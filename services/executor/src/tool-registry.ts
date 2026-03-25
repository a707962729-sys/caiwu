/**
 * Caiwu Executor — 工具注册表
 * 自注册模式
 */

import { ToolDefinition, ToolContext, ToolResult } from './types';
import { fileReadTool } from './built-in-tools/file-tool';
import { fileWriteTool } from './built-in-tools/file-write-tool';
import { bashTool } from './built-in-tools/bash-tool';
import { webSearchTool } from './built-in-tools/web-search-tool';
import { httpFetchTool } from './built-in-tools/http-fetch-tool';
import { invoiceOcrTool, executeInvoiceOcr } from './built-in-tools/invoice-ocr-tool';

// ============ 全局工具注册表（供外部扩展）============

export class GlobalToolRegistry {
  private static instance = new Map<string, ToolDefinition>();

  static register(tool: ToolDefinition): void {
    this.instance.set(tool.id, tool);
  }

  static get(id: string): ToolDefinition | undefined {
    return this.instance.get(id);
  }

  static getAll(): ToolDefinition[] {
    return Array.from(this.instance.values());
  }

  static clear(): void {
    this.instance.clear();
  }
}

// ============ 工具注册表 ============

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  constructor() {
    this.registerBuiltins();
  }

  private registerBuiltins(): void {
    this.register(fileReadTool);
    this.register(fileWriteTool);
    this.register(bashTool);
    this.register(webSearchTool);
    this.register(httpFetchTool);
    this.register(invoiceOcrTool);
  }

  async init(): Promise<void> {
    for (const tool of GlobalToolRegistry.getAll()) {
      this.register(tool);
    }
  }

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.id)) return;
    this.tools.set(tool.id, { ...tool, enabled: tool.enabled ?? true });
  }

  unregister(id: string): void {
    this.tools.delete(id);
  }

  getTool(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getEnabledTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).filter((t) => t.enabled);
  }

  getByIds(ids: string[]): ToolDefinition[] {
    return ids
      .map((id) => this.tools.get(id))
      .filter((t): t is ToolDefinition => t !== undefined && t.enabled);
  }

  async execute(
    toolIdOrName: string,
    params: any,
    context: ToolContext
  ): Promise<ToolResult> {
    // 优先按 id 查找，再按 name 查找
    let tool = this.tools.get(toolIdOrName);
    if (!tool) {
      tool = Array.from(this.tools.values()).find((t) => t.name === toolIdOrName);
    }

    if (!tool) {
      return { success: false, error: `Tool '${toolIdOrName}' not found` };
    }

    if (!tool.enabled) {
      return { success: false, error: `Tool '${toolIdOrName}' is disabled` };
    }

    try {
      const result = await tool.handler(params, context);
      return result;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
