/**
 * 内置工具：file_write
 */

import { writeFile } from 'fs/promises';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { ToolDefinition, ToolContext, ToolResult } from '../types';

export const fileWriteTool: ToolDefinition = {
  id: 'executor_file_write',
  name: 'file_write',
  description: '写入内容到文件。目录不存在则自动创建。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '目标文件路径' },
      content: { type: 'string', description: '要写入的内容' },
      append: { type: 'boolean', description: '是否追加，默认 false' },
    },
    required: ['path', 'content'],
  },
  enabled: true,
  async handler(params: { path: string; content: string; append?: boolean }, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const { path, content, append = false } = params;
      await mkdir(dirname(path), { recursive: true });
      const flag = append ? 'a' : 'w';
      await writeFile(path, content, { flag, encoding: 'utf-8' });
      return {
        success: true,
        output: append ? `已追加 ${content.length} 字符到 ${path}` : `已写入 ${content.length} 字符到 ${path}`,
        metadata: { path, bytes: Buffer.byteLength(content, 'utf-8'), append },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
