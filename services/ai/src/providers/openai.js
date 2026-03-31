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
    this.supportsVision = true;
    
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

  async chat(opts) {
    if (!this.isAvailable()) throw new Error('OpenAI provider not configured');
    const messages = opts.messages || [];
    const options = opts;
    const startTime = Date.now();

    try {
      const requestMessages = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const requestOpts = {
        model: options.model || this.config.model,
        messages: requestMessages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
      };

      if (options.tools && options.tools.length > 0) {
        requestOpts.tools = options.tools;
        if (options.tool_choice) requestOpts.tool_choice = options.tool_choice;
      }

      const response = await this.client.chat.completions.create(requestOpts);
      const choice = response.choices[0];
      const latency = Date.now() - startTime;

      logger.info(`[OpenAI] chat completed in ${latency}ms`);

      return {
        success: true,
        content: choice.message.content,
        model: response.model,
        usage: response.usage ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens
        } : null,
        toolCalls: choice.message.tool_calls || null,
        finishReason: choice.finish_reason
      };
    } catch (error) {
      logger.error('[OpenAI] chat error:', error);
      throw error;
    }
  }

  async streamChat(opts, onChunk) {
    const messages = opts.messages || [];
    const options = opts;
    if (!this.isAvailable()) {
      throw new Error('OpenAI provider not configured');
    }

    try {
      const stream = await this.client.chat.completions.create({
        model: options.model || this.config.model,
        messages: requestMessages.map(m => ({
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