const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const Joi = require('joi');

router.use(authMiddleware);

const followRecordSchemas = {
  create: Joi.object({
    customer_id: Joi.number().integer().positive().required(),
    content: Joi.string().required(),
    next_date: Joi.date().allow(null),
    next_action: Joi.string().max(200).allow(''),
    follow_type: Joi.string().valid('phone', 'visit', 'email', 'wechat', 'other').default('phone')
  }),
  update: Joi.object({
    content: Joi.string(),
    next_date: Joi.date().allow(null),
    next_action: Joi.string().max(200).allow(''),
    follow_type: Joi.string().valid('phone', 'visit', 'email', 'wechat', 'other')
  })
};

/**
 * @route   GET /api/follow-records
 * @desc    获取跟进记录列表
 */
router.get('/',
  permissionMiddleware('customers', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, customer_id, user_id, follow_type, start_date, end_date } = req.query;
    const companyId = req.user.companyId;

    let whereClause = 'WHERE c.company_id = ?';
    const params = [companyId];

    if (customer_id) {
      whereClause += ' AND fr.customer_id = ?';
      params.push(customer_id);
    }

    if (user_id) {
      whereClause += ' AND fr.user_id = ?';
      params.push(user_id);
    }

    if (follow_type) {
      whereClause += ' AND fr.follow_type = ?';
      params.push(follow_type);
    }

    if (start_date) {
      whereClause += ' AND date(fr.created_at) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND date(fr.created_at) <= ?';
      params.push(end_date);
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total 
      FROM follow_records fr
      JOIN customers c ON fr.customer_id = c.id
      ${whereClause}
    `).get(...params);

    const offset = (page - 1) * pageSize;
    const records = db.prepare(`
      SELECT fr.*, c.name as customer_name, u.real_name as user_name
      FROM follow_records fr
      JOIN customers c ON fr.customer_id = c.id
      LEFT JOIN users u ON fr.user_id = u.id
      ${whereClause}
      ORDER BY fr.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: records,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/follow-records/today
 * @desc    获取今日待跟进客户
 */
router.get('/today',
  permissionMiddleware('customers', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const today = new Date().toISOString().split('T')[0];

    const records = db.prepare(`
      SELECT fr.*, c.name as customer_name, c.level as customer_level
      FROM follow_records fr
      JOIN customers c ON fr.customer_id = c.id
      WHERE c.company_id = ? AND date(fr.next_date) = ?
      ORDER BY fr.next_date ASC
    `).all(companyId, today);

    res.json({ success: true, data: records });
  })
);

/**
 * @route   GET /api/follow-records/overdue
 * @desc    获取逾期未跟进客户
 */
router.get('/overdue',
  permissionMiddleware('customers', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const today = new Date().toISOString().split('T')[0];

    const records = db.prepare(`
      SELECT fr.*, c.name as customer_name, c.level as customer_level
      FROM follow_records fr
      JOIN customers c ON fr.customer_id = c.id
      WHERE c.company_id = ? AND date(fr.next_date) < ? AND fr.next_date IS NOT NULL
      ORDER BY fr.next_date ASC
    `).all(companyId, today);

    res.json({ success: true, data: records });
  })
);

/**
 * @route   GET /api/follow-records/:id
 * @desc    获取跟进记录详情
 */
router.get('/:id',
  permissionMiddleware('customers', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const record = db.prepare(`
      SELECT fr.*, c.name as customer_name, u.real_name as user_name
      FROM follow_records fr
      JOIN customers c ON fr.customer_id = c.id
      LEFT JOIN users u ON fr.user_id = u.id
      WHERE fr.id = ? AND c.company_id = ?
    `).get(req.params.id, req.user.companyId);

    if (!record) {
      throw ErrorTypes.NotFound('跟进记录');
    }

    res.json({ success: true, data: record });
  })
);

/**
 * @route   POST /api/follow-records
 * @desc    创建跟进记录
 */
router.post('/',
  permissionMiddleware('customers', 'create'),
  validate(followRecordSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 验证客户存在
    const customer = db.prepare('SELECT id FROM customers WHERE id = ? AND company_id = ?').get(req.body.customer_id, companyId);
    if (!customer) {
      throw ErrorTypes.NotFound('客户');
    }

    const result = db.prepare(`
      INSERT INTO follow_records (
        customer_id, user_id, content, next_date, next_action, follow_type
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.body.customer_id, req.user.id, req.body.content,
      req.body.next_date || null, req.body.next_action || null,
      req.body.follow_type || 'phone'
    );

    const newRecord = db.prepare(`
      SELECT fr.*, c.name as customer_name, u.real_name as user_name
      FROM follow_records fr
      JOIN customers c ON fr.customer_id = c.id
      LEFT JOIN users u ON fr.user_id = u.id
      WHERE fr.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: newRecord, message: '跟进记录创建成功' });
  })
);

/**
 * @route   PUT /api/follow-records/:id
 * @desc    更新跟进记录
 */
router.put('/:id',
  permissionMiddleware('customers', 'update'),
  validateId('id'),
  validate(followRecordSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();

    const record = db.prepare(`
      SELECT fr.*, c.company_id
      FROM follow_records fr
      JOIN customers c ON fr.customer_id = c.id
      WHERE fr.id = ? AND c.company_id = ?
    `).get(id, req.user.companyId);

    if (!record) {
      throw ErrorTypes.NotFound('跟进记录');
    }

    const updates = [];
    const values = [];
    const allowedFields = ['content', 'next_date', 'next_action', 'follow_type'];

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
    db.prepare(`UPDATE follow_records SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ success: true, message: '跟进记录更新成功' });
  })
);

/**
 * @route   DELETE /api/follow-records/:id
 * @desc    删除跟进记录
 */
router.delete('/:id',
  permissionMiddleware('customers', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const record = db.prepare(`
      SELECT fr.id, c.company_id
      FROM follow_records fr
      JOIN customers c ON fr.customer_id = c.id
      WHERE fr.id = ? AND c.company_id = ?
    `).get(req.params.id, req.user.companyId);

    if (!record) {
      throw ErrorTypes.NotFound('跟进记录');
    }

    db.prepare('DELETE FROM follow_records WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: '跟进记录已删除' });
  })
);

module.exports = router;