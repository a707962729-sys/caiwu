/**
 * Caiwu Executor — Express 路由
 * 挂载到独立 executor 服务
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getOrchestrator } from './orchestrator';

export const executorRouter = Router();

function getExecutor() {
  const ex = getOrchestrator();
  if (!ex) throw new Error('Executor 未初始化，请先调用 initExecutor()');
  return ex;
}

// ==================== 统计 & 工具 ====================

executorRouter.get('/stats', (_req: Request, res: Response) => {
  try {
    res.json(getExecutor().getStats());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

executorRouter.get('/tools', (_req: Request, res: Response) => {
  try {
    const ex = getExecutor();
    const tools = ex.getTools().getAllTools().map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      enabled: t.enabled,
    }));
    res.json({ tools });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== Agent ====================

executorRouter.get('/agents', (_req: Request, res: Response) => {
  try {
    res.json({ agents: getExecutor().listAgents() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

executorRouter.post('/agents', (req: Request, res: Response) => {
  try {
    const ex = getExecutor();
    const body = req.body;

    const agent = {
      id: body.id ?? uuidv4(),
      name: body.name,
      description: body.description ?? '',
      model: body.model ?? 'gpt-4o',
      modelType: body.modelType ?? 'openai',
      apiKey: body.apiKey ?? process.env.OPENAI_API_KEY,
      baseUrl: body.baseUrl ?? process.env.OPENAI_BASE_URL,
      maxTokens: body.maxTokens ?? 4096,
      temperature: body.temperature ?? 0.7,
      systemPrompt: body.systemPrompt ?? undefined,
      tools: body.tools ?? [],
      skills: body.skills ?? [],
      experienceId: undefined,
      concurrentLimit: body.concurrentLimit ?? 3,
      status: 'idle' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!agent.name) {
      res.status(400).json({ error: 'name 必填' });
      return;
    }

    ex.registerAgent(agent);
    res.json({ agent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

executorRouter.get('/agents/:id', (req: Request, res: Response) => {
  try {
    const agent = getExecutor().getAgent(req.params.id);
    if (!agent) { res.status(404).json({ error: 'Agent 不存在' }); return; }
    res.json({ agent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

executorRouter.delete('/agents/:id', (req: Request, res: Response) => {
  try {
    const ex = getExecutor();
    getExecutor().getDb().deleteAgent(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 任务 ====================

executorRouter.get('/tasks', (req: Request, res: Response) => {
  try {
    const { status, agentId } = req.query;
    const tasks = getExecutor().listTasks({
      status: status as string,
      agentId: agentId as string,
    });
    res.json({ tasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

executorRouter.post('/tasks', (req: Request, res: Response) => {
  try {
    const ex = getExecutor();
    const { agentId, input, priority = 'normal' } = req.body;

    if (!agentId) { res.status(400).json({ error: 'agentId 必填' }); return; }
    if (!input) { res.status(400).json({ error: 'input 必填' }); return; }

    const taskInput = {
      type: input.type ?? 'text',
      content: input.content ?? input,
      context: input.context,
    };

    const task = ex.submitTask(agentId, taskInput, priority);
    res.json({ task });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

executorRouter.get('/tasks/:id', (req: Request, res: Response) => {
  try {
    const task = getExecutor().getTask(req.params.id);
    if (!task) { res.status(404).json({ error: '任务不存在' }); return; }
    res.json({ task });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

executorRouter.post('/tasks/:id/cancel', (req: Request, res: Response) => {
  try {
    getExecutor().cancelTask(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 会话消息 ====================

executorRouter.get('/sessions/:id/messages', (req: Request, res: Response) => {
  try {
    const db = (getExecutor() as any).db;
    const messages = db.getMessages(req.params.id);
    res.json({ messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
