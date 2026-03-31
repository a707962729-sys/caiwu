/**
 * 修复数据库表结构问题
 * 运行: node fix-db-schema.js
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'database/caiwu.db');

async function fixSchema() {
  const SQL = await initSqlJs();
  let database;
  
  // 加载现有数据库
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    database = new SQL.Database(buffer);
    console.log('✓ 数据库加载成功');
  } else {
    database = new SQL.Database();
    console.log('✓ 创建新数据库');
  }
  
  const results = [];
  
  function addColumn(table, column, type, defaultVal = null) {
    try {
      // 检查列是否已存在
      const check = database.exec(`PRAGMA table_info(${table})`);
      const columns = check[0]?.values?.map(v => v[1]) || [];
      
      if (!columns.includes(column)) {
        const defaultStr = defaultVal !== null ? ` DEFAULT ${defaultVal}` : '';
        database.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}${defaultStr}`);
        results.push(`✓ ${table}.${column} 已添加`);
      } else {
        results.push(`○ ${table}.${column} 已存在`);
      }
    } catch (err) {
      results.push(`✗ ${table}.${column} 失败: ${err.message}`);
    }
  }
  
  console.log('\n=== 修复 customers 表 ===');
  addColumn('customers', 'type', 'VARCHAR(20)', "'prospect'");
  addColumn('customers', 'level', 'VARCHAR(20)', "'normal'");
  addColumn('customers', 'source', 'VARCHAR(50)', "''");
  addColumn('customers', 'owner_id', 'INTEGER');
  addColumn('customers', 'industry', 'VARCHAR(100)', "''");
  addColumn('customers', 'scale', 'VARCHAR(50)', "''");
  addColumn('customers', 'address', 'VARCHAR(255)', "''");
  addColumn('customers', 'website', 'VARCHAR(255)', "''");
  addColumn('customers', 'phone', 'VARCHAR(30)', "''");
  addColumn('customers', 'email', 'VARCHAR(100)', "''");
  addColumn('customers', 'notes', 'TEXT', "''");
  addColumn('customers', 'updated_at', 'DATETIME', 'CURRENT_TIMESTAMP');
  
  console.log('\n=== 修复 receivables_payables 表 ===');
  addColumn('receivables_payables', 'partner_id', 'INTEGER');
  addColumn('receivables_payables', 'contract_id', 'INTEGER');
  addColumn('receivables_payables', 'invoice_id', 'INTEGER');
  addColumn('receivables_payables', 'due_date', 'DATE');
  addColumn('receivables_payables', 'paid_amount', 'DECIMAL(15,2)', '0');
  addColumn('receivables_payables', 'remaining_amount', 'DECIMAL(15,2)', '0');
  addColumn('receivables_payables', 'description', 'TEXT', "''");
  addColumn('receivables_payables', 'created_by', 'INTEGER');
  addColumn('receivables_payables', 'updated_at', 'DATETIME', 'CURRENT_TIMESTAMP');
  
  console.log('\n=== 修复 invoices 表 ===');
  addColumn('invoices', 'seller_name', 'VARCHAR(100)', "''");
  addColumn('invoices', 'seller_tax_id', 'VARCHAR(50)', "''");
  addColumn('invoices', 'buyer_name', 'VARCHAR(100)', "''");
  addColumn('invoices', 'buyer_tax_id', 'VARCHAR(50)', "''");
  
  console.log('\n=== 修复 orders 表 ===');
  addColumn('orders', 'description', 'TEXT', "''");
  addColumn('orders', 'delivery_date', 'DATE');
  addColumn('orders', 'created_by', 'INTEGER');
  addColumn('orders', 'updated_at', 'DATETIME', 'CURRENT_TIMESTAMP');
  
  // 保存修复后的数据库
  const data = database.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  
  console.log('\n=== 修复结果 ===');
  results.forEach(r => console.log(r));
  
  console.log('\n✓ 数据库修复完成');
}

fixSchema().catch(console.error);
