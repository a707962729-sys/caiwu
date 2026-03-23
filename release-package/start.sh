#!/bin/bash
# 财务管家一键启动脚本

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "================================"
echo "   财务管家系统启动中..."
echo "================================"

# 启动后端服务
echo ""
echo "1. 启动后端服务..."
cd "$SCRIPT_DIR/backend"
export NODE_ENV=production
export PORT=3000
node src/index.js &
BACKEND_PID=$!

# 等待后端启动
sleep 2

echo ""
echo "2. 后端服务已启动 (PID: $BACKEND_PID)"
echo "   API 地址: http://localhost:3000"
echo ""
echo "3. 请打开 财务管家.app 开始使用"
echo ""
echo "按 Ctrl+C 停止服务"

# 等待
wait $BACKEND_PID
