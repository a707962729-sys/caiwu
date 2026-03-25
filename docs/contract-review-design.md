# 合同审核流程设计

## 1. 概述

合同审核模块为财务管家系统提供 AI 驱动的合同风险分析能力，在合同创建或导入时自动完成：身份风险判定、合同类型识别、风险评级、审核建议生成。

---

## 2. 数据库设计

### 2.1 扩展 contracts 表

原 `contracts` 表增加以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `party_a_partner_id` | UUID NULL | 甲方 Partner ID（关联 partners 表） |
| `party_b_partner_id` | UUID NULL | 乙方 Partner ID（关联 partners 表） |
| `review_id` | UUID NULL | 关联 contract_reviews.id |
| `contract_category` | ENUM NULL | 合同分类：purchase/service/labor/rental/loan/other |
| `is_ai_reviewed` | TINYINT DEFAULT 0 | 是否已完成 AI 审核 |

### 2.2 partners 表（新建，替代 customers_suppliers）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `name` | VARCHAR(200) | 合作方名称 |
| `partner_type` | ENUM | 身份类型：customer/supplier/both |
| `id_number` | VARCHAR(50) NULL | 营业执照/身份证号 |
| `risk_level` | ENUM DEFAULT 'low' | 预设风险等级：low/medium/high |
| `risk_reason` | TEXT NULL | 风险标注原因 |
| `credit_score` | INT NULL | 信用评分（0-100） |
| `contact` | VARCHAR(100) NULL | 联系人 |
| `phone` | VARCHAR(20) NULL | 电话 |
| `email` | VARCHAR(100) NULL | 邮箱 |
| `address` | VARCHAR(300) NULL | 地址 |
| `bank_name` | VARCHAR(100) NULL | 开户行 |
| `bank_account` | VARCHAR(50) NULL | 银行账号 |
| `tax_rate` | DECIMAL(5,2) NULL | 税率（%），默认 null |
| `receivable` | DECIMAL(14,2) DEFAULT 0 | 应收余额 |
| `payable` | DECIMAL(14,2) DEFAULT 0 | 应付余额 |
| `status` | TINYINT DEFAULT 1 | 状态：1正常 0禁用 |
| `created_at` | DATETIME | 创建时间 |
| `updated_at` | DATETIME | 更新时间 |

> **迁移说明**：`customers_suppliers` 表数据平滑迁移至 `partners`，`type` 字段映射为 `partner_type`。

### 2.3 contract_reviews 表（新建）

存储每次审核的结果记录：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `contract_id` | UUID | 关联合同 |
| `party_a_risk_level` | ENUM | 甲方风险：low/medium/high |
| `party_b_risk_level` | ENUM | 乙方风险：low/medium/high |
| `party_a_risk_factors` | JSON | 甲方风险因子详情 |
| `party_b_risk_factors` | JSON | 乙方风险因子详情 |
| `contract_type` | ENUM | 识别出的合同类型 |
| `contract_type_confidence` | DECIMAL(5,2) | 类型识别置信度（0-1） |
| `overall_risk_level` | ENUM | 综合风险：low/medium/high |
| `risk_score` | INT | 风险评分（0-100） |
| `risk_findings` | JSON | 风险发现列表 |
| `review_suggestions` | JSON | 审核建议列表 |
| `ai_model` | VARCHAR(50) | 调用的 AI 模型 |
| `ai_tokens_used` | INT NULL | AI 消耗 token 数 |
| `review_status` | ENUM DEFAULT 'pending' | 审核状态：pending/processing/completed/failed |
| `error_message` | TEXT NULL | 失败错误信息 |
| `reviewer_id` | UUID NULL | 人工复审人（人工介入时） |
| `reviewed_at` | DATETIME NULL | 人工复审时间 |
| `created_at` | DATETIME | 创建时间 |
| `updated_at` | DATETIME | 更新时间 |

### 2.4 contract_review_history 表（新建）

合同审核历史，支持多轮审核：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `review_id` | UUID | 关联 contract_reviews.id |
| `action` | ENUM | 操作：created/ai_completed/manual_reviewed/revised |
| `operator_id` | UUID | 操作人 |
| `changes` | JSON NULL | 变更内容 |
| `created_at` | DATETIME | 操作时间 |

