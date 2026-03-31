#!/bin/bash
# 创建桌面快捷方式

echo "🚀 创建财务管理统桌面快捷方式..."

# 获取当前目录
CURRENT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 创建桌面 app
APP_NAME="财务管理统"
APP_PATH="$HOME/Desktop/${APP_NAME}.app"

# 删除旧版本
rm -rf "$APP_PATH"

# 创建应用结构
mkdir -p "$APP_PATH/Contents/MacOS"
mkdir -p "$APP_PATH/Contents/Resources"

# 创建启动脚本
cat > "$APP_PATH/Contents/MacOS/${APP_NAME}" << 'LAUNCHER'
#!/bin/bash

# 获取脚本所在目录
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CAIWU_DIR="$(cd "$(dirname "$0")/../.. && pwd)"

# 尝试在多个位置查找 caiwu 目录
POSSIBLE_DIRS=(
    "$HOME/caiwu"
    "$HOME/Desktop/caiwu"
    "/Users/mac/caiwu"
    "$CAIWU_DIR"
)

CAIWU_DIR=""
for dir in "${POSSIBLE_DIRS[@]}"; do
    if [ -d "$dir/services/api" ] && [ -d "$dir/apps/admin" ]; then
        CAIWU_DIR="$dir"
        break
    fi
done

# 如果没找到，弹出选择框
if [ -z "$CAIWU_DIR" ]; then
    osascript -e 'tell application "Finder" to activate' \
              -e "set chosen_folder to POSIX path of (choose folder with prompt \"请选择 caiwu 项目目录：\")"
    CAIWU_DIR=$(osascript -e 'tell application "Finder" to activate' \
                 -e 'set chosen_folder to POSIX path of (choose folder with prompt "请选择 caiwu 项目目录：")' 2>/dev/null)
fi

if [ -z "$CAIWU_DIR" ] || [ ! -d "$CAIWU_DIR" ]; then
    osascript -e 'display dialog "找不到 caiwu 项目目录！" buttons "OK"'
    exit 1
fi

echo "使用 caiwu 目录: $CAIWU_DIR"

# 杀掉旧进程
pkill -f "node.*api.*src.*index" 2>/dev/null
pkill -f "node.*ai.*src.*index" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# 启动 API
cd "$CAIWU_DIR/services/api"
nohup node src/index.js >> "$CAIWU_DIR/logs/api.log" 2>&1 &
echo "📡 API 已启动"

# 启动 AI
cd "$CAIWU_DIR/services/ai"
nohup node src/index.js >> "$CAIWU_DIR/logs/ai.log" 2>&1 &
echo "🤖 AI 已启动"

# 启动前端
cd "$CAIWU_DIR/apps/admin"
nohup node_modules/.bin/vite --host 0.0.0.0 >> "$CAIWU_DIR/logs/admin.log" 2>&1 &
echo "🖥️ 前端已启动"

sleep 3
open "http://localhost:5174"
echo "✅ 启动完成！"
LAUNCHER

chmod +x "$APP_PATH/Contents/MacOS/${APP_NAME}"

# 创建 Info.plist
cat > "$APP_PATH/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>com.caiwu.financial</string>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright 2026. All rights reserved.</string>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
</dict>
</plist>
PLIST

# 同时创建 .command 快捷方式
cat > "$HOME/Desktop/启动财务管理系统.command" << 'COMMAND'
#!/bin/bash
cd "$(dirname "$0")/../caiwu"
./start.sh
COMMAND

chmod +x "$HOME/Desktop/启动财务管理系统.command"

echo "✅ 桌面快捷方式已创建！"
echo ""
echo "快捷方式位置："
echo "  - ${APP_NAME}.app"
echo "  - 启动财务管理系统.command"
echo ""
echo "双击即可启动所有服务并打开后台管理页面！"
