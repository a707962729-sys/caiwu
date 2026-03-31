const path = require('path');

// 加载环境变量
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 先定义 providers（IIFE 需要提前引用）
const providers = {
  kimi: {
    apiKey: process.env.KIMI_API_KEY || '',
    baseUrl: process.env.KIMI_BASE_URL || 'https://api.kimi.com/coding/v1',
    model: process.env.KIMI_MODEL || 'k2p5',
    enabled: !!process.env.KIMI_API_KEY
  },
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
  },
  glmFlash: {
    apiKey: process.env.GLM_API_KEY || '',
    baseUrl: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    model: process.env.GLM_MODEL || 'glm-4-flash',
    enabled: !!process.env.GLM_API_KEY
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
  ai: {
    provider: 'openai',
    visionModel: 'glm-4v-flash'
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'caiwu-jwt-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  // 主 API 配置
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000/api',
    internalApiKey: process.env.INTERNAL_API_KEY || 'caiwu-internal-service-key-2024'
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

  // 百度NLP配置（用于合同审核增强）
  // 需要在百度AI平台开通 NLP 相关服务（与OCR是不同产品，需单独申请）
  // 文档: https://cloud.baidu.com/doc/NLP/s/ajaxhfp5z
  baiduNlp: {
    apiKey: process.env.BAIDU_NLP_API_KEY || '',
    secretKey: process.env.BAIDU_NLP_SECRET_KEY || '',
    enabled: !!process.env.BAIDU_NLP_API_KEY
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
    if (providers.kimi.enabled) return 'kimi'; // Kimi key not working, use openai(GLM)
    if (providers.openai.enabled) return 'openai';
    if (providers.anthropic.enabled) return 'anthropic';
    if (providers.ollama.enabled) return 'ollama';
    return 'mock'; // 回退到模拟模式
  })()
};

module.exports = config;