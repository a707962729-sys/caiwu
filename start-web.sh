#!/bin/bash
# 财务管家 - Web版启动脚本

CAIWU_DIR="/Users/mac/caiwu"

echo "清理旧进程..."
pkill -f "node.*services" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2

mkdir -p "$CAIWU_DIR/logs"

echo "启动API服务..."
cd "$CAIWU_DIR/services/api"
DATABASE_PATH="$CAIWU_DIR/data/caiwu.db" nohup node src/index.js > "$CAIWU_DIR/logs/api.log" 2>&1 &
cd "$CAIWU_DIR"
sleep 3

echo "启动AI服务..."
cd "$CAIWU_DIR/services/ai"
DATABASE_PATH="$CAIWU_DIR/data/caiwu.db" nohup node src/index.js > "$CAIWU_DIR/logs/ai.log" 2>&1 &
cd "$CAIWU_DIR"
sleep 3

echo "启动前端..."
cd "$CAIWU_DIR/apps/admin"
nohup npm run dev > "$CAIWU_DIR/logs/admin.log" 2>&1 &
cd "$CAIWU_DIR"

sleep 5

echo ""
echo "✅ 启动完成!"
echo "  API: http://localhost:3000"
echo "  AI:  http://localhost:3001"
echo "  Web: http://localhost:5174/"
