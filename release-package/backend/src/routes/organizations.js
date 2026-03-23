const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const Joi = require('joi');

// 所有路由都需要认证
router.use(authMiddleware);

// 验证schema
const orgSchemas = {
  create: Joi.object({
    org_code: Joi.string().max(50).allow(''),
    org_name: Joi.string().max(100).required(),
    org_type: Joi.string().max(50).default('company'),
    parent_id: Joi.number().integer().positive().allow(null),
    level: Joi.number().integer().min(1).default(1),
    manager_id: Joi.number().integer().positive().allow(null),
    description: Joi.string().allow(''),
    status: Joi.string().valid('active', 'inactive').default('active')
  }),

  update: Joi.object({
    org_code: Joi.string().max(50).allow(''),
    org_name: Joi.string().max(100),
    org_type: Joi.string().max(50),
    parent_id: Joi.number().integer().positive().allow(null),
    level: Joi.number().integer().min(1),
    manager_id: Joi.number().integer().positive().allow(null),
    description: Joi.string().allow(''),
    status: Joi.string().valid('active', 'inactive')
  })
};

const deptSchemas = {
  create: Joi.object({
    org_id: Joi.number().integer().positive().allow(null),
    dept_code: Joi.string().max(50).allow(''),
    dept_name: Joi.string().max(100).required(),
    parent_id: Joi.number().integer().positive().allow(null),
    level: Joi.number().integer().min(1).default(1),
    manager_id: Joi.number().integer().positive().allow(null),
    cost_center: Joi.string().max(50).allow(''),
    description: Joi.string().allow(''),
    sort_order: Joi.number().integer().min(0).default(0),
    status: Joi.string().valid('active', 'inactive').default('active')
  }),

  update: Joi.object({
    org_id: Joi.number().integer().positive().allow(null),
    dept_code: Joi.string().max(50).allow(''),
    dept_name: Joi.string().max(100),
    parent_id: Joi.number().integer().positive().allow(null),
    level: Joi.number().integer().min(1),
    manager_id: Joi.number().integer().positive().allow(null),
    cost_center: Joi.string().max(50).allow(''),
    description: Joi.string().allow(''),
    sort_order: Joi.number().integer().min(0),
    status: Joi.string().valid('active', 'inactive')
  })
};

const positionSchemas = {
  create: Joi.object({
    dept_id: Joi.number().integer().positive().allow(null),
    position_code: Joi.string().max(50).allow(''),
    position_name: Joi.string().max(100).required(),
    position_level: Joi.string().max(50).allow(''),
    position_type: Joi.string().max(50).allow(''),
    parent_id: Joi.number().integer().positive().allow(null),
    responsibilities: Joi.string().allow(''),
    requirements: Joi.string().allow(''),
    headcount: Joi.number().integer().min(1).default(1),
    description: Joi.string().allow(''),
    sort_order: Joi.number().integer().min(0).default(0),
    status: Joi.string().valid('active', 'inactive').default('active')
  }),

  update: Joi.object({
    dept_id: Joi.number().integer().positive().allow(null),
    position_code: Joi.string().max(50).allow(''),
    position_name: Joi.string().max(100),
    position_level: Joi.string().max(50).allow(''),
    position_type: Joi.string().max(50).allow(''),
    parent_id: Joi.number().integer().positive().allow(null),
    responsibilities: Joi.string().allow(''),
    requirements: Joi.string().allow(''),
    headcount: Joi.number().integer().min(1),
    description: Joi.string().allow(''),
    sort_order: Joi.number().integer().min(0),
    status: Joi.string().valid('active', 'inactive')
  })
};

// ============================================
// 组织架构 API
// ============================================

/**
 * @route   GET /api/organizations
 * @desc    获取组织列表
 * @access  Private
 */
