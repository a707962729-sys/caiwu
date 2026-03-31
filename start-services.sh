#!/bin/bash
# 启动所有服务

CAIWU_DIR="/Users/mac/caiwu"

echo "🚀 启动财务管理系统服务..."

# 启动 API 服务
echo "📡 启动 API 服务..."
cd "$CAIWU_DIR/services/api"
nohup node src/index.js > "$CAIWU_DIR/services/logs/api.log" 2>&1 &

# 启动 AI 服务
echo "🤖 启动 AI 服务..."
cd "$CAIWU_DIR/services/ai"
nohup node src/index.js > "$CAIWU_DIR/services/logs/ai.log" 2>&1 &

# 等待服务启动
sleep 3

# 启动前端
echo "🖥️ 启动后台管理页面..."
cd "$CAIWU_DIR/apps/admin"
nohup node_modules/.bin/vite --host 0.0.0.0 > "$CAIWU_DIR/services/logs/admin.log" 2>&1 &

sleep 2

# 打开浏览器
echo "🌐 打开后台管理页面..."
open "http://localhost:5174"

echo "✅ 所有服务已启动！"
echo ""
echo "服务状态:"
echo "  - API: http://localhost:3000"
echo "  - AI: http://localhost:3001"
echo "  - 后台: http://localhost:5174"
