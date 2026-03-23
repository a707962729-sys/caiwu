// 重置用户密码脚本
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

async function resetPassword() {
  const SQL = await initSqlJs();
  
  const dbPath = path.join(__dirname, '../database/caiwu.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  // 生成新密码的 hash
  const newPassword = 'admin123';
  const hash = bcrypt.hashSync(newPassword, 10);
  
  // 更新密码
  db.run('UPDATE users SET password = ?, password_hash = ? WHERE username = ?', [newPassword, hash, 'admin']);
  
  // 保存
  const data = db.export();
  const newBuffer = Buffer.from(data);
  fs.writeFileSync(dbPath, newBuffer);
  
  // 验证
  const result = db.exec("SELECT username, password FROM users WHERE username = 'admin'");
  console.log('Password reset successfully!');
  console.log('Username: admin');
  console.log('Password: admin123');
  
  db.close();
}

resetPassword().catch(console.error);