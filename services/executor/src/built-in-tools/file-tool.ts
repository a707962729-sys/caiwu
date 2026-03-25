/**
 * 内置工具：file_read
 */

import { readFile } from 'fs/promises';
import { ToolDefinition, ToolContext, ToolResult } from '../types';

export const fileReadTool: ToolDefinition = {
  id: 'executor_file_read',
  name: 'file_read',
  description: '读取文件内容。返回文本。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
      maxLines: { type: 'number', description: '最多读取行数' },
    },
    required: ['path'],
  },
  enabled: true,
  async handler(params: { path: string; maxLines?: number }, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const { path, maxLines } = params;
      const content = await readFile(path, 'utf-8');
      const lines = content.split('\n');
      const total = lines.length;
      const output = maxLines ? lines.slice(0, maxLines).join('\n') : content;
      const suffix = maxLines && total > maxLines ? `\n... (${total - maxLines} more lines)` : '';
      return { success: true, output: output + suffix, metadata: { path, totalLines: total } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
