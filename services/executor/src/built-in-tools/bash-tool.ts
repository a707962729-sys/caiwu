/**
 * 内置工具：bash
 * 执行 shell 命令（安全限制）
 */

import { execSync } from 'child_process';
import { ToolDefinition, ToolContext, ToolResult } from '../types';

const DANGEROUS_PATTERNS = [
  /\brsync\b/, /\bmkfs\b/, /\bdd\b.*of=/,
  /\brm\s+-rf\s+\//, /:(){:|:&};:/,
  /\bcurl\b.*\|\s*sh\b/, /\bwget\b.*\|\s*sh\b/,
];

const BLOCKED_COMMANDS = [
  'sudo', 'su', 'passwd', 'chpasswd', 'mkfs',
  'fsck', 'dd', 'fdisk', 'parted',
  'lvremove', 'lvcreate', 'vgremove', 'pvremove',
];

function isDangerous(command: string): string | null {
  if (!command) return '空命令';
  const trimmed = command.trim().toLowerCase();
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) return `危险命令: ${pattern}`;
  }
  for (const blocked of BLOCKED_COMMANDS) {
    if (trimmed.startsWith(blocked)) return `禁止命令: ${blocked}`;
  }
  return null;
}

export const bashTool: ToolDefinition = {
  id: 'executor_bash',
  name: 'bash',
  description: '在服务器上执行 shell 命令。返回 stdout/stderr。超时保护 30s。',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的 shell 命令' },
      timeout: { type: 'number', description: '超时时间（秒），默认 30' },
      cwd: { type: 'string', description: '工作目录（可选）' },
    },
    required: ['command'],
  },
  enabled: true,
  async handler(params: { command: string; timeout?: number; cwd?: string }, _ctx: ToolContext): Promise<ToolResult> {
    const { command } = params;

    const dangerReason = isDangerous(command);
    if (dangerReason) {
      return { success: false, error: `[安全拦截] ${dangerReason}` };
    }

    const timeoutMs = Math.min(Math.max(params.timeout ?? 30, 1), 120) * 1000;

    try {
      const start = Date.now();
      const stdout = execSync(command, {
        encoding: 'utf-8',
        timeout: timeoutMs,
        cwd: params.cwd ?? process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 1024 * 1024,
      });
      return {
        success: true,
        output: stdout.trim() || '(无输出)',
        metadata: { command, elapsedMs: Date.now() - start, exitCode: 0 },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message ?? String(err),
        metadata: { command, exitCode: err.status ?? 1, signal: err.signal },
      };
    }
  },
};
