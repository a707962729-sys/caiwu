const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

// 数据库路径
const dbPath = path.join(__dirname, '../../database/caiwu.db');
const schemaPath = path.join(__dirname, '../../database/schema.sql');

console.log('Initializing database...');
console.log('Database path:', dbPath);
console.log('Schema path:', schemaPath);

async function initDatabase() {
  // 初始化 SQL.js
  const SQL = await initSqlJs();
  
  // 确保数据库目录存在
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('Created database directory');
  }
  
  // 创建或加载数据库
  let db;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
    console.log('Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('Created new database');
  }
  
  // 检查是否已初始化
  const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
  if (result.length > 0 && result[0].values.length > 0) {
    console.log('Database already initialized');
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    if (tables.length > 0) {
      console.log('Tables:', tables[0].values.map(t => t[0]).join(', '));
    }
    db.close();
    process.exit(0);
  }
  
  // 读取并执行 schema
  if (!fs.existsSync(schemaPath)) {
    console.error('Schema file not found:', schemaPath);
    process.exit(1);
  }
  
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  console.log('Executing schema...');
  
  try {
    // 分割并执行每条 SQL 语句
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      try {
        db.run(statement);
      } catch (err) {
        // 忽略表已存在等错误
        if (!err.message.includes('already exists')) {
          console.error('SQL Error:', err.message);
        }
      }
    }
    
    // 保存数据库
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    
    console.log('✅ Database initialized successfully');
    
    // 显示创建的表
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    if (tables.length > 0) {
      console.log('\nCreated tables:');
      tables[0].values.forEach(t => console.log(`  - ${t[0]}`));
    }
    
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
  
  db.close();
}

initDatabase().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});