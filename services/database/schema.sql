-- 财务管家数据库表结构

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  tax_id VARCHAR(50),
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