const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, roleMiddleware, getCurrentUser, hashPassword } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema, userSchemas } = require('../middleware/validation');

// 所有路由都需要认证
router.use(authMiddleware);

/**
 * @route   GET /api/users
 * @desc    获取用户列表
 * @access  Private (Admin)
 */
router.get('/',
  roleMiddleware('boss', 'accountant'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, role, status, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;
    
    // 构建查询条件
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (companyId) {
      whereClause += ' AND u.company_id = ?';
      params.push(companyId);
    }
    
    if (search) {
      whereClause += ' AND (u.username LIKE ? OR u.real_name LIKE ? OR u.email LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    if (role) {
      whereClause += ' AND u.role = ?';
      params.push(role);
    }
    
    if (status) {
      whereClause += ' AND u.status = ?';
      params.push(status);
    }
    
    // 统计总数
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM users u ${whereClause}`).get(...params);
    const total = countResult.total;
    
    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'username', 'real_name', 'role', 'status', 'created_at', 'updated_at', 'last_login_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    // 查询用户列表
    const offset = (page - 1) * pageSize;
    
    const users = db.prepare(`
      SELECT u.id, u.username, u.real_name, u.email, u.phone, u.role, 
             u.company_id, u.department, u.position, u.avatar, u.status,
             u.last_login_at, u.created_at, u.updated_at,
             c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      ${whereClause}
      ORDER BY u.${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    
    res.json({
      success: true,
      data: {
        list: users,
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
 * @route   GET /api/users/stats
 * @desc    获取用户统计
 * @access  Private (Admin)
 */
router.get('/stats',
  roleMiddleware('boss', 'accountant'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN role = 'boss' THEN 1 ELSE 0 END) as boss_count,
        SUM(CASE WHEN role = 'accountant' THEN 1 ELSE 0 END) as accountant_count,
        SUM(CASE WHEN role = 'employee' THEN 1 ELSE 0 END) as employee_count
      FROM users
      WHERE company_id = ?
    `).get(companyId);
    
    res.json({ success: true, data: stats });
  })
);

/**
 * @route   GET /api/users/:id
 * @desc    获取单个用户详情
 * @access  Private
 */
router.get('/:id',
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    
    const user = db.prepare(`
      SELECT u.id, u.username, u.real_name, u.email, u.phone, u.role,
             u.company_id, u.department, u.position, u.avatar, u.status,
             u.last_login_at, u.created_at, u.updated_at,
             c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = ?
    `).get(id);
    
    if (!user) {
      throw ErrorTypes.NotFound('用户');
    }
    
    // 权限检查：只能查看自己或同公司用户（老板/会计）
    const canView = req.user.id === id || 
                    req.user.role === 'boss' || 
                    (req.user.role === 'accountant' && req.user.companyId === user.company_id);
    
    if (!canView) {
      throw ErrorTypes.Forbidden();
    }
    
    res.json({
      success: true,
      data: user
    });
  })
);

/**
 * @route   POST /api/users
 * @desc    创建用户
 * @access  Private (Boss only)
 */
router.post('/',
  roleMiddleware('boss'),
  validate(userSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { username, password, real_name, email, phone, role, company_id, department, position } = req.body;
    
    // 检查用户名是否已存在
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      throw ErrorTypes.DuplicateEntry('用户名');
    }
    
    // 哈希密码
    const passwordHash = await hashPassword(password);
    
    // 创建用户
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, real_name, email, phone, role, company_id, department, position, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(username, passwordHash, real_name, email || null, phone || null, role, company_id || req.user.companyId, department || null, position || null, req.user.id);
    
    const newUser = db.prepare(`
      SELECT u.id, u.username, u.real_name, u.email, u.phone, u.role,
             u.company_id, u.department, u.position, u.status, u.created_at
      FROM users u
      WHERE u.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      data: newUser,
      message: '用户创建成功'
    });
  })
);

/**
 * @route   PUT /api/users/:id
 * @desc    更新用户信息
 * @access  Private
 */
router.put('/:id',
  validateId('id'),
  validate(userSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    
    // 检查用户是否存在
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      throw ErrorTypes.NotFound('用户');
    }
    
    // 权限检查
    const isSelf = req.user.id === id;
    const isBoss = req.user.role === 'boss';
    
    if (!isSelf && !isBoss) {
      throw ErrorTypes.Forbidden();
    }
    
    // 构建更新数据
    const updates = [];
    const values = [];
    
    const allowedFields = isBoss 
      ? ['real_name', 'email', 'phone', 'department', 'position', 'status']
      : ['real_name', 'email', 'phone', 'department', 'position'];
    
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
    
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    const updatedUser = db.prepare(`
      SELECT u.id, u.username, u.real_name, u.email, u.phone, u.role,
             u.company_id, u.department, u.position, u.status, u.updated_at
      FROM users u
      WHERE u.id = ?
    `).get(id);
    
    res.json({
      success: true,
      data: updatedUser,
      message: '用户信息更新成功'
    });
  })
);

/**
 * @route   DELETE /api/users/:id
 * @desc    删除用户（软删除或停用）
 * @access  Private (Boss only)
 */
router.delete('/:id',
  roleMiddleware('boss'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    
    // 不能删除自己
    if (id === req.user.id) {
      throw ErrorTypes.BadRequest('不能删除自己');
    }
    
    // 检查用户是否存在
    const user = db.prepare('SELECT id, status FROM users WHERE id = ?').get(id);
    if (!user) {
      throw ErrorTypes.NotFound('用户');
    }
    
    // 软删除（设置状态为inactive）
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run('inactive', id);
    
    res.json({
      success: true,
      message: '用户已停用'
    });
  })
);

/**
 * @route   POST /api/users/:id/reset-password
 * @desc    重置用户密码
 * @access  Private (Boss only)
 */
router.post('/:id/reset-password',
  roleMiddleware('boss'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    const db = getDatabaseCompat();
    
    if (!newPassword || newPassword.length < 6) {
      throw ErrorTypes.BadRequest('密码长度至少6位');
    }
    
    // 检查用户是否存在
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) {
      throw ErrorTypes.NotFound('用户');
    }
    
    // 哈希新密码
    const passwordHash = await hashPassword(newPassword);
    
    // 更新密码
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
    
    res.json({
      success: true,
      message: '密码重置成功'
    });
  })
);

/**
 * @route   GET /api/users/:id/permissions
 * @desc    获取用户权限列表
 * @access  Private
 */
router.get('/:id/permissions',
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // 只能查看自己的权限
    if (req.user.id !== id && req.user.role !== 'boss') {
      throw ErrorTypes.Forbidden();
    }
    
    const db = getDatabaseCompat();
    
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
    if (!user) {
      throw ErrorTypes.NotFound('用户');
    }
    
    // 获取权限
    const permissions = db.prepare(`
      SELECT module, action, granted
      FROM permissions
      WHERE user_id = ?
    `).all(id);
    
    res.json({
      success: true,
      data: {
        role: user.role,
        permissions
      }
    });
  })
);

module.exports = router;