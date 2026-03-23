#!/bin/bash
# caiwu-gateway 启动脚本
# 用法: ./start.sh [dev|prod]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MODE="${1:-prod}"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
fi

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 加载环境变量
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

case "$MODE" in
    dev)
        echo "🚀 启动 caiwu-gateway (开发模式)..."
        npm run dev
        ;;
    prod)
        echo "🚀 启动 caiwu-gateway (生产模式)..."
        npm start
        ;;
    *)
        echo "用法: $0 [dev|prod]"
        exit 1
        ;;
esac