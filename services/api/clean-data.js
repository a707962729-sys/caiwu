const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function cleanData() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'database/caiwu.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  // 删除交易记录
  db.run('DELETE FROM transactions WHERE id > 0');
  console.log('已删除交易记录');
  
  // 删除发票记录
  db.run('DELETE FROM invoices WHERE id > 0');
  console.log('已删除发票记录');
  
  // 保存
  const data = db.export();
  const newBuffer = Buffer.from(data);
  fs.writeFileSync(dbPath, newBuffer);
  console.log('✅ 数据已清理');
}

cleanData().catch(console.error);
