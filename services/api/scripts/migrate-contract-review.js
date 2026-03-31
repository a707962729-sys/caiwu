/**
 * 合同审核模块数据库迁移脚本
 * 运行方式: node scripts/migrate-contract-review.js
 */
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

async function migrate() {
  console.log('Starting contract review migration...');
  
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, '../database/caiwu.db');
  
  let db;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
    console.log('Database loaded');
  } else {
    console.error('Database not found:', dbPath);
    process.exit(1);
  }

  try {
    // 1. 检查 contracts 表结构，添加缺失的字段
    const contractsColumns = db.exec("PRAGMA table_info(contracts)");
    const existingColumns = new Set();
    if (contractsColumns.length > 0) {
      contractsColumns[0].values.forEach(row => {
        existingColumns.add(row[1]); // column name is index 1
      });
    }

    const newContractFields = [
      { name: 'party_a_partner_id', sql: 'INTEGER REFERENCES partners(id)' },
      { name: 'party_b_partner_id', sql: 'INTEGER REFERENCES partners(id)' },
      { name: 'review_id', sql: 'INTEGER' },
      { name: 'contract_category', sql: 'VARCHAR(20)' },
      { name: 'is_ai_reviewed', sql: 'INTEGER DEFAULT 0' },
      { name: 'terms_and_conditions', sql: 'TEXT' },
      { name: 'payment_terms', sql: 'TEXT' },
      { name: 'responsible_user_id', sql: 'INTEGER' },
      { name: 'sign_date', sql: 'DATE' }
    ];

    for (const field of newContractFields) {
      if (!existingColumns.has(field.name)) {
        db.run(`ALTER TABLE contracts ADD COLUMN ${field.name} ${field.sql}`);
        console.log(`Added column: contracts.${field.name}`);
      }
    }

    // 2. 检查 partners 表结构，添加缺失的字段
    const partnersColumns = db.exec("PRAGMA table_info(partners)");
    const partnerExistingColumns = new Set();
    if (partnersColumns.length > 0) {
      partnersColumns[0].values.forEach(row => {
        partnerExistingColumns.add(row[1]);
      });
    }

    const newPartnerFields = [
      { name: 'partner_type', sql: "VARCHAR(20) DEFAULT 'both'" },
      { name: 'id_number', sql: 'VARCHAR(50)' },
      { name: 'risk_level', sql: "VARCHAR(20) DEFAULT 'low'" },
      { name: 'risk_reason', sql: 'TEXT' },
      { name: 'credit_score', sql: 'INTEGER' },
      { name: 'contact', sql: 'VARCHAR(100)' },
      { name: 'tax_rate', sql: 'DECIMAL(5,2)' },
      { name: 'receivable', sql: 'DECIMAL(14,2) DEFAULT 0' },
      { name: 'payable', sql: 'DECIMAL(14,2) DEFAULT 0' }
    ];

    for (const field of newPartnerFields) {
      if (!partnerExistingColumns.has(field.name)) {
        db.run(`ALTER TABLE partners ADD COLUMN ${field.name} ${field.sql}`);
        console.log(`Added column: partners.${field.name}`);
      }
    }

    // 3. 创建 contract_reviews 表
    db.run(`
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
      )
    `);
    console.log('Created table: contract_reviews');

    // 4. 创建 contract_review_history 表
    db.run(`
      CREATE TABLE IF NOT EXISTS contract_review_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        review_id INTEGER NOT NULL,
        action VARCHAR(20) NOT NULL,
        operator_id INTEGER,
        changes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (review_id) REFERENCES contract_reviews(id)
      )
    `);
    console.log('Created table: contract_review_history');

    // 5. 创建 risk_rules 表
    db.run(`
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
      )
    `);
    console.log('Created table: risk_rules');

    // 6. 创建索引
    db.run('CREATE INDEX IF NOT EXISTS idx_partners_risk ON partners(risk_level)');
    db.run('CREATE INDEX IF NOT EXISTS idx_partners_type ON partners(partner_type)');
    db.run('CREATE INDEX IF NOT EXISTS idx_contract_reviews_contract ON contract_reviews(contract_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_contract_reviews_status ON contract_reviews(review_status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_risk_rules_type ON risk_rules(rule_type, enabled)');
    console.log('Created indexes');

    // 7. 插入默认风险规则
    const existingRules = db.exec("SELECT COUNT(*) FROM risk_rules");
    if (existingRules[0].values[0][0] === 0) {
      const defaultRules = [
        ['高风险合作方名单', 'party_risk', '{"type": "partner_in_list", "list": "high_risk"}', 'high', '该合作方在高风险名单中，建议人工审核', 1, 100],
        ['信用评分过低', 'party_risk', '{"type": "credit_score", "operator": "<", "value": 60}', 'medium', '合作方信用评分过低，建议加强付款条件管控', 1, 80],
        ['新合作方大额交易', 'party_risk', '{"type": "new_partner_amount", "amount_threshold": 1000000}', 'high', '新合作方交易金额超过100万，建议人工审核', 1, 90],
        ['历史逾期记录', 'party_risk', '{"type": "overdue_history", "count": 1}', 'high', '存在历史逾期记录，建议提高风险等级', 1, 95],
        ['预付款比例过高', 'contract_risk', '{"type": "advance_payment_ratio", "operator": ">", "value": 50}', 'medium', '预付款比例超过50%，存在资金风险', 1, 70],
        ['付款周期过长', 'contract_risk', '{"type": "payment_period", "operator": ">", "value": 90}', 'medium', '付款周期超过90天，资金回笼风险较高', 1, 60],
        ['合同金额异常', 'amount_risk', '{"type": "amount_threshold", "value": 5000000}', 'high', '合同金额超过500万，属于重大合同，建议多级审批', 1, 85]
      ];

      for (const rule of defaultRules) {
        db.run(
          'INSERT INTO risk_rules (rule_name, rule_type, condition, risk_level, suggestion_template, enabled, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
          rule
        );
      }
      console.log('Inserted default risk rules');
    }

    // 保存数据库
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    console.log('Database saved');

    console.log('\n✅ Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

migrate();
