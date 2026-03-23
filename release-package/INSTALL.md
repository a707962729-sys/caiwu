# 财务管家 Mac 安装包

## 📦 安装包内容

| 文件 | 说明 | 大小 |
|------|------|------|
| `财务管家-1.0.0-arm64.dmg` | Apple Silicon (M1/M2/M3) 安装包 | 114 MB |
| `财务管家-1.0.0.dmg` | Intel Mac 安装包 | 119 MB |
| `backend/` | 后端 API 服务 | 337 MB |
| `data/` | 数据库文件 | 120 KB |
| `start.sh` | 一键启动脚本 | - |

**总大小**: ~571 MB

## 🚀 快速安装

### 方式一：一键启动

```bash
cd release-package
./start.sh
```

然后打开 `财务管家.app` 应用

### 方式二：分别安装

#### 1. 安装前端应用

- Apple Silicon Mac: 双击 `财务管家-1.0.0-arm64.dmg`
- Intel Mac: 双击 `财务管家-1.0.0.dmg`

将应用拖拽到 Applications 文件夹

#### 2. 启动后端服务

```bash
cd backend
./start-api.sh
```

#### 3. 启动应用

从 Applications 打开 **财务管家**

## ⚙️ OpenClaw Gateway 配置

支持自定义 OpenClaw Gateway 地址：

```bash
# 设置环境变量
export OPENCLAW_GATEWAY_URL="http://your-server:18789"

# 启动后端
cd backend && ./start-api.sh
```

默认配置：
- API 服务: `http://localhost:3000`
- Gateway: `http://localhost:18789`

## 📋 系统要求

- macOS 10.15+
- Node.js 18+
- 内存: 4GB+
- 磁盘: 1GB+

## ⚠️ 注意事项

1. **首次运行**: macOS 可能提示"无法验证开发者"，请在系统设置中允许运行
2. **端口占用**: 确保 3000 端口未被占用
3. **数据备份**: 定期备份 `data/caiwu.db` 文件

## 🔧 故障排除

### 前端无法连接后端
- 检查后端是否在运行: `curl http://localhost:3000/api`
- 检查防火墙设置

### 应用无法打开
- 系统设置 → 隐私与安全性 → 允许运行

### 后端启动失败
- 安装依赖: `cd backend && npm install`
- 检查 Node.js 版本: `node -v`

---
**版本**: 1.0.0  
**构建日期**: 2026-03-23  
**构建者**: OpenClaw Agent
