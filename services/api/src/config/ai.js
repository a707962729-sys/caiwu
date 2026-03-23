/**
 * AI服务配置 - 连接OpenClaw Gateway
 */

const AI_CONFIG = {
  // OpenClaw Gateway配置
  gateway: {
    baseUrl: process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789',
    token: process.env.OPENCLAW_GATEWAY_TOKEN || 'c29ab6c81f0fc727c0f7307d9526a490f5b37831fa740bc8',
    defaultModel: process.env.AI_MODEL || 'glm',
    timeout: 60000
  },
  
  // 模型配置
  models: {
    // 默认模型 - 日常对话、查询
    default: 'glm',
    // 编码模型 - 复杂分析、代码生成
    coder: 'qwen3-coder-next',
    // 视觉模型 - 图片识别（发票OCR）
    vision: 'vision-model'
  },
  
  // 功能开关
  features: {
    invoiceRecognition: true,      // 发票识别
    intelligentQuery: true,        // 智能查询
    dataAnalysis: true,            // 数据分析
    prediction: true,              // 预测功能
    recommendation: true,          // 推荐功能
    anomalyDetection: true         // 异常检测
  },
  
  // 缓存配置
  cache: {
    enabled: true,
    ttl: 3600 // 1小时
  }
};

module.exports = AI_CONFIG;
