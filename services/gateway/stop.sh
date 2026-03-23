#!/bin/bash
# caiwu-gateway 停止脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 查找进程
PID=$(lsof -ti:18900 2>/dev/null || true)

if [ -z "$PID" ]; then
    # 尝试通过进程名查找
    PID=$(pgrep -f "caiwu-gateway" 2>/dev/null || true)
fi

if [ -z "$PID" ]; then
    echo "ℹ️  caiwu-gateway 未运行"
    exit 0
fi

echo "🛑 停止 caiwu-gateway (PID: $PID)..."
kill -TERM "$PID" 2>/dev/null || true

# 等待进程结束
for i in {1..10}; do
    if ! kill -0 "$PID" 2>/dev/null; then
        echo "✅ caiwu-gateway 已停止"
        exit 0
    fi
    sleep 1
done

# 强制杀死
echo "⚠️  强制停止..."
kill -9 "$PID" 2>/dev/null || true
echo "✅ caiwu-gateway 已强制停止"