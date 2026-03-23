/**
 * 云端认证服务路由
 * 
 * 功能：
 * - 公司注册
 * - 员工账号创建
 * - 云端登录
 * - 数据同步
 * - Token管理
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getDatabaseCompat } = require('../database');
const { authMiddleware, roleMiddleware, generateToken, hashPassword, verifyPassword } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate } = require('../middleware/validation');
const SyncService = require('../services/sync');

// 同步服务实例
let syncService = null;

/**
 * 初始化同步服务
 */
function getSyncService() {
  if (!syncService) {
    syncService = new SyncService();
  }
  return syncService;
}

// ============ 验证模式 ============

const validationSchemas = {
  register: {
    body: {
      type: 'object',
      required: ['companyName', 'adminUsername', 'adminPassword', 'adminEmail'],
      properties: {
        companyName: { type: 'string', minLength: 2, maxLength: 100 },
        adminUsername: { type: 'string', minLength: 3, maxLength: 50 },
        adminPassword: { type: 'string', minLength: 6, maxLength: 100 },
        adminEmail: { type: 'string', format: 'email' },
        contactPhone: { type: 'string', pattern: '^1[3-9]\\d{9}$' }
      }
    }
  },
  createUser: {
    body: {
      type: 'object',
      required: ['username', 'password', 'realName'],
      properties: {
        username: { type: 'string', minLength: 3, maxLength: 50 },
        password: { type: 'string', minLength: 6, maxLength: 100 },
        realName: { type: 'string', minLength: 2, maxLength: 50 },
        phone: { type: 'string', pattern: '^1[3-9]\\d{9}$' },
        email: { type: 'string', format: 'email' },
        department: { type: 'string', maxLength: 50 },
        position: { type: 'string', maxLength: 50 },
        role: { type: 'string', enum: ['boss', 'accountant', 'employee'] }
      }
    }
  },
  login: {
    body: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string' },
        password: { type: 'string' },
        deviceId: { type: 'string' }
      }
    }
  },
  sync: {
    query: {
      type: 'object',
      properties: {
        lastSyncTime: { type: 'string' },
        entities: { type: 'string' }
      }
    }
  },
  push: {
    body: {
      type: 'object',
      required: ['entity', 'action', 'data'],
      properties: {
        entity: { type: 'string' },
        entityId: { type: 'string' },
        action: { type: 'string', enum: ['create', 'update', 'delete'] },
        data: { type: 'object' }
      }
    }
  }
};

// ============ 中间件 ============

/**
 * 云端认证中间件
 * 验证云端Token并检查会话状态
 */
async function cloudAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: '未提供认证令牌'
    });
  }
  
  const token = authHeader.substring(7);
  const db = getDatabaseCompat();
  
  try {
    // 验证Token
    const decoded = verifyCloudToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: '无效或过期的令牌'
      });
    }
    
    // 检查会话是否有效
    const session = db.prepare(`
      SELECT * FROM cloud_sessions 
      WHERE user_id = ? AND token_id = ? AND expires_at > datetime('now')
    `).get(decoded.sub, decoded.jti);
    
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'SESSION_EXPIRED',
        message: '会话已过期，请重新登录'
      });
    }
    
    // 检查Token是否在黑名单中
    const blacklisted = db.prepare(`
      SELECT id FROM token_blacklist 
      WHERE token_id = ? AND expires_at > datetime('now')
    `).get(decoded.jti);
    
    if (blacklisted) {
      return res.status(401).json({
        success: false,
        error: 'TOKEN_REVOKED',
        message: '令牌已被撤销'
      });
    }
    
    req.user = decoded;
    req.session = session;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'AUTH_FAILED',
      message: '认证失败'
    });
  }
}

/**
 * 请求签名验证中间件
 */
