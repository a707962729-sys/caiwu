const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const Joi = require('joi');
const dayjs = require('dayjs');

// 所有路由都需要认证
router.use(authMiddleware);

// 编码规则验证schema
const codeRuleSchemas = {
  create: Joi.object({
    rule_type: Joi.string().max(50).required(),
    rule_name: Joi.string().max(100).required(),
    prefix: Joi.string().max(20).allow(''),
    date_format: Joi.string().max(20).allow(''),
    seq_length: Joi.number().integer().min(1).max(10).default(4),
    separator: Joi.string().max(5).default('-'),
    reset_period: Joi.string().valid('none', 'day', 'month', 'year').default('year'),
    status: Joi.string().valid('active', 'inactive').default('active'),
    description: Joi.string().allow('')
  }),

  update: Joi.object({
    rule_name: Joi.string().max(100),
    prefix: Joi.string().max(20).allow(''),
    date_format: Joi.string().max(20).allow(''),
    seq_length: Joi.number().integer().min(1).max(10),
    separator: Joi.string().max(5),
    reset_period: Joi.string().valid('none', 'day', 'month', 'year'),
    status: Joi.string().valid('active', 'inactive'),
    description: Joi.string().allow('')
  })
};

/**
 * 检查并重置序号
 */
function checkAndResetSeq(db, rule, companyId) {
  const today = dayjs().format('YYYY-MM-DD');
  let shouldReset = false;

  if (!rule.last_reset_date) {
    shouldReset = true;
  } else {
    const lastReset = dayjs(rule.last_reset_date);
    const now = dayjs();

    switch (rule.reset_period) {
      case 'day':
        shouldReset = !lastReset.isSame(now, 'day');
        break;
      case 'month':
        shouldReset = !lastReset.isSame(now, 'month');
        break;
      case 'year':
        shouldReset = !lastReset.isSame(now, 'year');
        break;
      default:
        shouldReset = false;
    }
  }

  if (shouldReset) {
    db.prepare(`
      UPDATE code_rules 
      SET current_seq = 0, last_reset_date = ? 
      WHERE id = ?
    `).run(today, rule.id);
    return 0;
  }

  return rule.current_seq;
}

/**
 * 生成编码
 */
function generateCode(rule, seq) {
  const parts = [];
  
  if (rule.prefix) {
    parts.push(rule.prefix);
  }

  if (rule.date_format) {
    parts.push(dayjs().format(rule.date_format));
  }

  // 序号补零
  const seqStr = String(seq + 1).padStart(rule.seq_length, '0');
  parts.push(seqStr);

  return parts.join(rule.separator || '');
}

/**
 * @route   GET /api/code-rules
 * @desc    获取编码规则列表
 * @access  Private
 */
router.get('/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, status, search, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;

    // 构建查询条件
    let whereClause = 'WHERE cr.company_id = ?';
    const params = [companyId];

    if (status) {
      whereClause += ' AND cr.status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (cr.rule_type LIKE ? OR cr.rule_name LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    // 统计总数
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM code_rules cr ${whereClause}
    `).get(...params);
    const total = countResult.total;

    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'rule_type', 'rule_name', 'status', 'created_at', 'updated_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // 查询列表
    const offset = (page - 1) * pageSize;

    const items = db.prepare(`
      SELECT cr.*, u.real_name as created_by_name
      FROM code_rules cr
      LEFT JOIN users u ON cr.created_by = u.id
      ${whereClause}
      ORDER BY cr.${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    });
  })
);

/**
 * @route   GET /api/code-rules/types
 * @desc    获取规则类型列表
 * @access  Private
 */
router.get('/types',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const types = db.prepare(`
      SELECT DISTINCT rule_type
      FROM code_rules
      WHERE company_id = ?
      ORDER BY rule_type
    `).all(companyId);

    res.json({
      success: true,
      data: types.map(t => t.rule_type)
    });
  })
);

/**
 * @route   GET /api/code-rules/:id
 * @desc    获取单个编码规则
 * @access  Private
 */
router.get('/:id',
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const item = db.prepare(`
      SELECT cr.*, u.real_name as created_by_name
      FROM code_rules cr
      LEFT JOIN users u ON cr.created_by = u.id
      WHERE cr.id = ? AND cr.company_id = ?
    `).get(id, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('编码规则');
    }

    res.json({
      success: true,
      data: item
    });
  })
);

/**
 * @route   POST /api/code-rules
 * @desc    创建编码规则
 * @access  Private (Boss only)
 */
