-- 财务管家数据库表结构

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  short_name VARCHAR(50),
  tax_id VARCHAR(50),
  address VARCHAR(200),
  phone VARCHAR(20),
  email VARCHAR(100),
  bank_name VARCHAR(100),
  bank_account VARCHAR(50),
  logo VARCHAR(255),
  invoice_header TEXT,
  remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255),
  password_hash VARCHAR(255),
  name VARCHAR(100),
  real_name VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'employee',
  department VARCHAR(100),
  position VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  supervisor_id INTEGER,
  department_id INTEGER,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  name VARCHAR(100) NOT NULL,
  tax_id VARCHAR(50),
  type VARCHAR(20) DEFAULT 'supplier',
  bank_name VARCHAR(100),
  bank_account VARCHAR(50),
  address TEXT,
  phone VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  partner_id INTEGER,
  contract_no VARCHAR(50),
  name VARCHAR(200),
  type VARCHAR(50),
  amount DECIMAL(15,2),
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  order_no VARCHAR(50),
  partner_id INTEGER,
  contract_id INTEGER,
  name VARCHAR(200),
  type VARCHAR(20),
  total_amount DECIMAL(15,2),
  status VARCHAR(20) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  transaction_no VARCHAR(50),
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(50),
  type VARCHAR(20) NOT NULL,
  category VARCHAR(50),
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'CNY',
  status VARCHAR(20) DEFAULT 'pending',
  description TEXT,
  entries TEXT,
  partner_id INTEGER,
  contract_id INTEGER,
  order_id INTEGER,
  invoice_id INTEGER,
  reimbursement_id INTEGER,
  created_by INTEGER,
  confirmed_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  invoice_type VARCHAR(50) NOT NULL,
  invoice_no VARCHAR(50) NOT NULL,
  invoice_code VARCHAR(50),
  direction VARCHAR(20) NOT NULL,
  issue_date DATE NOT NULL,
  amount_before_tax DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'CNY',
  status VARCHAR(20) DEFAULT 'pending',
  verify_date DATE,
  verify_status VARCHAR(20),
  partner_id INTEGER,
  contract_id INTEGER,
  order_id INTEGER,
  transaction_id INTEGER,
  description TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, invoice_no)
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  tax_id VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  name VARCHAR(200) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS receivables_payables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL,
  partner_name VARCHAR(100),
  amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  user_id INTEGER,
  action_type VARCHAR(50),
  input_text TEXT,
  output_text TEXT,
  session_id VARCHAR(100),
  module VARCHAR(50),
  output_data TEXT,
  model VARCHAR(50),
  status VARCHAR(20),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200),
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  key VARCHAR(100) NOT NULL,
  value TEXT
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  customer_id INTEGER,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS follow_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 流程引擎相关表

-- 流程定义
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  nodes TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 流程实例
CREATE TABLE IF NOT EXISTS workflow_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  definition_id INTEGER NOT NULL,
  title VARCHAR(200),
  initiator_id INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  result VARCHAR(20),
  business_type VARCHAR(50),
  business_id INTEGER,
  business_no VARCHAR(50),
  form_data TEXT,
  current_node_id VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- 审批任务
CREATE TABLE IF NOT EXISTS workflow_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  instance_id INTEGER NOT NULL,
  node_id VARCHAR(50) NOT NULL,
  node_name VARCHAR(100),
  assignee_id INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  action VARCHAR(20),
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME
);

-- 审批记录（历史）
CREATE TABLE IF NOT EXISTS workflow_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  instance_id INTEGER NOT NULL,
  task_id INTEGER,
  node_name VARCHAR(100),
  operator_id INTEGER,
  operator_name VARCHAR(100),
  action VARCHAR(20),
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 报销标准表
CREATE TABLE IF NOT EXISTS reimbursement_standards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  category VARCHAR(50) NOT NULL,        -- accommodation/meal/transport/other
  name VARCHAR(100) NOT NULL,
  daily_limit DECIMAL(15,2),
  monthly_limit DECIMAL(15,2),
  per_item_limit DECIMAL(15,2),
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 报销单表
CREATE TABLE IF NOT EXISTS reimbursements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  reimbursement_no VARCHAR(50),
  user_id INTEGER NOT NULL,
  title VARCHAR(200),
  reimbursement_type VARCHAR(50),
  amount DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'CNY',
  application_date DATE,
  expense_date DATE,
  status VARCHAR(20) DEFAULT 'draft',
  description TEXT,
  notes TEXT,
  approved_by INTEGER,
  approved_at DATETIME,
  reject_reason TEXT,
  paid_by INTEGER,
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 报销明细表
CREATE TABLE IF NOT EXISTS reimbursement_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reimbursement_id INTEGER NOT NULL,
  item_date DATE,
  category VARCHAR(50),
  description TEXT,
  amount DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'CNY',
  invoice_no VARCHAR(50),
  invoice_path TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 数据字典表