function signatureMiddleware(req, res, next) {
  const timestamp = req.headers['x-timestamp'];
  const signature = req.headers['x-signature'];
  const nonce = req.headers['x-nonce'];
  
  // 可选：如果配置了签名验证
  if (process.env.ENABLE_SIGNATURE_AUTH === 'true') {
    if (!timestamp || !signature || !nonce) {
      return res.status(401).json({
        success: false,
        error: 'MISSING_SIGNATURE',
        message: '缺少签名参数'
      });
    }
    
    // 检查时间戳有效性 (±5分钟)
    const now = Date.now();
    const requestTime = parseInt(timestamp, 10);
    if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
      return res.status(401).json({
        success: false,
        error: 'REQUEST_EXPIRED',
        message: '请求已过期'
      });
    }
    
    // 检查Nonce是否已使用 (防重放)
    const db = getDatabaseCompat();
    const usedNonce = db.prepare('SELECT id FROM used_nonces WHERE nonce = ?').get(nonce);
    if (usedNonce) {
      return res.status(401).json({
        success: false,
        error: 'REPLAY_ATTACK',
        message: '检测到重放攻击'
      });
    }
    
    // 验证签名
    const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body) || '').digest('hex');
    const signData = `${timestamp}${req.method}${req.path}${bodyHash}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.SIGNATURE_SECRET || 'default-secret')
      .update(signData)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_SIGNATURE',
        message: '签名验证失败'
      });
    }
    
    // 记录已使用的Nonce
    db.prepare('INSERT INTO used_nonces (nonce, created_at) VALUES (?, datetime("now"))').run(nonce);
  }
  
  next();
}

// ============ 工具函数 ============

/**
 * 生成云端Token
 */
function generateCloudToken(user, deviceId = null) {
  const jwt = require('jsonwebtoken');
  const config = require('../config');
  
  const payload = {
    jti: uuidv4(),
    sub: user.id,
    username: user.username,
    role: user.role,
    companyId: user.company_id,
    deviceId: deviceId,
    type: 'cloud'
  };
  
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: '7d'
  });
}

/**
 * 验证云端Token
 */
function verifyCloudToken(token) {
  const jwt = require('jsonwebtoken');
  const config = require('../config');
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.type !== 'cloud') {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * 生成刷新Token
 */
function generateRefreshToken(userId, deviceId = null) {
  const jwt = require('jsonwebtoken');
  const config = require('../config');
  
  const payload = {
    jti: uuidv4(),
    sub: userId,
    deviceId: deviceId,
    type: 'refresh'
  };
  
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: '30d'
  });
}

/**
 * 创建云端会话
 */
function createCloudSession(userId, tokenId, deviceId, userAgent, ip) {
  const db = getDatabaseCompat();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天
  
  db.prepare(`
    INSERT INTO cloud_sessions (id, user_id, token_id, device_id, user_agent, ip_address, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), userId, tokenId, deviceId, userAgent, ip, expiresAt.toISOString());
}

/**
 * 记录登录日志
 */
