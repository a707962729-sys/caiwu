/**
 * 内置工具：web_search
 * 使用 Bing 搜索 API（国内可访问）
 */

import { ToolDefinition, ToolContext, ToolResult } from '../types';

interface BingResult {
  title: string;
  url: string;
  desc: string;
}

function parseBingHTML(html: string, count: number): BingResult[] {
  const results: BingResult[] = [];

  // Bing 结果项在 <li class="b_algo"> 中
  const itemRegex = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/g;
  let match;
  let idx = 0;

  while ((match = itemRegex.exec(html)) !== null && idx < count) {
    const block = match[1];

    // 提取标题和链接
    const linkMatch = block.match(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;

    const url = linkMatch[1];
    // 提取纯文本标题
    const titleRaw = linkMatch[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    // 跳过百度安全验证等非结果
    if (!url || url.includes('baidu.com/security') || titleRaw.length < 5) continue;

    // 提取摘要描述
    const descMatch = block.match(/<p>([\s\S]*?)<\/p>/);
    let desc = descMatch
      ? descMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 150)
      : '';

    // 过滤验证链接
    if (url.startsWith('http')) {
      results.push({ title: titleRaw, url, desc });
      idx++;
    }
  }

  return results;
}

export const webSearchTool: ToolDefinition = {
  id: 'executor_web_search',
  name: 'web_search',
  description: '执行网页搜索，返回标题、链接和摘要列表（使用 Bing）。',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索关键词' },
      count: { type: 'number', description: '结果数量，默认 5' },
    },
    required: ['query'],
  },
  enabled: true,
  async handler(
    params: { query: string; count?: number },
    _ctx: ToolContext
  ): Promise<ToolResult> {
    try {
      const { query, count = 5 } = params;
      const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-cn`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const results = parseBingHTML(html, count);

      if (results.length === 0) {
        return {
          success: true,
          output: '(未找到搜索结果，可能网络环境受限)',
          metadata: { query, count, url },
        };
      }

      const formatted = results
        .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.desc}`)
        .join('\n\n');

      return {
        success: true,
        output: formatted,
        metadata: { query, count, resultsFound: results.length, url },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
