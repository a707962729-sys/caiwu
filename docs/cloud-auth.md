# 云端认证服务设计

## 一、系统架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              用户层                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   员工端     │    │   老板端     │    │   会计端     │              │
│  │  (Mobile)    │    │  (Desktop)   │    │  (Desktop)   │              │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘              │
└─────────┼───────────────────┼───────────────────┼───────────────────────┘
          │                   │                   │
          │ HTTPS             │ HTTPS             │ HTTPS
          ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           云端服务层                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      API Gateway (Nginx)                          │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 │                                       │
│  ┌──────────────────────────────┼───────────────────────────────────┐  │
│  │                     认证服务 (Auth Service)                        │  │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐     │  │
│  │  │ 登录认证  │  │ Token管理 │  │ 权限验证  │  │ 数据同步  │     │  │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘     │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 │                                       │
│  ┌──────────────────────────────┼───────────────────────────────────┐  │
│  │                      消息队列 (Redis/RabbitMQ)                    │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │
                                  │ WebSocket / Long Polling
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           客户本地服务                                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    OpenClaw Gateway (Docker)                      │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 │                                       │
│  ┌──────────────────────────────┼───────────────────────────────────┐  │
│  │                      财务管家 API 服务                             │  │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐     │  │
│  │  │ 记账管理  │  │ 报销管理  │  │ 合同管理  │  │ 数据库    │     │  │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## 二、认证流程

### 2.1 员工登录流程

```
员工端                    云端服务                   本地服务
   │                         │                         │
   │  1. 输入账号密码        │                         │
   │────────────────────────►│                         │
   │                         │                         │
   │                         │  2. 查询用户所属公司    │
   │                         │────────────────────────►│
   │                         │                         │
   │                         │  3. 返回公司信息        │
   │                         │◄────────────────────────│
   │                         │                         │
   │                         │  4. 验证密码            │
   │                         │────────────────────────►│
   │                         │                         │
   │                         │  5. 返回验证结果        │
   │                         │◄────────────────────────│
   │                         │                         │
   │  6. 返回 Token          │                         │
   │◄────────────────────────│                         │
   │                         │                         │
   │  7. API 请求 (带 Token) │                         │
   │─────────────────────────────────────────────────►│
   │                         │                         │
   │  8. 返回数据            │                         │
   │◄────────────────────────────────────────────────│
   │                         │                         │
```

### 2.2 Token 结构

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": 1,
    "username": "employee001",
    "role": "employee",
    "companyId": 1,
    "companyCode": "COMP001",
    "permissions": ["reimbursement:create", "reimbursement:read"],
    "iat": 1710000000,
    "exp": 1710086400
  },
  "signature": "..."
}
```

## 三、API 设计

### 3.1 云端认证 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/cloud/register` | POST | 公司注册 |
| `/api/cloud/login` | POST | 云端登录 |
| `/api/cloud/users` | GET | 获取用户列表 |
| `/api/cloud/users` | POST | 创建员工账号 |
| `/api/cloud/users/:id` | PUT | 更新用户信息 |
| `/api/cloud/users/:id` | DELETE | 删除用户 |
| `/api/cloud/sync/status` | GET | 获取同步状态 |
| `/api/cloud/sync/push` | POST | 推送数据到云端 |
| `/api/cloud/sync/pull` | GET | 拉取云端数据 |

### 3.2 登录请求/响应

**请求：**
```json
{
  "companyCode": "COMP001",
  "username": "employee001",
  "password": "encrypted_password",
  "deviceId": "device-uuid",
  "deviceName": "iPhone 15 Pro"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "refresh_token_here",
    "expiresIn": 86400,
    "user": {
      "id": 1,
      "username": "employee001",
      "realName": "张三",
      "role": "employee",
      "department": "销售部",
      "position": "销售专员"
    },
    "company": {
      "id": 1,
      "name": "测试公司",
      "logo": "https://...",
      "localServerUrl": "https://local.company.com"
    }
  }
}
```

## 四、数据同步方案

### 4.1 同步策略

| 数据类型 | 同步方向 | 同步频率 | 冲突处理 |
|---------|---------|---------|---------|
| 用户信息 | 双向 | 实时 | 以最新为准 |
| 记账数据 | 本地→云端 | 5分钟 | 本地优先 |
| 报销数据 | 双向 | 实时 | 云端优先 |
| 合同数据 | 本地→云端 | 10分钟 | 本地优先 |
| 审批状态 | 云端→本地 | 实时 | 云端优先 |

### 4.2 同步数据格式

```json
{
  "syncId": "sync-uuid",
  "companyId": 1,
  "timestamp": 1710000000000,
  "dataType": "transactions",
  "action": "create|update|delete",
  "records": [
    {
      "id": 1,
      "operation": "create",
      "data": { ... },
      "checksum": "md5-hash"
    }
  ]
}
```

## 五、安全机制

### 5.1 通信安全

- **HTTPS**: 所有通信使用 TLS 1.3
- **证书校验**: 双向证书验证
- **请求签名**: HMAC-SHA256 签名

### 5.2 Token 安全

- **有效期**: Access Token 24小时，Refresh Token 7天
- **存储**: 不存储原始密码，只存储 Token
- **刷新**: Token 过期前 30 分钟自动刷新

### 5.3 防护措施

- **防重放**: 时间戳 + Nonce 验证
- **限流**: IP/用户级别请求限制
- **审计**: 所有操作记录审计日志

## 六、容灾方案

### 6.1 离线模式

当云端服务不可用时：
1. 本地服务正常运行
2. 数据存储在本地数据库
3. 待云端恢复后自动同步

### 6.2 数据备份

- 每日自动备份到云存储
- 保留 30 天备份记录
- 支持一键恢复

## 七、部署方案

### 7.1 云端部署

```yaml
# docker-compose.yml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs

  auth-service:
    build: ./auth-service
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:alpine
    volumes:
      - redis-data:/data

  postgres:
    image: postgres:15
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  redis-data:
  postgres-data:
```

### 7.2 本地部署

```yaml
# 本地 docker-compose.yml
version: '3.8'
services:
  openclaw-gateway:
    image: openclaw/gateway:latest
    ports:
      - "18789:18789"
    volumes:
      - ./config:/app/config
      - ./agents:/app/agents
      - ./memory:/app/memory

  caiwu-api:
    build: ./services/api
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    environment:
      - JWT_SECRET=${JWT_SECRET}
```

## 八、监控告警

### 8.1 监控指标

| 指标 | 阈值 | 告警方式 |
|------|------|---------|
| 服务可用性 | < 99.9% | 短信 + 邮件 |
| 响应时间 | > 500ms | 邮件 |
| 错误率 | > 1% | 邮件 |
| CPU 使用率 | > 80% | 邮件 |
| 内存使用率 | > 85% | 邮件 |

### 8.2 日志收集

- 结构化日志 (JSON)
- 日志级别: ERROR, WARN, INFO, DEBUG
- 集中存储: ELK / Loki