### 2.5 risk_rules 表（新建）

可配置的风险规则表：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `rule_name` | VARCHAR(100) | 规则名称 |
| `rule_type` | ENUM | 规则类型：party_risk/contract_risk/amount_risk |
| `condition` | JSON | 匹配条件 |
| `risk_level` | ENUM | 命中后风险等级 |
| `suggestion_template` | TEXT | 建议模板 |
| `enabled` | TINYINT DEFAULT 1 | 是否启用 |
| `priority` | INT DEFAULT 0 | 优先级（越大越优先） |
| `created_at` | DATETIME | 创建时间 |

### 2.6 索引

```sql
CREATE INDEX idx_partners_risk ON partners(risk_level);
CREATE INDEX idx_partners_type ON partners(partner_type);
CREATE INDEX idx_contract_reviews_contract ON contract_reviews(contract_id);
CREATE INDEX idx_contract_reviews_status ON contract_reviews(review_status);
CREATE INDEX idx_risk_rules_type ON risk_rules(rule_type, enabled);
```

---

## 3. API 接口设计

### 3.1 触发审核

```
POST /api/contracts/:id/review
```

触发 AI 合同分析，返回审核结果。

**请求体（可选）：**
```json
{
  "contract_text": "合同全文文本，当不上传文件时直接分析文本"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "review_id": "uuid",
    "overall_risk_level": "medium",
    "risk_score": 58,
    "contract_type": "service",
    "contract_type_confidence": 0.91,
    "party_a_risk_level": "low",
    "party_b_risk_level": "medium",
    "risk_findings": [
      {
        "item": "付款周期过长",
        "detail": "付款周期90天，超出标准30天",
        "risk_level": "medium"
      }
    ],
    "review_suggestions": [
      {
        "priority": 1,
        "category": "payment",
        "suggestion": "建议将付款周期缩短至30天以内",
        "reason": "降低企业资金占用风险"
      }
    ],
    "ai_model": "claude-sonnet-4-20250514",
    "ai_tokens_used": 1820
  }
}
```

### 3.2 合同分析（上传文件/文本）

```
POST /api/contracts/:id/analyze
```

**请求：** `multipart/form-data`
- `file`: 合同文件（PDF/Word/图片，可选）
- `contract_text`: 合同文本（可选，二选一）

**响应：** 同 3.1

### 3.3 审核结果查询

```
GET /api/contracts/:id/review
```
返回指定合同的最新审核结果。

```
GET /api/contracts/:id/reviews
```
返回合同的所有审核历史（含多轮）。

### 3.4 人工复审

```
PUT /api/reviews/:reviewId/manual
```

**请求体：**
```json
{
  "overall_risk_level": "high",
  "risk_findings": [...],
  "review_suggestions": [...],
  "notes": "人工修改原因"
}
```

### 3.5 风险规则管理

```
GET    /api/risk-rules          # 列出规则
POST   /api/risk-rules          # 创建规则
PUT    /api/risk-rules/:id      # 更新规则
DELETE /api/risk-rules/:id      # 删除规则
```

### 3.6 Partner 风险管理

```
GET    /api/partners/:id/risk          # 查询 Partner 风险档案
PUT    /api/partners/:id/risk          # 更新 Partner 风险等级
```

### 3.7 批量审核

```
POST /api/contracts/batch-review
```

**请求体：**
```json
{
  "contract_ids": ["uuid1", "uuid2"]
}
```

---

## 4. 风险判断逻辑

### 4.1 合同类型识别

通过关键词 + AI 模型联合判断：

| 类型 | 关键词 | 说明 |
|------|--------|------|
| purchase | 采购、产品买卖、货物 | 采购合同 |
| service | 服务、咨询、设计、外包 | 服务合同 |
| labor | 劳动合同、聘用、工资 | 劳动合同 |
| rental | 租赁、房租、设备租赁 | 租赁合同 |
| loan | 借款、贷款、融资 | 借款合同 |
| other | 其他 | 默认类型 |

AI 置信度阈值：>=0.8 直接采纳，<0.8 进入人工确认。

### 4.2 身份风险判断

基于 Partner 档案与规则引擎联合判定：

