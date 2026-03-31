const path = require('path');

module.exports = {
  // 环境
  env: process.env.NODE_ENV || 'development',
  
  // 服务端口
  port: parseInt(process.env.PORT) || 3000,
  
  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  // 数据库配置
  database: {
    path: process.env.DATABASE_PATH || path.join(__dirname, '../../../data/caiwu.db')
  },
  
  // 文件上传配置
  upload: {
    dir: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
    maxSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
  },
  
  // AI服务配置
  ai: {
    serviceUrl: process.env.AI_SERVICE_URL || '',
    apiKey: process.env.AI_API_KEY || ''
  },
  
  // 日志配置
  log: {
    level: process.env.LOG_LEVEL || 'info'
  },
  
  // 分页配置
  pagination: {
    defaultPage: 1,
    defaultPageSize: 20,
    maxPageSize: 100
  },
  
  // 角色权限映射
  roles: {
    boss: {
      name: '老板',
      permissions: ['*']
    },
    accountant: {
      name: '会计',
      permissions: [
        'transactions:*', 'contracts:read', 'contracts:write',
        'orders:read', 'orders:write', 'invoices:*',
        'reimbursements:*', 'receivables:*', 'payables:*',
        'reports:*', 'partners:*'
      ]
    },
    employee: {
      name: '员工',
      permissions: [
        'transactions:read', 'contracts:read', 'orders:read',
        'reimbursements:create', 'reimbursements:read', 'reimbursements:update',
        'invoices:read', 'profile:*'
      ]
    }
  }
};