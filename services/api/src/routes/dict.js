const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const Joi = require('joi');

// 所有路由都需要认证
router.use(authMiddleware);

// 字典验证schema
const dictSchemas = {
  create: Joi.object({
    dict_type: Joi.string().max(50).required(),
    dict_code: Joi.string().max(50).required(),
    dict_name: Joi.string().max(100).required(),
    dict_value: Joi.string().allow(''),
    parent_code: Joi.string().max(50).allow(''),
    sort_order: Joi.number().integer().min(0).default(0),
    status: Joi.string().valid('active', 'inactive').default('active'),
    description: Joi.string().allow('')
  }),

  update: Joi.object({
    dict_name: Joi.string().max(100),
    dict_value: Joi.string().allow(''),
    parent_code: Joi.string().max(50).allow(''),
    sort_order: Joi.number().integer().min(0),
    status: Joi.string().valid('active', 'inactive'),
    description: Joi.string().allow('')
  })
};

/**
 * @route   GET /api/dict/types
 * @desc    获取字典类型列表
 * @access  Private
 */
router.get('/types',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const types = db.prepare(`
      SELECT DISTINCT dict_type, COUNT(*) as count
      FROM data_dictionaries
      WHERE (company_id = ? OR company_id IS NULL)
      GROUP BY dict_type
      ORDER BY dict_type
    `).all(companyId);

    res.json({
      success: true,
      data: types
    });
  })
);

/**
 * @route   GET /api/dict
 * @desc    获取字典列表（支持按类型筛选）
 * @access  Private
 */
router.get('/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 50, dict_type, parent_code, status, search, sortBy = 'sort_order', sortOrder = 'asc' } = req.query;
    const companyId = req.user.companyId;

    // 构建查询条件
    let whereClause = 'WHERE (dd.company_id = ? OR dd.company_id IS NULL)';
    const params = [companyId];

    if (dict_type) {
      whereClause += ' AND dd.dict_type = ?';
      params.push(dict_type);
    }

    if (parent_code !== undefined) {
      if (parent_code === '' || parent_code === 'null') {
        whereClause += ' AND dd.parent_code IS NULL';
      } else {
        whereClause += ' AND dd.parent_code = ?';
        params.push(parent_code);
      }
    }

    if (status) {
      whereClause += ' AND dd.status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (dd.dict_code LIKE ? OR dd.dict_name LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    // 统计总数
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM data_dictionaries dd ${whereClause}
    `).get(...params);
    const total = countResult.total;

    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'dict_type', 'dict_code', 'dict_name', 'sort_order', 'status', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'sort_order';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // 查询列表
    const offset = (page - 1) * pageSize;

    const items = db.prepare(`
      SELECT dd.*, u.real_name as created_by_name
      FROM data_dictionaries dd
      LEFT JOIN users u ON dd.created_by = u.id
      ${whereClause}
      ORDER BY dd.${sortField} ${order}
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
 * @route   GET /api/dict/tree/:type
 * @desc    获取字典树形结构
 * @access  Private
 */
router.get('/tree/:type',
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const items = db.prepare(`
      SELECT * FROM data_dictionaries
      WHERE dict_type = ? AND (company_id = ? OR company_id IS NULL)
      ORDER BY sort_order, dict_code
    `).all(type, companyId);

    // 构建树形结构
    const buildTree = (items, parentCode = null) => {
      return items
        .filter(item => (parentCode === null ? !item.parent_code : item.parent_code === parentCode))
        .map(item => ({
          ...item,
          children: buildTree(items, item.dict_code)
        }));
    };

    const tree = buildTree(items);

    res.json({
      success: true,
      data: tree
    });
  })
);

/**
 * @route   GET /api/dict/:id
 * @desc    获取单个字典项（数字ID）
 * @access  Private
 */
router.get('/:id(\\d+)',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const item = db.prepare(`
      SELECT dd.*, u.real_name as created_by_name
      FROM data_dictionaries dd
      LEFT JOIN users u ON dd.created_by = u.id
      WHERE dd.id = ? AND (dd.company_id = ? OR dd.company_id IS NULL)
    `).get(id, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('字典项');
    }

    res.json({
      success: true,
      data: item
    });
  })
);

/**
 * @route   GET /api/dict/:type/:code
 * @desc    获取单个字典项
 * @access  Private
 */