function logLogin(userId, action, ip, userAgent, success, details = null) {
  const db = getDatabaseCompat();
  db.prepare(`
    INSERT INTO cloud_login_logs (id, user_id, action, ip_address, user_agent, success, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(uuidv4(), userId, action, ip, userAgent, success ? 1 : 0, details ? JSON.stringify(details) : null);
}

// ============ 路由 ============

/**
 * @route   POST /api/cloud/register
 * @desc    公司注册（创建公司和管理员账号）
 * @access  Public
 */
router.post('/register',
  validate(validationSchemas.register),
  asyncHandler(async (req, res) => {
    const { companyName, adminUsername, adminPassword, adminEmail, contactPhone } = req.body;
    const db = getDatabaseCompat();
    
    // 检查公司名是否已存在
    const existingCompany = db.prepare('SELECT id FROM companies WHERE name = ?').get(companyName);
    if (existingCompany) {
      throw ErrorTypes.DuplicateEntry('公司名称');
    }
    
    // 检查管理员用户名是否已存在
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername);
    if (existingUser) {
      throw ErrorTypes.DuplicateEntry('管理员用户名');
    }
    
    // 创建公司
    const companyId = uuidv4();
    db.prepare(`
      INSERT INTO companies (id, name, contact_phone, contact_email, status, created_at)
      VALUES (?, ?, ?, ?, 'active', datetime('now'))
    `).run(companyId, companyName, contactPhone || null, adminEmail);
    
    // 创建管理员账号
    const adminId = uuidv4();
    const passwordHash = await hashPassword(adminPassword);
    
    db.prepare(`
      INSERT INTO users (id, username, password_hash, real_name, email, role, company_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'boss', ?, 'active', datetime('now'))
    `).run(adminId, adminUsername, passwordHash, `${companyName}管理员`, adminEmail, companyId);
    
    res.status(201).json({
      success: true,
      data: {
        companyId,
        adminId,
        message: '公司注册成功，请使用管理员账号登录'
      }
    });
  })
);

/**
 * @route   POST /api/cloud/create-user
 * @desc    创建员工账号（管理员操作）
 * @access  Private (Admin only)
 */
router.post('/create-user',
  cloudAuthMiddleware,
  roleMiddleware('boss', 'accountant'),
  validate(validationSchemas.createUser),
  asyncHandler(async (req, res) => {
    const { username, password, realName, phone, email, department, position, role = 'employee' } = req.body;
    const db = getDatabaseCompat();
    
    // 获取当前用户的公司ID
    const currentUser = db.prepare('SELECT company_id FROM users WHERE id = ?').get(req.user.sub);
    if (!currentUser) {
      throw ErrorTypes.NotFound('用户');
    }
    
    // 检查用户名是否已存在
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      throw ErrorTypes.DuplicateEntry('用户名');
    }
    
    // 创建员工账号
    const userId = uuidv4();
    const passwordHash = await hashPassword(password);
    
    db.prepare(`
      INSERT INTO users (
        id, username, password_hash, real_name, email, phone, 
        role, company_id, department, position, status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
    `).run(
      userId, username, passwordHash, realName, 
      email || null, phone || null,
      role, currentUser.company_id, 
      department || null, position || null
    );
    
    // 同步到云端缓存
    getSyncService().queueSync('users', userId, 'create');
    
    // 记录操作日志
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at)
      VALUES (?, ?, 'create_user', 'users', ?, ?, datetime('now'))
    `).run(uuidv4(), req.user.sub, userId, JSON.stringify({ username, realName, role }));
    
    res.status(201).json({
      success: true,
      data: {
        userId,
        username,
        realName,
        role,
        createdAt: new Date().toISOString()
      }
    });
  })
);

/**
 * @route   POST /api/cloud/login
 * @desc    云端登录
 * @access  Public
 */
router.post('/login',
  validate(validationSchemas.login),
  asyncHandler(async (req, res) => {
    const { username, password, deviceId } = req.body;
    const db = getDatabaseCompat();
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // 查找用户
    const user = db.prepare(`
      SELECT u.*, c.name as company_name, c.status as company_status
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.username = ? AND u.status = 'active'
    `).get(username);
    
    if (!user) {
      logLogin(null, 'login', ip, userAgent, false, { reason: 'user_not_found', username });
      throw ErrorTypes.Unauthorized('用户名或密码错误');
    }
    
    // 检查公司状态
    if (user.company_status !== 'active') {
      logLogin(user.id, 'login', ip, userAgent, false, { reason: 'company_inactive' });
      throw ErrorTypes.Forbidden('公司账号已停用');
    }
    
    // 验证密码
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      logLogin(user.id, 'login', ip, userAgent, false, { reason: 'invalid_password' });
      throw ErrorTypes.Unauthorized('用户名或密码错误');
    }
    
    // 生成Token
    const token = generateCloudToken(user, deviceId);
    const refreshToken = generateRefreshToken(user.id, deviceId);
    
    // 创建会话
    const decoded = verifyCloudToken(token);
    createCloudSession(user.id, decoded.jti, deviceId, userAgent, ip);
    
    // 更新最后登录时间
    db.prepare('UPDATE users SET last_login_at = datetime("now") WHERE id = ?').run(user.id);
    
    // 记录成功登录
    logLogin(user.id, 'login', ip, userAgent, true, { deviceId });
    
    // 移除敏感信息
    delete user.password_hash;
    
    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        expiresIn: 7 * 24 * 60 * 60, // 7天（秒）
        user: {
          id: user.id,
          username: user.username,
          realName: user.real_name,
          role: user.role,
          companyId: user.company_id,
          companyName: user.company_name,
          department: user.department,
          position: user.position
        }
      }
    });
  })
);

