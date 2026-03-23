/**
 * 财务管家 - 测试数据填充脚本
 * 创建测试客户/供应商、合同、记账记录、报销、应收应付数据
 */

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');

// 数据库路径
const dbPath = path.join(__dirname, '../database/caiwu.db');

console.log('🌱 Seeding test data...');
console.log('Database path:', dbPath);

// 测试数据
const testCompanies = [
  { name: '示例科技有限公司', short_name: '示例科技', tax_id: '91110108MA01234567', legal_person: '张三', address: '北京市海淀区中关村大街1号', phone: '010-12345678', bank_name: '中国工商银行', bank_account: '1234567890123456789' }
];

const testUsers = [
  { username: 'admin', real_name: '管理员', role: 'boss', email: 'admin@example.com', phone: '13800138000' },
  { username: 'accountant', real_name: '李会计', role: 'accountant', email: 'accountant@example.com', phone: '13800138001' },
  { username: 'employee', real_name: '王员工', role: 'employee', email: 'employee@example.com', phone: '13800138002' }
];

const testPartners = [
  { name: '北京优质供应商有限公司', type: 'supplier', contact_person: '赵经理', phone: '010-87654321', email: 'zhao@supplier.com', address: '北京市朝阳区建国路88号', credit_limit: 500000, credit_period: 30 },
  { name: '上海大客户集团', type: 'customer', contact_person: '钱总监', phone: '021-12345678', email: 'qian@customer.com', address: '上海市浦东新区陆家嘴金融中心', credit_limit: 1000000, credit_period: 45 },
  { name: '深圳科技合作伙伴', type: 'both', contact_person: '孙总', phone: '0755-98765432', email: 'sun@partner.com', address: '深圳市南山区科技园', credit_limit: 300000, credit_period: 15 },
  { name: '广州贸易公司', type: 'customer', contact_person: '李经理', phone: '020-11223344', email: 'li@trade.com', address: '广州市天河区珠江新城', credit_limit: 800000, credit_period: 60 },
  { name: '杭州电商供应商', type: 'supplier', contact_person: '周经理', phone: '0571-55667788', email: 'zhou@ecom.com', address: '杭州市西湖区文三路', credit_limit: 200000, credit_period: 30 }
];

const testContracts = [
  { contract_no: 'HT-2026-001', name: '2026年度原材料采购框架合同', partner_id: 1, contract_type: '采购合同', amount: 1200000, start_date: '2026-01-01', end_date: '2026-12-31', sign_date: '2026-01-15', status: 'active', payment_terms: '月结30天' },
  { contract_no: 'HT-2026-002', name: '软件开发服务合同', partner_id: 2, contract_type: '服务合同', amount: 500000, start_date: '2026-02-01', end_date: '2026-08-31', sign_date: '2026-01-28', status: 'active', payment_terms: '分期付款' },
  { contract_no: 'HT-2026-003', name: '技术咨询服务协议', partner_id: 3, contract_type: '服务合同', amount: 180000, start_date: '2026-03-01', end_date: '2026-06-30', sign_date: '2026-02-20', status: 'active', payment_terms: '按阶段付款' },
  { contract_no: 'HT-2026-004', name: '产品销售合同', partner_id: 4, contract_type: '销售合同', amount: 650000, start_date: '2026-03-10', end_date: '2026-09-30', sign_date: '2026-03-08', status: 'active', payment_terms: '发货后30天' }
];

const testTransactions = [
  { transaction_no: 'TXN-2026-03-001', transaction_date: '2026-03-01', transaction_type: 'income', category: '销售收入', sub_category: '软件服务', amount: 150000, account_from: null, account_to: '招商银行', partner_id: 2, description: '2月份软件服务收入' },
  { transaction_no: 'TXN-2026-03-002', transaction_date: '2026-03-05', transaction_type: 'expense', category: '采购支出', sub_category: '原材料', amount: 85000, account_from: '招商银行', account_to: null, partner_id: 1, description: '原材料采购付款' },
  { transaction_no: 'TXN-2026-03-003', transaction_date: '2026-03-10', transaction_type: 'income', category: '销售收入', sub_category: '产品销售', amount: 280000, account_from: null, account_to: '招商银行', partner_id: 4, description: '产品销售回款' },
  { transaction_no: 'TXN-2026-03-004', transaction_date: '2026-03-12', transaction_type: 'expense', category: '办公费用', sub_category: '办公用品', amount: 3500, account_from: '现金', account_to: null, description: '办公设备采购' },
  { transaction_no: 'TXN-2026-03-005', transaction_date: '2026-03-15', transaction_type: 'expense', category: '人员工资', sub_category: '工资', amount: 156000, account_from: '招商银行', account_to: null, description: '3月份员工工资发放' }
];

