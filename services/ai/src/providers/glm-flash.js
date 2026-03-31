/**
 * GLM-4-Flash 流式提供商（内置于 AI 服务，非插件模式）
 * 支持 GLM-4-flash 免费模型，流式响应
 * 端点: https://open.bigmodel.cn/api/paas/v4/chat/completions
 */
const BaseAIProvider = require('./base');
const logger = require('../utils/logger');

class GLMFlashProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'glm-flash';
    this.supportsVision = true;
    this.supportsStreaming = true;
    this.config = {
      apiKey: config.apiKey || process.env.GLM_API_KEY || '',
      baseUrl: config.baseUrl || 'https://open.bigmodel.cn/api/paas/v4',
      model: config.model || 'glm-4-flash',
      ...config
    };
  }

  isAvailable() {
    return !!this.config.apiKey;
  }

  /**
   * 普通对话（同步）
   */
  async chat(opts = {}) {
    const messages = opts.messages || [];
    const tools = opts.tools;
    const toolChoice = opts.tool_choice;
    const model = opts.model || this.config.model;
    const temperature = opts.temperature ?? 0.7;
    const maxTokens = opts.maxTokens ?? 2000;

    if (!this.isAvailable()) {
      throw new Error('GLM provider not configured: missing API key');
    }

    const startTime = Date.now();

    const body = {
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      temperature,
      max_tokens: maxTokens
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters
        }
      }));
      if (toolChoice === 'auto') {
        body.tool_choice = 'auto';
      }
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`GLM API error: ${response.status} ${errText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;
      logger.info(`[GLM] chat completed in ${latency}ms`);

      const choice = data.choices[0];
      const message = choice.message;

      return {
        success: true,
        content: message.content || '',
        toolCalls: message.tool_calls ? message.tool_calls.map(tc => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments
          }
        })) : [],
        finishReason: choice.finish_reason,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : null,
        model: data.model
      };
    } catch (err) {
      logger.error('[GLM] chat error:', err);
      throw err;
    }
  }

  /**
   * 流式对话
   * @param {Array} messages - 消息列表
   * @param {Function} onChunk - 流式回调，接收 (text, isFinal, toolCalls)
   * @param {Object} opts - 选项
   */
  async streamChat(messages, onChunk, opts = {}) {
    const tools = opts.tools;
    const model = opts.model || this.config.model;
    const temperature = opts.temperature ?? 0.7;
    const maxTokens = opts.maxTokens ?? 2000;

    if (!this.isAvailable()) {
      throw new Error('GLM provider not configured: missing API key');
    }

    const body = {
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      temperature,
      max_tokens: maxTokens,
      stream: true
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters
        }
      }));
      if (opts.tool_choice === 'auto') {
        body.tool_choice = 'auto';
      }
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`GLM API error: ${response.status} ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let toolCalls = [];
    let currentToolCall = null;
    let finished = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            finished = true;
            break;
          }

          try {
            const data = JSON.parse(jsonStr);
            const delta = data.choices?.[0]?.delta;

            if (delta?.content) {
              fullContent += delta.content;
              onChunk(delta.content, false, []);
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const index = tc.index ?? 0;
                if (!currentToolCall || currentToolCall._index !== index) {
                  if (currentToolCall) {
                    toolCalls.push({ ...currentToolCall });
                  }
                  currentToolCall = {
                    _index: index,
                    id: tc.id || `call_${Date.now()}_${index}`,
                    type: 'function',
                    function: { name: tc.function.name, arguments: '' }
                  };
                }
                if (tc.function?.arguments) {
                  currentToolCall.function.arguments += tc.function.arguments;
                }
              }
            }
          } catch (e) {
            // ignore parse errors for individual lines
          }
        }

        if (finished) break;
      }

      if (currentToolCall) {
        toolCalls.push({ ...currentToolCall });
      }

      onChunk('', true, toolCalls);
    } finally {
      reader.releaseLock();
    }
  }

  getModelInfo() {
    return {
      name: this.name,
      model: this.config.model,
      available: this.isAvailable(),
      supportsStreaming: this.supportsStreaming,
      supportsVision: this.supportsVision
    };
  }
}

module.exports = GLMFlashProvider;
