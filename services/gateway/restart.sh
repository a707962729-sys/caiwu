#!/bin/bash
# caiwu-gateway 重启脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔄 重启 caiwu-gateway..."

# 停止
"$SCRIPT_DIR/stop.sh"

# 等待端口释放
sleep 2

# 启动
"$SCRIPT_DIR/start.sh" "$@"