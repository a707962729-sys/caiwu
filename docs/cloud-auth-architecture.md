# 云端认证架构设计

## 1. 架构概述

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   移动端 (H5)    │────▶│   云服务器 (中转) │────▶│  本地服务 (API)  │
│  Employee App   │     │  Cloud Gateway  │     │  Local Server   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
      员工使用               认证中转               后台管理/数据存储
```

## 2. 组件说明

### 2.1 移动端 (Employee App)
- **技术**: Vue 3 + Vite H5
- **用户**: 员工
- **功能**: 
  - 登录认证
  - 提交报销
  - 查看工资
  - 查询进度

### 2.2 云服务器 (Cloud Gateway)
- **技术**: Node.js + Express 或 OpenClaw Gateway
- **部署**: 阿里云/腾讯云
- **功能**:
  - 接收移动端请求
  - Token 验证和分发
  - 请求转发到本地服务
  - 会话管理

### 2.3 本地服务 (Local Server)
- **技术**: Node.js + SQLite
- **部署**: 公司内网服务器
- **功能**:
  - 后台管理界面
  - 管理员创建账号
  - 数据存储和处理
  - 业务逻辑

## 3. 认证流程

### 3.1 登录流程

```
1. 员工输入账号密码 → 移动端
2. 移动端发送登录请求 → 云服务器
3. 云服务器转发请求 → 本地服务
4. 本地服务验证账号密码 → 返回用户信息
5. 云服务器生成 Token → 返回移动端
6. 移动端保存 Token → 后续请求携带 Token
```

### 3.2 Token 设计

```json
{
  "userId": "用户ID",
  "role": "employee",
  "companyId": "公司ID",
  "iat": "签发时间",
  "exp": "过期时间",
  "jti": "Token唯一标识"
}
```

## 4. API 设计

### 4.1 云端认证 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 员工登录 |
| `/api/auth/logout` | POST | 员工登出 |
| `/api/auth/refresh` | POST | 刷新Token |
| `/api/auth/verify` | GET | 验证Token |

### 4.2 本地服务 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/users` | GET | 获取用户列表 |
| `/api/admin/users` | POST | 创建用户账号 |
| `/api/admin/users/:id` | PUT | 更新用户信息 |
| `/api/admin/users/:id` | DELETE | 删除用户 |

## 5. 通信安全

### 5.1 传输加密
- HTTPS (TLS 1.3)
- 证书: Let's Encrypt

### 5.2 请求签名
```
signature = HMAC-SHA256(
  timestamp + method + path + body,
  secretKey
)
```

### 5.3 Token 验证
- JWT 签名验证
- 过期时间检查
- 黑名单机制

## 6. 数据同步

### 6.1 用户数据
- 本地服务是主数据源
- 云服务器缓存用户信息
- 定期同步更新

### 6.2 会话管理
- 云服务器维护活跃会话
- 本地服务同步在线状态
- 支持强制下线

## 7. 部署架构

### 7.1 云服务器
```
- 域名: api.yourcompany.com
- 端口: 443 (HTTPS)
- 服务: OpenClaw Gateway / Node.js
- 存储: Redis (会话缓存)
```

### 7.2 本地服务
```
- 地址: http://192.168.x.x:3000
- 端口: 3000
- 服务: Express API
- 存储: SQLite / MySQL
```

## 8. 实施步骤

### Phase 1: 基础设施
1. [ ] 购买云服务器
2. [ ] 配置域名和SSL证书
3. [ ] 部署 OpenClaw Gateway

### Phase 2: 认证服务
1. [ ] 实现云端认证API
2. [ ] 配置本地服务通信
3. [ ] 实现Token管理

### Phase 3: 移动端对接
1. [ ] 修改登录逻辑
2. [ ] 集成云端API
3. [ ] 测试验证

### Phase 4: 后台管理
1. [ ] 创建用户管理界面
2. [ ] 实现账号创建功能
3. [ ] 权限配置

## 9. 安全检查清单

- [ ] 所有API使用HTTPS
- [ ] 密码使用bcrypt加密存储
- [ ] Token设置合理过期时间
- [ ] 实现请求频率限制
- [ ] 记录所有登录日志
- [ ] 支持多设备登录控制
- [ ] 实现账号锁定机制
- [ ] 定期安全审计