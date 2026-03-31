const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const Joi = require('joi');

router.use(authMiddleware);

const customerSchemas = {
  create: Joi.object({
    name: Joi.string().max(100).required(),
    type: Joi.string().valid('prospect', 'lead', 'customer', 'vip', 'churned').default('prospect'),
    level: Joi.string().valid('normal', 'silver', 'gold', 'platinum').default('normal'),
    source: Joi.string().max(50).allow(''),
    owner_id: Joi.number().integer().positive().allow(null),
    industry: Joi.string().max(100).allow(''),
    scale: Joi.string().max(50).allow(''),
    address: Joi.string().allow(''),
    website: Joi.string().max(255).allow(''),
    phone: Joi.string().max(30).allow(''),
    email: Joi.string().email().allow(''),
    notes: Joi.string().allow('')
  }),
  update: Joi.object({
    name: Joi.string().max(100),
    type: Joi.string().valid('prospect', 'lead', 'customer', 'vip', 'churned'),
    level: Joi.string().valid('normal', 'silver', 'gold', 'platinum'),
    source: Joi.string().max(50).allow(''),
    owner_id: Joi.number().integer().positive().allow(null),
    industry: Joi.string().max(100).allow(''),
    scale: Joi.string().max(50).allow(''),
    address: Joi.string().allow(''),
    website: Joi.string().max(255).allow(''),
    phone: Joi.string().max(30).allow(''),
    email: Joi.string().email().allow(''),
    status: Joi.string().valid('active', 'inactive', 'archived'),
    notes: Joi.string().allow('')
  })
};

/**
 * @route   GET /api/customers
 * @desc    获取客户列表
 */
router.get('/',
  permissionMiddleware('customers', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, type, level, status, owner_id, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;

    let whereClause = 'WHERE company_id = ?';
    const params = [companyId];

    if (search) {
      whereClause += ' AND (name LIKE ? OR tax_id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM customers ${whereClause}`).get(...params);

    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'name', 'status', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const offset = (page - 1) * pageSize;
    const customers = db.prepare(`
      SELECT *
      FROM customers
      ${whereClause}
      ORDER BY ${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: customers,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/customers/stats
 * @desc    获取客户统计
 */
router.get('/stats',
  permissionMiddleware('customers', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive
      FROM customers
      WHERE company_id = ?
    `).get(companyId);
    
    res.json({ success: true, data: stats });
  })
);

/**
 * @route   GET /api/customers/:id
 * @desc    获取客户详情
 */
router.get('/:id',
  permissionMiddleware('customers', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const customer = db.prepare(`
      SELECT *
      FROM customers
      WHERE id = ? AND company_id = ?
    `).get(req.params.id, req.user.companyId);

    if (!customer) {
      throw ErrorTypes.NotFound('客户');
    }

    // 获取联系人列表
    const contacts = db.prepare('SELECT * FROM contacts WHERE customer_id = ?').get(req.params.id);

    // 获取商机统计
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as opportunity_count,
        SUM(CASE WHEN stage = 'closed_won' THEN 1 ELSE 0 END) as won_count,
        SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as total_amount
      FROM opportunities 
      WHERE customer_id = ?
    `).get(req.params.id);

    // 获取最近跟进记录
    const recentFollows = db.prepare(`
      SELECT * FROM follow_records 
      WHERE customer_id = ? 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all(req.params.id);

    res.json({
      success: true,
      data: {
        ...customer,
        contacts: contacts ? [contacts] : [],
        stats,
        recentFollows
      }
    });
  })
);

/**
 * @route   POST /api/customers
 * @desc    创建客户
 */
router.post('/',
  permissionMiddleware('customers', 'create'),
  validate(customerSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 检查名称是否重复
    const existing = db.prepare('SELECT id FROM customers WHERE company_id = ? AND name = ?').get(companyId, req.body.name);
    if (existing) {
      throw ErrorTypes.DuplicateEntry('客户名称');
    }

    const result = db.prepare(`
      INSERT INTO customers (
        company_id, name, type, level, source, owner_id, industry, scale,
        address, website, phone, email, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, req.body.name, req.body.type, req.body.level, req.body.source || null,
      req.body.owner_id || null, req.body.industry || null, req.body.scale || null,
      req.body.address || null, req.body.website || null, req.body.phone || null,
      req.body.email || null, req.body.notes || null, req.user.id
    );

    const newCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: newCustomer, message: '客户创建成功' });
  })
);

/**
 * @route   PUT /api/customers/:id
 * @desc    更新客户
 */
router.put('/:id',
  permissionMiddleware('customers', 'update'),
  validateId('id'),
  validate(customerSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();

    const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
    if (!customer) {
      throw ErrorTypes.NotFound('客户');
    }

    const updates = [];
    const values = [];
    const allowedFields = ['name', 'type', 'level', 'source', 'owner_id', 'industry', 'scale', 'address', 'website', 'phone', 'email', 'status', 'notes'];

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
    db.prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ success: true, message: '客户更新成功' });
  })
);

/**
 * @route   DELETE /api/customers/:id
 * @desc    删除客户
 */
router.delete('/:id',
  permissionMiddleware('customers', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!customer) {
      throw ErrorTypes.NotFound('客户');
    }

    // 检查是否有关联商机
    const opportunities = db.prepare('SELECT COUNT(*) as count FROM opportunities WHERE customer_id = ?').get(req.params.id);
    if (opportunities.count > 0) {
      throw ErrorTypes.BadRequest('该客户下存在关联商机，无法删除');
    }

    // 删除相关联系人和跟进记录
    db.prepare('DELETE FROM contacts WHERE customer_id = ?').run(req.params.id);
    db.prepare('DELETE FROM follow_records WHERE customer_id = ?').run(req.params.id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: '客户已删除' });
  })
);

/**
 * @route   GET /api/customers/:id/contacts
 * @desc    获取客户的联系人列表
 */
router.get('/:id/contacts',
  permissionMiddleware('customers', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const customer = db.prepare('SELECT id FROM customers WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!customer) {
      throw ErrorTypes.NotFound('客户');
    }

    const contacts = db.prepare('SELECT * FROM contacts WHERE customer_id = ? ORDER BY is_primary DESC, created_at DESC').all(req.params.id);

    res.json({ success: true, data: contacts });
  })
);

/**
 * @route   GET /api/customers/:id/opportunities
 * @desc    获取客户的商机列表
 */
router.get('/:id/opportunities',
  permissionMiddleware('customers', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const customer = db.prepare('SELECT id FROM customers WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!customer) {
      throw ErrorTypes.NotFound('客户');
    }

    const opportunities = db.prepare(`
      SELECT o.*, u.real_name as owner_name
      FROM opportunities o
      LEFT JOIN users u ON o.owner_id = u.id
      WHERE o.customer_id = ?
      ORDER BY created_at DESC
    `).all(req.params.id);

    res.json({ success: true, data: opportunities });
  })
);

/**
 * @route   GET /api/customers/:id/follow-records
 * @desc    获取客户的跟进记录
 */
router.get('/:id/follow-records',
  permissionMiddleware('customers', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const customer = db.prepare('SELECT id FROM customers WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!customer) {
      throw ErrorTypes.NotFound('客户');
    }

    const records = db.prepare(`
      SELECT fr.*, u.real_name as created_by_name
      FROM follow_records fr
      LEFT JOIN users u ON fr.created_by = u.id
      WHERE fr.customer_id = ?
      ORDER BY created_at DESC
    `).all(req.params.id);

    res.json({ success: true, data: records });
  })
);

module.exports = router;