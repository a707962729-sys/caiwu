-- 合同审核模块数据库迁移
-- 执行: sqlite3 database/caiwu.db < database/migrations/contract-review.sql

-- 1. 扩展 contracts 表
-- 添加甲方乙方关联、审核状态、合同分类等字段
ALTER TABLE contracts ADD COLUMN party_a_partner_id INTEGER REFERENCES partners(id);
ALTER TABLE contracts ADD COLUMN party_b_partner_id INTEGER REFERENCES partners(id);
ALTER TABLE contracts ADD COLUMN review_id INTEGER;
ALTER TABLE contracts ADD COLUMN contract_category VARCHAR(20);
ALTER TABLE contracts ADD COLUMN is_ai_reviewed INTEGER DEFAULT 0;

-- 2. 扩展 partners 表（风险相关字段）
ALTER TABLE partners ADD COLUMN partner_type VARCHAR(20) DEFAULT 'both';
ALTER TABLE partners ADD COLUMN id_number VARCHAR(50);
ALTER TABLE partners ADD COLUMN risk_level VARCHAR(20) DEFAULT 'low';
ALTER TABLE partners ADD COLUMN risk_reason TEXT;
ALTER TABLE partners ADD COLUMN credit_score INTEGER;
ALTER TABLE partners ADD COLUMN contact VARCHAR(100);
ALTER TABLE partners ADD COLUMN tax_rate DECIMAL(5,2);
ALTER TABLE partners ADD COLUMN receivable DECIMAL(14,2) DEFAULT 0;
ALTER TABLE partners ADD COLUMN payable DECIMAL(14,2) DEFAULT 0;

-- 3. 创建 contract_reviews 表（审核结果）
CREATE TABLE IF NOT EXISTS contract_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL,
  party_a_risk_level VARCHAR(20),
  party_b_risk_level VARCHAR(20),
  party_a_risk_factors TEXT,
  party_b_risk_factors TEXT,
  contract_type VARCHAR(20),
  contract_type_confidence DECIMAL(5,2),
  overall_risk_level VARCHAR(20),
  risk_score INTEGER,
  risk_findings TEXT,
  review_suggestions TEXT,
  ai_model VARCHAR(50),
  ai_tokens_used INTEGER,
  review_status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  reviewer_id INTEGER,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

-- 4. 创建 contract_review_history 表（审核历史）
CREATE TABLE IF NOT EXISTS contract_review_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL,
  operator_id INTEGER,
  changes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (review_id) REFERENCES contract_reviews(id)
);

-- 5. 创建 risk_rules 表（风险规则引擎）
CREATE TABLE IF NOT EXISTS risk_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(20) NOT NULL,
  condition TEXT NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  suggestion_template TEXT,
  enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. 创建索引
CREATE INDEX IF NOT EXISTS idx_partners_risk ON partners(risk_level);
CREATE INDEX IF NOT EXISTS idx_partners_type ON partners(partner_type);
CREATE INDEX IF NOT EXISTS idx_contract_reviews_contract ON contract_reviews(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_reviews_status ON contract_reviews(review_status);
CREATE INDEX IF NOT EXISTS idx_risk_rules_type ON risk_rules(rule_type, enabled);
CREATE INDEX IF NOT EXISTS idx_contract_review_history_review ON contract_review_history(review_id);

-- 7. 插入默认风险规则
INSERT OR IGNORE INTO risk_rules (id, rule_name, rule_type, condition, risk_level, suggestion_template, enabled, priority) VALUES
(1, '高风险合作方名单', 'party_risk', '{"type": "partner_in_list", "list": "high_risk"}', 'high', '该合作方在高风险名单中，建议人工审核', 1, 100),
(2, '信用评分过低', 'party_risk', '{"type": "credit_score", "operator": "<", "value": 60}', 'medium', '合作方信用评分过低，建议加强付款条件管控', 1, 80),
(3, '新合作方大额交易', 'party_risk', '{"type": "new_partner_amount", "amount_threshold": 1000000}', 'high', '新合作方交易金额超过100万，建议人工审核', 1, 90),
(4, '历史逾期记录', 'party_risk', '{"type": "overdue_history", "count": 1}', 'high', '存在历史逾期记录，建议提高风险等级', 1, 95),
(5, '预付款比例过高', 'contract_risk', '{"type": "advance_payment_ratio", "operator": ">", "value": 50}', 'medium', '预付款比例超过50%，存在资金风险', 1, 70),
(6, '付款周期过长', 'contract_risk', '{"type": "payment_period", "operator": ">", "value": 90}', 'medium', '付款周期超过90天，资金回笼风险较高', 1, 60),
(7, '合同金额异常', 'amount_risk', '{"type": "amount_threshold", "value": 5000000}', 'high', '合同金额超过500万，属于重大合同，建议多级审批', 1, 85);
