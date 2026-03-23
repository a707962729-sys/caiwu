/**
 * caiwu-gateway - 财务管家 API Gateway
 * 
 * 功能：
 * - HTTP 反向代理
 * - WebSocket 代理支持
 * - 请求日志记录
 * - 速率限制
 * - CORS 支持
 */

const http = require('http');
const httpProxy = require('http-proxy');
const { WebSocketServer } = require('ws');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// 加载配置
const configPath = path.join(__dirname, '..', 'gateway.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// 初始化日志
const logger = pino({
  level: config.logging?.level || 'info',
  transport: config.logging?.format === 'pretty' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined
});

// 速率限制存储
const rateLimitStore = new Map();

// 清理过期的速率限制记录
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore) {
    if (now - record.windowStart > config.rateLimit?.windowMs) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

/**
 * 检查速率限制
 */
function checkRateLimit(req) {
  if (!config.rateLimit?.enabled) return true;
  
  // 跳过特定路径
  if (config.rateLimit.skipPaths?.some(p => req.url.startsWith(p))) {
    return true;
  }
  
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = config.rateLimit.windowMs;
  
  const record = rateLimitStore.get(clientIp);
  
  if (!record || now - record.windowStart > windowMs) {
    rateLimitStore.set(clientIp, { windowStart: now, count: 1 });
    return true;
  }
  
  if (record.count >= config.rateLimit.maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
}

/**
 * 获取请求目标
 */
function getTarget(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  for (const [prefix, routeConfig] of Object.entries(config.routes)) {
    if (url.pathname.startsWith(prefix)) {
      return typeof routeConfig === 'string' ? routeConfig : routeConfig.target;
    }
  }
  
  return null;
}

/**
 * 创建代理服务器
 */
const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  timeout: config.timeout?.request || 30000,
  proxyTimeout: config.timeout?.request || 30000
});

// 代理错误处理
proxy.on('error', (err, req, res) => {
  logger.error({ err, url: req.url }, 'Proxy error');
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bad Gateway', message: err.message }));
  }
});

proxy.on('proxyReq', (proxyReq, req, res) => {
  // 添加请求ID
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  proxyReq.setHeader('X-Request-ID', requestId);
  proxyReq.setHeader('X-Forwarded-By', `caiwu-gateway/1.0.0`);
});

proxy.on('proxyRes', (proxyRes, req, res) => {
  const duration = Date.now() - req.startTime;
  logger.info({
    method: req.method,
    url: req.url,
    status: proxyRes.statusCode,
    duration: `${duration}ms`,
    requestId: req.headers['x-request-id']
  }, 'Request completed');
});

/**
 * 创建 HTTP 服务器
 */
const server = http.createServer((req, res) => {
  req.startTime = Date.now();
  
  // 记录请求
  if (config.logging?.logHeaders) {
    logger.debug({
      method: req.method,
      url: req.url,
      headers: req.headers,
      clientIp: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    }, 'Incoming request');
  }
  
  // CORS 预检
  if (req.method === 'OPTIONS') {
    handleCORS(req, res);
    return;
  }
  
  // 健康检查
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: config.name,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // 指标端点
  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      rateLimitStoreSize: rateLimitStore.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    }));
    return;
  }
  
  // 速率限制检查
  if (!checkRateLimit(req)) {
    logger.warn({ url: req.url }, 'Rate limit exceeded');
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
      retryAfter: config.rateLimit.windowMs
    }));
    return;
  }
  
  // CORS 处理
  handleCORS(req, res);
  
  // 获取目标
  const target = getTarget(req);
  
  if (!target) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not Found',
      message: 'No route matched',
      availableRoutes: Object.keys(config.routes)
    }));
    return;
  }
  
  // 代理请求
  proxy.web(req, res, { target }, (err) => {
    if (err) {
      logger.error({ err, url: req.url }, 'Proxy error');
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
    }
  });
});

/**
 * CORS 处理
 */
function handleCORS(req, res) {
  if (!config.cors?.enabled) return;
  
  const origin = req.headers.origin;
  if (config.cors.origins.includes('*') || config.cors.origins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', config.cors.methods?.join(', ') || 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', config.cors.headers?.join(', ') || 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
    }
  }
}

/**
 * WebSocket 支持
 */
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const target = getTarget(req);
  
  if (!target) {
    ws.close(1008, 'No route matched');
    return;
  }
  
  logger.info({ url: req.url, target }, 'WebSocket connection');
  
  // 创建到目标的 WebSocket 连接
  const targetUrl = new URL(req.url, target.replace('http', 'ws'));
  const targetWs = new WebSocket(targetUrl, {
    headers: {
      ...req.headers,
      host: targetUrl.host
    }
  });
  
  // 双向消息转发
  ws.on('message', (data) => {
    targetWs.send(data);
  });
  
  targetWs.on('message', (data) => {
    ws.send(data);
  });
  
  ws.on('close', () => {
    targetWs.close();
  });
  
  targetWs.on('close', () => {
    ws.close();
  });
  
  targetWs.on('error', (err) => {
    logger.error({ err, url: req.url }, 'WebSocket target error');
    ws.close(1011, 'Target error');
  });
});

/**
 * 优雅关闭
 */
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
  logger.info('Shutting down gracefully...');
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  
  // 强制关闭超时
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

/**
 * 启动服务器
 */
server.listen(config.port, config.host, () => {
  logger.info({
    service: config.name,
    host: config.host,
    port: config.port,
    routes: Object.keys(config.routes),
    rateLimit: config.rateLimit?.enabled ? 'enabled' : 'disabled'
  }, 'Gateway started');
  
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   caiwu-gateway v1.0.0                                    ║
║   财务管家 API Gateway                                    ║
║                                                           ║
║   🌐 Listening: http://${config.host}:${config.port}                    ║
║   🔒 Rate Limit: ${config.rateLimit?.enabled ? `${config.rateLimit.maxRequests} req/min` : 'disabled'}                          ║
║   📊 Routes: ${Object.keys(config.routes).join(', ').padEnd(42)}║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = { server, proxy, wss };