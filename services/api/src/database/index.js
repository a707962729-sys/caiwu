const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const config = require('../config');

let db = null;
let SQL = null;

/**
 * 初始化数据库连接
 */
async function initDatabase() {
  if (db) return db;
  
  SQL = await initSqlJs();
  
  const dbPath = config.database.path;
  const dbDir = path.dirname(dbPath);
  
  // 确保数据库目录存在
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // 尝试加载已有数据库
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
    console.log('Database loaded from file:', dbPath);
    // 验证关键表是否存在
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='data_dictionaries'");
    if (tables.length === 0 || tables[0].values.length === 0) {
      console.log('Warning: data_dictionaries table missing, will reinitialize schema');
      // 如果关键表缺失，需要重新初始化
      const schemaPath = path.join(__dirname, '../../database/schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
        for (const statement of statements) {
          try {
            db.run(statement);
          } catch (err) {
            if (!err.message.includes('already exists')) {
              console.error('SQL Error:', err.message);
            }
          }
        }
        saveDatabase();
        console.log('Database schema reinitialized');
      }
    }
  } else {
    db = new SQL.Database();
  }
  
  // 启用外键约束
  db.run('PRAGMA foreign_keys = ON');
  
  return db;
}

/**
 * 保存数据库到文件
 */
function saveDatabase() {
  if (db && config.database.path) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.database.path, buffer);
  }
}

/**
 * 获取数据库实例
 */
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * 关闭数据库连接
 */
function closeDatabase() {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

/**
 * 初始化数据库表结构
 */
function initSchema() {
  const schemaPath = path.join(__dirname, '../../../database/schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const database = getDatabase();
  
  // 分割并执行每条 SQL 语句
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  for (const statement of statements) {
    try {
      database.run(statement);
    } catch (err) {
      // 忽略表已存在等错误
      if (!err.message.includes('already exists')) {
        console.error('SQL Error:', err.message);
      }
    }
  }
  
  // 创建默认管理员用户（如果不存在）
  try {
    const bcrypt = require('bcryptjs');
    const existingAdmin = queryOne("SELECT id FROM users WHERE username = 'admin'");
    
    if (!existingAdmin) {
      const defaultPassword = bcrypt.hashSync('admin123', 10);
      database.run(
        `INSERT INTO users (username, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?)`,
        ['admin', defaultPassword, '管理员', 'boss', 'active']
      );
      console.log('Default admin user created (username: admin, password: admin123)');
    } else {
      console.log('Admin user already exists, skipping default user creation');
    }
  } catch (err) {
    console.error('Failed to create default admin user:', err.message);
  }
  
  saveDatabase();
  console.log('Database schema initialized successfully');
}

/**
 * 检查数据库是否已初始化
 */
function isSchemaInitialized() {
  const database = getDatabase();
  const result = database.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
  return result.length > 0 && result[0].values.length > 0;
}

/**
 * 事务包装器 (简化版)
 */
function transaction(fn) {
  const database = getDatabase();
  try {
    database.run('BEGIN TRANSACTION');
    const result = fn(database);
    database.run('COMMIT');
    saveDatabase();
    return result;
  } catch (err) {
    database.run('ROLLBACK');
    throw err;
  }
}

/**
 * 查询辅助函数
 */
function query(sql, params = []) {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  
  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();
  return results;
}

/**
 * 单行查询
 */
function queryOne(sql, params = []) {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * 执行 SQL
 */
function run(sql, params = []) {
  const database = getDatabase();
  database.run(sql, params);
  saveDatabase();
  return { changes: database.getRowsModified() };
}

/**
 * 创建兼容 better-sqlite3 API 的语句对象
 */
function prepareStatement(database, sql) {
  return {
    get: function(...params) {
      const stmt = database.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    },
    all: function(...params) {
      const stmt = database.prepare(sql);
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    },
    run: function(...params) {
      database.run(sql, params);
      // 在 saveDatabase 之前获取 lastInsertRowid，避免潜在问题
      const lastIdResult = database.exec("SELECT last_insert_rowid() as id");
      const lastInsertRowid = lastIdResult[0]?.values[0]?.[0] || 0;
      saveDatabase();
      return { 
        changes: database.getRowsModified(),
        lastInsertRowid
      };
    }
  };
}

/**
 * 创建兼容层对象（模拟 better-sqlite3 API）
 */
function getDatabaseCompat() {
  const database = getDatabase();
  return {
    prepare: function(sql) {
      return prepareStatement(database, sql);
    },
    exec: function(sql) {
      database.run(sql);
      return this;
    },
    pragma: function(str) {
      // sql.js 不支持 pragma，忽略
      return this;
    }
  };
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  initSchema,
  isSchemaInitialized,
  transaction,
  query,
  queryOne,
  run,
  saveDatabase,
  getDatabaseCompat
};