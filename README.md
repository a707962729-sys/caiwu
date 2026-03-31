# 财务管理系统

基于 AI 的智能财务管理系统，支持发票管理、劳动合同自动录入、工资计算等功能。

## 功能特点

- 📊 **发票管理**：发票识别、审核、作废
- 📝 **劳动合同**：通过 QQ 机器人自动录入员工信息
- 💰 **工资管理**：自动计算试用期/正式期工资
- 🤖 **AI 助手**：智能合同审查、报销审核
- 📱 **多端支持**：支持桌面端访问

## 系统要求

- macOS 10.15+
- Node.js 18+
- npm 8+

## 安装步骤

### 1. 克隆代码

```bash
git clone https://github.com/a707962729-sys/caiwu.git
cd caiwu
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动服务

```bash
./start.sh
```

服务启动后自动打开浏览器访问后台：
- 后台管理：http://localhost:5174
- API 服务：http://localhost:3000
- AI 服务：http://localhost:3001

## 创建桌面快捷方式

安装完成后，运行以下命令创建桌面快捷方式：

```bash
./create-desktop-shortcut.sh
```

或在 Finder 中双击 `财务管理统.app` 启动。

## 默认账号

- 用户名：`admin`
- 密码：`admin123`

## QQ 机器人

1. 添加 QQ 机器人为好友
2. 发送合同文件（PDF/Word）自动识别员工信息
3. 发送「发票」相关文件自动录入发票信息

## 目录结构

```
caiwu/
├── apps/
│   └── admin/          # 前端管理后台
├── services/
│   ├── api/            # API 服务
│   ├── ai/             # AI 服务
│   └── ...
├── data/              # 数据库文件
└── logs/               # 日志文件
```

## 常见问题

**Q: 启动报错 "port already in use"**
A: 可能端口被占用，执行 `./stop.sh` 再重新启动

**Q: AI 服务无法连接**
A: 确保 AI 服务已启动，查看 `logs/ai.log` 排查问题

## License

MIT
