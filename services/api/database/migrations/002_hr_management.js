/**
 * 人力资源管理功能数据库迁移
 * 创建 employees, salaries, attendance, leave_requests 表
 */

const fs = require('fs');
const path = require('path');
const { getDatabase, saveDatabase } = require('../../src/database');

const migrations = [
  // 员工表
  `CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    user_id INTEGER,
    name VARCHAR(100) NOT NULL,
    id_card VARCHAR(18),
    phone VARCHAR(20),
    email VARCHAR(100),
    position VARCHAR(100),
    department VARCHAR(100),
    hire_date DATE,
    contract_id INTEGER,
    contract_no VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    bank_name VARCHAR(100),
    bank_account VARCHAR(50),
    base_salary DECIMAL(15,2) DEFAULT 0,
    position_allowance DECIMAL(15,2) DEFAULT 0,
    social_insurance_no VARCHAR(50),
    housing_fund_no VARCHAR(50),
    remark TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // 考勤表
  `CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    user_id INTEGER,
    date DATE NOT NULL,
    check_in_time TEXT,
    check_out_time TEXT,
    work_hours DECIMAL(5,2) DEFAULT 0,
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'normal',
    absent_type VARCHAR(50),
    remark TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // 请假表
  `CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    user_id INTEGER,
    leave_type VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days DECIMAL(5,1) NOT NULL,
    hours DECIMAL(5,1),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    approved_by INTEGER,
    approved_at TEXT,
    reject_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // 工资表
  `CREATE TABLE IF NOT EXISTS salaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    user_id INTEGER,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    base_salary DECIMAL(15,2) DEFAULT 0,
    position_allowance DECIMAL(15,2) DEFAULT 0,
    performance_bonus DECIMAL(15,2) DEFAULT 0,
    overtime_pay DECIMAL(15,2) DEFAULT 0,
    other_bonus DECIMAL(15,2) DEFAULT 0,
    social_insurance DECIMAL(15,2) DEFAULT 0,
    housing_fund DECIMAL(15,2) DEFAULT 0,
    tax DECIMAL(15,2) DEFAULT 0,
    other_deduction DECIMAL(15,2) DEFAULT 0,
    gross_salary DECIMAL(15,2) DEFAULT 0,
    actual_salary DECIMAL(15,2) DEFAULT 0,
    work_days INTEGER DEFAULT 0,
    actual_work_days INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft',
    paid_at TEXT,
    notes TEXT,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(company_id, employee_id, year, month)
  )`,

  // 为 users 表添加员工相关字段
  `ALTER TABLE users ADD COLUMN id_card VARCHAR(18)`,
  `ALTER TABLE users ADD COLUMN hire_date DATE`,
  `ALTER TABLE users ADD COLUMN employee_status VARCHAR(20) DEFAULT 'inactive'`,

  // 添加索引
  `CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id)`,
  `CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status)`,
  `CREATE INDEX IF NOT EXISTS idx_attendance_company ON attendance(company_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)`,
  `CREATE INDEX IF NOT EXISTS idx_leave_requests_company ON leave_requests(company_id)`,
  `CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status)`,
  `CREATE INDEX IF NOT EXISTS idx_salaries_company ON salaries(company_id)`,
  `CREATE INDEX IF NOT EXISTS idx_salaries_employee ON salaries(employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_salaries_year_month ON salaries(year, month)`
];

async function runMigration() {
  console.log('Running HR management migration...');
  
  try {
    const db = getDatabase();
    
    for (let i = 0; i < migrations.length; i++) {
      const sql = migrations[i];
      try {
        db.run(sql);
        console.log(`Migration ${i + 1}/${migrations.length} executed`);
      } catch (err) {
        if (!err.message.includes('already exists') && !err.message.includes('duplicate column name')) {
          console.warn(`Migration ${i + 1} warning:`, err.message);
        }
      }
    }
    
    saveDatabase();
    console.log('HR management migration completed successfully');
    
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  }
}

if (require.main === module) {
  const { initDatabase } = require('../../src/database');
  
  (async () => {
    try {
      await initDatabase();
      await runMigration();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { runMigration };