router.get('/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 50, status, search, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;

    let whereClause = 'WHERE o.company_id = ?';
    const params = [companyId];

    if (status) {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (o.org_code LIKE ? OR o.org_name LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM organizations o ${whereClause}
    `).get(...params);
    const total = countResult.total;

    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'org_code', 'org_name', 'org_type', 'level', 'status', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const offset = (page - 1) * pageSize;

    const items = db.prepare(`
      SELECT o.*, 
             p.org_name as parent_name,
             u.real_name as manager_name,
             cu.real_name as created_by_name
      FROM organizations o
      LEFT JOIN organizations p ON o.parent_id = p.id
      LEFT JOIN users u ON o.manager_id = u.id
      LEFT JOIN users cu ON o.created_by = cu.id
      ${whereClause}
      ORDER BY o.${sortField} ${order}
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
 * @route   GET /api/organizations/tree
 * @desc    获取组织树形结构
 * @access  Private
 */
router.get('/tree',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const items = db.prepare(`
      SELECT o.*, 
             u.real_name as manager_name
      FROM organizations o
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.company_id = ? AND o.status = 'active'
      ORDER BY o.level, o.org_name
    `).all(companyId);

    // 构建树形结构
    const buildTree = (items, parentId = null) => {
      return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.id)
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
 * @route   GET /api/organizations/:id
 * @desc    获取单个组织详情
 * @access  Private
 */
router.get('/:id',
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const item = db.prepare(`
      SELECT o.*, 
             p.org_name as parent_name,
             u.real_name as manager_name,
             cu.real_name as created_by_name
      FROM organizations o
      LEFT JOIN organizations p ON o.parent_id = p.id
      LEFT JOIN users u ON o.manager_id = u.id
      LEFT JOIN users cu ON o.created_by = cu.id
      WHERE o.id = ? AND o.company_id = ?
    `).get(id, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('组织');
    }

    // 获取下属部门数量
    const deptCount = db.prepare(`
      SELECT COUNT(*) as count FROM departments WHERE org_id = ? AND status = 'active'
    `).get(id);

    res.json({
      success: true,
      data: {
        ...item,
        dept_count: deptCount.count
      }
    });
  })
);

/**
 * @route   POST /api/organizations
 * @desc    创建组织
 * @access  Private (Boss only)
 */
router.post('/',
  roleMiddleware('boss'),
  validate(orgSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { org_code, org_name, org_type, parent_id, level, manager_id, description, status } = req.body;
    const companyId = req.user.companyId;

    // 检查编码是否已存在
    if (org_code) {
      const existing = db.prepare(`
        SELECT id FROM organizations WHERE company_id = ? AND org_code = ?
      `).get(companyId, org_code);
      if (existing) {
        throw ErrorTypes.DuplicateEntry('组织编码');
      }
    }

    const result = db.prepare(`
      INSERT INTO organizations 
      (company_id, org_code, org_name, org_type, parent_id, level, manager_id, description, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(companyId, org_code || null, org_name, org_type || 'company', parent_id || null, 
          level || 1, manager_id || null, description || null, status || 'active', req.user.id);

    const newItem = db.prepare(`
      SELECT o.*, 
             p.org_name as parent_name,
             u.real_name as manager_name
      FROM organizations o
      LEFT JOIN organizations p ON o.parent_id = p.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: newItem,
      message: '组织创建成功'
    });
  })
);

/**
 * @route   PUT /api/organizations/:id
 * @desc    更新组织
 * @access  Private (Boss only)
 */
router.put('/:id',
  roleMiddleware('boss'),
  validateId('id'),
  validate(orgSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const item = db.prepare(`
      SELECT * FROM organizations WHERE id = ? AND company_id = ?
    `).get(id, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('组织');
    }

    // 不能将自己设为父级
    if (req.body.parent_id === parseInt(id)) {
      throw ErrorTypes.BadRequest('不能将自身设为上级组织');
    }

    const updates = [];
    const values = [];
    const allowedFields = ['org_code', 'org_name', 'org_type', 'parent_id', 'level', 'manager_id', 'description', 'status'];

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value === '' ? null : value);
      }
    }

    if (updates.length === 0) {
      throw ErrorTypes.BadRequest('没有要更新的数据');
    }

    values.push(id, companyId);

    db.prepare(`
      UPDATE organizations SET ${updates.join(', ')} WHERE id = ? AND company_id = ?
    `).run(...values);

    const updatedItem = db.prepare(`
      SELECT o.*, 
             p.org_name as parent_name,
             u.real_name as manager_name
      FROM organizations o
      LEFT JOIN organizations p ON o.parent_id = p.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.id = ?
    `).get(id);

    res.json({
      success: true,
      data: updatedItem,
      message: '组织更新成功'
    });
  })
);

/**
 * @route   DELETE /api/organizations/:id
 * @desc    删除组织
 * @access  Private (Boss only)
 */
