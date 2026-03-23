#!/bin/bash
# 财务管家后端服务启动脚本

# 设置工作目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CAIWU_ROOT="$(dirname "$SCRIPT_DIR")"

# 设置环境变量
export NODE_ENV=production
export PORT=3000

# 支持 OpenClaw Gateway 配置
if [ -n "$OPENCLAW_GATEWAY_URL" ]; then
    export OPENCLAW_GATEWAY_URL="$OPENCLAW_GATEWAY_URL"
else
    export OPENCLAW_GATEWAY_URL="http://localhost:18789"
fi

# 启动 API 服务
cd "$CAIWU_ROOT/services/api"
echo "Starting Caiwu API Server..."
echo "  - Port: $PORT"
echo "  - OpenClaw Gateway: $OPENCLAW_GATEWAY_URL"
echo "  - Database: $CAIWU_ROOT/data/caiwu.db"

node src/index.js
