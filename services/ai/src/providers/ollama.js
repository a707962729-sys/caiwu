const axios = require('axios');
const BaseAIProvider = require('./base');
const logger = require('../utils/logger');

/**
 * Ollama 本地模型提供商
 */
class OllamaProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.name = 'ollama';
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'llama3.2';
  }

  isAvailable() {
    return this.config.enabled !== false;
  }

  async checkConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async chat(messages, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Ollama provider not configured');
    }

    const startTime = Date.now();

    try {
      const response = await axios.post(`${this.baseUrl}/api/chat`, {
        model: options.model || this.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 2000
        }
      }, {
        timeout: 120000 // 2分钟超时
      });

      const latency = Date.now() - startTime;
      const data = response.data;

      logger.info('Ollama chat completed', {
        model: data.model,
        latency,
        done: data.done
      });

      return {
        success: true,
        content: data.message?.content || '',
        model: data.model,
        usage: {
          inputTokens: data.prompt_eval_count || 0,
          outputTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        latency,
        done: data.done
      };
    } catch (error) {
      logger.error('Ollama chat failed', { error: error.message });
      throw new Error(`Ollama 服务不可用: ${error.message}`);
    }
  }

  async analyzeImage(imageBase64, prompt, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Ollama provider not configured');
    }

    const startTime = Date.now();

    try {
      // Ollama 的多模态支持（需要支持视觉的模型如 llava）
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: options.model || 'llava', // 视觉模型
        prompt: prompt,
        images: [imageBase64],
        stream: false
      }, {
        timeout: 120000
      });

      const latency = Date.now() - startTime;
      const data = response.data;

      logger.info('Ollama image analysis completed', {
        model: data.model,
        latency
      });

      return {
        success: true,
        content: data.response || '',
        model: data.model,
        usage: {
          inputTokens: data.prompt_eval_count || 0,
          outputTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        latency
      };
    } catch (error) {
      logger.error('Ollama image analysis failed', { error: error.message });
      throw new Error(`Ollama 视觉分析失败: ${error.message}`);
    }
  }

  async streamChat(messages, onChunk, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Ollama provider not configured');
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/chat`, {
        model: options.model || this.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        stream: true
      }, {
        responseType: 'stream',
        timeout: 120000
      });

      let fullContent = '';

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          try {
            const lines = chunk.toString().split('\n').filter(Boolean);
            for (const line of lines) {
              const data = JSON.parse(line);
              if (data.message?.content) {
                fullContent += data.message.content;
                if (onChunk) {
                  onChunk(data.message.content);
                }
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        });

        response.data.on('end', () => {
          resolve({
            success: true,
            content: fullContent
          });
        });

        response.data.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Ollama stream chat failed', { error: error.message });
      throw error;
    }
  }

  /**
   * 获取可用模型列表
   */
  async listModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data.models || [];
    } catch (error) {
      logger.error('Failed to list Ollama models', { error: error.message });
      return [];
    }
  }
}

module.exports = OllamaProvider;