router.delete('/:id',
  roleMiddleware('boss'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const item = db.prepare(`
      SELECT id FROM organizations WHERE id = ? AND company_id = ?
    `).get(id, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('组织');
    }

    // 检查是否有子组织
    const children = db.prepare(`
      SELECT COUNT(*) as count FROM organizations WHERE parent_id = ?
    `).get(id);

    if (children.count > 0) {
      throw ErrorTypes.BadRequest('该组织存在下级组织，请先删除下级组织');
    }

    // 检查是否有关联部门
    const depts = db.prepare(`
      SELECT COUNT(*) as count FROM departments WHERE org_id = ?
    `).get(id);

    if (depts.count > 0) {
      throw ErrorTypes.BadRequest('该组织存在关联部门，请先处理关联部门');
    }

    db.prepare('DELETE FROM organizations WHERE id = ?').run(id);

    res.json({
      success: true,
      message: '组织删除成功'
    });
  })
);

// ============================================
// 部门 API
// ============================================

/**
 * @route   GET /api/organizations/departments
 * @desc    获取部门列表
 * @access  Private
 */
router.get('/departments/list',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 50, org_id, status, search, sortBy = 'sort_order', sortOrder = 'asc' } = req.query;
    const companyId = req.user.companyId;

    let whereClause = 'WHERE d.company_id = ?';
    const params = [companyId];

    if (org_id) {
      whereClause += ' AND d.org_id = ?';
      params.push(org_id);
    }

    if (status) {
      whereClause += ' AND d.status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (d.dept_code LIKE ? OR d.dept_name LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM departments d ${whereClause}
    `).get(...params);
    const total = countResult.total;

    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'dept_code', 'dept_name', 'level', 'sort_order', 'status', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'sort_order';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const offset = (page - 1) * pageSize;

    const items = db.prepare(`
      SELECT d.*, 
             o.org_name,
             p.dept_name as parent_name,
             u.real_name as manager_name,
             cu.real_name as created_by_name
      FROM departments d
      LEFT JOIN organizations o ON d.org_id = o.id
      LEFT JOIN departments p ON d.parent_id = p.id
      LEFT JOIN users u ON d.manager_id = u.id
      LEFT JOIN users cu ON d.created_by = cu.id
      ${whereClause}
      ORDER BY d.${sortField} ${order}
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
 * @route   GET /api/organizations/departments/tree
 * @desc    获取部门树形结构
 * @access  Private
 */
router.get('/departments/tree',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const items = db.prepare(`
      SELECT d.*, 
             o.org_name,
             u.real_name as manager_name
      FROM departments d
      LEFT JOIN organizations o ON d.org_id = o.id
      LEFT JOIN users u ON d.manager_id = u.id
      WHERE d.company_id = ? AND d.status = 'active'
      ORDER BY d.sort_order, d.dept_name
    `).all(companyId);

    // 构建树形结构
    const buildTree = (items, parentId = null) => {
      return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.id)
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
 * @route   POST /api/organizations/departments
 * @desc    创建部门
 * @access  Private (Boss only)
 */
router.post('/departments',
  roleMiddleware('boss'),
  validate(deptSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { org_id, dept_code, dept_name, parent_id, level, manager_id, cost_center, description, sort_order, status } = req.body;
    const companyId = req.user.companyId;

    // 检查编码是否已存在
    if (dept_code) {
      const existing = db.prepare(`
        SELECT id FROM departments WHERE company_id = ? AND dept_code = ?
      `).get(companyId, dept_code);
      if (existing) {
        throw ErrorTypes.DuplicateEntry('部门编码');
      }
    }

    const result = db.prepare(`
      INSERT INTO departments 
      (company_id, org_id, dept_code, dept_name, parent_id, level, manager_id, cost_center, description, sort_order, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(companyId, org_id || null, dept_code || null, dept_name, parent_id || null,
          level || 1, manager_id || null, cost_center || null, description || null, 
          sort_order || 0, status || 'active', req.user.id);

    const newItem = db.prepare(`
      SELECT d.*, 
             o.org_name,
             p.dept_name as parent_name,
             u.real_name as manager_name
      FROM departments d
      LEFT JOIN organizations o ON d.org_id = o.id
      LEFT JOIN departments p ON d.parent_id = p.id
      LEFT JOIN users u ON d.manager_id = u.id
      WHERE d.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: newItem,
      message: '部门创建成功'
    });
  })
);

