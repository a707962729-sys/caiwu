# 发票管理功能 QA 测试报告

**项目：** 财务管家 (caiwu)
**测试日期：** 2026-03-24
**测试人：** QA Agent
**项目路径：** ~/Desktop/caiwu/

---

## 一、测试范围

本次测试覆盖发票管理功能的全栈实现：
- **前端：** `apps/admin` (Vue3 + Element Plus 管理后台) + `apps/mobile` (Vant 移动端)
- **后端 API：** `services/api/src/routes/invoices.js` + `services/api/src/routes/invoice-entry.js`
- **业务逻辑：** `services/api/src/services/invoice-processor.js`
- **数据库：** `services/database/schema.sql` — `invoices` 表

---

## 二、业务流程梳理

### 2.1 发票录入

**手动录入（管理后台）：**
新增票据弹窗 → 填写票据号/类型/金额/日期/开票单位/付款单位/状态/备注 → 提交 → 后端 INSERT → 返回成功

**拍照上传（移动端）：**
上传图片/拍照 → AI OCR 识别 (ai-gateway) → 返回结构化发票数据 → 用户确认 → 自动入账或待审核

**文件上传 API（后端）：**
- POST /api/invoices/upload → 保存文件 → invoiceProcessor.fullProcess() → OCR → 验证 → 入账
- POST /api/invoices/process-local → 本地文件路径处理（给 QQ 机器人用）

### 2.2 发票识别（OCR）

**识别链路：**
1. 图片 → extractFromImage() → base64 → aiGateway.recognizeInvoice() (AI 视觉模型)
2. PDF → extractFromPDF() → pdftotext 文本提取 → parseInvoiceText() 正则解析
3. OCR 识别结果 → fullProcess() → 验证 → 入账/待审核

**识别字段：** 发票号(invoiceNo)、发票代码(invoiceCode)、类型(type)、日期(date)、购买方(buyer{name, taxNumber})、销售方(seller{name, taxNumber})、不含税金额(amountWithoutTax)、税额(taxAmount)、总金额(totalAmount)、商品明细(items)

### 2.3 发票查重

- 数据库层：UNIQUE(company_id, invoice_no) 唯一约束
- API 层：创建前查询 SELECT ... WHERE invoice_no = ? AND company_id = ?
- 入账规则层：validateInvoice() 中检查重复

### 2.4 发票审核

- 状态流转：pending → pending_review（超标） → verified（审核通过）
- POST /api/invoices/:id/verify：只有 direction='in' 的进项发票可以审核
- 超标发票（超报销标准）自动置为 pending_review，需人工审核

### 2.5 发票统计

GET /api/invoices/stats → 返回 stats/monthly/byStatus/total/totalAmount/pendingReview

### 2.6 与订单/合同关联

- 数据库字段：partner_id、contract_id、order_id
- 后端 SELECT 时做了 LEFT JOIN：partner_name、contract_name、order_name
- **前端问题：** 管理后台编辑弹窗无 partner/order/contract 字段，无法关联

---

## 三、已有功能清单

| 功能 | 状态 | 位置 |
|------|------|------|
| 手动录入发票 | ✅ 已实现 | 管理后台新增弹窗 |
| 拍照/图片上传识别 | ✅ 已实现 | 移动端 upload 页面 |
| 文件上传识别 | ✅ 已实现 | POST /api/invoices/upload |
| AI OCR 识别（图片） | ✅ 已实现 | invoiceProcessor.extractFromImage() |
| PDF 文本提取识别 | ✅ 已实现（部分） | invoiceProcessor.extractFromPDF() |
| 发票查重（数据库约束 + API检查） | ✅ 已实现 | invoices.js + invoice-entry.js |
| 发票审核认证 | ✅ 已实现 | POST /api/invoices/:id/verify |
| 发票统计面板 | ✅ 已实现 | GET /api/invoices/stats |
| 统计卡片（总数/总金额/待审核/已审核） | ✅ 已实现 | 管理后台 invoices/index.vue |
| 发票导出 Excel | ✅ 已实现（API存在） | invoiceApi.export() |
| 发票删除（状态限制） | ✅ 已实现 | 已认证/已使用不能删除 |
| 批量删除 | ✅ 已实现 | POST /api/invoices/batch-delete |
| 进项/销项方向区分 | ✅ 已实现 | direction 字段 |
| 报销合规检查 | ✅ 已实现 | invoiceProcessor.checkCompliance() |
| 超标自动待审 | ✅ 已实现 | fullProcess() 中判断 |
| 计量单位换算（万） | ✅ 已实现 | formatMoney() |
| 日期范围筛选 | ✅ 已实现 | 筛选表单 + API |

---

## 四、缺失或需要修复的功能

### 🔴 严重（功能缺失）

1. **发票详情页空白**
   - `apps/mobile/src/views/invoice/detail.vue` 只有 van-empty，没有实际内容
   - `apps/admin/src/views/invoices/index.vue` 的 viewInvoice() 只有 TODO，没有打开发票详情弹窗或页面

