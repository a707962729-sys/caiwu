/**
 * Caiwu Executor — Agent 运行时
 * 核心执行循环
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Task,
  AgentConfig,
  Session,
  LLMMessage,
  ToolContext,
  TaskOutput,
} from './types';
import { ExecutorDB } from './db';
import { LLMAdapter } from './llm-adapter';
import { ToolRegistry } from './tool-registry';

export interface RuntimeOptions {
  db: ExecutorDB;
  tools: ToolRegistry;
  onProgress?: (taskId: string, progress: number) => void;
  onMessage?: (taskId: string, message: string) => void;
}

export class AgentRuntime {
  private db: ExecutorDB;
  private tools: ToolRegistry;
  private onProgress?: RuntimeOptions['onProgress'];
  private onMessage?: RuntimeOptions['onMessage'];

  constructor(opts: RuntimeOptions) {
    this.db = opts.db;
    this.tools = opts.tools;
    this.onProgress = opts.onProgress;
    this.onMessage = opts.onMessage;
  }

  async execute(task: Task, agent: AgentConfig): Promise<TaskOutput> {
    const { id: taskId, agentId, input } = task;

    const llm = new LLMAdapter({
      model: agent.model,
      modelType: agent.modelType,
      apiKey: agent.apiKey ?? process.env.OPENAI_API_KEY ?? '',
      baseUrl: agent.baseUrl,
      maxTokens: agent.maxTokens,
      temperature: agent.temperature,
    });

    this.db.updateTask(taskId, { status: 'running', startedAt: new Date().toISOString() });
    this.reportProgress(taskId, 5);

    try {
      // 获取或创建会话
      let session = task.sessionId ? this.db.getSession(task.sessionId) : undefined;
      if (!session) {
        session = this.createSession(agentId, taskId);
      }

      // 构建消息
      const messages = await this.buildMessages(session, input, agent);
      this.reportProgress(taskId, 15);

      // 获取启用的工具
      const enabledTools = this.tools.getByIds(agent.tools ?? []);
      this.reportProgress(taskId, 20);

      // LLM 调用循环
      const output = await this.runLLMLoop(taskId, session, messages, enabledTools, llm, agent);
      this.reportProgress(taskId, 95);

      this.db.updateTask(taskId, {
        status: 'completed',
        output,
        completedAt: new Date().toISOString(),
      });
      this.reportProgress(taskId, 100);

      return output;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const retryCount = task.retryCount ?? 0;

      if (retryCount < (task.maxRetries ?? 3)) {
        this.db.updateTask(taskId, { status: 'pending', retryCount: retryCount + 1, error: errorMsg });
      } else {
        this.db.updateTask(taskId, {
          status: 'failed', error: errorMsg, completedAt: new Date().toISOString(),
        });
      }

      throw err;
    }
  }

  // ==================== 内部方法 ====================

  private createSession(agentId: string, taskId: string): Session {
    const session: Session = {
      id: uuidv4(),
      agentId,
      taskId,
      status: 'active',
      context: { recentMessages: [], currentTask: taskId, toolHistory: [], variables: {} },
      messageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.db.createSession(session);
    this.db.updateTask(taskId, { sessionId: session.id });
    return session;
  }

  private async buildMessages(
    session: Session,
    input: Task['input'],
    agent: AgentConfig
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    const systemPrompt = agent.systemPrompt ?? this.defaultSystemPrompt(agent.name);
    messages.push({ role: 'system', content: systemPrompt });

    const history = this.db.getMessages(session.id, 20);
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content ?? '(无内容)',
        name: msg.name,
        toolCallId: msg.toolCallId,
      });
    }

    const userContent =
      typeof input.content === 'string' ? input.content : JSON.stringify(input.content);
    messages.push({ role: 'user', content: userContent });

    return messages;
  }

  private defaultSystemPrompt(agentName: string): string {
    return `你是 ${agentName}，一个专业的 AI 助手。
核心原则：
- 理解用户意图，提供准确、有用的回答
- 使用可用工具完成复杂任务
- 结果要清晰、结构化
- 遇到问题主动说明，不要隐瞒`;
  }

  private async runLLMLoop(
    taskId: string,
    session: Session,
    messages: LLMMessage[],
    enabledTools: any[],
    llm: LLMAdapter,
    agent: AgentConfig
  ): Promise<TaskOutput> {
    let finish = false;
    let iterations = 0;
    const maxIterations = 50;
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    while (!finish && iterations < maxIterations) {
      iterations++;
      this.reportMessage(taskId, `[LLM] 第 ${iterations} 轮`);

      // DEBUG: 打印发给 LLM 的完整消息
      const msgSummary = messages.map((m: any) => ({
        role: m.role, content: typeof m.content === 'string' ? m.content.slice(0, 20) : '[object]', tc: m.toolCalls?.length
      }));
      const response = await llm.chat(messages, enabledTools);
      const choice = response.choices[0];

      if (response.usage) {
        totalUsage.promptTokens += response.usage.promptTokens;
        totalUsage.completionTokens += response.usage.completionTokens;
        totalUsage.totalTokens += response.usage.totalTokens;
      }

      if (choice.finishReason === 'stop') {
        messages.push({ role: 'assistant', content: choice.message.content || '' });
        finish = true;
      } else if (choice.finishReason === 'tool_calls') {
        this.reportProgress(taskId, Math.min(20 + iterations * 3, 90));

        for (const toolCall of choice.message.toolCalls ?? []) {
          // assistant(tool_calls) 消息必须在 tool 结果之前
          messages.push({ role: 'assistant', content: ' ', toolCalls: [toolCall] });

          let args: any = {};
          try { args = JSON.parse(toolCall.function.arguments); } catch { /* ignore */ }

          this.reportMessage(taskId, `[Tool] ${toolCall.function.name}(${JSON.stringify(args).slice(0, 80)})`);

          const toolContext: ToolContext = {
            sessionId: session.id, taskId, agentId: agent.id,
            variables: session.context.variables,
          };

          let result: any = { success: false, error: 'unknown' };
          try {
            result = await this.tools.execute(toolCall.function.name, args, toolContext);
          } catch (err) {
            result = { success: false, error: err instanceof Error ? err.message : String(err) };
          }
          const resultContent =
            result.output == null ? '(无输出)' : (typeof result.output === 'string' ? result.output : JSON.stringify(result.output));


          messages.push({ role: 'tool', content: resultContent, toolCallId: toolCall.id, name: toolCall.function.name });

          session.context.toolHistory.push({
            id: toolCall.id, type: 'function', function: toolCall.function,
          });

          this.reportMessage(taskId, result.success
            ? `[Tool OK] ${String(result.output ?? '').slice(0, 100)}`
            : `[Tool ERR] ${result.error}`);
        }
      }
    }

    const finalMsg = messages[messages.length - 1];
    const outputContent =
      finalMsg?.role === 'assistant' && finalMsg?.content
        ? finalMsg.content
        : '(无文本输出)';

    return {
      type: 'text',
      content: outputContent,
      usage: totalUsage.totalTokens > 0 ? totalUsage : undefined,
    };
  }

  private saveMessage(sessionId: string, message: any): void {
    try { this.db.createMessage(message); } catch { /* ignore duplicate */ }
  }

  private reportProgress(taskId: string, progress: number): void {
    if (this.onProgress) this.onProgress(taskId, progress);
  }

  private reportMessage(taskId: string, message: string): void {
    if (this.onMessage) this.onMessage(taskId, message);
  }
}
