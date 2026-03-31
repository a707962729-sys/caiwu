#!/bin/bash
# AI 服务看门狗脚本
# 如果 AI 服务挂了，自动重启

SERVICE_NAME="ai-service"
SERVICE_DIR="/Users/mac/caiwu/services/ai"
LOG_FILE="/Users/mac/caiwu/logs/ai-watchdog.log"
CHECK_INTERVAL=30  # 每30秒检查一次

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

check_service() {
    # 检查服务是否响应
    response=$(curl -s -m 5 http://localhost:3001/api/ai/chat \
        -H "Content-Type: application/json" \
        -d '{"message":"ping","images":[]}' 2>/dev/null)
    
    if echo "$response" | grep -q "response"; then
        return 0  # 服务正常
    else
        return 1  # 服务异常
    fi
}

restart_service() {
    log "检测到 AI 服务异常，正在重启..."
    
    # 杀掉现有进程
    pkill -f "node.*ai.*src.*index" 2>/dev/null
    sleep 2
    
    # 重启服务
    cd $SERVICE_DIR
    nohup node src/index.js >> /Users/mac/caiwu/logs/ai.log 2>&1 &
    
    sleep 3
    
    # 验证重启成功
    if curl -s -m 5 http://localhost:3001/api/ai/chat \
        -H "Content-Type: application/json" \
        -d '{"message":"ping","images":[]}' 2>/dev/null | grep -q "response"; then
        log "AI 服务重启成功"
        return 0
    else
        log "AI 服务重启失败"
        return 1
    fi
}

# 主循环
log "看门狗启动，监控 AI 服务..."
while true; do
    if check_service; then
        # 服务正常，不做任何事
        :
    else
        log "AI 服务无响应"
        restart_service
    fi
    sleep $CHECK_INTERVAL
done