2. **发票编辑弹窗字段不完整**
   - 缺少 partner_id（合作方）、contract_id（合同）、order_id（订单）字段
   - 缺少 tax_rate、tax_amount、amount_before_tax 字段（表单只提交 amount）
   - invoice_code 字段在新增/编辑表单中缺失

3. **发票金额字段 bug（前端展示）**
   - 表格列 prop="total_amount" 但模板中用了 row.amount
   - 后端返回字段是 total_amount，前端接口映射也是 amount，但表格直接用 row.amount 会有问题

4. **移动端发票列表页空白**
   - `apps/mobile/src/views/invoice/index.vue` 只有 van-empty，没有发票列表

### 🟡 中等（功能不完整）

5. **发票识别后的修改功能** - 移动端识别结果页 editItem() 提示"编辑功能开发中"
6. **缺少发票作废功能** - cancelled 状态存在，但无专门的作废入口
7. **报销标准设置界面缺失** - checkCompliance() 引用了 reimbursement_standards 表，但无管理后台页面
8. **缺少发票红冲支持** - 只有 cancelled 状态，无红冲流程
9. **发票批量导入（Excel）** - 仅有导出，缺少批量导入
10. **OCR 识别失败兜底** - PDF 识别失败只抛错，无重试机制

### 🟢 轻微（体验优化）

11. **日期筛选默认值** - 无快捷筛选（本周/本月/本季度/本年）
12. **表格列宽和字段定制** - seller_name / buyer_name 列没有配置 min-width
13. **导出字段不完整** - seller_name、buyer_name 等字段可能未包含在导出中
14. **发票号/发票代码字段混用** - 后端字段是 invoice_code + invoice_no，前端表单只有 invoice_no

---

## 五、潜在 Bug

### B-01：发票金额字段名不匹配（高优先级）

位置：`apps/admin/src/views/invoices/index.vue`

表格列 prop="total_amount"，但模板用 `formatMoney(row.amount)`。
影响：金额列可能显示 undefined，表格数据展示异常。

### B-02：编辑时无法更新完整金额字段

位置：`apps/admin/src/views/invoices/index.vue` 的 handleSubmit()

表单只传了 amount，没有 amount_before_tax、tax_amount、tax_rate、invoice_code，导致这些字段无法通过编辑更新。

### B-03：POST /invoices 的字段映射错误

位置：`services/api/src/routes/invoices.js` 的 POST 路由

| 后端期望字段 | 前端传入字段 | 问题 |
|------------|------------|------|
| invoice_type | type | 字段名不匹配 |
| total_amount | amount | 字段名不匹配 |
| issue_date | invoice_date | 字段名不匹配 |
| partner_id | issuer/payer（名字） | 应传ID而非名字 |
| attachment | attachment | 后端无对应字段 |
| status | status | 后端 INSERT 硬编码，不接收 |

### B-04：移动端识别后直接入账，跳过发票表

位置：`apps/mobile/src/views/upload/index.vue` 的 confirmEntry()

只入到 transactions，没有写入 invoices 表，不符合"发票→入账"双记录逻辑。

### B-05：AI 识别结果无人工确认

移动端上传后直接入账，无人工核验识别结果步骤（识别错误的字段无法修正）。

### B-06：pending 状态发票审核后不创建记账凭证

POST /api/invoices/:id/verify 中，只有 pending_review 状态会触发 createEntry，pending 状态审核时不会创建记账凭证。

---

## 六、改进建议

1. **统一前后端字段命名**：建立统一的 DTO/接口文档，避免 amount/total_amount、invoice_date/issue_date 混用
2. **发票详情页**：补全管理后台的发票详情弹窗/页面，移动端详情页不能是空白
3. **发票编辑完善**：支持 partner/order/contract 关联、发票代码、税额拆分的编辑
4. **发票批量导入**：支持 Excel 批量导入，减少手工录入
5. **识别后人工确认**：AI 识别结果应先展示可编辑表单，用户确认后再入账
6. **OCR 失败兜底**：百度 OCR API Key 未配置时应明确提示
7. **报销标准配置页**：后台应提供报销标准的 CRUD 界面
8. **日志完善**：发票识别、审核操作应记录详细操作日志

---

## 七、总结

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完整性 | 7/10 | 核心 CRUD + OCR + 审核 + 统计均有，但详情/编辑不完整 |
| 代码质量 | 6/10 | 字段名映射混乱，存在明显 bug |
| 业务覆盖 | 7/10 | 查重/审核/合规检查均有，缺红冲/批量导入 |
| 前端体验 | 5/10 | 移动端列表空白，详情页未实现 |
| 后端健壮性 | 7/10 | 验证逻辑完整，但字段校验不足 |

**总体评价：** 发票管理功能框架完整，核心流程已跑通，但字段映射混乱导致数据不一致，前端页面存在多处未完成功能。建议优先修复 B-01~B-04，补充发票详情页和移动端列表。

**报告已生成，因权限限制无法写入 ~/Desktop/caiwu/docs/invoice-qa-report.md，请手动复制或调整权限。**
