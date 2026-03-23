# 数据库设计

## 用户与权限

### users (用户表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| username | VARCHAR(50) | 用户名 |
| password_hash | VARCHAR(255) | 密码哈希 |
| real_name | VARCHAR(50) | 真实姓名 |
| phone | VARCHAR(20) | 手机号 |
| email | VARCHAR(100) | 邮箱 |
| role | ENUM | 角色: boss/accountant/employee |
| status | TINYINT | 状态: 1启用 0禁用 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### permissions (权限表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户ID |
| resource | VARCHAR(100) | 资源类型 |
| action | VARCHAR(50) | 操作: read/write/delete |
| granted | BOOLEAN | 是否授权 |

## 核心业务

### contracts (合同表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| contract_no | VARCHAR(50) | 合同编号 |
| name | VARCHAR(200) | 合同名称 |
| party_a | VARCHAR(100) | 甲方 |
| party_b | VARCHAR(100) | 乙方 |
| amount | DECIMAL(12,2) | 金额 |
| sign_date | DATE | 签订日期 |
| start_date | DATE | 开始日期 |
| end_date | DATE | 结束日期 |
| status | ENUM | 状态 |
| file_path | VARCHAR(500) | 合同文件路径 |
| creator_id | UUID | 创建人 |
| created_at | DATETIME | 创建时间 |

### orders (订单/项目表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| order_no | VARCHAR(50) | 订单编号 |
| name | VARCHAR(200) | 订单/项目名称 |
| contract_id | UUID | 关联合同 |
| customer_id | UUID | 客户ID |
| amount | DECIMAL(12,2) | 金额 |
| cost | DECIMAL(12,2) | 成本 |
| profit | DECIMAL(12,2) | 利润 |
| status | ENUM | 状态 |
| created_at | DATETIME | 创建时间 |

### transactions (收支记录表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| type | ENUM | 类型: income/expense |
| category | VARCHAR(50) | 分类 |
| amount | DECIMAL(12,2) | 金额 |
| order_id | UUID | 关联订单 |
| account_id | UUID | 关联账户 |
| description | TEXT | 说明 |
| transaction_date | DATE | 交易日期 |
| creator_id | UUID | 创建人 |
| created_at | DATETIME | 创建时间 |

### invoices (发票表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| invoice_no | VARCHAR(50) | 发票号 |
| type | ENUM | 类型: input/output |
| amount | DECIMAL(12,2) | 金额 |
| tax_amount | DECIMAL(12,2) | 税额 |
| invoice_date | DATE | 开票日期 |
| file_path | VARCHAR(500) | 发票图片路径 |
| ocr_data | JSON | OCR识别数据 |
| status | ENUM | 状态 |
| created_at | DATETIME | 创建时间 |

### reimbursements (报销表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| applicant_id | UUID | 申请人 |
| amount | DECIMAL(12,2) | 金额 |
| category | VARCHAR(50) | 报销类型 |
| description | TEXT | 说明 |
| status | ENUM | 状态: pending/approved/rejected |
| approver_id | UUID | 审批人 |
| approved_at | DATETIME | 审批时间 |
| created_at | DATETIME | 创建时间 |

### reimbursement_items (报销明细)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| reimbursement_id | UUID | 报销ID |
| amount | DECIMAL(12,2) | 金额 |
| description | TEXT | 说明 |
| invoice_path | VARCHAR(500) | 票据图片 |
| ocr_data | JSON | OCR数据 |

### accounts (账户表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | VARCHAR(100) | 账户名称 |
| type | ENUM | 类型: cash/bank/alipay/wechat |
| balance | DECIMAL(12,2) | 余额 |
| account_no | VARCHAR(50) | 账号 |

### customers_suppliers (客户供应商表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | VARCHAR(100) | 名称 |
| type | ENUM | 类型: customer/supplier |
| contact | VARCHAR(50) | 联系人 |
| phone | VARCHAR(20) | 电话 |
| address | VARCHAR(200) | 地址 |
| receivable | DECIMAL(12,2) | 应收 |
| payable | DECIMAL(12,2) | 应付 |

## AI 相关

### ai_conversations (AI对话记录)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户ID |
| message | TEXT | 消息内容 |
| response | TEXT | AI回复 |
| referenced_files | JSON | 引用的文件 |
| created_at | DATETIME | 创建时间 |

### documents (文档表 - 供AI检索)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| type | VARCHAR(50) | 文档类型 |
| title | VARCHAR(200) | 标题 |
| content | TEXT | 内容 |
| file_path | VARCHAR(500) | 文件路径 |
| embedding | VECTOR | 向量嵌入(可选) |
| permission_level | INT | 权限级别 |
| created_at | DATETIME | 创建时间 |

## 索引设计

- users: idx_username, idx_phone
- contracts: idx_contract_no, idx_status
- orders: idx_order_no, idx_customer_id
- transactions: idx_order_id, idx_account_id, idx_date
- invoices: idx_invoice_no, idx_type
- reimbursements: idx_applicant_id, idx_status