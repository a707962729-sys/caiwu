require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fileUpload = require('express-fileupload');
const path = require('path');
const config = require('./config');
const { errorHandler, notFoundHandler, requestLogger } = require('./middleware/error');
const { initDatabase, initSchema, isSchemaInitialized } = require('./database');

// 导入路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const companyRoutes = require('./routes/companies');
const settingsRoutes = require('./routes/settings');
const transactionRoutes = require('./routes/transactions');
const contractRoutes = require('./routes/contracts');
const orderRoutes = require('./routes/orders');
const reimbursementRoutes = require('./routes/reimbursements');
const invoiceRoutes = require('./routes/invoices');
const partnerRoutes = require('./routes/partners');
const aiRoutes = require('./routes/ai');
const aiIntelligenceRoutes = require('./routes/ai-intelligence');
const dashboardRoutes = require('./routes/dashboard');
const auditLogRoutes = require('./routes/audit-logs');
const attendanceRoutes = require('./routes/attendance');
const leaveRequestRoutes = require('./routes/leave-requests');
const salaryRoutes = require('./routes/salaries');
const supplierRoutes = require('./routes/suppliers');
const purchaseOrderRoutes = require('./routes/purchase-orders');
const goodsReceiptRoutes = require('./routes/goods-receipts');
const dictRoutes = require('./routes/dict');
const codeRulesRoutes = require('./routes/code-rules');
const organizationRoutes = require('./routes/organizations');
const warehouseRoutes = require('./routes/warehouses');
const productRoutes = require('./routes/products');
const inventoryRoutes = require('./routes/inventory');
const subjectRoutes = require('./routes/subjects');
const voucherRoutes = require('./routes/vouchers');
const financialReportRoutes = require('./routes/financial-reports');
const customerRoutes = require('./routes/customers');
const contactRoutes = require('./routes/contacts');
const followRecordRoutes = require('./routes/follow-records');
const aiQueryRoutes = require('./routes/ai-query');
const aiAnalyticsRoutes = require('./routes/ai-analytics');
const financeRoutes = require('./routes/finance');
const openclawRoutes = require('./routes/openclaw');
const quotationRoutes = require('./routes/quotations');
const salesOrderRoutes = require('./routes/sales-orders');
const purchaseRequestRoutes = require('./routes/purchase-requests');
const receivableRoutes = require('./routes/receivables');
const payableRoutes = require('./routes/payables');
const invoiceEntryRoutes = require('./routes/invoice-entry');
const { openclawService } = require('./services/openclaw');

// 创建Express应用
const app = express();

// 基础中间件
app.use(helmet()); // 安全头
app.use(cors()); // 跨域
app.use(compression()); // 压缩
app.use(express.json({ limit: '10mb' })); // JSON解析
app.use(express.urlencoded({ extended: true })); // URL编码解析
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: config.upload.maxSize }
})); // 文件上传

// 静态文件
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// 请求日志
if (config.env !== 'test') {
  app.use(morgan('combined'));
}
app.use(requestLogger);

// API速率限制
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 每个IP最多1000请求
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: '请求过于频繁，请稍后再试'
  }
});

// 登录速率限制（更严格）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 每个IP最多10次登录尝试
  message: {
    success: false,
    error: 'TOO_MANY_LOGIN_ATTEMPTS',
    message: '登录尝试过多，请15分钟后再试'
  }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/company', companyRoutes); // 单数别名，前端兼容
app.use('/api/settings', settingsRoutes);
app.use('/api/config', settingsRoutes); // config 别名，前端兼容
app.use('/api/transactions', transactionRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reimbursements', reimbursementRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/invoice-entry', invoiceEntryRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai', aiIntelligenceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/dict', dictRoutes);
app.use('/api/code-rules', codeRulesRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/goods-receipts', goodsReceiptRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/financial-reports', financialReportRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/follow-records', followRecordRoutes);
app.use('/api/ai-query', aiQueryRoutes);
app.use('/api/ai-analytics', aiAnalyticsRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/openclaw', openclawRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/purchase-requests', purchaseRequestRoutes);
app.use('/api/receivables', receivableRoutes);
app.use('/api/payables', payableRoutes);

// AI 规则路由
const aiRulesRoutes = require('./routes/ai-rules');
app.use('/api/ai-rules', aiRulesRoutes);

// 工作流路由
const workflowRoutes = require('./routes/workflows');
app.use('/api/workflows', workflowRoutes);

// 部门路由
const departmentRoutes = require('./routes/departments');
app.use('/api/departments', departmentRoutes);

// 角色路由
const roleRoutes = require('./routes/roles');
app.use('/api/roles', roleRoutes);

// 报销标准路由
const reimbursementStandardRoutes = require('./routes/reimbursement-standards');
app.use('/api/reimbursement-standards', reimbursementStandardRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.env
  });
});

// API信息
app.get('/api', (req, res) => {
  res.json({
    name: '财务管家 API',
    version: '1.0.0',
    description: '企业财务管理API服务',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      transactions: '/api/transactions',
      contracts: '/api/contracts',
      orders: '/api/orders',
      reimbursements: '/api/reimbursements',
      invoices: '/api/invoices',
      partners: '/api/partners',
      ai: '/api/ai',
      dashboard: '/api/dashboard',
      auditLogs: '/api/audit-logs',
      attendance: '/api/attendance',
      leaveRequests: '/api/leave-requests',
      salaries: '/api/salaries',
      dict: '/api/dict',
      codeRules: '/api/code-rules',
      organizations: '/api/organizations',
      suppliers: '/api/suppliers',
      purchaseOrders: '/api/purchase-orders',
      goodsReceipts: '/api/goods-receipts',
      warehouses: '/api/warehouses',
      products: '/api/products',
      inventory: '/api/inventory',
      subjects: '/api/subjects',
      vouchers: '/api/vouchers',
      financialReports: '/api/financial-reports'
    }
  });
});

// 404处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    
    // 检查并初始化表结构
    if (!isSchemaInitialized()) {
      console.log('Initializing database schema...');
      initSchema();
    }
    
    // 初始化 OpenClaw 服务
    await openclawService.init();
    
    // 启动HTTP服务
    app.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port}`);
      console.log(`📚 Environment: ${config.env}`);
      console.log(`🔗 API: http://localhost:${config.port}/api`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  // 生产环境只记录错误类型，避免泄露敏感信息
  if (config.env === 'production') {
    console.error('Uncaught Exception:', error.name, error.message);
  } else {
    console.error('Uncaught Exception:', error);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  // 生产环境简化日志
  if (config.env === 'production') {
    console.error('Unhandled Rejection:', String(reason));
  } else {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  }
});

module.exports = { app, startServer };

// 自动启动
if (require.main === module) {
  startServer();
}