**Partner 档案维度：**
- `risk_level`：预设风险（high 直接升整体风险）
- `credit_score`：信用评分 < 60 触发警告
- `status`：已禁用的 Partner 强制高风险
- 交易历史：应收/应付超过阈值触发风险标记

**规则引擎命中（risk_rules 表）：**
```
IF partner_id IN (高风险名单)        → risk_level = high
IF credit_score < 60                  → risk_level += 1 档
IF 是新合作方（创建 < 30天）         → risk_level += 1 档
IF 历史逾期记录 > 0                   → risk_level = high
IF 交易金额 > 100万 且 partner新     → risk_level = high
```

### 4.3 综合风险评级

风险评分 = Σ(各因子加权得分)，最终映射至 low/medium/high：

| 评分区间 | 风险等级 | 颜色标识 |
|---------|---------|---------|
| 0-30 | low | 绿色 |
| 31-60 | medium | 黄色 |
| 61-100 | high | 红色 |

**评分因子及权重：**

| 因子 | 权重 | 说明 |
|------|------|------|
| 甲方身份风险 | 20% | 基于 Partner 档案 |
| 乙方身份风险 | 20% | 基于 Partner 档案 |
| 合同金额风险 | 15% | 金额越大权重越高 |
| 合同期限风险 | 10% | 超1年或期限不明确 |
| 付款条件风险 | 20% | 预付款/赊账/尾款比例 |
| 违约金条款 | 10% | 违约金比例是否合理 |
| 合同类型风险 | 5% | 某些类型天然高风险 |

### 4.4 AI 审核流程

```
1. 文本提取（上传文件时）
   └── pdf-parse / mammoth 提取文本
2. 关键词预分类
   └── 根据关键词确定合同类型候选
3. AI 分析（Claude）
   ├── 系统提示：合同审核专家角色
   ├── 用户提示：合同文本 + 分析要求
   └── 输出结构化 JSON
4. 规则引擎校正
   └── AI 结果 + risk_rules 联合校正
5. 生成最终报告
   └── risk_findings + review_suggestions
```

**AI 提示词核心结构：**
```
你是一位资深法务顾问。请分析以下合同：

1. 识别合同类型（采购/服务/劳动/租赁/借款/其他）及置信度
2. 识别甲方乙方，并评估各方风险（历史信用、资质、履约能力）
3. 识别合同中的风险条款（付款、违约、终止、赔偿等）
4. 生成整改建议，按优先级排序

输出 JSON 格式：{ contract_type, confidence, parties_risk, risk_findings[], suggestions[] }
```

---

## 5. 与现有表关联方案

### 5.1 contracts ↔ partners

```
contracts.party_a_partner_id → partners.id
contracts.party_b_partner_id → partners.id
```

- 新增合同可选择关联 Partner（不强制）
- 已有合同可补录 Partner 关联（历史数据兼容）
- 未关联 Partner 时，通过 party_a/party_b 文本字段处理

### 5.2 contracts ↔ contract_reviews

```
contracts.review_id → contract_reviews.id (最新审核结果)
contracts.id         → contract_reviews.contract_id
```

- 一个合同可有多轮审核，contracts.review_id 指向最新
- 历史审核记录保留在 contract_reviews + contract_review_history

### 5.3 partners ↔ transactions（扩展建议）

```
transactions.partner_id → partners.id (新增字段)
```

> **注意**：`transactions` 表目前无 `partner_id` 外键，需扩展该字段以关联收支记录至合作方，用于信用评估数据积累。

### 5.4 整体 ER 关系

```
partners ←(party_a/b_partner_id)→ contracts ←(contract_id)→ contract_reviews
                                                          ↓
                                                  contract_review_history
                                                          ↓
                                                    risk_rules (参考)
```

---

## 6. 实现优先级

**Phase 1（MVP）：**
- partners 表扩展 / 新建
- contract_reviews 表
- 基础审核 API（文本分析）
- 固定规则引擎（风险评分）

**Phase 2（完善）：**
- risk_rules 表 + 规则配置
- AI 多轮对话审核
- 批量审核
- 人工复审流程

**Phase 3（高级）：**
- 向量检索（历史合同相似案例推荐）
- 自动预警（合同到期/付款节点）
- 数据看板（合同风险仪表盘）
