/**
 * AI服务配置 - 连接本地 caiwu-ai 服务
 * 已移除对 OpenClaw 的依赖
 */

const AI_CONFIG = {
  // 本地 AI 服务配置
  gateway: {
    baseUrl: process.env.AI_SERVICE_URL || 'http://localhost:3001',
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
    intelligentQuery: true,       // 智能查询
    dataAnalysis: true,           // 数据分析
    prediction: true,             // 预测功能
    recommendation: true,         // 推荐功能
    anomalyDetection: true        // 异常检测
  },

  // 缓存配置
  cache: {
    enabled: true,
    ttl: 3600 // 1小时
  }
};

module.exports = AI_CONFIG;