router.get('/:type/:code',
  asyncHandler(async (req, res) => {
    const { type, code } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const item = db.prepare(`
      SELECT dd.*, u.real_name as created_by_name
      FROM data_dictionaries dd
      LEFT JOIN users u ON dd.created_by = u.id
      WHERE dd.dict_type = ? AND dd.dict_code = ? 
        AND (dd.company_id = ? OR dd.company_id IS NULL)
    `).get(type, code, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('字典项');
    }

    res.json({
      success: true,
      data: item
    });
  })
);

/**
 * @route   POST /api/dict
 * @desc    创建字典项
 * @access  Private (Boss, Accountant)
 */
router.post('/',
  roleMiddleware('boss', 'accountant'),
  validate(dictSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { dict_type, dict_code, dict_name, dict_value, parent_code, sort_order, status, description } = req.body;
    const companyId = req.user.companyId;

    // 检查是否已存在
    const existing = db.prepare(`
      SELECT id FROM data_dictionaries 
      WHERE dict_type = ? AND dict_code = ? AND company_id = ?
    `).get(dict_type, dict_code, companyId);

    if (existing) {
      throw ErrorTypes.DuplicateEntry('字典编码');
    }

    const result = db.prepare(`
      INSERT INTO data_dictionaries 
      (company_id, dict_type, dict_code, dict_name, dict_value, parent_code, sort_order, status, description, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(companyId, dict_type, dict_code, dict_name, dict_value || null, parent_code || null, sort_order, status, description || null, req.user.id);

    const newItem = db.prepare(`
      SELECT dd.*, u.real_name as created_by_name
      FROM data_dictionaries dd
      LEFT JOIN users u ON dd.created_by = u.id
      WHERE dd.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: newItem,
      message: '字典项创建成功'
    });
  })
);

/**
 * @route   PUT /api/dict/:id
 * @desc    更新字典项（数字ID）
 * @access  Private (Boss, Accountant)
 */
