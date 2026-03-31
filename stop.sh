#!/bin/bash
# 财务管家 - 停止脚本

LOG_DIR="$HOME/caiwu/logs"

echo "停止财务管家..."

# 停止 AI
if [ -f "$LOG_DIR/ai.pid" ]; then
    AI_PID=$(cat "$LOG_DIR/ai.pid")
    if kill -0 "$AI_PID" 2>/dev/null; then
        kill "$AI_PID" && echo "AI 服务已停止 (PID: $AI_PID)"
    fi
    rm -f "$LOG_DIR/ai.pid"
fi

# 停止 API
if [ -f "$LOG_DIR/api.pid" ]; then
    API_PID=$(cat "$LOG_DIR/api.pid")
    if kill -0 "$API_PID" 2>/dev/null; then
        kill "$API_PID" && echo "API 服务已停止 (PID: $API_PID)"
    fi
    rm -f "$LOG_DIR/api.pid"
fi

# 停止 Desktop
if [ -f "$LOG_DIR/desktop.pid" ]; then
    DESKTOP_PID=$(cat "$LOG_DIR/desktop.pid")
    if kill -0 "$DESKTOP_PID" 2>/dev/null; then
        kill "$DESKTOP_PID" && echo "Desktop 应用已停止 (PID: $DESKTOP_PID)"
    fi
    rm -f "$LOG_DIR/desktop.pid"
fi

# 清理残留 node 进程（精准匹配）
pkill -f "node src/index.js.*services/api" 2>/dev/null && echo "清理残留 API 进程"
pkill -f "node src/index.js.*services/ai" 2>/dev/null && echo "清理残留 AI 进程"
pkill -f "vite" 2>/dev/null && echo "清理残留 Vite 进程"

echo "停止完成"
