const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId } = require('../middleware/validation');
const Joi = require('joi');

router.use(authMiddleware);

const contactSchemas = {
  create: Joi.object({
    customer_id: Joi.number().integer().positive().required(),
    name: Joi.string().max(50).required(),
    phone: Joi.string().max(30).allow(''),
    email: Joi.string().email().allow(''),
    position: Joi.string().max(100).allow(''),
    department: Joi.string().max(100).allow(''),
    is_primary: Joi.boolean().default(false),
    wechat: Joi.string().max(50).allow(''),
    notes: Joi.string().allow('')
  }),
  update: Joi.object({
    name: Joi.string().max(50),
    phone: Joi.string().max(30).allow(''),
    email: Joi.string().email().allow(''),
    position: Joi.string().max(100).allow(''),
    department: Joi.string().max(100).allow(''),
    is_primary: Joi.boolean(),
    wechat: Joi.string().max(50).allow(''),
    notes: Joi.string().allow('')
  })
};

/**
 * @route   GET /api/contacts
 * @desc    获取联系人列表
 */
router.get('/',
  permissionMiddleware('customers', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { customer_id, search, page = 1, pageSize = 20 } = req.query;
    const companyId = req.user.companyId;

    let whereClause = 'WHERE c.company_id = ?';
    const params = [companyId];

    if (customer_id) {
      whereClause += ' AND ct.customer_id = ?';
      params.push(customer_id);
    }

    if (search) {
      whereClause += ' AND (ct.name LIKE ? OR ct.phone LIKE ? OR ct.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total 
      FROM contacts ct
      JOIN customers c ON ct.customer_id = c.id
      ${whereClause}
    `).get(...params);

    const offset = (page - 1) * pageSize;
    const contacts = db.prepare(`
      SELECT ct.*, c.name as customer_name
      FROM contacts ct
      JOIN customers c ON ct.customer_id = c.id
      ${whereClause}
      ORDER BY ct.is_primary DESC, ct.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: contacts,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/contacts/:id
 * @desc    获取联系人详情
 */
router.get('/:id',
  permissionMiddleware('customers', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const contact = db.prepare(`
      SELECT ct.*, c.name as customer_name, c.company_id
      FROM contacts ct
      JOIN customers c ON ct.customer_id = c.id
      WHERE ct.id = ? AND c.company_id = ?
    `).get(req.params.id, req.user.companyId);

    if (!contact) {
      throw ErrorTypes.NotFound('联系人');
    }

    res.json({ success: true, data: contact });
  })
);

/**
 * @route   POST /api/contacts
 * @desc    创建联系人
 */
router.post('/',
  permissionMiddleware('customers', 'create'),
  validate(contactSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 验证客户存在
    const customer = db.prepare('SELECT id FROM customers WHERE id = ? AND company_id = ?').get(req.body.customer_id, companyId);
    if (!customer) {
      throw ErrorTypes.NotFound('客户');
    }

    // 如果设为主要联系人，取消该客户其他主要联系人
    if (req.body.is_primary) {
      db.prepare('UPDATE contacts SET is_primary = 0 WHERE customer_id = ?').run(req.body.customer_id);
    }

    const result = db.prepare(`
      INSERT INTO contacts (
        customer_id, name, phone, email, position, department, is_primary, wechat, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.body.customer_id, req.body.name, req.body.phone || null,
      req.body.email || null, req.body.position || null, req.body.department || null,
      req.body.is_primary ? 1 : 0, req.body.wechat || null, req.body.notes || null
    );

    const newContact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: newContact, message: '联系人创建成功' });
  })
);

/**
 * @route   PUT /api/contacts/:id
 * @desc    更新联系人
 */
router.put('/:id',
  permissionMiddleware('customers', 'update'),
  validateId('id'),
  validate(contactSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();

    const contact = db.prepare(`
      SELECT ct.*, c.company_id
      FROM contacts ct
      JOIN customers c ON ct.customer_id = c.id
      WHERE ct.id = ? AND c.company_id = ?
    `).get(id, req.user.companyId);

    if (!contact) {
      throw ErrorTypes.NotFound('联系人');
    }

    // 如果设为主要联系人，取消该客户其他主要联系人
    if (req.body.is_primary) {
      db.prepare('UPDATE contacts SET is_primary = 0 WHERE customer_id = ?').run(contact.customer_id);
    }

    const updates = [];
    const values = [];
    const allowedFields = ['name', 'phone', 'email', 'position', 'department', 'is_primary', 'wechat', 'notes'];

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(key === 'is_primary' ? (value ? 1 : 0) : value);
      }
    }

    if (updates.length === 0) {
      throw ErrorTypes.BadRequest('没有要更新的数据');
    }

    values.push(id);
    db.prepare(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ success: true, message: '联系人更新成功' });
  })
);

/**
 * @route   DELETE /api/contacts/:id
 * @desc    删除联系人
 */
router.delete('/:id',
  permissionMiddleware('customers', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const contact = db.prepare(`
      SELECT ct.id, c.company_id
      FROM contacts ct
      JOIN customers c ON ct.customer_id = c.id
      WHERE ct.id = ? AND c.company_id = ?
    `).get(req.params.id, req.user.companyId);

    if (!contact) {
      throw ErrorTypes.NotFound('联系人');
    }

    db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: '联系人已删除' });
  })
);

/**
 * @route   PUT /api/contacts/:id/set-primary
 * @desc    设置为主要联系人
 */
router.put('/:id/set-primary',
  permissionMiddleware('customers', 'update'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const contact = db.prepare(`
      SELECT ct.*, c.company_id
      FROM contacts ct
      JOIN customers c ON ct.customer_id = c.id
      WHERE ct.id = ? AND c.company_id = ?
    `).get(req.params.id, req.user.companyId);

    if (!contact) {
      throw ErrorTypes.NotFound('联系人');
    }

    // 取消该客户其他主要联系人
    db.prepare('UPDATE contacts SET is_primary = 0 WHERE customer_id = ?').run(contact.customer_id);
    // 设置当前联系人为主要联系人
    db.prepare('UPDATE contacts SET is_primary = 1 WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: '已设置为主要联系人' });
  })
);

module.exports = router;