# 财务管家 API 文档

## 概述

财务管家 API 是一个 RESTful 风格的企业财务管理接口服务，提供用户管理、记账、合同、订单、报销、票据等核心功能。

- **Base URL**: `http://localhost:3000/api`
- **数据格式**: JSON
- **认证方式**: JWT Bearer Token

## 认证

### 认证方式

所有 API 请求（除了登录和注册）都需要在 Header 中携带 JWT Token：

```
Authorization: Bearer <your_token>
```

### 登录获取 Token

```
POST /api/auth/login
```

**请求体：**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "real_name": "管理员",
      "role": "boss",
      "email": "admin@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 错误响应

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "错误描述",
  "details": [...]
}
```

## 分页

列表接口支持分页参数：

- `page`: 页码，默认 1
- `pageSize`: 每页数量，默认 20，最大 100
- `sortBy`: 排序字段
- `sortOrder`: 排序方向 (asc/desc)

**分页响应格式：**
```json
{
  "success": true,
  "data": {
    "list": [...],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

---

## 认证接口 `/api/auth`

### POST /login
用户登录

**请求参数：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |

### POST /logout
用户登出

### GET /me
获取当前用户信息

### PUT /password
修改密码

**请求参数：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| oldPassword | string | 是 | 原密码 |
| newPassword | string | 是 | 新密码（至少6位）|

### POST /refresh
刷新 Token

### POST /register
用户注册（初始化或管理员调用）

---

## 用户管理 `/api/users`

> 需要 boss 或 accountant 角色

### GET /api/users
获取用户列表

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页数量 |
| search | string | 搜索关键词 |
| role | string | 角色筛选 |
| status | string | 状态筛选 |

### GET /api/users/:id
获取用户详情

### POST /api/users
创建用户（仅 boss）

**请求体：**
```json
{
  "username": "user001",
  "password": "password123",
  "real_name": "张三",
  "email": "zhangsan@example.com",
  "phone": "13800138000",
  "role": "employee",
  "department": "销售部",
  "position": "销售经理"
}
```

### PUT /api/users/:id
更新用户信息

### DELETE /api/users/:id
删除（停用）用户（仅 boss）

### POST /api/users/:id/reset-password
重置用户密码（仅 boss）

---

## 记账管理 `/api/transactions`

### GET /api/transactions
获取记账记录列表

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页数量 |
| search | string | 搜索关键词 |
| transactionType | string | 类型（income/expense/transfer）|
| category | string | 分类 |
| status | string | 状态 |
| startDate | string | 开始日期 |
| endDate | string | 结束日期 |
| partnerId | number | 客户/供应商ID |
| contractId | number | 合同ID |
| orderId | number | 订单ID |

### GET /api/transactions/stats
获取记账统计

### GET /api/transactions/:id
获取记账记录详情

### POST /api/transactions
创建记账记录

**请求体：**
```json
{
  "transaction_no": "TXN20260316001",
  "transaction_date": "2026-03-16",
  "transaction_type": "expense",
  "category": "办公费用",
  "sub_category": "办公用品",
  "amount": 1000.00,
  "currency": "CNY",
  "account_from": "银行账户",
  "partner_id": 1,
  "description": "购买办公用品",
  "voucher_no": "VCH001"
}
```

### PUT /api/transactions/:id
更新记账记录

### POST /api/transactions/:id/confirm
确认记账记录（会计/老板）

### POST /api/transactions/:id/reverse
冲销记账记录（会计/老板）

### DELETE /api/transactions/:id
删除记账记录

---

## 合同管理 `/api/contracts`

### GET /api/contracts
获取合同列表

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页数量 |
| search | string | 搜索关键词 |
| status | string | 状态 |
| partnerId | number | 客户/供应商ID |
| startDate | string | 开始日期 |
| endDate | string | 结束日期 |

### GET /api/contracts/:id
获取合同详情

### POST /api/contracts
创建合同

**请求体：**
```json
{
  "contract_no": "CT2026030001",
  "name": "销售合同",
  "partner_id": 1,
  "contract_type": "销售",
  "amount": 100000.00,
  "currency": "CNY",
  "start_date": "2026-03-01",
  "end_date": "2026-12-31",
  "sign_date": "2026-03-15",
  "responsible_user_id": 2,
  "payment_terms": "货到付款",
  "notes": "重要客户"
}
```

### PUT /api/contracts/:id
更新合同

### DELETE /api/contracts/:id
删除合同

---

## 订单管理 `/api/orders`

### GET /api/orders
获取订单列表

### GET /api/orders/:id
获取订单详情

### POST /api/orders
创建订单

**请求体：**
```json
{
  "order_no": "ORD20260316001",
  "name": "产品采购订单",
  "contract_id": 1,
  "order_type": "采购",
  "partner_id": 1,
  "amount": 50000.00,
  "tax_amount": 6500.00,
  "currency": "CNY",
  "start_date": "2026-03-16",
  "end_date": "2026-03-30",
  "responsible_user_id": 2,
  "description": "办公用品采购"
}
```

### PUT /api/orders/:id
更新订单

### DELETE /api/orders/:id
删除订单

---

## 报销管理 `/api/reimbursements`

### GET /api/reimbursements
获取报销列表

> 员工只能查看自己的报销单

### GET /api/reimbursements/:id
获取报销详情

### POST /api/reimbursements
创建报销单

**请求体：**
```json
{
  "reimbursement_no": "RMB20260316001",
  "title": "出差报销",
  "reimbursement_type": "差旅",
  "amount": 3500.00,
  "currency": "CNY",
  "application_date": "2026-03-16",
  "expense_date": "2026-03-10",
  "description": "北京出差费用",
  "items": [
    {
      "item_date": "2026-03-10",
      "category": "交通费",
      "description": "机票",
      "amount": 1500.00
    },
    {
      "item_date": "2026-03-10",
      "category": "住宿费",
      "description": "酒店",
      "amount": 800.00
    }
  ]
}
```

### PUT /api/reimbursements/:id
更新报销单

### POST /api/reimbursements/:id/submit
提交审批

### POST /api/reimbursements/:id/approve
审批报销单（会计/老板）

**请求体：**
```json
{
  "action": "approve",  // 或 "reject"
  "reject_reason": "不符合报销标准"  // 拒绝时必填
}
```

### POST /api/reimbursements/:id/pay
支付报销单（会计/老板）

### DELETE /api/reimbursements/:id
删除报销单

---

## 票据管理 `/api/invoices`

### GET /api/invoices
获取票据列表

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| direction | string | 方向（in: 进项, out: 销项）|
| status | string | 状态 |

### GET /api/invoices/stats
获取票据统计

### GET /api/invoices/:id
获取票据详情

### POST /api/invoices
创建票据

**请求体：**
```json
{
  "invoice_type": "增值税专用发票",
  "invoice_no": "12345678",
  "invoice_code": "1100",
  "direction": "in",
  "partner_id": 1,
  "issue_date": "2026-03-15",
  "amount_before_tax": 10000.00,
  "tax_rate": 13,
  "tax_amount": 1300.00,
  "total_amount": 11300.00,
  "currency": "CNY"
}
```

### PUT /api/invoices/:id
更新票据

### POST /api/invoices/:id/verify
认证进项发票（会计）

### DELETE /api/invoices/:id
删除票据

---

## 客户/供应商 `/api/partners`

### GET /api/partners
获取列表

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| type | string | 类型（customer/supplier/both）|
| status | string | 状态 |

### GET /api/partners/:id
获取详情（含统计信息）

### POST /api/partners
创建客户/供应商

**请求体：**
```json
{
  "name": "示例公司",
  "type": "customer",
  "contact_person": "张经理",
  "phone": "13800138000",
  "email": "zhang@example.com",
  "address": "北京市朝阳区",
  "tax_id": "91110000MA00XXXXX",
  "credit_limit": 100000.00,
  "credit_period": 30
}
```

### PUT /api/partners/:id
更新

### DELETE /api/partners/:id
删除

---

## AI 服务 `/api/ai`

### POST /api/ai/recognize
AI 识别

**请求体：**
```json
{
  "type": "invoice",  // invoice/receipt/contract/general
  "image": "base64_encoded_image",
  "data": { ... }
}
```

### POST /api/ai/analyze
AI 分析

**请求体：**
```json
{
  "module": "finance",  // finance/receivables
  "period": "month",
  "metrics": ["income", "expense", "cashflow"]
}
```

### POST /api/ai/recommend
AI 建议

**请求体：**
```json
{
  "type": "category",  // category/approval/tax
  "context": { "keyword": "办公用品" }
}
```

### POST /api/ai/feedback
提交反馈

**请求体：**
```json
{
  "sessionId": "uuid",
  "score": 5,
  "feedback": "识别准确"
}
```

---

## 仪表盘 `/api/dashboard`

### GET /api/dashboard/overview
获取概览数据

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| startDate | string | 开始日期 |
| endDate | string | 结束日期 |

**响应数据：**
- 收支统计
- 应收应付
- 待办事项

### GET /api/dashboard/cashflow
现金流数据

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| months | number | 月数（默认6）|

### GET /api/dashboard/category
收支分类统计

### GET /api/dashboard/receivables
应收账款账龄分析

### GET /api/dashboard/payables
应付账款账龄分析

### GET /api/dashboard/tax
税务概览

---

## 错误码

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| BAD_REQUEST | 400 | 请求参数错误 |
| VALIDATION_ERROR | 400 | 数据验证失败 |
| UNAUTHORIZED | 401 | 未授权 |
| INVALID_TOKEN | 401 | 无效令牌 |
| TOKEN_EXPIRED | 401 | 令牌过期 |
| FORBIDDEN | 403 | 权限不足 |
| NOT_FOUND | 404 | 资源不存在 |
| CONFLICT | 409 | 资源冲突 |
| DUPLICATE_ENTRY | 409 | 数据已存在 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |
| SERVICE_UNAVAILABLE | 503 | 服务不可用 |

---

## 角色权限

### Boss（老板）
- 所有模块完全权限
- 用户管理
- 系统配置

### Accountant（会计）
- 记账：完全权限
- 合同：读写
- 订单：读写
- 票据：完全权限
- 报销：审批、支付
- 应收应付：完全权限
- 报表：完全权限
- 客户/供应商：完全权限

### Employee（员工）
- 记账：只读
- 合同：只读
- 订单：只读
- 报销：创建、查看、修改自己的
- 票据：只读
- 个人信息：修改自己的

---

## 数据库表结构

详见 `database/schema.sql`

主要表：
- `users` - 用户表
- `companies` - 公司表
- `partners` - 客户/供应商表
- `contracts` - 合同表
- `orders` - 订单表
- `transactions` - 记账表
- `reimbursements` - 报销表
- `invoices` - 票据表
- `receivables_payables` - 应收应付表
- `permissions` - 权限表
- `ai_logs` - AI操作日志表
- `accounts` - 账户表
- `settings` - 系统配置表
- `audit_logs` - 审计日志表

---

## 快速开始

### 1. 安装依赖

```bash
cd services/api
npm install
```

### 2. 配置环境

```bash
cp .env.example .env
# 编辑 .env 文件配置
```

### 3. 初始化数据库

```bash
npm run init-db
```

### 4. 启动服务

```bash
npm run dev  # 开发模式
npm start    # 生产模式
```

### 5. 测试 API

```bash
# 健康检查
curl http://localhost:3000/health

# API 信息
curl http://localhost:3000/api
```

---

## 版本历史

- **v1.0.0** (2026-03-16)
  - 初始版本
  - 完整的 RESTful API
  - JWT 认证
  - 基础 CRUD 操作
  - AI 服务集成框架