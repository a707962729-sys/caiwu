const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const { AuditLogger } = require('../middleware/audit');
const Joi = require('joi');

router.use(authMiddleware);

// 验证 schema
const standardCreateSchema = Joi.object({
  category: Joi.string().valid('accommodation', 'meal', 'transport', 'other').required(),
  name: Joi.string().max(100).required(),
  daily_limit: Joi.number().precision(2).min(0).allow(null),
  monthly_limit: Joi.number().precision(2).min(0).allow(null),
  per_item_limit: Joi.number().precision(2).min(0).allow(null),
  description: Joi.string().allow(null, ''),
  status: Joi.string().valid('active', 'inactive').default('active')
});

const standardUpdateSchema = Joi.object({
  category: Joi.string().valid('accommodation', 'meal', 'transport', 'other'),
  name: Joi.string().max(100),
  daily_limit: Joi.number().precision(2).min(0).allow(null),
  monthly_limit: Joi.number().precision(2).min(0).allow(null),
  per_item_limit: Joi.number().precision(2).min(0).allow(null),
  description: Joi.string().allow(null, ''),
  status: Joi.string().valid('active', 'inactive')
});

// 类别名称映射
const categoryNames = {
  accommodation: '住宿',
  meal: '餐饮',
  transport: '交通',
  other: '其他'
};

/**
 * @route   GET /api/reimbursement-standards
 * @desc    获取报销标准列表
 */