CREATE TABLE IF NOT EXISTS data_dictionaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  dict_type VARCHAR(50) NOT NULL,
  dict_code VARCHAR(50) NOT NULL,
  dict_name VARCHAR(100) NOT NULL,
  dict_value TEXT,
  parent_code VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  description TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI日志表（含chat_history）
CREATE TABLE IF NOT EXISTS ai_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  user_id INTEGER,
  action_type VARCHAR(50),
  input_text TEXT,
  output_text TEXT,
  session_id VARCHAR(100),
  module VARCHAR(50),
  output_data TEXT,
  model VARCHAR(50),
  status VARCHAR(20),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 会计科目表
CREATE TABLE IF NOT EXISTS accounting_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  subject_code VARCHAR(50) NOT NULL,
  subject_name VARCHAR(100) NOT NULL,
  subject_type VARCHAR(20) NOT NULL,
  subject_category VARCHAR(50),
  parent_id INTEGER,
  level INTEGER DEFAULT 1,
  direction VARCHAR(10),
  is_leaf INTEGER DEFAULT 1,
  is_enabled INTEGER DEFAULT 1,
  description TEXT,
  balance DECIMAL(15,2) DEFAULT 0,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 记账凭证表
CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  voucher_no VARCHAR(50),
  voucher_date DATE NOT NULL,
  period_year INTEGER,
  period_month INTEGER,
  voucher_type VARCHAR(50) DEFAULT 'general',
  description TEXT,
  total_debit DECIMAL(15,2),
  total_credit DECIMAL(15,2),
  entries_count INTEGER,
  reference_no VARCHAR(100),
  reference_type VARCHAR(50),
  reference_id INTEGER,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  posted_by INTEGER,
  posted_at DATETIME,
  voided_by INTEGER,
  voided_at DATETIME,
  void_reason TEXT
);

-- 凭证分录表
CREATE TABLE IF NOT EXISTS voucher_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  voucher_id INTEGER NOT NULL,
  entry_no INTEGER,
  subject_id INTEGER,
  subject_code VARCHAR(50),
  subject_name VARCHAR(100),
  description TEXT,
  debit_amount DECIMAL(15,2) DEFAULT 0,
  credit_amount DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'CNY',
  exchange_rate DECIMAL(15,4) DEFAULT 1,
  original_amount DECIMAL(15,2),
  quantity DECIMAL(15,2),
  unit_price DECIMAL(15,2),
  partner_id INTEGER,
  partner_name VARCHAR(100),
  project VARCHAR(100),
  department VARCHAR(100),
  settlement_no VARCHAR(50),
  invoice_no VARCHAR(50),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
);

-- 采购订单表
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  order_no VARCHAR(50) NOT NULL,
  request_id INTEGER,
  supplier_id INTEGER,
  order_date DATE NOT NULL,
  expected_date DATE,
  order_type VARCHAR(50),
  total_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  final_amount DECIMAL(15,2) DEFAULT 0,
  payment_terms VARCHAR(100),
  delivery_address VARCHAR(200),
  contact_person VARCHAR(50),
  contact_phone VARCHAR(30),
  description TEXT,
  attachments VARCHAR(255),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  confirmed_by INTEGER,
  confirmed_at DATETIME,
  received_by INTEGER,
  received_at DATETIME,
  cancelled_at DATETIME,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 采购订单明细表
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  item_no INTEGER,
  product_name VARCHAR(200) NOT NULL,
  product_code VARCHAR(50),
  specification VARCHAR(200),
  unit VARCHAR(20),
  quantity DECIMAL(15,2) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  amount DECIMAL(15,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  discount_rate DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  final_amount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES purchase_orders(id)
);

-- Chat历史记录表
CREATE TABLE IF NOT EXISTS chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  session_id VARCHAR(100),
  module VARCHAR(50),
  input_text TEXT,
  output_text TEXT,
  output_data TEXT,
  model VARCHAR(50),
  status VARCHAR(20),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Quotations table
CREATE TABLE IF NOT EXISTS quotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  number VARCHAR(50) UNIQUE,
  customer_id INTEGER,
  amount DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',
  valid_until DATE,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  description TEXT DEFAULT '',
  items TEXT DEFAULT '[]',
  currency VARCHAR(10) DEFAULT 'CNY',
  discount_rate DECIMAL(5,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0
);
