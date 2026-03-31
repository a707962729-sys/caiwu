#!/bin/bash
# AI服务启动脚本 - 自动清理端口占用

cd /Users/mac/caiwu/services/ai

# 清理3001端口
echo "清理3001端口..."
lsof -ti :3001 | xargs kill -9 2>/dev/null || true
pkill -9 -f "node.*services/ai" 2>/dev/null || true
pkill -9 -f "nodemon.*ai" 2>/dev/null || true

sleep 1

# 检查端口是否已释放
if lsof -i :3001 >/dev/null 2>&1; then
    echo "端口3001仍被占用，等待..."
    sleep 2
    lsof -ti :3001 | xargs kill -9 2>/dev/null || true
fi

# 启动服务
echo "启动AI服务..."
nohup node src/index.js > /Users/mac/caiwu/logs/ai.log 2>&1 &
echo "AI服务已启动 (PID: $!)"
