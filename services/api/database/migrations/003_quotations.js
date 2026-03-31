/**
 * Migration 003: Add quotations table
 */
async function up(db) {
  await db.run(`
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
    )
  `);
}

async function down(db) {
  await db.run('DROP TABLE IF EXISTS quotations');
}

module.exports = { up, down };
