# 企业管理平台开发计划

## 一、核心理念

### 1.1 Agent 深度介入
- 每个业务节点 Agent 可介入分析
- 数据驱动的智能推荐
- 流程化填表自动完成
- 打款等敏感操作人工审核
- 每日分析报告和建议

### 1.2 开发策略
- 10 个子代理并行开发
- 精简任务描述，快速迭代
- 主代理监督进度，协调资源

---

## 二、子代理分配

| # | 子代理 | 负责模块 | 核心任务 |
|---|--------|---------|---------|
| 1 | architect | 基础架构 | 数据字典 + 编码规则 + 组织架构 |
| 2 | backend-1 | 系统管理 | 权限系统 + 消息通知 |
| 3 | backend-2 | CRM | 客户档案 + 联系人 + 商机 |
| 4 | backend-3 | 销售流程 | 报价单 + 订单 + 发货 + 收款 |
| 5 | backend-4 | 采购流程 | 供应商 + 采购单 + 入库 + 付款 |
| 6 | backend-5 | 库存管理 | 仓库 + 商品 + 出入库 + 盘点 |
| 7 | backend-6 | 财务总账 | 科目 + 凭证 + 报表 |
| 8 | backend-7 | 流程引擎 | 表单 + 审批 + 工作流 |
| 9 | frontend | 桌面端 | Vue3 管理后台 |
| 10 | agent-engineer | AI 介入 | 智能分析 + 自动填表 + 每日报告 |

---

## 三、数据库设计

### 3.1 基础架构表
```sql
-- 组织架构
organizations (id, name, parent_id, type)
departments (id, org_id, name, parent_id)
positions (id, dept_id, name, level)

-- 数据字典
dict_categories (id, name, code)
dict_items (id, category_id, label, value, sort)

-- 编码规则
code_rules (id, name, prefix, date_format, seq_length, current_seq)
```

### 3.2 CRM 表
```sql
customers (id, name, type, level, source, owner_id)
contacts (id, customer_id, name, phone, position)
opportunities (id, customer_id, name, stage, amount, probability)
follow_records (id, customer_id, content, next_date)
```

### 3.3 销售流程表
```sql
quotations (id, customer_id, amount, status)
quotation_items (id, quotation_id, product_id, qty, price)
delivery_orders (id, order_id, status, logistics)
```

### 3.4 采购流程表
```sql
suppliers (id, name, level, status)
purchase_requests (id, requester_id, status)
purchase_orders (id, supplier_id, status)
goods_receipts (id, po_id, warehouse_id)
```

### 3.5 库存表
```sql
warehouses (id, name, type)
products (id, sku, name, category, unit)
inventory (id, warehouse_id, product_id, qty)
stock_movements (id, type, warehouse_id, product_id, qty)
```

### 3.6 财务表
```sql
accounting_subjects (id, code, name, type, parent_id)
vouchers (id, number, date, maker_id, status)
voucher_entries (id, voucher_id, subject_id, debit, credit)
```

### 3.7 流程引擎表
```sql
workflow_definitions (id, name, type, config)
workflow_instances (id, definition_id, data, status)
workflow_tasks (id, instance_id, assignee_id, status)
```

### 3.8 AI 介入表
```sql
ai_recommendations (id, user_id, type, content, score)
ai_daily_reports (id, user_id, date, content)
ai_actions (id, type, target, result, approved_by)
```

---

## 四、API 端点规划

| 模块 | 端点数 | 核心接口 |
|------|--------|---------|
| 基础架构 | 15 | /api/orgs, /api/depts, /api/dict |
| 权限系统 | 10 | /api/roles, /api/permissions |
| 消息通知 | 8 | /api/messages, /api/notifications |
| CRM | 20 | /api/customers, /api/contacts, /api/opportunities |
| 销售流程 | 25 | /api/quotations, /api/orders, /api/deliveries |
| 采购流程 | 20 | /api/suppliers, /api/purchase-orders |
| 库存 | 15 | /api/warehouses, /api/products, /api/inventory |
| 财务 | 20 | /api/subjects, /api/vouchers, /api/reports |
| 流程引擎 | 12 | /api/workflows, /api/tasks |
| AI 介入 | 10 | /api/ai/recommend, /api/ai/daily-report |

---

## 五、前端页面规划

| 模块 | 页面数 |
|------|--------|
| 系统管理 | 15 |
| CRM | 10 |
| 销售管理 | 12 |
| 采购管理 | 10 |
| 库存管理 | 8 |
| 财务管理 | 12 |
| 流程审批 | 5 |
| 数据分析 | 8 |
| **总计** | **80+** |

---

## 六、Agent 介入设计

### 6.1 介入节点

| 节点 | Agent 能力 | 人工审核 |
|------|-----------|---------|
| 客户录入 | 自动识别名片、填充信息 | 否 |
| 报价单 | 推荐价格、利润分析 | 否 |
| 订单创建 | 风险评估、信用检查 | 否 |
| 发货审批 | 库存检查、物流推荐 | 否 |
| 收款确认 | 自动对账 | 金额>10万需审核 |
| 付款审批 | 发票核验、预算检查 | **必须审核** |
| 凭证生成 | 自动生成 | 否 |
| 每日报告 | 自动生成分析和建议 | 否 |

### 6.2 智能功能

```
每日 9:00 自动生成：
1. 昨日经营数据汇总
2. 待处理事项提醒
3. 异常数据预警
4. 业务机会推荐
5. 行动建议
```

---

## 七、开发里程碑

| 阶段 | 时间 | 目标 |
|------|------|------|
| Phase 1 | Week 1-2 | 基础架构 + CRM |
| Phase 2 | Week 3-4 | 销售 + 采购流程 |
| Phase 3 | Week 5-6 | 库存 + 财务 |
| Phase 4 | Week 7-8 | 流程引擎 + AI |
| Phase 5 | Week 9-10 | 前端完善 + 测试 |

---

## 八、监督机制

### 8.1 主代理职责
- 每日检查子代理进度
- 协调资源冲突
- 验收关键成果
- 汇报 CEO

### 8.2 进度检查点
- 每完成一个模块，子代理自动汇报
- 主代理验证后更新进度表
- 超时任务主代理接手

---

## 九、风险评估

| 风险 | 应对措施 |
|------|---------|
| 子代理超时 | 精简任务，主代理接手 |
| 需求变更 | 优先完成核心功能 |
| 技术债务 | 预留重构时间 |
| 集成问题 | 定义清晰接口规范 |