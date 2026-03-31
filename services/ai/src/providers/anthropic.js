const Anthropic = require('@anthropic-ai/sdk');
const BaseAIProvider = require('./base');
const logger = require('../utils/logger');

/**
 * Anthropic (Claude) 提供商
 */
class AnthropicProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.name = 'anthropic';
    this.supportsVision = true;
    
    if (config.apiKey) {
      this.client = new Anthropic({
        apiKey: config.apiKey
      });
    }
  }

  isAvailable() {
    return !!this.client && !!this.config.apiKey;
  }

  async chat(messages, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Anthropic provider not configured');
    }

    const startTime = Date.now();

    try {
      // 转换消息格式
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }));

      const response = await this.client.messages.create({
        model: options.model || this.config.model,
        max_tokens: options.maxTokens || 2000,
        system: systemMessage?.content || '你是一个专业的财务助手。',
        messages: conversationMessages
      });

      const latency = Date.now() - startTime;
      const textContent = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');

      logger.info('Anthropic chat completed', {
        model: response.model,
        latency,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens
      });

      return {
        success: true,
        content: textContent,
        model: response.model,
        usage: {
          inputTokens: response.usage?.input_tokens || 0,
          outputTokens: response.usage?.output_tokens || 0,
          totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
        },
        latency,
        finishReason: response.stop_reason
      };
    } catch (error) {
      logger.error('Anthropic chat failed', { error: error.message });
      throw error;
    }
  }

  async analyzeImage(imageBase64, prompt, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Anthropic provider not configured');
    }

    const startTime = Date.now();

    try {
      const mimeType = options.mimeType || 'image/jpeg';

      const response = await this.client.messages.create({
        model: options.model || this.config.model,
        max_tokens: options.maxTokens || 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: imageBase64
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      });

      const latency = Date.now() - startTime;
      const textContent = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');

      logger.info('Anthropic image analysis completed', {
        model: response.model,
        latency,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens
      });

      return {
        success: true,
        content: textContent,
        model: response.model,
        usage: {
          inputTokens: response.usage?.input_tokens || 0,
          outputTokens: response.usage?.output_tokens || 0,
          totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
        },
        latency
      };
    } catch (error) {
      logger.error('Anthropic image analysis failed', { error: error.message });
      throw error;
    }
  }

  async streamChat(messages, onChunk, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Anthropic provider not configured');
    }

    try {
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }));

      const stream = await this.client.messages.stream({
        model: options.model || this.config.model,
        max_tokens: options.maxTokens || 2000,
        system: systemMessage?.content || '你是一个专业的财务助手。',
        messages: conversationMessages
      });

      let fullContent = '';

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.text) {
          const content = event.delta.text;
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
      logger.error('Anthropic stream chat failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = AnthropicProvider;