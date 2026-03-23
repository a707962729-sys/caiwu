const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const Joi = require('joi');

router.use(authMiddleware);

const partnerSchemas = {
  create: Joi.object({
    name: Joi.string().max(100).required(),
    type: Joi.string().valid('customer', 'supplier', 'both').required(),
    contact_person: Joi.string().max(50).allow(''),
    phone: Joi.string().max(30).allow(''),
    email: Joi.string().email().allow(''),
    address: Joi.string().allow(''),
    tax_id: Joi.string().max(50).allow(''),
    bank_name: Joi.string().max(100).allow(''),
    bank_account: Joi.string().max(50).allow(''),
    credit_limit: Joi.number().min(0).default(0),
    credit_period: Joi.number().integer().min(0).default(30),
    notes: Joi.string().allow('')
  }),
  update: Joi.object({
    name: Joi.string().max(100),
    type: Joi.string().valid('customer', 'supplier', 'both'),
    contact_person: Joi.string().max(50).allow(''),
    phone: Joi.string().max(30).allow(''),
    email: Joi.string().email().allow(''),
    address: Joi.string().allow(''),
    tax_id: Joi.string().max(50).allow(''),
    bank_name: Joi.string().max(100).allow(''),
    bank_account: Joi.string().max(50).allow(''),
    credit_limit: Joi.number().min(0),
    credit_period: Joi.number().integer().min(0),
    status: Joi.string().valid('active', 'inactive'),
    notes: Joi.string().allow('')
  })
};

/**
 * @route   GET /api/partners
 * @desc    获取客户/供应商列表
 */
router.get('/',
  permissionMiddleware('partners', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, type, status, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE company_id = ?';
    const params = [companyId];
    
    if (search) {
      whereClause += ' AND (name LIKE ? OR contact_person LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM partners ${whereClause}`).get(...params);
    
    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'name', 'type', 'status', 'credit_limit', 'credit_period', 'created_at', 'updated_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    const offset = (page - 1) * pageSize;
    const partners = db.prepare(`
      SELECT * FROM partners
      ${whereClause}
      ORDER BY ${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    
    res.json({
      success: true,
      data: {
        list: partners,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/partners/:id
 * @desc    获取客户/供应商详情
 */
router.get('/:id',
  permissionMiddleware('partners', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const partner = db.prepare('SELECT * FROM partners WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!partner) {
      throw ErrorTypes.NotFound('客户/供应商');
    }
    
    // 获取统计信息
    const stats = db.prepare(`
      SELECT 
        (SELECT SUM(total_amount) FROM contracts WHERE partner_id = ? AND company_id = ?) as total_contract_amount,
        (SELECT COUNT(*) FROM contracts WHERE partner_id = ? AND company_id = ?) as contract_count,
        (SELECT COUNT(*) FROM orders WHERE partner_id = ? AND company_id = ?) as order_count,
        (SELECT SUM(amount) FROM transactions WHERE partner_id = ? AND company_id = ? AND transaction_type = 'income') as total_income,
        (SELECT SUM(amount) FROM transactions WHERE partner_id = ? AND company_id = ? AND transaction_type = 'expense') as total_expense
    `).get(
      req.params.id, req.user.companyId,
      req.params.id, req.user.companyId,
      req.params.id, req.user.companyId,
      req.params.id, req.user.companyId,
      req.params.id, req.user.companyId
    );
    
    res.json({ success: true, data: { ...partner, stats } });
  })
);

/**
 * @route   POST /api/partners
 * @desc    创建客户/供应商
 */
router.post('/',
  permissionMiddleware('partners', 'create'),
  validate(partnerSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    // 检查名称是否重复
    const existing = db.prepare('SELECT id FROM partners WHERE company_id = ? AND name = ?').get(companyId, req.body.name);
    if (existing) {
      throw ErrorTypes.DuplicateEntry('客户/供应商名称');
    }
    
    const result = db.prepare(`
      INSERT INTO partners (
        company_id, name, type, contact_person, phone, email, address,
        tax_id, bank_name, bank_account, credit_limit, credit_period, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, req.body.name, req.body.type, req.body.contact_person || null,
      req.body.phone || null, req.body.email || null, req.body.address || null,
      req.body.tax_id || null, req.body.bank_name || null, req.body.bank_account || null,
      req.body.credit_limit || 0, req.body.credit_period || 30, req.body.notes || null
    );
    
    const newPartner = db.prepare('SELECT * FROM partners WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, data: newPartner, message: '客户/供应商创建成功' });
  })
);

/**
 * @route   PUT /api/partners/:id
 * @desc    更新客户/供应商
 */
router.put('/:id',
  permissionMiddleware('partners', 'update'),
  validateId('id'),
  validate(partnerSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    
    const partner = db.prepare('SELECT * FROM partners WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
    if (!partner) {
      throw ErrorTypes.NotFound('客户/供应商');
    }
    
    const updates = [];
    const values = [];
    const allowedFields = ['name', 'type', 'contact_person', 'phone', 'email', 'address', 'tax_id', 'bank_name', 'bank_account', 'credit_limit', 'credit_period', 'status', 'notes'];
    
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
    db.prepare(`UPDATE partners SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    res.json({ success: true, message: '客户/供应商更新成功' });
  })
);

/**
 * @route   DELETE /api/partners/:id
 * @desc    删除客户/供应商
 */
router.delete('/:id',
  permissionMiddleware('partners', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const partner = db.prepare('SELECT * FROM partners WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!partner) {
      throw ErrorTypes.NotFound('客户/供应商');
    }
    
    // 检查是否有关联合同或订单
    const contracts = db.prepare('SELECT COUNT(*) as count FROM contracts WHERE partner_id = ?').get(req.params.id);
    const orders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE partner_id = ?').get(req.params.id);
    
    if (contracts.count > 0 || orders.count > 0) {
      throw ErrorTypes.BadRequest('该客户/供应商下存在关联合同或订单，无法删除');
    }
    
    db.prepare('DELETE FROM partners WHERE id = ?').run(req.params.id);
    
    res.json({ success: true, message: '客户/供应商已删除' });
  })
);

module.exports = router;