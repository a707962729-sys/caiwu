# 财务管家

企业财务管理系统，支持记账、合同、订单、报销、票据等功能。

## 项目结构

```
caiwu/
├── database/              # 数据库
│   └── schema.sql         # 数据库表结构
├── services/
│   └── api/               # API 服务
│       ├── src/
│       │   ├── config/    # 配置
│       │   ├── database/  # 数据库连接
│       │   ├── middleware/# 中间件
│       │   └── routes/    # 路由
│       └── package.json
├── docs/
│   └── api.md             # API 文档
└── uploads/               # 上传文件目录
```

## 快速开始

### 安装

```bash
cd services/api
npm install
```

### 配置

```bash
cp .env.example .env
# 编辑 .env 配置 JWT_SECRET 等
```

### 初始化数据库

```bash
npm run init-db
```

### 启动

```bash
npm run dev
```

## 功能模块

- 用户管理（角色：老板、会计、员工）
- 记账管理
- 合同管理
- 订单管理
- 报销管理
- 票据管理
- 应收应付
- AI 辅助
- 数据分析

## API 文档

详见 [docs/api.md](docs/api.md)