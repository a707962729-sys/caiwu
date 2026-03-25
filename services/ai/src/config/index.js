const path = require('path');

// 加载环境变量
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 先定义 providers（IIFE 需要提前引用）
const providers = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    enabled: !!process.env.OPENAI_API_KEY
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    enabled: !!process.env.ANTHROPIC_API_KEY
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2',
    enabled: process.env.OLLAMA_ENABLED === 'true' || false
  }
};

const config = {
  // 服务配置
  service: {
    name: '@caiwu/ai-service',
    version: '1.0.0',
    port: parseInt(process.env.PORT) || 3001,
    env: process.env.NODE_ENV || 'development'
  },

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  // 主 API 配置
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000/api'
  },

  // AI 提供商配置
  providers,

  // OCR 配置
  ocr: {
    provider: process.env.OCR_PROVIDER || 'openai',
    baidu: {
      appId: process.env.BAIDU_OCR_APP_ID || '',
      apiKey: process.env.BAIDU_OCR_API_KEY || '',
      secretKey: process.env.BAIDU_OCR_SECRET_KEY || ''
    },
    tencent: {
      secretId: process.env.TENCENT_SECRET_ID || '',
      secretKey: process.env.TENCENT_SECRET_KEY || ''
    }
  },

  // 功能开关
  features: {
    enableAiChat: process.env.ENABLE_AI_CHAT !== 'false',
    enableOcr: process.env.ENABLE_OCR !== 'false',
    enableAuditLog: process.env.ENABLE_AUDIT_LOG !== 'false'
  },

  // 限制配置
  limits: {
    dailyLimitUser: parseInt(process.env.DAILY_LIMIT_USER) || 100,
    dailyLimitCompany: parseInt(process.env.DAILY_LIMIT_COMPANY) || 1000,
    maxTokensPerRequest: parseInt(process.env.MAX_TOKENS_PER_REQUEST) || 4000,
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 60000
  },

  // 日志配置
  log: {
    level: process.env.LOG_LEVEL || 'info'
  },

  // 默认 AI 模型优先级
  defaultModel: (() => {
    if (process.env.DEFAULT_MODEL) return process.env.DEFAULT_MODEL;
    if (providers.openai.enabled) return 'openai';
    if (providers.anthropic.enabled) return 'anthropic';
    if (providers.ollama.enabled) return 'ollama';
    return 'mock'; // 回退到模拟模式
  })()
};

module.exports = config;