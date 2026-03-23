const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema, contractSchemas } = require('../middleware/validation');
const { AuditLog } = require('../middleware/audit');

router.use(authMiddleware);

/**
 * 生成合同编号
 */
function generateContractNo(companyId) {
  const db = getDatabaseCompat();
  const today = dayjs().format('YYYYMM');
  const prefix = `CT${today}`;
  
  const result = db.prepare(`
    SELECT MAX(contract_no) as max_no 
    FROM contracts 
    WHERE company_id = ? AND contract_no LIKE ?
  `).get(companyId, `${prefix}%`);
  
  let seq = 1;
  if (result && result.max_no) {
    const lastSeq = parseInt(result.max_no.slice(-4));
    seq = lastSeq + 1;
  }
  
  return `${prefix}${seq.toString().padStart(4, '0')}`;
}

/**
 * @route   GET /api/contracts
 * @desc    获取合同列表
 */
router.get('/',
  permissionMiddleware('contracts', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, status, partnerId, startDate, endDate, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE c.company_id = ?';
    const params = [companyId];
    
    if (search) {
      whereClause += ' AND (c.contract_no LIKE ? OR c.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (status) {
      whereClause += ' AND c.status = ?';
      params.push(status);
    }
    
    if (partnerId) {
      whereClause += ' AND c.partner_id = ?';
      params.push(parseInt(partnerId));
    }
    
    if (startDate) {
      whereClause += ' AND c.sign_date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      whereClause += ' AND c.sign_date <= ?';
      params.push(endDate);
    }
    
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM contracts c ${whereClause}`).get(...params);
    
    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'contract_no', 'name', 'status', 'amount', 'sign_date', 'start_date', 'end_date', 'created_at', 'updated_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    const offset = (page - 1) * pageSize;
    const contracts = db.prepare(`
      SELECT c.*, p.name as partner_name, u.real_name as responsible_name
      FROM contracts c
      LEFT JOIN partners p ON c.partner_id = p.id
      LEFT JOIN users u ON c.responsible_user_id = u.id
      ${whereClause}
      ORDER BY c.${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    
    res.json({
      success: true,
      data: {
        list: contracts,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/contracts/stats
 * @desc    获取合同统计
 */
router.get('/stats',
  permissionMiddleware('contracts', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN status = 'terminated' THEN 1 ELSE 0 END) as terminated,
        SUM(CASE WHEN end_date BETWEEN date('now') AND date('now', '+30 days') THEN 1 ELSE 0 END) as expiring_soon,
        SUM(amount) as total_amount
      FROM contracts
      WHERE company_id = ?
    `).get(companyId);
    
    res.json({ success: true, data: stats });
  })
);

/**
 * @route   GET /api/contracts/:id
 * @desc    获取合同详情
 */
router.get('/:id',
  permissionMiddleware('contracts', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const contract = db.prepare(`
      SELECT c.*, p.name as partner_name, u.real_name as responsible_name
      FROM contracts c
      LEFT JOIN partners p ON c.partner_id = p.id
      LEFT JOIN users u ON c.responsible_user_id = u.id
      WHERE c.id = ? AND c.company_id = ?
    `).get(req.params.id, req.user.companyId);
    
    if (!contract) {
      throw ErrorTypes.NotFound('合同');
    }
    
    res.json({ success: true, data: contract });
  })
);

/**
 * @route   POST /api/contracts
 * @desc    创建合同
 */
router.post('/',
  permissionMiddleware('contracts', 'create'),
  validate(contractSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    // 检查用户是否有关联公司
    if (!companyId) {
      throw ErrorTypes.BadRequest('用户未关联公司，无法创建合同');
    }
    
    const { contract_no, partner_id, responsible_user_id, ...data } = req.body;
    
    // 验证 partner_id 外键约束（如果提供）
    if (partner_id) {
      const partner = db.prepare('SELECT id FROM partners WHERE id = ? AND company_id = ?').get(partner_id, companyId);
      if (!partner) {
        throw ErrorTypes.BadRequest('指定的合作伙伴不存在或不属于当前公司');
      }
    }
    
    // 验证 responsible_user_id 外键约束（如果提供）
    if (responsible_user_id) {
      const user = db.prepare('SELECT id FROM users WHERE id = ? AND company_id = ?').get(responsible_user_id, companyId);
      if (!user) {
        throw ErrorTypes.BadRequest('指定的负责人不存在或不属于当前公司');
      }
    }
    
    // 生成或验证合同编号
    let finalContractNo = contract_no;
    if (!finalContractNo || finalContractNo.trim() === '') {
      finalContractNo = generateContractNo(companyId);
    } else {
      // 检查合同编号是否已存在
      const existing = db.prepare('SELECT id FROM contracts WHERE company_id = ? AND contract_no = ?').get(companyId, finalContractNo);
      if (existing) {
        throw ErrorTypes.DuplicateEntry('合同编号');
      }
    }
    
    const result = db.prepare(`
      INSERT INTO contracts (
        company_id, contract_no, name, partner_id, contract_type, amount, currency,
        start_date, end_date, sign_date, responsible_user_id, payment_terms,
        terms_and_conditions, notes, created_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `).run(
      companyId, finalContractNo, data.name, partner_id || null, data.contract_type || null,
      data.amount, data.currency, data.start_date || null, data.end_date || null,
      data.sign_date || null, responsible_user_id || null, data.payment_terms || null,
      data.terms_and_conditions || null, data.notes || null, req.user.id
    );
    
    const newContract = db.prepare(`
      SELECT c.*, p.name as partner_name, u.real_name as responsible_name
      FROM contracts c
      LEFT JOIN partners p ON c.partner_id = p.id
      LEFT JOIN users u ON c.responsible_user_id = u.id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);
    
    // 记录审计日志
    AuditLog.create(req.user.id, AuditLog.MODULES.CONTRACTS, result.lastInsertRowid, newContract, req);
    
    res.status(201).json({ success: true, data: newContract, message: '合同创建成功' });
  })
);

/**
 * @route   PUT /api/contracts/:id
 * @desc    更新合同
 */
router.put('/:id',
  permissionMiddleware('contracts', 'update'),
  validateId('id'),
  validate(contractSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ? AND company_id = ?').get(id, companyId);
    if (!contract) {
      throw ErrorTypes.NotFound('合同');
    }
    
    const { partner_id, responsible_user_id } = req.body;
    
    // 验证 partner_id 外键约束（如果要更新）
    if (partner_id !== undefined && partner_id !== null) {
      const partner = db.prepare('SELECT id FROM partners WHERE id = ? AND company_id = ?').get(partner_id, companyId);
      if (!partner) {
        throw ErrorTypes.BadRequest('指定的合作伙伴不存在或不属于当前公司');
      }
    }
    
    // 验证 responsible_user_id 外键约束（如果要更新）
    if (responsible_user_id !== undefined && responsible_user_id !== null) {
      const user = db.prepare('SELECT id FROM users WHERE id = ? AND company_id = ?').get(responsible_user_id, companyId);
      if (!user) {
        throw ErrorTypes.BadRequest('指定的负责人不存在或不属于当前公司');
      }
    }
    
    const updates = [];
    const values = [];
    const allowedFields = ['name', 'partner_id', 'contract_type', 'amount', 'currency', 'start_date', 'end_date', 'sign_date', 'responsible_user_id', 'status', 'payment_terms', 'terms_and_conditions', 'notes'];
    
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
    db.prepare(`UPDATE contracts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    const updatedContract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id);
    
    // 记录审计日志
    AuditLog.update(req.user.id, AuditLog.MODULES.CONTRACTS, id, contract, updatedContract, req);
    
    res.json({ success: true, data: updatedContract, message: '合同更新成功' });
  })
);

/**
 * @route   DELETE /api/contracts/:id
 * @desc    删除合同
 */
router.delete('/:id',
  permissionMiddleware('contracts', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!contract) {
      throw ErrorTypes.NotFound('合同');
    }
    
    // 检查是否有关联订单
    const orders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE contract_id = ?').get(req.params.id);
    if (orders.count > 0) {
      throw ErrorTypes.BadRequest('合同下存在关联订单，无法删除');
    }
    
    db.prepare('DELETE FROM contracts WHERE id = ?').run(req.params.id);
    
    // 记录审计日志
    AuditLog.delete(req.user.id, AuditLog.MODULES.CONTRACTS, req.params.id, contract, req);
    
    res.json({ success: true, message: '合同已删除' });
  })
);

module.exports = router;