/**
 * @route   POST /api/cloud/logout
 * @desc    云端登出
 * @access  Private
 */
router.post('/logout',
  cloudAuthMiddleware,
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const tokenId = req.user.jti;
    const userId = req.user.sub;
    
    // 将Token加入黑名单
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    db.prepare(`
      INSERT INTO token_blacklist (id, token_id, user_id, reason, expires_at)
      VALUES (?, ?, ?, 'logout', ?)
    `).run(uuidv4(), tokenId, userId, expiresAt.toISOString());
    
    // 删除会话
    db.prepare('DELETE FROM cloud_sessions WHERE token_id = ?').run(tokenId);
    
    // 记录登出日志
    logLogin(userId, 'logout', req.ip, req.headers['user-agent'], true);
    
    res.json({
      success: true,
      message: '登出成功'
    });
  })
);

/**
 * @route   POST /api/cloud/refresh
 * @desc    刷新Token
 * @access  Private
 */
router.post('/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw ErrorTypes.BadRequest('缺少刷新令牌');
    }
    
    // 验证刷新令牌
    let decoded;
    try {
      const jwt = require('jsonwebtoken');
      const config = require('../config');
      decoded = jwt.verify(refreshToken, config.jwt.secret);
      
      if (decoded.type !== 'refresh') {
        throw ErrorTypes.Unauthorized('无效的刷新令牌');
      }
    } catch (error) {
      throw ErrorTypes.Unauthorized('刷新令牌已过期，请重新登录');
    }
    
    const db = getDatabaseCompat();
    
    // 检查刷新令牌是否在黑名单中
    const blacklisted = db.prepare(`
      SELECT id FROM token_blacklist 
      WHERE token_id = ? AND expires_at > datetime('now')
    `).get(decoded.jti);
    
    if (blacklisted) {
      throw ErrorTypes.Unauthorized('刷新令牌已被撤销');
    }
    
    // 获取用户信息
    const user = db.prepare(`
      SELECT u.*, c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = ? AND u.status = 'active'
    `).get(decoded.sub);
    
    if (!user) {
      throw ErrorTypes.NotFound('用户');
    }
    
    // 生成新的访问令牌
    const newToken = generateCloudToken(user, decoded.deviceId);
    const newRefreshToken = generateRefreshToken(user.id, decoded.deviceId);
    
    // 将旧的刷新令牌加入黑名单
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    db.prepare(`
      INSERT INTO token_blacklist (id, token_id, user_id, reason, expires_at)
      VALUES (?, ?, ?, 'refresh', ?)
    `).run(uuidv4(), decoded.jti, user.id, expiresAt.toISOString());
    
    // 创建新会话
    const newDecoded = verifyCloudToken(newToken);
    createCloudSession(user.id, newDecoded.jti, decoded.deviceId, req.headers['user-agent'], req.ip);
    
    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
        expiresIn: 7 * 24 * 60 * 60
      }
    });
  })
);

/**
 * @route   GET /api/cloud/verify
 * @desc    验证Token有效性
 * @access  Private
 */
router.get('/verify',
  cloudAuthMiddleware,
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    // 获取最新用户信息
    const user = db.prepare(`
      SELECT u.id, u.username, u.real_name, u.role, u.company_id, 
             u.department, u.position, u.status
      FROM users u
      WHERE u.id = ?
    `).get(req.user.sub);
    
    if (!user) {
      throw ErrorTypes.NotFound('用户');
    }
    
    res.json({
      success: true,
      data: {
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          realName: user.real_name,
          role: user.role,
          companyId: user.company_id,
          department: user.department,
          position: user.position
        }
      }
    });
  })
);

