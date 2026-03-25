# Caiwu Executor — 独立服务集成指南

> nanoclaw 核心精简版，完全独立，不依赖 OpenClaw  
> 端口：3100（可通过 EXECUTOR_PORT 环境变量修改）

---

## 目录结构

```
caiwu/
└── services/
    └── executor/                  ← 新建
        ├── package.json
        ├── tsconfig.json
        ├── .env                  ← 环境变量
        ├── data/                 ← SQLite 数据（自动创建）
        │   └── executor.db
        └── src/
            ├── index.ts          ← 服务入口
            ├── types.ts          ← 核心类型
            ├── db.ts             ← SQLite 持久化
            ├── llm-adapter.ts    ← LLM 适配器
            ├── tool-registry.ts  ← 工具注册表
            ├── agent-runtime.ts   ← Agent 执行循环
            ├── orchestrator.ts    ← 主编排器
            ├── routes.ts          ← Express 路由
            └── built-in-tools/
                ├── bash-tool.ts
                ├── file-tool.ts
                ├── file-write-tool.ts
                ├── web-search-tool.ts
                └── http-fetch-tool.ts
```

## 快速启动

```bash
# 1. 进入 executor 目录
cd services/executor

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY 等

# 4. 启动
npm run dev
```

## .env 配置示例

```env
OPENAI_API_KEY=sk-xxxxx
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_API_KEY=sk-ant-xxxxx
EXECUTOR_PORT=3100
EXECUTOR_DB_PATH=./data/executor.db
```

## API 路由

```
GET    /health                    ← 健康检查
GET    /api/stats                 ← 执行器统计
GET    /api/tools                 ← 工具列表
GET    /api/agents               ← 列出所有 Agent
POST   /api/agents               ← 创建 Agent
GET    /api/agents/:id           ← 获取单个 Agent
DELETE /api/agents/:id           ← 删除 Agent
GET    /api/tasks                ← 列出任务
POST   /api/tasks                ← 提交任务
GET    /api/tasks/:id            ← 获取任务状态
POST   /api/tasks/:id/cancel     ← 取消任务
GET    /api/sessions/:id/messages ← 获取会话历史
```

## 创建 Agent 示例

```bash
curl -X POST http://localhost:3100/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "财务助手",
    "description": "企业财务分析 AI 助手",
    "model": "gpt-4o",
    "modelType": "openai",
    "systemPrompt": "你是企业的财务助手，擅长数据分析、报表生成...",
    "tools": ["executor_bash", "executor_file_read", "executor_file_write", "executor_web_search", "executor_http_fetch"],
    "concurrentLimit": 3
  }'
```

## 提交任务示例

```bash
curl -X POST http://localhost:3100/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "<agent-id>",
    "input": {
      "type": "text",
      "content": "分析本月各项支出，生成摘要报告"
    },
    "priority": "normal"
  }'
```

## 内置工具

| 工具 ID | 说明 | 参数 |
|---------|------|------|
| `executor_bash` | 执行 shell 命令（有安全限制） | command, timeout, cwd |
| `executor_file_read` | 读取文件 | path, maxLines |
| `executor_file_write` | 写入文件 | path, content, append |
| `executor_web_search` | DuckDuckGo 网页搜索 | query, count |
| `executor_http_fetch` | HTTP GET/POST | url, method, headers, body |

## 与 AI 服务集成

AI 服务（端口 3001）可通过 HTTP 调用 Executor 服务：

```js
// services/ai/src/providers/openai.js 或类似位置
const executorBase = 'http://localhost:3100';

// 调用 executor 执行任务
const res = await fetch(`${executorBase}/api/tasks`, {
  method: 'POST',
  body: JSON.stringify({ agentId, input: { type: 'text', content } })
});
```

## 与现有 caiwu 系统集成

Executor 服务启动后，通过 `agentId` 与业务关联：

1. **创建 Agent** 时，`id` 可设为业务相关的标识（如 `finance-analyst-01`）
2. **提交任务** 时，`input.content` 传入业务指令
3. **查询结果** 通过 `/api/tasks/:id` 轮询或 WebSocket 推送

## 扩展自定义工具

在任意位置注册全局工具：

```js
const { GlobalToolRegistry } = require('./tool-registry');

GlobalToolRegistry.register({
  id: 'my_custom_tool',
  name: 'my_custom_tool',
  description: '自定义工具',
  parameters: { type: 'object', properties: { ... } },
  enabled: true,
  handler: async (params, context) => {
    return { success: true, output: '结果' };
  }
});
```

---

*代码位置：~/Desktop/caiwu/services/executor/*
