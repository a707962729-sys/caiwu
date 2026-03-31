const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const Joi = require('joi');

router.use(authMiddleware);

const subjectSchemas = {
  create: Joi.object({
    subject_code: Joi.string().max(50).required(),
    subject_name: Joi.string().max(100).required(),
    subject_type: Joi.string().valid('asset', 'liability', 'equity', 'income', 'expense').required(),
    subject_category: Joi.string().max(50).allow(''),
    parent_id: Joi.number().integer().positive().allow(null),
    level: Joi.number().integer().min(1).max(4).default(1),
    direction: Joi.string().valid('debit', 'credit').default('debit'),
    is_leaf: Joi.boolean().default(true),
    is_enabled: Joi.boolean().default(true),
    description: Joi.string().allow('')
  }),
  update: Joi.object({
    subject_name: Joi.string().max(100),
    subject_type: Joi.string().valid('asset', 'liability', 'equity', 'income', 'expense'),
    subject_category: Joi.string().max(50).allow(''),
    parent_id: Joi.number().integer().positive().allow(null),
    level: Joi.number().integer().min(1).max(4),
    direction: Joi.string().valid('debit', 'credit'),
    is_leaf: Joi.boolean(),
    is_enabled: Joi.boolean(),
    description: Joi.string().allow('')
  })
};

// 科目类型映射
const subjectTypeNames = {
  asset: '资产',
  liability: '负债',
  equity: '所有者权益',
  income: '收入',
  expense: '费用'
};

/**
 * @route   GET /api/subjects
 * @desc    获取会计科目列表
 */
