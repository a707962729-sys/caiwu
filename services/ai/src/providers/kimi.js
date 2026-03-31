/**
 * Kimi (Moonshot) AI 提供商
 * 兼容 OpenAI API 格式
 */
const OpenAI = require('openai');
const BaseAIProvider = require('./base');

class KimiProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.name = 'kimi';
    this.supportsVision = true;
    
    if (config.apiKey) {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || 'https://api.kimi.com/coding/v1'
      });
    }
  }

  isAvailable() {
    return !!this.client && !!this.config.apiKey;
  }

  async chat(opts) {
    const messages = opts.messages || [];
    const options = opts;
    if (!this.isAvailable()) {
      throw new Error('Kimi provider not configured');
    }

    const startTime = Date.now();

    try {
      // Kimi 支持 function calling，tools 参数透传
      const requestOpts = {
        model: options.model || this.config.model || 'k2p5',
        messages: (Array.isArray(messages) ? messages : []).map(m => ({
          role: m.role,
          content: m.content
        })),
        temperature: options.temperature || 0.3,
        max_tokens: options.maxTokens || 4096,
      };

      // 如果有工具定义，透传
      if (options.tools && options.tools.length > 0) {
        requestOpts.tools = options.tools;
        if (options.tool_choice) {
          requestOpts.tool_choice = options.tool_choice;
        }
      }

      const response = await this.client.chat.completions.create(requestOpts);

      const latency = Date.now() - startTime;
      const choice = response.choices[0];

      console.log(`[Kimi] chat completed in ${latency}ms, model=${response.model}`);

      return {
        success: true,
        content: choice.message.content,
        model: response.model,
        usage: response.usage ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens
        } : null,
        // tool_calls 支持
        toolCalls: choice.message.tool_calls || null,
        finishReason: choice.finish_reason
      };
    } catch (error) {
      console.error('[Kimi] chat error:', error.message);
      throw error;
    }
  }

  async analyzeImage(imageBase64, prompt, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Kimi provider not configured');
    }

    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
        ]
      }
    ];

    return this.chat(messages, { ...options, model: options.model || this.config.visionModel });
  }

  async streamChat(messages, onChunk, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Kimi provider not configured');
    }

    const stream = await this.client.chat.completions.create({
      model: options.model || this.config.model || 'k2p5',
      messages: (Array.isArray(messages) ? messages : []).map(m => ({
        role: m.role,
        content: m.content
      })),
      temperature: options.temperature || 0.3,
      max_tokens: options.maxTokens || 4096,
      stream: true
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        fullContent += text;
        if (onChunk) onChunk(text);
      }
    }

    return { success: true, content: fullContent };
  }

  getModelInfo() {
    return {
      name: this.name,
      model: this.config.model || 'k2p5',
      baseUrl: this.config.baseUrl || 'https://api.kimi.com/coding/v1',
      available: this.isAvailable()
    };
  }
}

module.exports = KimiProvider;
