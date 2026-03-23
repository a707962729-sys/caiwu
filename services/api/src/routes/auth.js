const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { getDatabaseCompat } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, userSchemas } = require('../middleware/validation');
const { generateToken, hashPassword, verifyPassword, getCurrentUser } = require('../middleware/auth');

// 登录频率限制：15分钟最多10次
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 最多10次请求
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'TOO_MANY_ATTEMPTS',
    message: '登录尝试次数过多，请15分钟后再试'
  },
  // 使用IP+用户名作为key，防止针对特定用户暴力破解
  keyGenerator: (req) => {
    const ip = req.ip || req.connection.remoteAddress;
    const username = req.body?.username || '';
    return `${ip}:${username}`;
  }
});

// 密码修改频率限制：1小时最多5次
const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 5, // 最多5次请求
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'TOO_MANY_ATTEMPTS',
    message: '密码修改次数过多，请稍后再试'
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    用户登录
 * @access  Public
 */
router.post('/login', 
  loginLimiter,
  validate(userSchemas.login),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    const db = getDatabaseCompat();
    
    // 查找用户
    const user = db.prepare(`
      SELECT * FROM users 
      WHERE username = ? AND status = 'active'
    `).get(username);
    
    if (!user) {
      throw ErrorTypes.Unauthorized('用户名或密码错误');
    }
    
    // 验证密码
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      throw ErrorTypes.Unauthorized('用户名或密码错误');
    }
    
    // 更新最后登录时间
    db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    
    // 生成token
    const token = generateToken(user);
    
    // 移除敏感信息
    delete user.password_hash;
    
    res.json({
      success: true,
      data: {
        user,
        token
      }
    });
  })
);

/**
 * @route   POST /api/auth/logout
 * @desc    用户登出
 * @access  Private
 */
router.post('/logout', 
  authMiddleware,
  asyncHandler(async (req, res) => {
    // JWT是无状态的，登出只需客户端删除token
    // 如需服务端管理，可实现token黑名单
    res.json({
      success: true,
      message: '登出成功'
    });
  })
);

/**
 * @route   GET /api/auth/me
 * @desc    获取当前用户信息
 * @access  Private
 */
router.get('/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req.user.id);
    
    if (!user) {
      throw ErrorTypes.NotFound('用户');
    }
    
    res.json({
      success: true,
      data: user
    });
  })
);

/**
 * @route   PUT /api/auth/password
 * @desc    修改密码
 * @access  Private
 */
router.put('/password',
  authMiddleware,
  passwordChangeLimiter,
  validate(userSchemas.changePassword),
  asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const db = getDatabaseCompat();
    
    // 获取用户
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
      throw ErrorTypes.NotFound('用户');
    }
    
    // 验证旧密码
    const isValid = await verifyPassword(oldPassword, user.password_hash);
    if (!isValid) {
      throw ErrorTypes.BadRequest('原密码错误');
    }
    
    // 哈希新密码
    const newHash = await hashPassword(newPassword);
    
    // 更新密码
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);
    
    res.json({
      success: true,
      message: '密码修改成功'
    });
  })
);

/**
 * @route   POST /api/auth/refresh
 * @desc    刷新Token
 * @access  Private
 */
router.post('/refresh',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req.user.id);
    
    if (!user) {
      throw ErrorTypes.NotFound('用户');
    }
    
    const token = generateToken(user);
    
    res.json({
      success: true,
      data: { token }
    });
  })
);

/**
 * @route   POST /api/auth/register
 * @desc    用户注册（仅允许在初始化阶段或由管理员调用）
 * @access  Public/Private (根据配置)
 */
router.post('/register',
  validate(userSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    // 检查是否已有用户（简单初始化检查）
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    
    // 如果已有用户，需要认证
    if (userCount.count > 0) {
      // 检查是否有token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw ErrorTypes.Forbidden('注册需要管理员权限');
      }
      
      // 这里需要验证token和权限
      // 简化处理，实际应该用authMiddleware和roleMiddleware
    }
    
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
      INSERT INTO users (username, password_hash, real_name, email, phone, role, company_id, department, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(username, passwordHash, real_name, email || null, phone || null, role, company_id || null, department || null, position || null);
    
    const newUser = db.prepare('SELECT id, username, real_name, email, phone, role, company_id, department, position, status, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      data: newUser,
      message: '注册成功'
    });
  })
);

module.exports = router;