/**
 * Caiwu Executor — 独立服务入口
 * 端口 3100，完全独立，不依赖 OpenClaw
 */

require('dotenv').config();
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { initExecutor } from './orchestrator';
import { executorRouter } from './routes';

// ============ Express App ============

const app = express();
const PORT = parseInt(process.env.EXECUTOR_PORT ?? '3100');
const DB_PATH = process.env.EXECUTOR_DB_PATH ?? path.join(__dirname, '../../data/executor.db');

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// ============ 健康检查 ============

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'caiwu-executor', port: PORT, ts: new Date().toISOString() });
});

// ============ API 路由 ============

app.use('/api', executorRouter);

// ============ 错误处理 ============

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Executor] Error:', err.message);
  res.status(err.status ?? 500).json({ error: err.message ?? '内部错误' });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: '接口不存在' });
});

// ============ 启动 ============

async function main() {
  const executor = initExecutor(DB_PATH);
  await executor.init(DB_PATH);
  executor.start();

  executor.on('task:completed', ({ taskId, agentId }: any) => {
    console.log(`[Executor] ✓ Task ${taskId} completed by ${agentId}`);
  });

  executor.on('task:failed', ({ taskId, agentId, error }: any) => {
    console.error(`[Executor] ✗ Task ${taskId} failed (${agentId}): ${error}`);
  });

  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║   caiwu-executor v1.0.0                          ║
║   nanoclaw 核心 · 独立服务                        ║
║                                                  ║
║   🌐 http://localhost:${PORT}                       ║
║   📊 http://localhost:${PORT}/api/stats             ║
║   🔧 http://localhost:${PORT}/api/tools             ║
╚═══════════════════════════════════════════════════╝
    `);
  });
}

main().catch((err: Error) => {
  console.error('[Executor] 启动失败:', err.message);
  process.exit(1);
});
