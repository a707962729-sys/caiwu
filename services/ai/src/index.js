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
app.listen(PORT, () => {
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

module.exports = app;