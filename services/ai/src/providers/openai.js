const OpenAI = require('openai');
const BaseAIProvider = require('./base');
const logger = require('../utils/logger');

/**
 * OpenAI 提供商
 */
class OpenAIProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.name = 'openai';
    
    if (config.apiKey) {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl
      });
    }
  }

  isAvailable() {
    return !!this.client && !!this.config.apiKey;
  }

  async chat(messages, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('OpenAI provider not configured');
    }

    const startTime = Date.now();
    
    try {
      const response = await this.client.chat.completions.create({
        model: options.model || this.config.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
        top_p: options.topP || 1,
        stream: false
      });

      const latency = Date.now() - startTime;
      const choice = response.choices[0];

      logger.info('OpenAI chat completed', {
        model: response.model,
        latency,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens
      });

      return {
        success: true,
        content: choice.message.content,
        model: response.model,
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        },
        latency,
        finishReason: choice.finish_reason
      };
    } catch (error) {
      logger.error('OpenAI chat failed', { error: error.message });
      throw error;
    }
  }

  async analyzeImage(imageBase64, prompt, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('OpenAI provider not configured');
    }

    const startTime = Date.now();

    try {
      // 确定 MIME 类型
      const mimeType = options.mimeType || 'image/jpeg';
      
      const response = await this.client.chat.completions.create({
        model: options.model || this.config.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: options.detail || 'auto'
                }
              }
            ]
          }
        ],
        max_tokens: options.maxTokens || 2000
      });

      const latency = Date.now() - startTime;
      const choice = response.choices[0];

      logger.info('OpenAI image analysis completed', {
        model: response.model,
        latency,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens
      });

      return {
        success: true,
        content: choice.message.content,
        model: response.model,
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        },
        latency
      };
    } catch (error) {
      logger.error('OpenAI image analysis failed', { error: error.message });
      throw error;
    }
  }

  async streamChat(messages, onChunk, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('OpenAI provider not configured');
    }

    try {
      const stream = await this.client.chat.completions.create({
        model: options.model || this.config.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
        stream: true
      });

      let fullContent = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          if (onChunk) {
            await onChunk(content);
          }
        }
      }

      return {
        success: true,
        content: fullContent
      };
    } catch (error) {
      logger.error('OpenAI stream chat failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = OpenAIProvider;