router.get('/',
  permissionMiddleware('subjects', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 100, search, subject_type, parent_id, is_enabled, sortBy = 'subject_code', sortOrder = 'asc' } = req.query;
    const companyId = req.user.companyId;

    let whereClause = 'WHERE s.company_id = ?';
    const params = [companyId];

    if (search) {
      whereClause += ' AND (s.subject_code LIKE ? OR s.subject_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (subject_type) {
      whereClause += ' AND s.subject_type = ?';
      params.push(subject_type);
    }

    if (parent_id !== undefined && parent_id !== '') {
      if (parent_id === 'null' || parent_id === null) {
        whereClause += ' AND s.parent_id IS NULL';
      } else {
        whereClause += ' AND s.parent_id = ?';
        params.push(parent_id);
      }
    }

    if (is_enabled !== undefined) {
      whereClause += ' AND s.is_enabled = ?';
      params.push(is_enabled === 'true' || is_enabled === true ? 1 : 0);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM accounting_subjects s ${whereClause}`).get(...params);

    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'subject_code', 'subject_name', 'subject_type', 'level', 'direction', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'subject_code';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const offset = (page - 1) * pageSize;
    const subjects = db.prepare(`
      SELECT s.*, p.subject_name as parent_name
      FROM accounting_subjects s
      LEFT JOIN accounting_subjects p ON s.parent_id = p.id
      ${whereClause}
      ORDER BY ${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: subjects,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/subjects/tree
 * @desc    获取会计科目树形结构
 */
router.get('/tree',
  permissionMiddleware('subjects', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { subject_type } = req.query;

    let whereClause = 'WHERE company_id = ?';
    const params = [companyId];

    if (subject_type) {
      whereClause += ' AND subject_type = ?';
      params.push(subject_type);
    }

    const subjects = db.prepare(`
      SELECT * FROM accounting_subjects
      ${whereClause}
      ORDER BY subject_code ASC
    `).all(...params);

    // 构建树形结构
    const subjectMap = {};
    const tree = [];

    subjects.forEach(subject => {
      subjectMap[subject.id] = { ...subject, children: [] };
    });

    subjects.forEach(subject => {
      const node = subjectMap[subject.id];
      if (subject.parent_id && subjectMap[subject.parent_id]) {
        subjectMap[subject.parent_id].children.push(node);
      } else {
        tree.push(node);
      }
    });

    res.json({ success: true, data: tree });
  })
);

/**
 * @route   GET /api/subjects/:id
 * @desc    获取会计科目详情
 */
router.get('/:id',
  permissionMiddleware('subjects', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const subject = db.prepare(`
      SELECT s.*, p.subject_name as parent_name
      FROM accounting_subjects s
      LEFT JOIN accounting_subjects p ON s.parent_id = p.id
      WHERE s.id = ? AND s.company_id = ?
    `).get(req.params.id, req.user.companyId);

    if (!subject) {
      throw ErrorTypes.NotFound('会计科目');
    }

    // 获取子科目
    const children = db.prepare(`
      SELECT * FROM accounting_subjects
      WHERE parent_id = ? AND company_id = ?
      ORDER BY subject_code ASC
    `).all(req.params.id, req.user.companyId);

    // 获取科目余额变动记录
    const balanceLogs = db.prepare(`
      SELECT ve.*, v.voucher_no, v.voucher_date
      FROM voucher_entries ve
      JOIN vouchers v ON ve.voucher_id = v.id
      WHERE ve.subject_id = ? AND v.company_id = ? AND v.status = 'posted'
      ORDER BY v.voucher_date DESC
      LIMIT 10
    `).all(req.params.id, req.user.companyId);

    res.json({
      success: true,
      data: {
        ...subject,
        children,
        balanceLogs
      }
    });
  })
);

/**
 * @route   POST /api/subjects
 * @desc    创建会计科目
 */
router.post('/',
  permissionMiddleware('subjects', 'create'),
  validate(subjectSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 检查编码是否重复
    const existing = db.prepare('SELECT id FROM accounting_subjects WHERE company_id = ? AND subject_code = ?').get(companyId, req.body.subject_code);
    if (existing) {
      throw ErrorTypes.DuplicateEntry('科目编码');
    }

    // 检查名称是否重复
    const existingName = db.prepare('SELECT id FROM accounting_subjects WHERE company_id = ? AND subject_name = ?').get(companyId, req.body.subject_name);
    if (existingName) {
      throw ErrorTypes.DuplicateEntry('科目名称');
    }

    // 如果有父级科目，验证父级科目存在且更新其is_leaf状态
    if (req.body.parent_id) {
      const parent = db.prepare('SELECT * FROM accounting_subjects WHERE id = ? AND company_id = ?').get(req.body.parent_id, companyId);
      if (!parent) {
        throw ErrorTypes.NotFound('父级科目');
      }
      // 更新父级科目为非末级
      db.prepare('UPDATE accounting_subjects SET is_leaf = 0 WHERE id = ?').run(req.body.parent_id);
    }

    const result = db.prepare(`
      INSERT INTO accounting_subjects (
        company_id, subject_code, subject_name, subject_type, subject_category,
        parent_id, level, direction, is_leaf, is_enabled, description, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, req.body.subject_code, req.body.subject_name, req.body.subject_type,
      req.body.subject_category || null, req.body.parent_id || null, req.body.level,
      req.body.direction, req.body.is_leaf ? 1 : 0, req.body.is_enabled ? 1 : 0,
      req.body.description || null, req.user.id
    );

    const newSubject = db.prepare('SELECT * FROM accounting_subjects WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: newSubject, message: '会计科目创建成功' });
  })
);

/**
 * @route   PUT /api/subjects/:id
 * @desc    更新会计科目
 */
router.put('/:id',
  permissionMiddleware('subjects', 'update'),
  validateId('id'),
  validate(subjectSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();

    const subject = db.prepare('SELECT * FROM accounting_subjects WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
    if (!subject) {
      throw ErrorTypes.NotFound('会计科目');
    }

    // 如果修改了科目名称，检查是否重复
    if (req.body.subject_name && req.body.subject_name !== subject.subject_name) {
      const existing = db.prepare('SELECT id FROM accounting_subjects WHERE company_id = ? AND subject_name = ? AND id != ?').get(req.user.companyId, req.body.subject_name, id);
      if (existing) {
        throw ErrorTypes.DuplicateEntry('科目名称');
      }
    }

    const updates = [];
    const values = [];
    const allowedFields = ['subject_name', 'subject_type', 'subject_category', 'parent_id', 'level', 'direction', 'is_leaf', 'is_enabled', 'description'];

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        if (key === 'is_leaf' || key === 'is_enabled') {
          updates.push(`${key} = ?`);
          values.push(value ? 1 : 0);
        } else {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }
    }

    if (updates.length === 0) {
      throw ErrorTypes.BadRequest('没有要更新的数据');
    }

    values.push(id);
    db.prepare(`UPDATE accounting_subjects SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ success: true, message: '会计科目更新成功' });
  })
);

