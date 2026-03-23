# 前端 API 配置说明

## 概述

已完成桌面端和移动端的 API 配置，确保前端可以正确调用后端 API。

## 后端 API

- **地址**: `http://localhost:3000/api`
- **认证**: JWT Bearer Token
- **响应格式**: `{ success: true, data: {...} }`

## 桌面端配置 (apps/desktop/)

### 文件结构
```
src/
├── api/
│   └── index.ts          # API 方法定义
├── config/
│   └── api.ts            # API 配置和端点
├── types/
│   └── index.ts          # TypeScript 类型定义
├── utils/
│   └── request.ts        # Axios 请求封装
└── stores/
    └── authStore.ts      # 认证状态管理 (已更新)
```

### 环境变量
- `.env`: 开发环境 - `VITE_API_BASE_URL=http://localhost:3000/api`
- `.env.production`: 生产环境

### 使用示例
```typescript
import { authApi, transactionApi } from '@/api'

// 登录
const result = await authApi.login({ username: 'admin', password: '123456' })
console.log(result.user, result.token)

// 获取交易列表
const transactions = await transactionApi.getList({ page: 1, pageSize: 20 })
```

## 移动端配置 (apps/mobile/)

### 文件结构
```
src/
├── api/
│   └── index.ts          # API 方法定义
├── config/
│   └── api.ts            # API 配置和端点
├── types/
│   └── index.ts          # TypeScript 类型定义
└── utils/
    └── request.ts        # Axios 请求封装
```

### Vite Proxy 配置
移动端通过 Vite proxy 将 `/api` 代理到 `http://localhost:3000`：
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true
    }
  }
}
```

## API 模块

### 认证 API (authApi)
- `login(params)` - 登录
- `logout()` - 登出
- `getMe()` - 获取当前用户
- `updatePassword(data)` - 修改密码
- `refreshToken()` - 刷新 Token

### 用户 API (userApi)
- `getList(params)` - 获取用户列表
- `getDetail(id)` - 获取用户详情
- `create(data)` - 创建用户
- `update(id, data)` - 更新用户
- `delete(id)` - 删除用户

### 交易 API (transactionApi)
- `getList(params)` - 获取交易列表
- `getStats(params)` - 获取交易统计
- `getDetail(id)` - 获取交易详情
- `create(data)` - 创建交易
- `update(id, data)` - 更新交易
- `delete(id)` - 删除交易

### 合同 API (contractApi)
- `getList(params)` - 获取合同列表
- `getDetail(id)` - 获取合同详情
- `create(data)` - 创建合同
- `update(id, data)` - 更新合同
- `delete(id)` - 删除合同

### 订单 API (orderApi)
- `getList(params)` - 获取订单列表
- `getDetail(id)` - 获取订单详情
- `create(data)` - 创建订单
- `update(id, data)` - 更新订单
- `delete(id)` - 删除订单

### 报销 API (reimbursementApi)
- `getList(params)` - 获取报销列表
- `getDetail(id)` - 获取报销详情
- `create(data)` - 创建报销
- `update(id, data)` - 更新报销
- `delete(id)` - 删除报销
- `submit(id)` - 提交报销
- `approve(id, data)` - 审批报销
- `pay(id)` - 支付报销

### 票据 API (invoiceApi)
- `getList(params)` - 获取票据列表
- `getStats()` - 获取票据统计
- `getDetail(id)` - 获取票据详情
- `create(data)` - 创建票据
- `update(id, data)` - 更新票据
- `delete(id)` - 删除票据
- `verify(id)` - 验证票据

### 客户/供应商 API (partnerApi)
- `getList(params)` - 获取列表
- `getDetail(id)` - 获取详情
- `create(data)` - 创建
- `update(id, data)` - 更新
- `delete(id)` - 删除

### 应收应付 API (receivablePayableApi)
- `getList(params)` - 获取列表
- `getReceivables(params)` - 获取应收
- `getPayables(params)` - 获取应付
- `getDetail(id)` - 获取详情
- `create(data)` - 创建
- `update(id, data)` - 更新
- `delete(id)` - 删除

### 仪表盘 API (dashboardApi)
- `getOverview(params)` - 获取概览
- `getCashflow(params)` - 获取现金流
- `getCategory()` - 获取分类统计
- `getReceivables()` - 获取应收统计
- `getPayables()` - 获取应付统计
- `getTax(params)` - 获取税务统计

### 文件上传 API (uploadApi)
- `uploadImage(file, onProgress)` - 上传图片
- `uploadFile(file, onProgress)` - 上传文件

### AI 服务 API (aiApi)
- `recognizeInvoice(image)` - OCR 票据识别
- `analyze(data)` - AI 分析
- `recommend(data)` - AI 推荐
- `feedback(data)` - AI 反馈

## 请求/响应拦截器

### 请求拦截器
- 自动添加 `Authorization: Bearer <token>` 头

### 响应拦截器
- 自动提取 `data.data` 返回实际数据
- 处理业务错误 (success: false)
- 处理 HTTP 错误 (401, 403, 404, 500)
- 显示错误提示消息

## 启动服务

```bash
# 启动后端 API
cd services/api
npm run dev

# 启动桌面端
cd apps/desktop
npm run dev

# 启动移动端
cd apps/mobile
npm run dev
```

## 注意事项

1. 后端 API 返回格式统一为 `{ success: true, data: {...} }`，前端已自动处理
2. 401 错误会自动清除登录状态并跳转登录页
3. 所有请求会自动添加认证 Token
4. 移动端开发环境使用 Vite proxy，生产环境需要配置实际 API 地址