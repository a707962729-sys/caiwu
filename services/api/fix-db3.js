const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function fixDatabase() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'database/caiwu.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  const alterStatements = [
    "ALTER TABLE users ADD COLUMN avatar VARCHAR(255)",
    "ALTER TABLE users ADD COLUMN real_name VARCHAR(100)",
    "ALTER TABLE users ADD COLUMN email VARCHAR(100)",
    "ALTER TABLE users ADD COLUMN phone VARCHAR(20)",
    "ALTER TABLE users ADD COLUMN position VARCHAR(100)"
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
  console.log('Done!');
}

fixDatabase().catch(console.error);
