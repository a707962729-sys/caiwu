/**
 * Caiwu Executor — LLM 适配器
 * OpenAI SDK v4 + Anthropic SDK
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { LLMMessage, LLMResponse, ToolDefinition } from './types';

// ============ 配置 ============

export interface LLMConfig {
  model: string;
  modelType: 'openai' | 'anthropic' | 'openai-compatible';
  apiKey: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

// ============ 错误类 ============

export class LLMError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

// ============ LLM Adapter ============

export class LLMAdapter {
  private config: LLMConfig;
  private openaiClient?: OpenAI;
  private anthropicClient?: Anthropic;

  constructor(config: LLMConfig) {
    this.config = {
      maxTokens: 4096,
      temperature: 0.7,
      ...config,
    };
    this.initClients();
  }

  private initClients(): void {
    if (this.config.modelType === 'openai' || this.config.modelType === 'openai-compatible') {
      this.openaiClient = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl
          ? `${this.config.baseUrl.replace(/\/$/, '')}/v1`
          : undefined,
        dangerouslyAllowBrowser: false,
      });
    }

    if (this.config.modelType === 'anthropic') {
      this.anthropicClient = new Anthropic({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl
          ? `${this.config.baseUrl.replace(/\/$/, '')}/v1`
          : undefined,
      });
    }
  }

  /**
   * 核心聊天接口
   */
  async chat(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    try {
      if (this.config.modelType === 'anthropic' && this.anthropicClient) {
        return this.chatAnthropic(messages, tools);
      }
      return this.chatOpenAI(messages, tools);
    } catch (err: any) {
      if (err.status) {
        const status = err.status ?? 500;
        const isRetryable = status >= 500 || status === 429;
        throw new LLMError(`${err.message ?? 'LLM Error'} (${status})`, status, isRetryable);
      }
      throw err;
    }
  }

  // ============ OpenAI / 兼容端 ============

  private async chatOpenAI(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    if (!this.openaiClient) throw new LLMError('OpenAI client not initialized', 500);

    // 过滤：确保每条消息都有合法 content（DeepSeek 严格要求）
    const raw = this.formatMessages(messages);
    const formatted = raw.filter((m: any) => {
      // tool 消息必须保留（content=object 是因为 result.output 格式问题）
      if (m.role === 'tool') return true;
      const hasContent = m.content !== null && m.content !== undefined && String(m.content).trim() !== '';
      const hasTC = m.tool_calls && m.tool_calls.length > 0;
      const keep = m.role === 'system' || hasTC || hasContent;
      return keep;
    });

    const requestOptions: any = {
      model: this.config.model,
      messages: formatted,
      max_tokens: this.config.maxTokens ?? 4096,
      temperature: this.config.temperature ?? 0.7,
    };

    if (tools?.length) {
      requestOptions.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      requestOptions.tool_choice = 'auto';
    }

    const response = await (this.openaiClient as any).chat.completions.create(requestOptions);
    return this.convertOpenAIResponse(response);
  }

  // ============ Anthropic Claude ============

  private async chatAnthropic(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    if (!this.anthropicClient) throw new LLMError('Anthropic client not initialized', 500);

    const systemMsgs = messages.filter((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const systemPrompt = systemMsgs
      .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
      .join('\n');

    const body: any = {
      model: this.config.model,
      messages: chatMessages.map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: m.toolCallId,
                content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
              },
            ],
          };
        }
        return {
          role: m.role === 'assistant' ? ('assistant' as const) : m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          ...(m.name ? { name: m.name } : {}),
        };
      }),
      max_tokens: this.config.maxTokens ?? 4096,
      temperature: this.config.temperature ?? 0.7,
    };

    if (systemPrompt) body.system = systemPrompt;

    if (tools?.length) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters ?? { type: 'object', properties: {} },
      }));
    }

    const response = await (this.anthropicClient as any).messages.create(body);
    return this.convertAnthropicResponse(response);
  }

  // ============ 格式化 & 转换 ============

  private formatMessages(messages: LLMMessage[]): object[] {
    return messages.map((m) => {
      if (m.role === 'tool') {
        // content 必须是 string，null/undefined 会导致 API 报错
        const contentStr = m.content == null ? '(无输出)' : String(m.content);
        return {
          role: 'tool' as const,
          tool_call_id: m.toolCallId ?? '',
          content: contentStr,
        };
      }
      const hasToolCalls = m.toolCalls && m.toolCalls.length > 0;
      const rawContent = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      // assistant 带 tool_calls 时 content 设为空格（不能为 null），否则用 rawContent
      let content: string | null = hasToolCalls ? ' ' : (rawContent || '(无文本内容)');
      const obj: Record<string, any> = {
        role: m.role,
        content,
      };
      if (m.name) obj.name = m.name;
      if (hasToolCalls) {
        obj.tool_calls = m.toolCalls!.map((tc) => ({
          id: tc.id,
          type: tc.type ?? 'function',
          function: tc.function,
        }));
      }
      return obj;
    });
  }

  private convertOpenAIResponse(data: any): LLMResponse {
    const choice = data.choices[0];
    const finishReason = choice?.finish_reason ?? 'stop';
    // finish_reason === 'tool_calls' 时 content 必须是 null（不是空字符串也不是占位符）
    const content = finishReason === 'tool_calls'
      ? null
      : (choice?.message?.content ?? '');
    return {
      id: data.id ?? `openai-${Date.now()}`,
      model: data.model,
      choices: [
        {
          message: {
            role: 'assistant',
            content,
            toolCalls: finishReason === 'tool_calls'
              ? (choice?.message?.tool_calls?.map((tc: any) => ({
                  id: tc.id,
                  type: 'function',
                  function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                  },
                })) ?? [])
              : undefined,
          },
          finishReason,
        },
      ],
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          }
        : undefined,
    };
  }

  private convertAnthropicResponse(data: any): LLMResponse {
    const toolCalls =
      data.content
        ?.filter((c: any) => c.type === 'tool_use')
        .map((c: any) => ({
          id: c.id,
          type: 'function' as const,
          function: {
            name: c.name,
            arguments: JSON.stringify(c.input ?? {}),
          },
        })) ?? [];

    const textContent = data.content?.find((c: any) => c.type === 'text')?.text ?? null;

    return {
      id: data.id ?? `anthropic-${Date.now()}`,
      model: data.model,
      choices: [
        {
          message: {
            role: 'assistant' as const,
            content: textContent,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          },
          finishReason: data.stop_reason ?? (toolCalls.length > 0 ? 'tool_calls' : 'stop'),
        },
      ],
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens ?? 0,
            completionTokens: data.usage.output_tokens ?? 0,
            totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
          }
        : undefined,
    };
  }
}
