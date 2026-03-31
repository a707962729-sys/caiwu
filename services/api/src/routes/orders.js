const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema, orderSchemas } = require('../middleware/validation');

router.use(authMiddleware);

function generateOrderNo(companyId) {
  const db = getDatabaseCompat();
  const today = dayjs().format('YYYYMMDD');
  const prefix = `ORD${today}`;
  
  const result = db.prepare(`
    SELECT MAX(order_no) as max_no 
    FROM orders 
    WHERE company_id = ? AND order_no LIKE ?
  `).get(companyId, `${prefix}%`);
  
  let seq = 1;
  if (result && result.max_no) {
    const lastSeq = parseInt(result.max_no.slice(-4));
    seq = lastSeq + 1;
  }
  
  return `${prefix}${seq.toString().padStart(4, '0')}`;
}

/**
 * @route   GET /api/orders
 * @desc    获取订单列表
 */
router.get('/',
  permissionMiddleware('orders', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, status, partnerId, contractId, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE o.company_id = ?';
    const params = [companyId];
    
    if (search) {
      whereClause += ' AND (o.order_no LIKE ? OR o.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (status) {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }
    
    if (partnerId) {
      whereClause += ' AND o.partner_id = ?';
      params.push(parseInt(partnerId));
    }
    
    if (contractId) {
      whereClause += ' AND o.contract_id = ?';
      params.push(parseInt(contractId));
    }
    
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM orders o ${whereClause}`).get(...params);
    
    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'order_no', 'name', 'status', 'amount', 'total_amount', 'created_at', 'updated_at', 'start_date', 'end_date'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    const offset = (page - 1) * pageSize;
    const orders = db.prepare(`
      SELECT o.*, p.name as partner_name, c.name as contract_name, u.real_name as responsible_name
      FROM orders o
      LEFT JOIN partners p ON o.partner_id = p.id
      LEFT JOIN contracts c ON o.contract_id = c.id
      LEFT JOIN users u ON o.responsible_user_id = u.id
      ${whereClause}
      ORDER BY o.${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    
    res.json({
      success: true,
      data: {
        list: orders,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/orders/:id
 * @desc    获取订单详情
 */
router.get('/:id',
  permissionMiddleware('orders', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const order = db.prepare(`
      SELECT o.*, p.name as partner_name, c.name as contract_name, u.real_name as responsible_name
      FROM orders o
      LEFT JOIN partners p ON o.partner_id = p.id
      LEFT JOIN contracts c ON o.contract_id = c.id
      LEFT JOIN users u ON o.responsible_user_id = u.id
      WHERE o.id = ? AND o.company_id = ?
    `).get(req.params.id, req.user.companyId);
    
    if (!order) {
      throw ErrorTypes.NotFound('订单');
    }
    
    res.json({ success: true, data: order });
  })
);

/**
 * @route   POST /api/orders
 * @desc    创建订单
 */
router.post('/',
  permissionMiddleware('orders', 'create'),
  validate(orderSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    let { order_no, ...data } = req.body;
    if (!order_no) {
      order_no = generateOrderNo(companyId);
    }
    
    const existing = db.prepare('SELECT id FROM orders WHERE company_id = ? AND order_no = ?').get(companyId, order_no);
    if (existing) {
      throw ErrorTypes.DuplicateEntry('订单编号');
    }
    
    const totalAmount = data.amount + (data.tax_amount || 0);
    
    const result = db.prepare(`
      INSERT INTO orders (
        company_id, order_no, name, contract_id, type, partner_id,
        total_amount, responsible_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, order_no, data.name, data.contract_id || null, data.order_type || null,
      data.partner_id || null, totalAmount, data.responsible_user_id || null
    );
    
    const newOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, data: newOrder, message: '订单创建成功' });
  })
);

/**
 * @route   PUT /api/orders/:id
 * @desc    更新订单
 */
router.put('/:id',
  permissionMiddleware('orders', 'update'),
  validateId('id'),
  validate(orderSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
    if (!order) {
      throw ErrorTypes.NotFound('订单');
    }
    
    const updates = [];
    const values = [];
    const allowedFields = ['name', 'contract_id', 'type', 'partner_id', 'total_amount', 'currency', 'start_date', 'end_date', 'responsible_user_id', 'status', 'progress', 'description', 'notes'];
    
    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    // 重新计算总价
    if (req.body.total_amount !== undefined) {
      updates.push('total_amount = ?');
      values.push(req.body.total_amount);
    }
    
    if (updates.length === 0) {
      throw ErrorTypes.BadRequest('没有要更新的数据');
    }
    
    values.push(id);
    db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    res.json({ success: true, message: '订单更新成功' });
  })
);

/**
 * @route   DELETE /api/orders/:id
 * @desc    删除订单
 */
router.delete('/:id',
  permissionMiddleware('orders', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!order) {
      throw ErrorTypes.NotFound('订单');
    }
    
    db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
    
    res.json({ success: true, message: '订单已删除' });
  })
);

module.exports = router;