const testReimbursements = [
  { reimbursement_no: 'RB-2026-03-001', title: '上海出差报销', reimbursement_type: '差旅费', amount: 8520.50, application_date: '2026-03-05', expense_date: '2026-03-03', status: 'approved', description: '上海客户拜访差旅费用' },
  { reimbursement_no: 'RB-2026-03-002', title: '办公设备采购报销', reimbursement_type: '办公费', amount: 3200.00, application_date: '2026-03-08', expense_date: '2026-03-07', status: 'paid', description: '打印机、办公桌椅采购' },
  { reimbursement_no: 'RB-2026-03-003', title: '客户招待报销', reimbursement_type: '招待费', amount: 1580.00, application_date: '2026-03-12', expense_date: '2026-03-10', status: 'pending', description: '客户来访餐饮招待' },
  { reimbursement_no: 'RB-2026-03-004', title: '交通费用报销', reimbursement_type: '差旅费', amount: 456.00, application_date: '2026-03-14', expense_date: '2026-03-14', status: 'approved', description: '市内交通打车费用' }
];

const testReceivablesPayables = [
  { type: 'receivable', rp_no: 'AR-2026-03-001', partner_id: 2, contract_id: 2, amount: 500000, paid_amount: 150000, due_date: '2026-04-15', transaction_date: '2026-03-01', description: '软件开发服务应收款' },
  { type: 'receivable', rp_no: 'AR-2026-03-002', partner_id: 4, contract_id: 4, amount: 325000, paid_amount: 0, due_date: '2026-04-10', transaction_date: '2026-03-10', description: '产品销售应收款（首期）' },
  { type: 'payable', rp_no: 'AP-2026-03-001', partner_id: 1, contract_id: 1, amount: 1200000, paid_amount: 85000, due_date: '2026-03-31', transaction_date: '2026-03-05', description: '原材料采购应付款' },
  { type: 'receivable', rp_no: 'AR-2026-03-003', partner_id: 3, contract_id: 3, amount: 180000, paid_amount: 0, due_date: '2026-06-30', transaction_date: '2026-03-01', description: '技术咨询服务应收款' },
  { type: 'payable', rp_no: 'AP-2026-03-002', partner_id: 5, amount: 42000, paid_amount: 42000, due_date: '2026-03-20', transaction_date: '2026-03-01', description: '电商商品采购应付款', status: 'settled' }
];

// 辅助函数：获取或插入记录
function getOrInsert(db, table, uniqueField, uniqueValue, insertFields, insertValues, returnId = true) {
  // 先查询是否存在
  const existingResult = db.exec(`SELECT id FROM ${table} WHERE ${uniqueField} = ?`, [uniqueValue]);
  if (existingResult.length > 0 && existingResult[0].values.length > 0) {
    return { id: existingResult[0].values[0][0], inserted: false };
  }
  
  // 处理值，确保 undefined 变成 null
  const processedValues = insertValues.map(v => v === undefined ? null : v);
  
  // 不存在则插入
  db.run(
    `INSERT INTO ${table} (${insertFields}) VALUES (${insertFields.split(',').map(() => '?').join(',')})`,
    processedValues
  );
  
  if (returnId) {
    const idResult = db.exec('SELECT last_insert_rowid()');
    return { id: idResult[0].values[0][0], inserted: true };
  }
  return { inserted: true };
}