/**
 * @route   PUT /api/organizations/departments/:id
 * @desc    更新部门
 * @access  Private (Boss only)
 */
router.put('/departments/:id',
  roleMiddleware('boss'),
  validateId('id'),
  validate(deptSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const item = db.prepare(`
      SELECT * FROM departments WHERE id = ? AND company_id = ?
    `).get(id, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('部门');
    }

    if (req.body.parent_id === parseInt(id)) {
      throw ErrorTypes.BadRequest('不能将自身设为上级部门');
    }

    const updates = [];
    const values = [];
    const allowedFields = ['org_id', 'dept_code', 'dept_name', 'parent_id', 'level', 'manager_id', 'cost_center', 'description', 'sort_order', 'status'];

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value === '' ? null : value);
      }
    }

    if (updates.length === 0) {
      throw ErrorTypes.BadRequest('没有要更新的数据');
    }

    values.push(id, companyId);

    db.prepare(`
      UPDATE departments SET ${updates.join(', ')} WHERE id = ? AND company_id = ?
    `).run(...values);

    const updatedItem = db.prepare(`
      SELECT d.*, 
             o.org_name,
             p.dept_name as parent_name,
             u.real_name as manager_name
      FROM departments d
      LEFT JOIN organizations o ON d.org_id = o.id
      LEFT JOIN departments p ON d.parent_id = p.id
      LEFT JOIN users u ON d.manager_id = u.id
      WHERE d.id = ?
    `).get(id);

    res.json({
      success: true,
      data: updatedItem,
      message: '部门更新成功'
    });
  })
);

/**
 * @route   DELETE /api/organizations/departments/:id
 * @desc    删除部门
 * @access  Private (Boss only)
 */
router.delete('/departments/:id',
  roleMiddleware('boss'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const item = db.prepare(`
      SELECT id FROM departments WHERE id = ? AND company_id = ?
    `).get(id, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('部门');
    }

    // 检查是否有子部门
    const children = db.prepare(`
      SELECT COUNT(*) as count FROM departments WHERE parent_id = ?
    `).get(id);

    if (children.count > 0) {
      throw ErrorTypes.BadRequest('该部门存在下级部门，请先删除下级部门');
    }

    // 检查是否有关联岗位
    const positions = db.prepare(`
      SELECT COUNT(*) as count FROM positions WHERE dept_id = ?
    `).get(id);

    if (positions.count > 0) {
      throw ErrorTypes.BadRequest('该部门存在关联岗位，请先处理关联岗位');
    }

    db.prepare('DELETE FROM departments WHERE id = ?').run(id);

    res.json({
      success: true,
      message: '部门删除成功'
    });
  })
);

// ============================================
// 岗位 API
// ============================================

/**
 * @route   GET /api/organizations/positions
 * @desc    获取岗位列表
 * @access  Private
 */
router.get('/positions/list',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 50, dept_id, status, search, sortBy = 'sort_order', sortOrder = 'asc' } = req.query;
    const companyId = req.user.companyId;

    let whereClause = 'WHERE p.company_id = ?';
    const params = [companyId];

    if (dept_id) {
      whereClause += ' AND p.dept_id = ?';
      params.push(dept_id);
    }

    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (p.position_code LIKE ? OR p.position_name LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM positions p ${whereClause}
    `).get(...params);
    const total = countResult.total;

    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'position_code', 'position_name', 'position_level', 'headcount', 'sort_order', 'status', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'sort_order';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const offset = (page - 1) * pageSize;

    const items = db.prepare(`
      SELECT p.*, 
             d.dept_name,
             pp.position_name as parent_name,
             cu.real_name as created_by_name
      FROM positions p
      LEFT JOIN departments d ON p.dept_id = d.id
      LEFT JOIN positions pp ON p.parent_id = pp.id
      LEFT JOIN users cu ON p.created_by = cu.id
      ${whereClause}
      ORDER BY p.${sortField} ${order}
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
 * @route   GET /api/organizations/positions/:id
 * @desc    获取岗位详情
 * @access  Private
 */
router.get('/positions/:id',
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const item = db.prepare(`
      SELECT p.*, 
             d.dept_name,
             pp.position_name as parent_name,
             cu.real_name as created_by_name
      FROM positions p
      LEFT JOIN departments d ON p.dept_id = d.id
      LEFT JOIN positions pp ON p.parent_id = pp.id
      LEFT JOIN users cu ON p.created_by = cu.id
      WHERE p.id = ? AND p.company_id = ?
    `).get(id, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('岗位');
    }

    // 获取该岗位的员工数量
    const empCount = db.prepare(`
      SELECT COUNT(*) as count FROM users WHERE position = ? AND status = 'active'
    `).get(item.position_name);

    res.json({
      success: true,
      data: {
        ...item,
        employee_count: empCount.count
      }
    });
  })
);

