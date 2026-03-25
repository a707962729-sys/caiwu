/**
 * 内置工具：http_fetch
 * 发送 HTTP GET/POST 请求
 */

import { ToolDefinition, ToolContext, ToolResult } from '../types';

export const httpFetchTool: ToolDefinition = {
  id: 'executor_http_fetch',
  name: 'http_fetch',
  description: '发送 HTTP GET/POST 请求，获取网页或 API 内容。',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '目标 URL' },
      method: { type: 'string', description: 'HTTP 方法，默认 GET' },
      headers: { type: 'object', description: '请求头（可选）' },
      body: { type: 'string', description: '请求体（POST 时使用）' },
      timeout: { type: 'number', description: '超时 ms，默认 10000' },
    },
    required: ['url'],
  },
  enabled: true,
  async handler(
    params: { url: string; method?: string; headers?: Record<string, string>; body?: string; timeout?: number },
    _ctx: ToolContext
  ): Promise<ToolResult> {
    try {
      const { url, method = 'GET', headers = {}, body, timeout = 10000 } = params;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers: { 'User-Agent': 'CaiwuExecutor/1.0', ...headers },
        body: method !== 'GET' ? body : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const text = await response.text();
      const preview = text.length > 2000 ? text.slice(0, 2000) + '\n...(truncated)' : text;

      return {
        success: true,
        output: preview,
        metadata: { url, method, status: response.status, size: text.length },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