router.post('/',
  roleMiddleware('boss'),
  validate(codeRuleSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { rule_type, rule_name, prefix, date_format, seq_length, separator, reset_period, status, description } = req.body;
    const companyId = req.user.companyId;

    // 检查是否已存在
    const existing = db.prepare(`
      SELECT id FROM code_rules WHERE company_id = ? AND rule_type = ?
    `).get(companyId, rule_type);

    if (existing) {
      throw ErrorTypes.DuplicateEntry('该规则类型');
    }

    // 生成示例编码
    const example = generateCode({
      prefix: prefix || '',
      date_format: date_format || '',
      seq_length: seq_length || 4,
      separator: separator || '-'
    }, 0);

    const result = db.prepare(`
      INSERT INTO code_rules 
      (company_id, rule_type, rule_name, prefix, date_format, seq_length, current_seq, 
       reset_period, separator, example, status, description, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `).run(companyId, rule_type, rule_name, prefix || null, date_format || null, 
          seq_length || 4, reset_period || 'year', separator || '-', example, 
          status || 'active', description || null, req.user.id);

    const newItem = db.prepare(`
      SELECT cr.*, u.real_name as created_by_name
      FROM code_rules cr
      LEFT JOIN users u ON cr.created_by = u.id
      WHERE cr.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: newItem,
      message: '编码规则创建成功'
    });
  })
);

/**
 * @route   PUT /api/code-rules/:id
 * @desc    更新编码规则
 * @access  Private (Boss only)
 */
router.put('/:id',
  roleMiddleware('boss'),
  validateId('id'),
  validate(codeRuleSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 检查是否存在
    const item = db.prepare(`
      SELECT * FROM code_rules WHERE id = ? AND company_id = ?
    `).get(id, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('编码规则');
    }

    // 构建更新数据
    const updates = [];
    const values = [];

    const allowedFields = ['rule_name', 'prefix', 'date_format', 'seq_length', 'separator', 'reset_period', 'status', 'description'];

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value === '' ? null : value);
      }
    }

    if (updates.length === 0) {
      throw ErrorTypes.BadRequest('没有要更新的数据');
    }

    // 更新示例
    const updatedItem = { ...item, ...req.body };
    const example = generateCode({
      prefix: updatedItem.prefix || '',
      date_format: updatedItem.date_format || '',
      seq_length: updatedItem.seq_length || 4,
      separator: updatedItem.separator || '-'
    }, 0);
    updates.push('example = ?');
    values.push(example);

    values.push(id, companyId);

    db.prepare(`
      UPDATE code_rules 
      SET ${updates.join(', ')} 
      WHERE id = ? AND company_id = ?
    `).run(...values);

    const result = db.prepare(`
      SELECT cr.*, u.real_name as created_by_name
      FROM code_rules cr
      LEFT JOIN users u ON cr.created_by = u.id
      WHERE cr.id = ?
    `).get(id);

    res.json({
      success: true,
      data: result,
      message: '编码规则更新成功'
    });
  })
);

/**
 * @route   DELETE /api/code-rules/:id
 * @desc    删除编码规则
 * @access  Private (Boss only)
 */
router.delete('/:id',
  roleMiddleware('boss'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 检查是否存在
    const item = db.prepare(`
      SELECT id FROM code_rules WHERE id = ? AND company_id = ?
    `).get(id, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('编码规则');
    }

    db.prepare('DELETE FROM code_rules WHERE id = ?').run(id);

    res.json({
      success: true,
      message: '编码规则删除成功'
    });
  })
);

/**
 * @route   POST /api/code-rules/generate/:type
 * @desc    生成编码
 * @access  Private
 */
router.post('/generate/:type',
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 查找规则
    const rule = db.prepare(`
      SELECT * FROM code_rules 
      WHERE rule_type = ? AND company_id = ? AND status = 'active'
    `).get(type, companyId);

    if (!rule) {
      throw ErrorTypes.NotFound('编码规则');
    }

    // 检查是否需要重置序号
    const currentSeq = checkAndResetSeq(db, rule, companyId);

    // 生成编码
    const code = generateCode(rule, currentSeq);

    // 更新序号
    db.prepare(`
      UPDATE code_rules 
      SET current_seq = current_seq + 1 
      WHERE id = ?
    `).run(rule.id);

    res.json({
      success: true,
      data: {
        code,
        rule_type: type,
        seq: currentSeq + 1
      },
      message: '编码生成成功'
    });
  })
);

/**
 * @route   POST /api/code-rules/preview/:type
 * @desc    预览编码（不消耗序号）
 * @access  Private
 */
router.post('/preview/:type',
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 查找规则
    const rule = db.prepare(`
      SELECT * FROM code_rules 
      WHERE rule_type = ? AND company_id = ? AND status = 'active'
    `).get(type, companyId);

    if (!rule) {
      throw ErrorTypes.NotFound('编码规则');
    }

    // 检查是否需要重置序号（但不实际重置）
    let previewSeq = rule.current_seq;
    if (rule.reset_period !== 'none') {
      const today = dayjs().format('YYYY-MM-DD');
      if (rule.last_reset_date) {
        const lastReset = dayjs(rule.last_reset_date);
        const now = dayjs();
        let shouldReset = false;
        switch (rule.reset_period) {
          case 'day':
            shouldReset = !lastReset.isSame(now, 'day');
            break;
          case 'month':
            shouldReset = !lastReset.isSame(now, 'month');
            break;
          case 'year':
            shouldReset = !lastReset.isSame(now, 'year');
            break;
        }
        if (shouldReset) {
          previewSeq = 0;
        }
      }
    }

    // 生成预览编码
    const code = generateCode(rule, previewSeq);

    res.json({
      success: true,
      data: {
        code,
        rule_type: type,
        next_seq: previewSeq + 1,
        current_seq: rule.current_seq,
        will_reset: rule.last_reset_date !== dayjs().format('YYYY-MM-DD')
      }
    });
  })
);

/**
 * @route   POST /api/code-rules/:id/reset
 * @desc    重置序号
 * @access  Private (Boss only)
 */
router.post('/:id/reset',
  roleMiddleware('boss'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 检查是否存在
    const item = db.prepare(`
      SELECT * FROM code_rules WHERE id = ? AND company_id = ?
    `).get(id, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('编码规则');
    }

    const today = dayjs().format('YYYY-MM-DD');

    db.prepare(`
      UPDATE code_rules 
      SET current_seq = 0, last_reset_date = ? 
      WHERE id = ?
    `).run(today, id);

    res.json({
      success: true,
      message: '序号已重置'
    });
  })
);

module.exports = router;