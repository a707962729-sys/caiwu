/**
 * 合同审核功能数据库迁移
 * 创建 contract_reviews, contract_review_history, risk_rules 表
 */

const fs = require('fs');
const path = require('path');
const { getDatabase, saveDatabase } = require('../');

const migrations = [
  // 合同审核结果表
  `CREATE TABLE IF NOT EXISTS contract_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    party_a_risk_level TEXT DEFAULT 'unknown',
    party_b_risk_level TEXT DEFAULT 'unknown',
    party_a_risk_factors TEXT DEFAULT '[]',
    party_b_risk_factors TEXT DEFAULT '[]',
    contract_type TEXT DEFAULT 'other',
    contract_type_confidence REAL DEFAULT 0.5,
    overall_risk_level TEXT DEFAULT 'medium',
    risk_score INTEGER DEFAULT 50,
    risk_findings TEXT DEFAULT '[]',
    review_suggestions TEXT DEFAULT '[]',
    ai_model TEXT,
    ai_tokens_used INTEGER DEFAULT 0,
    reviewer_id INTEGER,
    reviewed_at TEXT,
    review_status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contract_id) REFERENCES contracts(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id)
  )`,

  // 审核历史记录表
  `CREATE TABLE IF NOT EXISTS contract_review_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER,
    contract_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    operator_id INTEGER,
    changes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (review_id) REFERENCES contract_reviews(id),
    FOREIGN KEY (contract_id) REFERENCES contracts(id),
    FOREIGN KEY (operator_id) REFERENCES users(id)
  )`,

  // 风险规则表
  `CREATE TABLE IF NOT EXISTS risk_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    condition TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    suggestion_template TEXT DEFAULT '',
    enabled INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // 为 contracts 表添加审核相关字段（如果不存在）
  `ALTER TABLE contracts ADD COLUMN review_id INTEGER`,
  `ALTER TABLE contracts ADD COLUMN is_ai_reviewed INTEGER DEFAULT 0`,
  `ALTER TABLE contracts ADD COLUMN contract_category TEXT`,
  `ALTER TABLE contracts ADD COLUMN terms_and_conditions TEXT`,

  // 添加索引
  `CREATE INDEX IF NOT EXISTS idx_contract_reviews_contract_id ON contract_reviews(contract_id)`,
  `CREATE INDEX IF NOT EXISTS idx_contract_review_history_review_id ON contract_review_history(review_id)`,
  `CREATE INDEX IF NOT EXISTS idx_contract_review_history_contract_id ON contract_review_history(contract_id)`,
  `CREATE INDEX IF NOT EXISTS idx_risk_rules_type ON risk_rules(rule_type)`
];

async function runMigration() {
  console.log('Running contract review migration...');
  
  try {
    const db = getDatabase();
    
    for (let i = 0; i < migrations.length; i++) {
      const sql = migrations[i];
      try {
        db.run(sql);
        console.log(`Migration ${i + 1}/${migrations.length} executed`);
      } catch (err) {
        // 忽略 "already exists" 错误
        if (!err.message.includes('already exists') && !err.message.includes('duplicate column name')) {
          console.warn(`Migration ${i + 1} warning:`, err.message);
        }
      }
    }
    
    saveDatabase();
    console.log('Contract review migration completed successfully');
    
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  }
}

// 运行迁移
if (require.main === module) {
  const { initDatabase } = require('../index');
  
  (async () => {
    try {
      await initDatabase();
      await runMigration();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { runMigration };