/**
 * @route   POST /api/organizations/positions
 * @desc    创建岗位
 * @access  Private (Boss only)
 */
router.post('/positions',
  roleMiddleware('boss'),
  validate(positionSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { dept_id, position_code, position_name, position_level, position_type, parent_id, 
            responsibilities, requirements, headcount, description, sort_order, status } = req.body;
    const companyId = req.user.companyId;

    // 检查编码是否已存在
    if (position_code) {
      const existing = db.prepare(`
        SELECT id FROM positions WHERE company_id = ? AND position_code = ?
      `).get(companyId, position_code);
      if (existing) {
        throw ErrorTypes.DuplicateEntry('岗位编码');
      }
    }

    const result = db.prepare(`
      INSERT INTO positions 
      (company_id, dept_id, position_code, position_name, position_level, position_type, 
       parent_id, responsibilities, requirements, headcount, description, sort_order, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(companyId, dept_id || null, position_code || null, position_name, position_level || null,
          position_type || null, parent_id || null, responsibilities || null, requirements || null,
          headcount || 1, description || null, sort_order || 0, status || 'active', req.user.id);

    const newItem = db.prepare(`
      SELECT p.*, 
             d.dept_name,
             pp.position_name as parent_name
      FROM positions p
      LEFT JOIN departments d ON p.dept_id = d.id
      LEFT JOIN positions pp ON p.parent_id = pp.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: newItem,
      message: '岗位创建成功'
    });
  })
);

/**
 * @route   PUT /api/organizations/positions/:id
 * @desc    更新岗位
 * @access  Private (Boss only)
 */
router.put('/positions/:id',
  roleMiddleware('boss'),
  validateId('id'),
  validate(positionSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const item = db.prepare(`
      SELECT * FROM positions WHERE id = ? AND company_id = ?
    `).get(id, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('岗位');
    }

    const updates = [];
    const values = [];
    const allowedFields = ['dept_id', 'position_code', 'position_name', 'position_level', 'position_type', 
                          'parent_id', 'responsibilities', 'requirements', 'headcount', 'description', 'sort_order', 'status'];

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value === '' ? null : value);
      }
    }

    if (updates.length === 0) {
      throw ErrorTypes.BadRequest('没有要更新的数据');
    }

    values.push(id, companyId);

    db.prepare(`
      UPDATE positions SET ${updates.join(', ')} WHERE id = ? AND company_id = ?
    `).run(...values);

    const updatedItem = db.prepare(`
      SELECT p.*, 
             d.dept_name,
             pp.position_name as parent_name
      FROM positions p
      LEFT JOIN departments d ON p.dept_id = d.id
      LEFT JOIN positions pp ON p.parent_id = pp.id
      WHERE p.id = ?
    `).get(id);

    res.json({
      success: true,
      data: updatedItem,
      message: '岗位更新成功'
    });
  })
);

/**
 * @route   DELETE /api/organizations/positions/:id
 * @desc    删除岗位
 * @access  Private (Boss only)
 */
router.delete('/positions/:id',
  roleMiddleware('boss'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const item = db.prepare(`
      SELECT id, position_name FROM positions WHERE id = ? AND company_id = ?
    `).get(id, companyId);

    if (!item) {
      throw ErrorTypes.NotFound('岗位');
    }

    // 检查是否有员工在该岗位
    const employees = db.prepare(`
      SELECT COUNT(*) as count FROM users WHERE position = ? AND status = 'active'
    `).get(item.position_name);

    if (employees.count > 0) {
      throw ErrorTypes.BadRequest('该岗位存在在职员工，请先调整员工岗位');
    }

    db.prepare('DELETE FROM positions WHERE id = ?').run(id);

    res.json({
      success: true,
      message: '岗位删除成功'
    });
  })
);

module.exports = router;