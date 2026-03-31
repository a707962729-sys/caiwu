#!/bin/bash
# 财务管家 - 一键启动脚本
# 同时启动 API 服务 + Desktop 应用

set -e

CAIWU_DIR="$HOME/caiwu"
API_DIR="$CAIWU_DIR/services/api"
DESKTOP_DIR="$CAIWU_DIR/apps/desktop"
LOG_DIR="$CAIWU_DIR/logs"

mkdir -p "$LOG_DIR"

API_LOG="$LOG_DIR/api.log"
AI_DIR="$CAIWU_DIR/services/ai"
DESKTOP_LOG="$LOG_DIR/desktop.log"
AI_LOG="$LOG_DIR/ai.log"

echo "========================================="
echo "  财务管家 - 一键启动"
echo "========================================="

# 启动 AI 服务
start_ai() {
    echo "[1/3] 启动 AI 服务..."
    cd "$AI_DIR"
    node src/index.js > "$AI_LOG" 2>&1 &
    AI_PID=$!
    echo $AI_PID > "$LOG_DIR/ai.pid"
    echo "  AI 服务已启动 (PID: $AI_PID)"
    echo "  日志: $AI_LOG"
}

# 等待 AI 服务就绪
wait_ai() {
    echo "  等待 AI 服务就绪..."
    for i in {1..15}; do
        if curl -s http://localhost:3001/health > /dev/null 2>&1; then
            echo "  AI 服务已就绪 ✓"
            return 0
        fi
        sleep 1
    done
    echo "  AI 服务启动超时，请检查日志: $AI_LOG"
    return 1
}

# 启动 API 服务
start_api() {
    echo "[2/3] 启动 API 服务..."
    cd "$API_DIR"
    node src/index.js > "$API_LOG" 2>&1 &
    API_PID=$!
    echo $API_PID > "$LOG_DIR/api.pid"
    echo "  API 服务已启动 (PID: $API_PID)"
    echo "  日志: $API_LOG"
}

# 等待 API 服务就绪
wait_api() {
    echo "  等待 API 服务就绪..."
    for i in {1..30}; do
        if curl -s http://localhost:3000/api/auth/me > /dev/null 2>&1; then
            echo "  API 服务已就绪 ✓"
            return 0
        fi
        sleep 1
    done
    echo "  API 服务启动超时，请检查日志: $API_LOG"
    return 1
}

# 启动 Desktop 应用
start_desktop() {
    echo "[3/3] 启动 Desktop 应用..."
    cd "$DESKTOP_DIR"
    if command -v npm &> /dev/null; then
        npm run dev > "$DESKTOP_LOG" 2>&1 &
        DESKTOP_PID=$!
        echo $DESKTOP_PID > "$LOG_DIR/desktop.pid"
        echo "  Desktop 应用已启动 (PID: $DESKTOP_PID)"
        echo "  日志: $DESKTOP_LOG"
    else
        echo "  错误: 未找到 npm 命令"
        return 1
    fi
}

# 主流程
start_ai
wait_ai
start_api
wait_api
start_desktop

echo ""
echo "========================================="
echo "  启动完成!"
echo "  - AI:    http://localhost:3001"
echo "  - API:   http://localhost:3000"
echo "  - Desktop: 开发服务器 (检查日志)"
echo "========================================="
echo ""
echo "停止命令: ~/caiwu/stop.sh"
