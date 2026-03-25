/**
 * Caiwu Executor — 主编排器
 * 任务轮询 + Agent 调度
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  Task,
  TaskInput,
  ExecutorState,
  AgentConfig,
} from './types';
import { ExecutorDB } from './db';
import { ToolRegistry } from './tool-registry';
import { AgentRuntime } from './agent-runtime';

// ============ ExecutorOrchestrator ============

export class ExecutorOrchestrator extends EventEmitter {
  private db!: ExecutorDB;
  private tools!: ToolRegistry;
  private pollIntervalMs = 3000;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private activeTaskCount = new Map<string, number>();

  async init(dbPath: string): Promise<void> {
    this.db = new ExecutorDB(dbPath);
    await this.db.init();
    this.tools = new ToolRegistry();
    await this.tools.init();
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    this.pollTimer = setInterval(() => {
      this.pollTasks().catch((err) => {
        console.error('[Executor] poll error:', err.message);
      });
    }, this.pollIntervalMs);

    console.log('[Executor] 已启动，轮询间隔 3s');
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('[Executor] 已停止');
  }

  // ---- Agent 管理 ----

  registerAgent(agent: AgentConfig): void {
    const existing = this.db.getAgent(agent.id);
    if (existing) {
      this.db.updateAgent(agent.id, agent);
    } else {
      this.db.createAgent(agent);
    }
  }

  getAgent(agentId: string): AgentConfig | undefined {
    return this.db.getAgent(agentId);
  }

  listAgents(): AgentConfig[] {
    return this.db.listAgents();
  }

  // ---- 任务管理 ----

  submitTask(agentId: string, input: TaskInput, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'): Task {
    const task: Task = {
      id: uuidv4(),
      agentId,
      status: 'pending',
      priority,
      input,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.db.createTask(task);
    this.emit('task:submitted', { taskId: task.id, agentId });
    return task;
  }

  getTask(taskId: string): Task | undefined {
    return this.db.getTask(taskId);
  }

  listTasks(filter?: { status?: string; agentId?: string }): Task[] {
    return this.db.listTasks(filter as any);
  }

  cancelTask(taskId: string): void {
    const task = this.db.getTask(taskId);
    if (!task) return;
    if (task.status === 'pending' || task.status === 'running') {
      this.db.updateTask(taskId, { status: 'cancelled' });
      this.emit('task:cancelled', { taskId });
    }
  }

  getStats(): ExecutorState {
    return this.db.getExecutorStats();
  }

  getTools(): ToolRegistry {
    return this.tools;
  }

  getDb(): ExecutorDB {
    return this.db;
  }

  deleteAgent(id: string): void {
    this.db.deleteAgent(id);
  }

  // ---- 内部轮询 ----

  private async pollTasks(): Promise<void> {
    if (!this.running) return;
    const pending = this.db.pollPendingTasks(10);
    console.log(`[Executor] poll: running=${this.running}, pending_count=${pending.length}`);
    for (const task of pending) {
      await this.executeTask(task);
    }
  }

  private async executeTask(task: Task): Promise<void> {
    const currentActive = this.activeTaskCount.get(task.agentId) ?? 0;
    const agent = this.db.getAgent(task.agentId);

    console.log(`[Executor] executeTask: task=${task.id} agent=${task.agentId} active=${currentActive}`);

    if (!agent) {
      this.db.updateTask(task.id, { status: 'failed', error: `Agent ${task.agentId} not found` });
      return;
    }

    if (currentActive >= (agent.concurrentLimit ?? 3)) {
      console.log(`[Executor] concurrent limit reached for agent ${task.agentId}`);
      return;
    }

    this.db.updateTask(task.id, { status: 'running', startedAt: new Date().toISOString() });
    this.activeTaskCount.set(task.agentId, currentActive + 1);
    this.emit('task:started', { taskId: task.id, agentId: task.agentId });

    console.log(`[Executor] starting task ${task.id} with agent ${agent.name}`);

    const runtime = new AgentRuntime({
      db: this.db,
      tools: this.tools,
      onProgress: (tid, progress) => {
        this.db.updateTask(tid, { progress });
        this.emit('task:progress', { taskId: tid, progress });
      },
      onMessage: (tid, message) => {
        this.emit('task:message', { taskId: tid, message });
      },
    });

    runtime
      .execute(task, agent)
      .then((output) => {
        this.db.updateTask(task.id, {
          status: 'completed', output,
          completedAt: new Date().toISOString(),
        });
        this.emit('task:completed', { taskId: task.id, agentId: task.agentId, output });
      })
      .catch((err) => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Executor] executeTask error for task ${task.id}:`, err);
        const retryCount = task.retryCount ?? 0;

        if (retryCount < (task.maxRetries ?? 3)) {
          this.db.updateTask(task.id, {
            status: 'pending', retryCount: retryCount + 1, error: errorMsg,
          });
        } else {
          this.db.updateTask(task.id, {
            status: 'failed', error: errorMsg, completedAt: new Date().toISOString(),
          });
          this.emit('task:failed', { taskId: task.id, agentId: task.agentId, error: errorMsg });
        }
      })
      .finally(() => {
        const count = this.activeTaskCount.get(task.agentId) ?? 1;
        this.activeTaskCount.set(task.agentId, Math.max(0, count - 1));
      });
  }
}

// ============ 单例 ============

let _orchestrator: ExecutorOrchestrator | null = null;

export function initExecutor(dbPath: string): ExecutorOrchestrator {
  _orchestrator = new ExecutorOrchestrator();
  // 启动时不自动 start，由调用方控制
  return _orchestrator;
}

export function getOrchestrator(): ExecutorOrchestrator | null {
  return _orchestrator;
}