async function seedDatabase() {
  // 初始化 SQL.js
  const SQL = await initSqlJs();
  
  // 检查数据库文件是否存在
  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database file not found. Please run: npm run init-db');
    process.exit(1);
  }
  
  // 加载数据库
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  console.log('✅ Database loaded');
  
  try {
    // ============================================
    // 1. 插入公司数据
    // ============================================
    console.log('\n📦 Inserting companies...');
    const companyIds = [];
    for (const company of testCompanies) {
      const result = getOrInsert(
        db, 'companies', 'name', company.name,
        'name, short_name, tax_id, legal_person, address, phone, bank_name, bank_account',
        [company.name, company.short_name, company.tax_id, company.legal_person, company.address, company.phone, company.bank_name, company.bank_account]
      );
      companyIds.push(result.id);
      console.log(`  ${result.inserted ? '✓' : '→'} Company: ${company.name} (ID: ${result.id})${result.inserted ? '' : ' [exists]'}`);
    }
    const defaultCompanyId = companyIds[0];
    
    // ============================================
    // 2. 插入用户数据
    // ============================================
    console.log('\n📦 Inserting users...');
    const userIds = [];
    const passwordHash = await bcrypt.hash('123456', 10); // 默认密码
    for (const user of testUsers) {
      const result = getOrInsert(
        db, 'users', 'username', user.username,
        'username, password_hash, real_name, role, email, phone, company_id',
        [user.username, passwordHash, user.real_name, user.role, user.email, user.phone, defaultCompanyId]
      );
      userIds.push(result.id);
      console.log(`  ${result.inserted ? '✓' : '→'} User: ${user.real_name} (${user.role}) - ID: ${result.id}${result.inserted ? '' : ' [exists]'}`);
    }
    const bossId = userIds[0];
    const accountantId = userIds[1];
    const employeeId = userIds[2];
    
    // ============================================
    // 3. 插入客户/供应商数据
    // ============================================
    console.log('\n📦 Inserting partners...');
    const partnerIds = [];
    for (const partner of testPartners) {
      const result = getOrInsert(
        db, 'partners', 'name', partner.name,
        'company_id, name, type, contact_person, phone, email, address, credit_limit, credit_period',
        [defaultCompanyId, partner.name, partner.type, partner.contact_person, partner.phone, partner.email, partner.address, partner.credit_limit, partner.credit_period]
      );
      partnerIds.push(result.id);
      console.log(`  ${result.inserted ? '✓' : '→'} Partner: ${partner.name} (${partner.type}) - ID: ${result.id}${result.inserted ? '' : ' [exists]'}`);
    }
    
    // ============================================
    // 4. 插入合同数据
    // ============================================
    console.log('\n📦 Inserting contracts...');
    const contractIds = [];
    for (const contract of testContracts) {
      const partnerId = partnerIds[contract.partner_id - 1];
      const result = getOrInsert(
        db, 'contracts', 'contract_no', contract.contract_no,
        'company_id, contract_no, name, partner_id, contract_type, amount, start_date, end_date, sign_date, status, payment_terms, created_by',
        [defaultCompanyId, contract.contract_no, contract.name, partnerId, contract.contract_type, contract.amount, contract.start_date, contract.end_date, contract.sign_date, contract.status, contract.payment_terms, bossId]
      );
      contractIds.push(result.id);
      console.log(`  ${result.inserted ? '✓' : '→'} Contract: ${contract.contract_no} - ${contract.name} (¥${contract.amount.toLocaleString()})${result.inserted ? '' : ' [exists]'}`);
    }
    
    // ============================================
    // 5. 插入记账记录
    // ============================================
    console.log('\n📦 Inserting transactions...');
    const transactionIds = [];
    for (const txn of testTransactions) {
      const partnerId = txn.partner_id ? partnerIds[txn.partner_id - 1] : null;
      const result = getOrInsert(
        db, 'transactions', 'transaction_no', txn.transaction_no,
        'company_id, transaction_no, transaction_date, transaction_type, category, sub_category, amount, account_from, account_to, partner_id, description, status, created_by',
        [defaultCompanyId, txn.transaction_no, txn.transaction_date, txn.transaction_type, txn.category, txn.sub_category, txn.amount, txn.account_from, txn.account_to, partnerId, txn.description, 'confirmed', accountantId]
      );
      transactionIds.push(result.id);
      const typeEmoji = txn.transaction_type === 'income' ? '💰' : '💸';
      console.log(`  ${result.inserted ? '✓' : '→'} Transaction: ${txn.transaction_no} ${typeEmoji} ${txn.category} (¥${txn.amount.toLocaleString()})${result.inserted ? '' : ' [exists]'}`);
    }
    
    // ============================================
    // 6. 插入报销数据
    // ============================================
    console.log('\n📦 Inserting reimbursements...');
    const reimbursementIds = [];
    for (const rb of testReimbursements) {
      const result = getOrInsert(
        db, 'reimbursements', 'reimbursement_no', rb.reimbursement_no,
        'company_id, reimbursement_no, user_id, title, reimbursement_type, amount, application_date, expense_date, status, description, approved_by',
        [defaultCompanyId, rb.reimbursement_no, employeeId, rb.title, rb.reimbursement_type, rb.amount, rb.application_date, rb.expense_date, rb.status, rb.description, rb.status !== 'pending' ? bossId : null]
      );
      reimbursementIds.push(result.id);
      const statusEmoji = rb.status === 'approved' ? '✅' : (rb.status === 'paid' ? '💵' : '⏳');
      console.log(`  ${result.inserted ? '✓' : '→'} Reimbursement: ${rb.reimbursement_no} ${statusEmoji} ${rb.title} (¥${rb.amount.toFixed(2)})${result.inserted ? '' : ' [exists]'}`);
    }
    
    // ============================================
    // 7. 插入应收应付数据
    // ============================================
    console.log('\n📦 Inserting receivables/payables...');
    const rpIds = [];
    for (const rp of testReceivablesPayables) {
      const partnerId = partnerIds[rp.partner_id - 1];
      const contractId = rp.contract_id ? contractIds[rp.contract_id - 1] : null;
      const remainingAmount = rp.amount - (rp.paid_amount || 0);
      const status = rp.status || (remainingAmount <= 0 ? 'settled' : (rp.paid_amount > 0 ? 'partial' : 'pending'));
      
      const result = getOrInsert(
        db, 'receivables_payables', 'rp_no', rp.rp_no,
        'company_id, type, rp_no, partner_id, contract_id, amount, paid_amount, remaining_amount, due_date, transaction_date, status, description',
        [defaultCompanyId, rp.type, rp.rp_no, partnerId, contractId, rp.amount, rp.paid_amount, remainingAmount, rp.due_date, rp.transaction_date, status, rp.description]
      );
      rpIds.push(result.id);
      const typeEmoji = rp.type === 'receivable' ? '📥' : '📤';
      console.log(`  ${result.inserted ? '✓' : '→'} ${rp.type === 'receivable' ? 'Receivable' : 'Payable'}: ${rp.rp_no} ${typeEmoji} ¥${rp.amount.toLocaleString()} (已${rp.type === 'receivable' ? '收' : '付'}: ¥${rp.paid_amount.toLocaleString()})${result.inserted ? '' : ' [exists]'}`);
    }
    
    // ============================================
    // 8. 插入账户数据
    // ============================================
    console.log('\n📦 Inserting accounts...');
    const testAccounts = [
      { name: '招商银行基本户', account_type: 'bank', account_no: '6214830123456789', bank_name: '招商银行', balance: 856000.00 },
      { name: '工商银行一般户', account_type: 'bank', account_no: '6222020123456789012', bank_name: '工商银行', balance: 320000.00 },
      { name: '建设银行', account_type: 'bank', account_no: '6217001234567890123', bank_name: '建设银行', balance: 185000.00 },
      { name: '现金账户', account_type: 'cash', balance: 15000.00 },
      { name: '支付宝账户', account_type: 'alipay', balance: 25000.00 }
    ];
    
    for (const account of testAccounts) {
      const result = getOrInsert(
        db, 'accounts', 'name', account.name,
        'company_id, name, account_type, account_no, bank_name, balance',
        [defaultCompanyId, account.name, account.account_type, account.account_no || null, account.bank_name || null, account.balance]
      );
      console.log(`  ${result.inserted ? '✓' : '→'} Account: ${account.name} (¥${account.balance.toLocaleString()})${result.inserted ? '' : ' [exists]'}`);
    }
    
    // ============================================
    // 保存数据库
    // ============================================
    const data = db.export();
    const saveBuffer = Buffer.from(data);
    fs.writeFileSync(dbPath, saveBuffer);
    
    console.log('\n✅ ========================================');
    console.log('🎉 Test data seeded successfully!');
    console.log('✅ ========================================\n');
    
    // 汇总统计
    console.log('📊 Summary:');
    console.log(`  - Companies: ${testCompanies.length}`);
    console.log(`  - Users: ${testUsers.length} (default password: 123456)`);
    console.log(`  - Partners: ${testPartners.length}`);
    console.log(`  - Contracts: ${testContracts.length}`);
    console.log(`  - Transactions: ${testTransactions.length}`);
    console.log(`  - Reimbursements: ${testReimbursements.length}`);
    console.log(`  - Receivables/Payables: ${testReceivablesPayables.length}`);
    console.log(`  - Accounts: ${testAccounts.length}`);
    
    console.log('\n👤 Test accounts:');
    console.log('  - admin / 123456 (boss)');
    console.log('  - accountant / 123456 (accountant)');
    console.log('  - employee / 123456 (employee)');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    db.close();
    process.exit(1);
  }
  
  db.close();
}

seedDatabase().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});