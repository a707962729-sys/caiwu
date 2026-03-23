const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function fixDatabase() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'database/caiwu.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  const alterStatements = [
    "ALTER TABLE orders ADD COLUMN order_type VARCHAR(20) DEFAULT 'sales'",
    "ALTER TABLE orders ADD COLUMN customer_id INTEGER",
    "ALTER TABLE orders ADD COLUMN salesperson_id INTEGER",
    "ALTER TABLE orders ADD COLUMN order_date DATE",
    "ALTER TABLE users ADD COLUMN department_id INTEGER"
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
  
  const data = db.export();
  const newBuffer = Buffer.from(data);
  fs.writeFileSync(dbPath, newBuffer);
  console.log('Done!');
}

fixDatabase().catch(console.error);