/**
 * @route   DELETE /api/subjects/:id
 * @desc    删除会计科目
 */
router.delete('/:id',
  permissionMiddleware('subjects', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const subject = db.prepare('SELECT * FROM accounting_subjects WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!subject) {
      throw ErrorTypes.NotFound('会计科目');
    }

    // 检查是否有子科目
    const children = db.prepare('SELECT COUNT(*) as count FROM accounting_subjects WHERE parent_id = ?').get(req.params.id);
    if (children.count > 0) {
      throw ErrorTypes.BadRequest('该科目下存在子科目，无法删除');
    }

    // 检查是否有关联的凭证分录
    const entries = db.prepare('SELECT COUNT(*) as count FROM voucher_entries WHERE subject_id = ?').get(req.params.id);
    if (entries.count > 0) {
      throw ErrorTypes.BadRequest('该科目已用于凭证分录，无法删除');
    }

    db.prepare('DELETE FROM accounting_subjects WHERE id = ?').run(req.params.id);

    // 如果父级科目没有其他子科目，更新为末级科目
    if (subject.parent_id) {
      const siblings = db.prepare('SELECT COUNT(*) as count FROM accounting_subjects WHERE parent_id = ?').get(subject.parent_id);
      if (siblings.count === 0) {
        db.prepare('UPDATE accounting_subjects SET is_leaf = 1 WHERE id = ?').run(subject.parent_id);
      }
    }

    res.json({ success: true, message: '会计科目已删除' });
  })
);

/**
 * @route   GET /api/subjects/:id/balance
 * @desc    获取科目余额
 */
router.get('/:id/balance',
  permissionMiddleware('subjects', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { period_year, period_month } = req.query;

    const subject = db.prepare('SELECT * FROM accounting_subjects WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!subject) {
      throw ErrorTypes.NotFound('会计科目');
    }

    let periodCondition = '';
    const params = [req.params.id, req.user.companyId];

    if (period_year && period_month) {
      periodCondition = 'AND v.period_year = ? AND v.period_month = ?';
      params.push(parseInt(period_year), parseInt(period_month));
    }

    const balance = db.prepare(`
      SELECT 
        COALESCE(SUM(ve.debit_amount), 0) as total_debit,
        COALESCE(SUM(ve.credit_amount), 0) as total_credit
      FROM voucher_entries ve
      JOIN vouchers v ON ve.voucher_id = v.id
      WHERE ve.subject_id = ? AND v.company_id = ? AND v.status = 'posted' ${periodCondition}
    `).get(...params);

    // 计算余额
    let balanceAmount = 0;
    if (subject.direction === 'debit') {
      balanceAmount = balance.total_debit - balance.total_credit;
    } else {
      balanceAmount = balance.total_credit - balance.total_debit;
    }

    res.json({
      success: true,
      data: {
        subject_id: subject.id,
        subject_code: subject.subject_code,
        subject_name: subject.subject_name,
        direction: subject.direction,
        total_debit: balance.total_debit,
        total_credit: balance.total_credit,
        balance: balanceAmount
      }
    });
  })
);

module.exports = router;