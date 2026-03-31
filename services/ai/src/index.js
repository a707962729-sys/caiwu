/**
 * AI 服务入口文件
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config');
const logger = require('./utils/logger');

// 创建 Express 应用
const app = express();

// ============ 全局错误处理 ============

// 处理未捕获的Promise rejection
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Unhandled Rejection:', reason);
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  console.error('Uncaught Exception:', error);
  // 不立即退出，给5秒让日志写入
  setTimeout(() => {
    process.exit(1);
  }, 5000);
});

// 中间件
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// 速率限制
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: '请求过于频繁，请稍后再试' }
});
app.use('/api/', limiter);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'caiwu-ai',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API 路由
app.use('/api/ai', require('./routes/ai'));
app.use('/api/ocr', require('./routes/ocr'));
app.use('/api/ai/agent', require('./routes/agent'));

// 错误处理
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || '服务器内部错误',
    code: err.code || 'INTERNAL_ERROR'
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 启动服务器
const PORT = config.port || 3001;
const server = app.listen(PORT, () => {
  logger.info(`AI 服务已启动: http://localhost:${PORT}`);
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   caiwu-ai-service v1.0.0                                 ║
║   财务管家 AI 服务                                        ║
║                                                           ║
║   🌐 Listening: http://localhost:${PORT}                      ║
║   🤖 AI Provider: ${config.ai?.provider || 'mock'}                                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// 服务器错误处理
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`端口 ${PORT} 已被占用`);
    console.error(`端口 ${PORT} 已被占用`);
  } else {
    logger.error('Server error:', error);
    console.error('Server error:', error);
  }
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM 信号，正在关闭...');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('收到 SIGINT 信号，正在关闭...');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

module.exports = app;