/**
 * @route   GET /api/cloud/sync
 * @desc    获取数据同步状态
 * @access  Private
 */
router.get('/sync',
  cloudAuthMiddleware,
  asyncHandler(async (req, res) => {
    const { lastSyncTime, entities } = req.query;
    const syncService = getSyncService();
    
    const status = await syncService.getSyncStatus(req.user.sub, {
      lastSyncTime: lastSyncTime ? new Date(lastSyncTime) : null,
      entities: entities ? entities.split(',') : null
    });
    
    res.json({
      success: true,
      data: status
    });
  })
);

/**
 * @route   POST /api/cloud/push
 * @desc    推送数据到本地服务
 * @access  System
 */
router.post('/push',
  signatureMiddleware,
  validate(validationSchemas.push),
  asyncHandler(async (req, res) => {
    const { entity, entityId, action, data } = req.body;
    const syncService = getSyncService();
    
    const result = await syncService.pushToLocal(entity, entityId, action, data);
    
    res.json({
      success: true,
      data: result
    });
  })
);

/**
 * @route   GET /api/cloud/pull
 * @desc    拉取云端数据
 * @access  Private
 */
router.get('/pull',
  cloudAuthMiddleware,
  asyncHandler(async (req, res) => {
    const { lastSyncTime, entities, limit = 100 } = req.query;
    const syncService = getSyncService();
    
    const data = await syncService.pullFromCloud(req.user.sub, {
      lastSyncTime: lastSyncTime ? new Date(lastSyncTime) : null,
      entities: entities ? entities.split(',') : null,
      limit: parseInt(limit, 10)
    });
    
    res.json({
      success: true,
      data
    });
  })
);

/**
 * @route   GET /api/cloud/sessions
 * @desc    获取当前用户的所有活跃会话
 * @access  Private
 */
router.get('/sessions',
  cloudAuthMiddleware,
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const sessions = db.prepare(`
      SELECT id, device_id, user_agent, ip_address, created_at, expires_at
      FROM cloud_sessions
      WHERE user_id = ? AND expires_at > datetime('now')
      ORDER BY created_at DESC
    `).all(req.user.sub);
    
    res.json({
      success: true,
      data: sessions
    });
  })
);

/**
 * @route   DELETE /api/cloud/sessions/:sessionId
 * @desc    注销指定会话（强制下线）
 * @access  Private
 */
router.delete('/sessions/:sessionId',
  cloudAuthMiddleware,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const db = getDatabaseCompat();
    
    // 获取会话
    const session = db.prepare(`
      SELECT * FROM cloud_sessions WHERE id = ? AND user_id = ?
    `).get(sessionId, req.user.sub);
    
    if (!session) {
      throw ErrorTypes.NotFound('会话');
    }
    
    // 将Token加入黑名单
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    db.prepare(`
      INSERT INTO token_blacklist (id, token_id, user_id, reason, expires_at)
      VALUES (?, ?, ?, 'force_logout', ?)
    `).run(uuidv4(), session.token_id, req.user.sub, expiresAt.toISOString());
    
    // 删除会话
    db.prepare('DELETE FROM cloud_sessions WHERE id = ?').run(sessionId);
    
    res.json({
      success: true,
      message: '会话已注销'
    });
  })
);

/**
 * @route   GET /api/cloud/login-history
 * @desc    获取登录历史
 * @access  Private
 */
router.get('/login-history',
  cloudAuthMiddleware,
  asyncHandler(async (req, res) => {
    const { limit = 20, offset = 0 } = req.query;
    const db = getDatabaseCompat();
    
    const history = db.prepare(`
      SELECT action, ip_address, user_agent, success, details, created_at
      FROM cloud_login_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user.sub, parseInt(limit, 10), parseInt(offset, 10));
    
    res.json({
      success: true,
      data: history
    });
  })
);

module.exports = router;