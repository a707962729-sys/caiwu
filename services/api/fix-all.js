const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function fixDatabase() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'database/caiwu.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  const alterStatements = [
    // users 表
    "ALTER TABLE users ADD COLUMN updated_at DATETIME",
    "ALTER TABLE users ADD COLUMN supervisor_id INTEGER",
    // partners 表
    "ALTER TABLE partners ADD COLUMN level VARCHAR(20)",
    "ALTER TABLE partners ADD COLUMN credit_limit DECIMAL(15,2)",
    // products 表
    "ALTER TABLE products ADD COLUMN barcode VARCHAR(50)",
    "ALTER TABLE products ADD COLUMN unit VARCHAR(20)",
    "ALTER TABLE products ADD COLUMN cost_price DECIMAL(15,2)",
    // invoices 表
    "ALTER TABLE invoices ADD COLUMN verify_date DATE",
    "ALTER TABLE invoices ADD COLUMN verify_status VARCHAR(20)"
  ];
  
  for (const sql of alterStatements) {
    try {
      db.run(sql);
      console.log('OK:', sql.substring(0, 50));
    } catch (e) {
      if (e.message.includes('duplicate column')) {
        console.log('SKIP:', sql.substring(0, 50));
      } else {
        console.log('ERROR:', e.message);
      }
    }
  }
  
  const data = db.export();
  const newBuffer = Buffer.from(data);
  fs.writeFileSync(dbPath, newBuffer);
  console.log('All done!');
}

fixDatabase().catch(console.error);
