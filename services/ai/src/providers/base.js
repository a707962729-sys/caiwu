/**
 * AI 提供商基类
 */
class BaseAIProvider {
  constructor(config) {
    this.config = config;
    this.name = 'base';
    this.supportsVision = false;
  }

  /**
   * 发送聊天消息
   * @param {Array} messages - 消息列表
   * @param {Object} options - 选项
   * @returns {Promise<Object>}
   */
  async chat(messages, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * 分析图片（Vision）
   * @param {string} imageBase64 - Base64 编码的图片
   * @param {string} prompt - 提示词
   * @param {Object} options - 选项
   * @returns {Promise<Object>}
   */
  async analyzeImage(imageBase64, prompt, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * 流式聊天
   * @param {Array} messages - 消息列表
   * @param {Function} onChunk - 回调函数
   * @param {Object} options - 选项
   * @returns {Promise<void>}
   */
  async streamChat(messages, onChunk, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * 检查是否可用
   * @returns {boolean}
   */
  isAvailable() {
    return false;
  }

  /**
   * 获取模型信息
   * @returns {Object}
   */
  getModelInfo() {
    return {
      name: this.name,
      model: this.config.model,
      available: this.isAvailable()
    };
  }
}

module.exports = BaseAIProvider;