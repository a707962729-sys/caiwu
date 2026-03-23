# 财务管家系统安装说明

## 系统要求

- macOS 10.15 或更高版本
- Node.js 18.0 或更高版本

## 安装步骤

### 1. 安装前端应用

双击 `财务管家-1.0.0-arm64.dmg`（Apple Silicon Mac）或 `财务管家-1.0.0.dmg`（Intel Mac）

将 **财务管家** 应用拖拽到 Applications 文件夹

### 2. 启动后端服务

```bash
# 进入安装目录
cd /path/to/caiwu/dist-backend

# 启动后端服务
./start-api.sh
```

后端服务将在 http://localhost:3000 运行

### 3. 启动前端应用

从 Applications 文件夹打开 **财务管家** 应用

## OpenClaw 集成配置

财务管家支持与 OpenClaw Gateway 集成。设置环境变量：

```bash
# 设置 OpenClaw Gateway 地址
export OPENCLAW_GATEWAY_URL="http://your-gateway:18789"

# 然后启动后端服务
./start-api.sh
```

默认配置：
- 后端 API: http://localhost:3000
- OpenClaw Gateway: http://localhost:18789

## 数据库

数据库文件位于 `data/caiwu.db`（SQLite）

首次运行时会自动初始化数据库结构

## 故障排除

### 前端无法连接后端

1. 确认后端服务正在运行
2. 检查端口 3000 是否被占用
3. 检查防火墙设置

### 后端启动失败

1. 确认 Node.js 版本 >= 18
2. 运行 `npm install` 安装依赖
3. 检查数据库文件权限

## 文件位置

- 前端应用: `/Applications/财务管家.app`
- 后端服务: `./dist-backend/`
- 数据库: `./data/caiwu.db`
- 配置文件: `./services/api/.env`

---
版本: 1.0.0
构建日期: 2026-03-23