router.get('/',
  permissionMiddleware('settings', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, category, status, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE company_id = ?';
    const params = [companyId];
    
    if (search) {
      whereClause += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }
    
    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM reimbursement_standards ${whereClause}`).get(...params);
    
    // SQL 注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'category', 'name', 'daily_limit', 'monthly_limit', 'per_item_limit', 'status', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    const offset = (page - 1) * pageSize;
    const standards = db.prepare(`
      SELECT * FROM reimbursement_standards
      ${whereClause}
      ORDER BY ${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    
    // 添加类别名称
    const result = standards.map(s => ({
      ...s,
      category_name: categoryNames[s.category] || s.category
    }));
    
    res.json({
      success: true,
      data: {
        list: result,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/reimbursement-standards/:id
 * @desc    获取报销标准详情
 */
router.get('/:id',
  permissionMiddleware('settings', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const standard = db.prepare(`
      SELECT * FROM reimbursement_standards 
      WHERE id = ? AND company_id = ?
    `).get(req.params.id, req.user.companyId);
    
    if (!standard) {
      throw ErrorTypes.NotFound('报销标准');
    }
    
    res.json({
      success: true,
      data: {
        ...standard,
        category_name: categoryNames[standard.category] || standard.category
      }
    });
  })
);

/**
 * @route   GET /api/reimbursement-standards/category/:category
 * @desc    根据类别获取报销标准
 */
router.get('/category/:category',
  permissionMiddleware('settings', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { category } = req.params;
    
    if (!['accommodation', 'meal', 'transport', 'other'].includes(category)) {
      throw ErrorTypes.BadRequest('无效的报销类别');
    }
    
    const standards = db.prepare(`
      SELECT * FROM reimbursement_standards 
      WHERE company_id = ? AND category = ? AND status = 'active'
      ORDER BY created_at DESC
    `).all(req.user.companyId, category);
    
    res.json({
      success: true,
      data: standards.map(s => ({
        ...s,
        category_name: categoryNames[s.category] || s.category
      }))
    });
  })
);

/**
 * @route   POST /api/reimbursement-standards
 * @desc    创建报销标准
 */
router.post('/',
  permissionMiddleware('settings', 'create'),
  validate(standardCreateSchema),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { category, name, daily_limit, monthly_limit, per_item_limit, description, status } = req.body;
    
    // 检查同名标准是否存在
    const existing = db.prepare(`
      SELECT id FROM reimbursement_standards 
      WHERE company_id = ? AND category = ? AND name = ?
    `).get(companyId, category, name);
    
    if (existing) {
      throw ErrorTypes.DuplicateEntry('同一类别下已存在同名报销标准');
    }
    
    const result = db.prepare(`
      INSERT INTO reimbursement_standards (
        company_id, category, name, daily_limit, monthly_limit, per_item_limit, description, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, 
      category, 
      name, 
      daily_limit ?? null, 
      monthly_limit ?? null, 
      per_item_limit ?? null, 
      description || null, 
      status || 'active'
    );
    
    const newId = result.lastInsertRowid;
    
    // 记录审计日志
    AuditLogger.logCreate('reimbursement_standards', newId, { category, name }, req);
    
    res.status(201).json({
      success: true,
      data: {
        id: newId,
        company_id: companyId,
        category,
        name,
        daily_limit: daily_limit ?? null,
        monthly_limit: monthly_limit ?? null,
        per_item_limit: per_item_limit ?? null,
        description: description || null,
        status: status || 'active',
        category_name: categoryNames[category] || category
      },
      message: '报销标准创建成功'
    });
  })
);

/**
 * @route   PUT /api/reimbursement-standards/:id
 * @desc    更新报销标准
 */
router.put('/:id',
  permissionMiddleware('settings', 'update'),
  validateId('id'),
  validate(standardUpdateSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    
    const standard = db.prepare(`
      SELECT * FROM reimbursement_standards WHERE id = ? AND company_id = ?
    `).get(id, req.user.companyId);
    
    if (!standard) {
      throw ErrorTypes.NotFound('报销标准');
    }
    
    // 如果修改了类别或名称，检查是否重复
    if (req.body.category || req.body.name) {
      const newCategory = req.body.category || standard.category;
      const newName = req.body.name || standard.name;
      
      const existing = db.prepare(`
        SELECT id FROM reimbursement_standards 
        WHERE company_id = ? AND category = ? AND name = ? AND id != ?
      `).get(req.user.companyId, newCategory, newName, id);
      
      if (existing) {
        throw ErrorTypes.DuplicateEntry('同一类别下已存在同名报销标准');
      }
    }
    
    const updates = [];
    const values = [];
    const allowedFields = ['category', 'name', 'daily_limit', 'monthly_limit', 'per_item_limit', 'description', 'status'];
    
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
    db.prepare(`UPDATE reimbursement_standards SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    const updatedStandard = db.prepare('SELECT * FROM reimbursement_standards WHERE id = ?').get(id);
    
    // 记录审计日志
    AuditLogger.logUpdate('reimbursement_standards', id, standard, updatedStandard, req);
    
    res.json({
      success: true,
      data: {
        ...updatedStandard,
        category_name: categoryNames[updatedStandard.category] || updatedStandard.category
      },
      message: '报销标准更新成功'
    });
  })
);

/**
 * @route   DELETE /api/reimbursement-standards/:id
 * @desc    删除报销标准
 */
router.delete('/:id',
  permissionMiddleware('settings', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    
    const standard = db.prepare(`
      SELECT * FROM reimbursement_standards WHERE id = ? AND company_id = ?
    `).get(id, req.user.companyId);
    
    if (!standard) {
      throw ErrorTypes.NotFound('报销标准');
    }
    
    // 记录审计日志
    AuditLogger.logDelete('reimbursement_standards', id, standard, req);
    
    db.prepare('DELETE FROM reimbursement_standards WHERE id = ?').run(id);
    
    res.json({ success: true, message: '报销标准已删除' });
  })
);

/**
 * @route   PUT /api/reimbursement-standards/:id/status
 * @desc    切换报销标准状态
 */
router.put('/:id/status',
  permissionMiddleware('settings', 'update'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'inactive'].includes(status)) {
      throw ErrorTypes.BadRequest('无效的状态值');
    }
    
    const db = getDatabaseCompat();
    
    const standard = db.prepare(`
      SELECT * FROM reimbursement_standards WHERE id = ? AND company_id = ?
    `).get(id, req.user.companyId);
    
    if (!standard) {
      throw ErrorTypes.NotFound('报销标准');
    }
    
    db.prepare('UPDATE reimbursement_standards SET status = ? WHERE id = ?').run(status, id);
    
    res.json({ success: true, message: status === 'active' ? '报销标准已启用' : '报销标准已禁用' });
  })
);

module.exports = router;