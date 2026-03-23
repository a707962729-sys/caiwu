const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const Joi = require('joi');

router.use(authMiddleware);

const supplierSchemas = {
  create: Joi.object({
    name: Joi.string().max(100).required(),
    contact: Joi.string().max(50).allow(''),
    phone: Joi.string().max(30).allow(''),
    email: Joi.string().email().allow(''),
    address: Joi.string().allow(''),
    tax_id: Joi.string().max(50).allow(''),
    bank_name: Joi.string().max(100).allow(''),
    bank_account: Joi.string().max(50).allow(''),
    level: Joi.string().valid('premium', 'normal', 'probation', 'blacklist').default('normal'),
    credit_limit: Joi.number().min(0).default(0),
    credit_period: Joi.number().integer().min(0).default(30),
    payment_terms: Joi.string().allow(''),
    delivery_terms: Joi.string().allow(''),
    notes: Joi.string().allow('')
  }),
  update: Joi.object({
    name: Joi.string().max(100),
    contact: Joi.string().max(50).allow(''),
    phone: Joi.string().max(30).allow(''),
    email: Joi.string().email().allow(''),
    address: Joi.string().allow(''),
    tax_id: Joi.string().max(50).allow(''),
    bank_name: Joi.string().max(100).allow(''),
    bank_account: Joi.string().max(50).allow(''),
    level: Joi.string().valid('premium', 'normal', 'probation', 'blacklist'),
    credit_limit: Joi.number().min(0),
    credit_period: Joi.number().integer().min(0),
    payment_terms: Joi.string().allow(''),
    delivery_terms: Joi.string().allow(''),
    status: Joi.string().valid('active', 'inactive'),
    notes: Joi.string().allow('')
  })
};

/**
 * @route   GET /api/suppliers
 * @desc    获取供应商列表
 */
router.get('/',
  permissionMiddleware('suppliers', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, level, status, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE company_id = ?';
    const params = [companyId];
    
    if (search) {
      whereClause += ' AND (name LIKE ? OR contact LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (level) {
      whereClause += ' AND level = ?';
      params.push(level);
    }
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM suppliers ${whereClause}`).get(...params);
    
    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'name', 'level', 'status', 'credit_limit', 'credit_period', 'created_at', 'updated_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    const offset = (page - 1) * pageSize;
    const suppliers = db.prepare(`
      SELECT * FROM suppliers
      ${whereClause}
      ORDER BY ${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    
    res.json({
      success: true,
      data: {
        list: suppliers,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/suppliers/:id
 * @desc    获取供应商详情
 */
router.get('/:id',
  permissionMiddleware('suppliers', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!supplier) {
      throw ErrorTypes.NotFound('供应商');
    }
    
    // 获取统计信息
    const stats = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = ? AND company_id = ?) as order_count,
        (SELECT SUM(final_amount) FROM purchase_orders WHERE supplier_id = ? AND company_id = ?) as total_order_amount,
        (SELECT SUM(paid_amount) FROM purchase_orders WHERE supplier_id = ? AND company_id = ?) as total_paid_amount
    `).get(
      req.params.id, req.user.companyId,
      req.params.id, req.user.companyId,
      req.params.id, req.user.companyId
    );
    
    res.json({ success: true, data: { ...supplier, stats } });
  })
);

/**
 * @route   POST /api/suppliers
 * @desc    创建供应商
 */
router.post('/',
  permissionMiddleware('suppliers', 'create'),
  validate(supplierSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    // 检查名称是否重复
    const existing = db.prepare('SELECT id FROM suppliers WHERE company_id = ? AND name = ?').get(companyId, req.body.name);
    if (existing) {
      throw ErrorTypes.DuplicateEntry('供应商名称');
    }
    
    const result = db.prepare(`
      INSERT INTO suppliers (
        company_id, name, contact, phone, email, address,
        tax_id, bank_name, bank_account, level, credit_limit, credit_period,
        payment_terms, delivery_terms, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, req.body.name, req.body.contact || null, req.body.phone || null, 
      req.body.email || null, req.body.address || null,
      req.body.tax_id || null, req.body.bank_name || null, req.body.bank_account || null,
      req.body.level || 'normal', req.body.credit_limit || 0, req.body.credit_period || 30,
      req.body.payment_terms || null, req.body.delivery_terms || null, req.body.notes || null,
      req.user.id
    );
    
    const newSupplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, data: newSupplier, message: '供应商创建成功' });
  })
);

/**
 * @route   PUT /api/suppliers/:id
 * @desc    更新供应商
 */
router.put('/:id',
  permissionMiddleware('suppliers', 'update'),
  validateId('id'),
  validate(supplierSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
    if (!supplier) {
      throw ErrorTypes.NotFound('供应商');
    }
    
    const updates = [];
    const values = [];
    const allowedFields = ['name', 'contact', 'phone', 'email', 'address', 'tax_id', 'bank_name', 
                           'bank_account', 'level', 'credit_limit', 'credit_period', 
                           'payment_terms', 'delivery_terms', 'status', 'notes'];
    
    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (updates.length === 0) {
      throw ErrorTypes.BadRequest('没有要更新的数据');
    }
    
    values.push(id);
    db.prepare(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    res.json({ success: true, message: '供应商更新成功' });
  })
);

/**
 * @route   DELETE /api/suppliers/:id
 * @desc    删除供应商
 */
router.delete('/:id',
  permissionMiddleware('suppliers', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!supplier) {
      throw ErrorTypes.NotFound('供应商');
    }
    
    // 检查是否有关联采购订单
    const orders = db.prepare('SELECT COUNT(*) as count FROM purchase_orders WHERE supplier_id = ?').get(req.params.id);
    
    if (orders.count > 0) {
      throw ErrorTypes.BadRequest('该供应商下存在关联采购订单，无法删除');
    }
    
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
    
    res.json({ success: true, message: '供应商已删除' });
  })
);

/**
 * @route   GET /api/suppliers/:id/orders
 * @desc    获取供应商的采购订单列表
 */
router.get('/:id/orders',
  permissionMiddleware('suppliers', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, status } = req.query;
    
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!supplier) {
      throw ErrorTypes.NotFound('供应商');
    }
    
    let whereClause = 'WHERE supplier_id = ? AND company_id = ?';
    const params = [req.params.id, req.user.companyId];
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM purchase_orders ${whereClause}`).get(...params);
    
    const offset = (page - 1) * pageSize;
    const orders = db.prepare(`
      SELECT * FROM purchase_orders
      ${whereClause}
      ORDER BY created_at DESC
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

module.exports = router;