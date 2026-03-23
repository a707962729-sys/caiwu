const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { getDatabase } = require('../database');

/**
 * 生成JWT Token
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    companyId: user.company_id
  };
  
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
}

/**
 * 验证JWT Token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    return null;
  }
}

/**
 * 哈希密码
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * 验证密码
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * 认证中间件
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: '未提供认证令牌'
    });
  }
  
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: '无效或过期的令牌'
    });
  }
  
  req.user = decoded;
  next();
}

/**
 * 可选认证中间件 - 有token则验证，无token也放行
 */
function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }
  
  next();
}

/**
 * 角色检查中间件
 */
function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: '未认证'
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '权限不足'
      });
    }
    
    next();
  };
}

/**
 * 角色检查中间件 (别名，用于审计日志路由)
 */
function requireRole(allowedRoles) {
  return roleMiddleware(...allowedRoles);
}

/**
 * 权限检查中间件
 */
function permissionMiddleware(module, action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: '未认证'
      });
    }
    
    const role = req.user.role;
    const roleConfig = config.roles[role];
    
    if (!roleConfig) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '角色不存在'
      });
    }
    
    // 检查是否有通配符权限
    if (roleConfig.permissions.includes('*')) {
      return next();
    }
    
    // 检查模块级权限
    const modulePermission = `${module}:*`;
    if (roleConfig.permissions.includes(modulePermission)) {
      return next();
    }
    
    // 检查具体权限
    const specificPermission = `${module}:${action}`;
    if (roleConfig.permissions.includes(specificPermission)) {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: '权限不足'
    });
  };
}

/**
 * 获取当前用户完整信息
 */
async function getCurrentUser(userId) {
  const { getDatabaseCompat } = require('../database');
  const db = getDatabaseCompat();
  const user = db.prepare(`
    SELECT u.*, c.name as company_name
    FROM users u
    LEFT JOIN companies c ON u.company_id = c.id
    WHERE u.id = ? AND u.status = 'active'
  `).get(userId);
  
  if (user) {
    delete user.password_hash;
  }
  
  return user;
}

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  authMiddleware,
  optionalAuthMiddleware,
  roleMiddleware,
  requireRole,
  permissionMiddleware,
  getCurrentUser
};