router.put('/:id(\\d+)',
  roleMiddleware('boss', 'accountant'),
  validate(dictSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 检查是否存在
    const item = db.prepare(`
      SELECT * FROM data_dictionaries 
      WHERE id = ? AND (company_id = ? OR company_id IS NULL)
    `).get(id, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('字典项');
    }

    // 构建更新数据
    const updates = [];
    const values = [];

    const allowedFields = ['dict_name', 'dict_value', 'parent_code', 'sort_order', 'status', 'description'];

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value === '' ? null : value);
      }
    }

    if (updates.length === 0) {
      throw ErrorTypes.BadRequest('没有要更新的数据');
    }

    values.push(id);

    db.prepare(`UPDATE data_dictionaries SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedItem = db.prepare(`
      SELECT dd.*, u.real_name as created_by_name
      FROM data_dictionaries dd
      LEFT JOIN users u ON dd.created_by = u.id
      WHERE dd.id = ?
    `).get(id);

    res.json({
      success: true,
      data: updatedItem,
      message: '字典项更新成功'
    });
  })
);

/**
 * @route   DELETE /api/dict/:id
 * @desc    删除字典项（数字ID）
 * @access  Private (Boss only)
 */
router.delete('/:id(\\d+)',
  roleMiddleware('boss'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 检查是否存在
    const item = db.prepare(`
      SELECT id, dict_type, dict_code FROM data_dictionaries 
      WHERE id = ? AND (company_id = ? OR company_id IS NULL)
    `).get(id, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('字典项');
    }

    // 检查是否有子项
    const children = db.prepare(`
      SELECT COUNT(*) as count FROM data_dictionaries 
      WHERE dict_type = ? AND parent_code = ?
    `).get(item.dict_type, item.dict_code);

    if (children.count > 0) {
      throw ErrorTypes.BadRequest('该字典项存在子项，请先删除子项');
    }

    db.prepare('DELETE FROM data_dictionaries WHERE id = ?').run(id);

    res.json({
      success: true,
      message: '字典项删除成功'
    });
  })
);

/**
 * @route   PUT /api/dict/:type/:code
 * @desc    更新字典项
 * @access  Private (Boss, Accountant)
 */
router.put('/:type/:code',
  roleMiddleware('boss', 'accountant'),
  validate(dictSchemas.update),
  asyncHandler(async (req, res) => {
    const { type, code } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 检查是否存在
    const item = db.prepare(`
      SELECT * FROM data_dictionaries 
      WHERE dict_type = ? AND dict_code = ? AND company_id = ?
    `).get(type, code, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('字典项');
    }

    // 构建更新数据
    const updates = [];
    const values = [];

    const allowedFields = ['dict_name', 'dict_value', 'parent_code', 'sort_order', 'status', 'description'];

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value === '' ? null : value);
      }
    }

    if (updates.length === 0) {
      throw ErrorTypes.BadRequest('没有要更新的数据');
    }

    values.push(type, code, companyId);

    db.prepare(`
      UPDATE data_dictionaries 
      SET ${updates.join(', ')} 
      WHERE dict_type = ? AND dict_code = ? AND company_id = ?
    `).run(...values);

    const updatedItem = db.prepare(`
      SELECT dd.*, u.real_name as created_by_name
      FROM data_dictionaries dd
      LEFT JOIN users u ON dd.created_by = u.id
      WHERE dd.dict_type = ? AND dd.dict_code = ? AND dd.company_id = ?
    `).get(type, code, companyId);

    res.json({
      success: true,
      data: updatedItem,
      message: '字典项更新成功'
    });
  })
);

/**
 * @route   DELETE /api/dict/:type/:code
 * @desc    删除字典项
 * @access  Private (Boss only)
 */
router.delete('/:type/:code',
  roleMiddleware('boss'),
  asyncHandler(async (req, res) => {
    const { type, code } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 检查是否存在
    const item = db.prepare(`
      SELECT id FROM data_dictionaries 
      WHERE dict_type = ? AND dict_code = ? AND company_id = ?
    `).get(type, code, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('字典项');
    }

    // 检查是否有子项
    const children = db.prepare(`
      SELECT COUNT(*) as count FROM data_dictionaries 
      WHERE dict_type = ? AND parent_code = ?
    `).get(type, code);

    if (children.count > 0) {
      throw ErrorTypes.BadRequest('该字典项存在子项，请先删除子项');
    }

    db.prepare(`
      DELETE FROM data_dictionaries 
      WHERE dict_type = ? AND dict_code = ? AND company_id = ?
    `).run(type, code, companyId);

    res.json({
      success: true,
      message: '字典项删除成功'
    });
  })
);

/**
 * @route   POST /api/dict/batch
 * @desc    批量创建字典项
 * @access  Private (Boss, Accountant)
 */
router.post('/batch',
  roleMiddleware('boss', 'accountant'),
  asyncHandler(async (req, res) => {
    const { dict_type, items } = req.body;

    if (!dict_type || !Array.isArray(items) || items.length === 0) {
      throw ErrorTypes.BadRequest('参数错误');
    }

    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const created = [];
    const failed = [];

    // 批量查询已存在的编码（修复 N+1 查询）
    const codes = items.map(item => item.dict_code);
    const placeholders = codes.map(() => '?').join(',');
    const existingRecords = db.prepare(`
      SELECT dict_code FROM data_dictionaries 
      WHERE dict_type = ? AND dict_code IN (${placeholders}) AND company_id = ?
    `).all(dict_type, ...codes, companyId);
    const existingCodes = new Set(existingRecords.map(r => r.dict_code));

    // 准备插入语句
    const insertStmt = db.prepare(`
      INSERT INTO data_dictionaries 
      (company_id, dict_type, dict_code, dict_name, dict_value, parent_code, sort_order, status, description, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      try {
        // 检查是否已存在（使用预先查询的结果）
        if (existingCodes.has(item.dict_code)) {
          failed.push({ ...item, reason: '编码已存在' });
          continue;
        }

        const result = insertStmt.run(companyId, dict_type, item.dict_code, item.dict_name, item.dict_value || null, 
              item.parent_code || null, item.sort_order || 0, item.status || 'active', 
              item.description || null, req.user.id);

        created.push({ ...item, id: result.lastInsertRowid });
      } catch (err) {
        failed.push({ ...item, reason: err.message });
      }
    }

    res.json({
      success: true,
      data: {
        created,
        failed,
        total: items.length,
        createdCount: created.length,
        failedCount: failed.length
      },
      message: `成功创建 ${created.length} 条，失败 ${failed.length} 条`
    });
  })
);

module.exports = router;