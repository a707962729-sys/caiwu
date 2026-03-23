#!/bin/bash
# caiwu-gateway 状态检查脚本

set -e

PORT=18900
PID=$(lsof -ti:$PORT 2>/dev/null || true)

if [ -z "$PID" ]; then
    echo "状态: ⚪ 未运行"
    echo "端口: $PORT 空闲"
    exit 0
fi

echo "状态: 🟢 运行中"
echo "端口: $PORT"
echo "PID: $PID"

# 检查健康状态
HEALTH=$(curl -s http://127.0.0.1:$PORT/health 2>/dev/null || echo "null")

if [ "$HEALTH" != "null" ]; then
    echo ""
    echo "健康检查:"
    echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
else
    echo ""
    echo "健康检查: ❌ 无响应"
fi

# 内存使用
if command -v ps &> /dev/null; then
    MEM=$(ps -o rss= -p $PID 2>/dev/null | awk '{printf "%.1f MB", $1/1024}')
    echo ""
    echo "内存: $MEM"
fi