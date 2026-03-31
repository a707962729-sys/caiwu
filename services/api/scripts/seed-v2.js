// 财务管家 - 数据填充脚本 v2 (匹配实际数据库schema)
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

async function seed() {
  const SQL = await initSqlJs();
  // Use the same DATABASE_PATH as the API service
  const dbPath = process.env.DATABASE_PATH || '/Users/mac/caiwu/services/api/database/caiwu.db';
  console.log('Database path:', dbPath);
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const run = (sql, params = []) => { db.run(sql, params); };
  const exec = (sql) => db.exec(sql);

  console.log('🌱 Seeding test data...');

  // Check if already seeded
  const existing = exec('SELECT COUNT(*) FROM partners');
  if (existing[0]?.values[0][0] > 0) {
    console.log('Data already exists, skipping seed.');
    db.close();
    return;
  }

  // Insert partners
  const partners = [
    { id: 1, name: '北京优质供应商有限公司', type: 'supplier', phone: '010-87654321', address: '北京市朝阳区建国路88号' },
    { id: 2, name: '上海大客户集团', type: 'customer', phone: '021-12345678', address: '上海市浦东新区陆家嘴金融中心' },
    { id: 3, name: '深圳科技合作伙伴', type: 'both', phone: '0755-98765432', address: '深圳市南山区科技园' },
    { id: 4, name: '广州贸易公司', type: 'customer', phone: '020-11223344', address: '广州市天河区珠江新城' },
    { id: 5, name: '杭州电商供应商', type: 'supplier', phone: '0571-55667788', address: '杭州市西湖区文三路477号' },
  ];
  for (const p of partners) {
    run('INSERT INTO partners (id, company_id, name, type, phone, address, risk_level) VALUES (?,?,?,?,?,?,?)',
      [p.id, 1, p.name, p.type, p.phone, p.address, 'low']);
  }

  // Insert contracts
  const contracts = [
    { contract_no: 'HT-2026-001', name: '2026年度原材料采购框架合同', contract_type: '采购合同', amount: 1200000, start_date: '2026-01-01', end_date: '2026-12-31', sign_date: '2026-01-15', status: 'active', payment_terms: '月结30天', partner_id: 1 },
    { contract_no: 'HT-2026-002', name: '软件开发服务合同', contract_type: '服务合同', amount: 500000, start_date: '2026-02-01', end_date: '2026-08-31', sign_date: '2026-01-28', status: 'active', payment_terms: '分期付款', partner_id: 2 },
    { contract_no: 'HT-2026-003', name: '技术咨询服务协议', contract_type: '服务合同', amount: 180000, start_date: '2026-03-01', end_date: '2026-06-30', sign_date: '2026-02-20', status: 'active', payment_terms: '按阶段付款', partner_id: 3 },
    { contract_no: 'HT-2026-004', name: '产品销售合同', contract_type: '销售合同', amount: 650000, start_date: '2026-03-10', end_date: '2026-09-30', sign_date: '2026-03-08', status: 'active', payment_terms: '发货后30天', partner_id: 4 },
  ];
  for (const c of contracts) {
    run('INSERT INTO contracts (company_id, partner_id, contract_no, name, contract_type, amount, start_date, end_date, sign_date, status, payment_terms) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [1, c.partner_id, c.contract_no, c.name, c.contract_type, c.amount, c.start_date, c.end_date, c.sign_date, c.status, c.payment_terms]);
  }

  // Insert transactions (type: income/expense)
  const transactions = [
    { transaction_no: 'TXN-2026-03-001', transaction_date: '2026-03-01', type: 'income', transaction_type: '收入', category: '销售收入', amount: 150000, partner_id: 2, description: '2月份软件服务收入' },
    { transaction_no: 'TXN-2026-03-002', transaction_date: '2026-03-05', type: 'expense', transaction_type: '支出', category: '采购支出', amount: 85000, partner_id: 1, description: '原材料采购付款' },
    { transaction_no: 'TXN-2026-03-003', transaction_date: '2026-03-10', type: 'income', transaction_type: '收入', category: '销售收入', amount: 280000, partner_id: 4, description: '产品销售回款' },
    { transaction_no: 'TXN-2026-03-004', transaction_date: '2026-03-12', type: 'expense', transaction_type: '支出', category: '办公费用', amount: 3500, partner_id: null, description: '办公设备采购' },
    { transaction_no: 'TXN-2026-03-005', transaction_date: '2026-03-15', type: 'expense', transaction_type: '支出', category: '人员工资', amount: 156000, partner_id: null, description: '3月份员工工资发放' },
  ];
  for (const t of transactions) {
    run('INSERT INTO transactions (company_id, transaction_no, transaction_date, type, transaction_type, category, amount, currency, status, description, partner_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [1, t.transaction_no, t.transaction_date, t.type, t.transaction_type, t.category, t.amount, 'CNY', 'confirmed', t.description, t.partner_id]);
  }

  // Insert reimbursements
  const reimbursements = [
    { reimbursement_no: 'RB-2026-03-001', title: '上海出差报销', reimbursement_type: '差旅费', amount: 8520.50, application_date: '2026-03-05', expense_date: '2026-03-03', status: 'approved', description: '上海客户拜访差旅费用' },
    { reimbursement_no: 'RB-2026-03-002', title: '办公设备采购报销', reimbursement_type: '办公费', amount: 3200.00, application_date: '2026-03-08', expense_date: '2026-03-07', status: 'paid', description: '打印机、办公桌椅采购' },
    { reimbursement_no: 'RB-2026-03-003', title: '客户招待报销', reimbursement_type: '招待费', amount: 1580.00, application_date: '2026-03-12', expense_date: '2026-03-10', status: 'pending', description: '客户来访餐饮招待' },
    { reimbursement_no: 'RB-2026-03-004', title: '交通费用报销', reimbursement_type: '差旅费', amount: 456.00, application_date: '2026-03-14', expense_date: '2026-03-14', status: 'approved', description: '市内交通打车费用' },
  ];
  for (const r of reimbursements) {
    run('INSERT INTO reimbursements (company_id, reimbursement_no, user_id, title, reimbursement_type, amount, currency, application_date, expense_date, status, description, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [1, r.reimbursement_no, 1, r.title, r.reimbursement_type, r.amount, 'CNY', r.application_date, r.expense_date, r.status, r.description, '']);
  }

  // Insert receivables_payables
  const rp = [
    { rp_no: 'AR-2026-03-001', type: 'receivable', partner_name: '上海大客户集团', amount: 500000, paid_amount: 150000, due_date: '2026-04-15', transaction_date: '2026-03-01', notes: '软件开发服务应收款' },
    { rp_no: 'AR-2026-03-002', type: 'receivable', partner_name: '广州贸易公司', amount: 325000, paid_amount: 0, due_date: '2026-04-10', transaction_date: '2026-03-10', notes: '产品销售应收款（首期）' },
    { rp_no: 'AP-2026-03-001', type: 'payable', partner_name: '北京优质供应商有限公司', amount: 1200000, paid_amount: 85000, due_date: '2026-03-31', transaction_date: '2026-03-05', notes: '原材料采购应付款' },
    { rp_no: 'AR-2026-03-003', type: 'receivable', partner_name: '深圳科技合作伙伴', amount: 180000, paid_amount: 0, due_date: '2026-06-30', transaction_date: '2026-03-01', notes: '技术咨询服务应收款' },
    { rp_no: 'AP-2026-03-002', type: 'payable', partner_name: '杭州电商供应商', amount: 42000, paid_amount: 42000, due_date: '2026-03-20', transaction_date: '2026-03-01', notes: '电商商品采购应付款' },
  ];
  for (const r of rp) {
    const remaining = r.amount - r.paid_amount;
    const status = remaining === 0 ? 'settled' : (remaining === r.amount ? 'pending' : 'partial');
    run('INSERT INTO receivables_payables (company_id, rp_no, type, partner_name, amount, paid_amount, remaining_amount, due_date, transaction_date, notes, status, description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [1, r.rp_no, r.type, r.partner_name, r.amount, r.paid_amount, remaining, r.due_date, r.transaction_date, r.notes, status, '']);
  }

  // Insert accounts
  const accounts = [
    { name: '招商银行', account_type: 'bank', account_no: '1001', balance: 285000 },
    { name: '现金', account_type: 'cash', account_no: '1002', balance: 5000 },
    { name: '应收账款', account_type: 'receivable', account_no: '1123', balance: 1005000 },
    { name: '应付账款', account_type: 'payable', account_no: '2202', balance: 1242000 },
    { name: '主营业务收入', account_type: 'income', account_no: '6001', balance: 0 },
    { name: '销售成本', account_type: 'expense', account_no: '6401', balance: 0 },
  ];
  for (const a of accounts) {
    run('INSERT INTO accounts (company_id, name, account_type, account_no, balance, status) VALUES (?,?,?,?,?,?)', [1, a.name, a.account_type, a.account_no, a.balance, 'active']);
  }

  // Insert products
  const products = [
    { name: '财务软件旗舰版', category: '软件', price: 29999, cost: 15000, unit: '套' },
    { name: 'ERP标准版', category: '软件', price: 59999, cost: 30000, unit: '套' },
    { name: '服务器', category: '硬件', price: 25000, cost: 18000, unit: '台' },
    { name: '办公桌椅套装', category: '办公用品', price: 3500, cost: 2000, unit: '套' },
  ];
  for (const p of products) {
    run('INSERT INTO products (company_id, name, category, price, cost, unit) VALUES (?,?,?,?,?,?)', [1, p.name, p.category, p.price, p.cost, p.unit]);
  }

  // Insert invoices
  const invoices = [
    { invoice_type: '增值税专用发票', invoice_no: 'FP-2026-001', direction: 'in', issue_date: '2026-03-01', amount_before_tax: 132743, tax_amount: 17257, total_amount: 150000, partner_id: 2, status: 'verified', seller_name: '财务管家科技有限公司', buyer_name: '上海大客户集团' },
    { invoice_type: '增值税专用发票', invoice_no: 'FP-2026-002', direction: 'out', issue_date: '2026-03-10', amount_before_tax: 247788, tax_amount: 32212, total_amount: 280000, partner_id: 4, status: 'verified', seller_name: '财务管家科技有限公司', buyer_name: '广州贸易公司' },
    { invoice_type: '增值税普通发票', invoice_no: 'FP-2026-003', direction: 'in', issue_date: '2026-03-05', amount_before_tax: 74336, tax_amount: 9664, total_amount: 84000, partner_id: 1, status: 'pending', seller_name: '北京优质供应商有限公司', buyer_name: '财务管家科技有限公司' },
  ];
  for (const inv of invoices) {
    run('INSERT INTO invoices (company_id, invoice_type, invoice_no, direction, issue_date, amount_before_tax, tax_amount, total_amount, partner_id, status, seller_name, buyer_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [1, inv.invoice_type, inv.invoice_no, inv.direction, inv.issue_date, inv.amount_before_tax, inv.tax_amount, inv.total_amount, inv.partner_id, inv.status, inv.seller_name, inv.buyer_name]);
  }

  // Save
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  console.log('✅ Seed complete!');

  // Verify
  const tables = ['partners', 'contracts', 'transactions', 'reimbursements', 'receivables_payables', 'accounts', 'products', 'invoices'];
  for (const t of tables) {
    const r = exec('SELECT COUNT(*) FROM ' + t);
    console.log('  ' + t + ':', r[0]?.values[0][0]);
  }
  db.close();
}

seed().catch(console.error);
