const dayjs = require('dayjs');

/**
 * 统一错误响应
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 常见错误类型
 */
const ErrorTypes = {
  // 400 Bad Request
  BadRequest: (message = '请求参数错误', details = null) => 
    new AppError(message, 400, 'BAD_REQUEST', details),
  
  ValidationError: (details = null) => 
    new AppError('数据验证失败', 400, 'VALIDATION_ERROR', details),
  
  // 401 Unauthorized
  Unauthorized: (message = '未授权访问') => 
    new AppError(message, 401, 'UNAUTHORIZED'),
  
  InvalidToken: () => 
    new AppError('无效或过期的令牌', 401, 'INVALID_TOKEN'),
  
  // 403 Forbidden
  Forbidden: (message = '权限不足') => 
    new AppError(message, 403, 'FORBIDDEN'),
  
  // 404 Not Found
  NotFound: (resource = '资源') => 
    new AppError(`${resource}不存在`, 404, 'NOT_FOUND'),
  
  // 409 Conflict
  Conflict: (message = '资源冲突') => 
    new AppError(message, 409, 'CONFLICT'),
  
  DuplicateEntry: (field = '') => 
    new AppError(`${field}已存在`, 409, 'DUPLICATE_ENTRY'),
  
  // 422 Unprocessable Entity
  UnprocessableEntity: (message = '无法处理的实体') => 
    new AppError(message, 422, 'UNPROCESSABLE_ENTITY'),
  
  // 500 Internal Server Error
  InternalError: (message = '服务器内部错误') => 
    new AppError(message, 500, 'INTERNAL_ERROR'),
  
  // 503 Service Unavailable
  ServiceUnavailable: (service = '服务') => 
    new AppError(`${service}暂时不可用`, 503, 'SERVICE_UNAVAILABLE')
};

/**
 * 异步处理包装器
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 错误处理中间件
 */
function errorHandler(err, req, res, next) {
  // 如果响应已发送，交给Express默认处理
  if (res.headersSent) {
    return next(err);
  }
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  // 开发环境下打印完整错误信息
  if (!isProduction) {
    console.error('Error:', err);
  } else {
    // 生产环境只打印基本错误信息，不打印堆栈
    console.error('[Error]', {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method
    });
  }
  
  // 处理不同类型的错误
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || '服务器内部错误';
  let details = err.details || null;
  
  // SQLite 错误处理
  if (err.code === 'SQLITE_CONSTRAINT') {
    statusCode = 409;
    code = 'CONSTRAINT_VIOLATION';
    message = '数据约束冲突';
    
    if (err.message.includes('UNIQUE constraint failed')) {
      message = '数据已存在';
    }
  }
  
  // Joi 验证错误
  if (err.isJoi) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = '数据验证失败';
    details = err.details.map(d => ({
      field: d.path.join('.'),
      message: d.message
    }));
  }
  
  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = '无效的令牌';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = '令牌已过期';
  }
  
  // 生产环境隐藏内部错误详情
  if (isProduction && statusCode === 500 && !err.isOperational) {
    message = '服务器内部错误';
    code = 'INTERNAL_ERROR';
    details = null;
  }
  
  // 构造响应
  const response = {
    success: false,
    error: code,
    message: message
  };
  
  if (details) {
    response.details = details;
  }
  
  // 仅开发环境添加堆栈跟踪
  if (!isProduction) {
    response.stack = err.stack;
  }
  
  res.status(statusCode).json(response);
}

/**
 * 404处理中间件
 */
function notFoundHandler(req, res, next) {
  const error = ErrorTypes.NotFound(`路由 ${req.method} ${req.path}`);
  next(error);
}

/**
 * 请求日志中间件
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.id
    };
    
    if (res.statusCode >= 400) {
      console.error('[API Error]', log);
    } else {
      console.log('[API]', log);
    }
  });
  
  next();
}

module.exports = {
  AppError,
  ErrorTypes,
  asyncHandler,
  errorHandler,
  notFoundHandler,
  requestLogger
};