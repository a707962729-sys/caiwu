#!/bin/bash
# AI服务监控脚本 - 自动重启挂掉的AI服务

AI_DIR="/Users/mac/caiwu/services/ai"
LOG_FILE="/Users/mac/caiwu/logs/ai-monitor.log"

echo "[$(date)] AI服务监控启动" >> $LOG_FILE

while true; do
    # 检查AI服务是否存活
    if curl -s --max-time 3 http://localhost:3001/health > /dev/null 2>&1; then
        sleep 10
    else
        echo "[$(date)] AI服务无响应，尝试重启..." >> $LOG_FILE
        
        # 杀掉可能存在的进程
        pkill -9 -f "node.*services/ai" 2>/dev/null
        sleep 2
        
        # 重启AI服务
        cd $AI_DIR
        nohup node src/index.js >> $LOG_FILE 2>&1 &
        
        echo "[$(date)] AI服务已重启" >> $LOG_FILE
        sleep 5
    fi
done
