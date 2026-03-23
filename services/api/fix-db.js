const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function fixDatabase() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'database/caiwu.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  // 添加缺失字段
  const alterStatements = [
    "ALTER TABLE contracts ADD COLUMN responsible_user_id INTEGER",
    "ALTER TABLE customers ADD COLUMN owner_id INTEGER",
    "ALTER TABLE customers ADD COLUMN level VARCHAR(20)",
    "ALTER TABLE customers ADD COLUMN credit_limit DECIMAL(15,2)",
    "ALTER TABLE sales_orders ADD COLUMN customer_id INTEGER"
  ];
  
  for (const sql of alterStatements) {
    try {
      db.run(sql);
      console.log('OK:', sql.substring(0, 50));
    } catch (e) {
      if (e.message.includes('duplicate column')) {
        console.log('SKIP (exists):', sql.substring(0, 50));
      } else {
        console.log('ERROR:', e.message);
      }
    }
  }
  
  // 保存
  const data = db.export();
  const newBuffer = Buffer.from(data);
  fs.writeFileSync(dbPath, newBuffer);
  console.log('Database saved!');
}

fixDatabase().catch(console.error);
