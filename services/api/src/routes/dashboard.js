const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const { getDatabaseCompat } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');

router.use(authMiddleware);

/**
 * @route   GET /api/dashboard/
 * @desc    仪表盘根路径，返回可用端点列表
 */
router.get('/',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: {
        message: '财务管家仪表盘 API',
        version: '1.0.0',
        endpoints: [
          { path: '/overview', method: 'GET', desc: '仪表盘概览数据' },
          { path: '/cashflow', method: 'GET', desc: '现金流数据' },
          { path: '/category', method: 'GET', desc: '收支分类统计' },
          { path: '/receivables', method: 'GET', desc: '应收账款' },
          { path: '/payables', method: 'GET', desc: '应付账款' },
          { path: '/tax', method: 'GET', desc: '税务概览' }
        ]
      }
    });
  })
);

/**
 * @route   GET /api/dashboard/info
 * @desc    获取仪表盘可用端点列表
 */
router.get('/info',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: {
        endpoints: [
          { path: '/overview', method: 'GET', desc: '仪表盘概览数据' },
          { path: '/cashflow', method: 'GET', desc: '现金流数据' },
          { path: '/category', method: 'GET', desc: '收支分类统计' },
          { path: '/receivables', method: 'GET', desc: '应收账款' },
          { path: '/payables', method: 'GET', desc: '应付账款' },
          { path: '/tax', method: 'GET', desc: '税务概览' }
        ]
      }
    });
  })
);

/**
 * @route   GET /api/dashboard/overview
 * @desc    获取仪表盘概览数据
 */
router.get('/overview',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { startDate, endDate } = req.query;
    
    // 默认本月
    const start = startDate || dayjs().startOf('month').format('YYYY-MM-DD');
    const end = endDate || dayjs().endOf('month').format('YYYY-MM-DD');
    
    // 收支统计
    const incomeExpense = db.prepare(`
      SELECT 
        SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) as total_expense,
        COUNT(*) as transaction_count
      FROM transactions
      WHERE company_id = ? AND transaction_date BETWEEN ? AND ? AND status = 'confirmed'
    `).get(companyId, start, end);
    
    // 应收应付
    const receivablesPayables = db.prepare(`
      SELECT 
        SUM(CASE WHEN type = 'receivable' THEN amount ELSE 0 END) as total_receivable,
        SUM(CASE WHEN type = 'payable' THEN amount ELSE 0 END) as total_payable,
        SUM(CASE WHEN type = 'receivable' THEN COALESCE(amount, 0) ELSE 0 END) as total_received,
        SUM(CASE WHEN type = 'payable' THEN COALESCE(amount, 0) ELSE 0 END) as total_paid,
        SUM(CASE WHEN type = 'receivable' AND status IN ('pending', 'partial', 'overdue') THEN amount ELSE 0 END) as remaining_receivable,
        SUM(CASE WHEN type = 'payable' AND status IN ('pending', 'partial', 'overdue') THEN amount ELSE 0 END) as remaining_payable
      FROM receivables_payables
      WHERE company_id = ?
    `).get(companyId);
    
    // 账户余额
    const accounts = db.prepare(`
      SELECT id, name, account_type, account_no, balance
      FROM accounts
      WHERE company_id = ? AND status = 'active'
      ORDER BY balance DESC
    `).all(companyId);
    
    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    
    // 合同统计
    const contracts = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN end_date BETWEEN date('now') AND date('now', '+30 days') THEN 1 ELSE 0 END) as expiring,
        SUM(amount) as total_amount
      FROM contracts
      WHERE company_id = ?
    `).get(companyId);
    
    // 待办事项
    const pendingItems = {
      reimbursements: db.prepare(`
        SELECT COUNT(*) as count FROM reimbursements
        WHERE company_id = ? AND status = 'pending'
      `).get(companyId).count,
      transactions: db.prepare(`
        SELECT COUNT(*) as count FROM transactions
        WHERE company_id = ? AND status = 'pending'
      `).get(companyId).count,
      invoices: db.prepare(`
        SELECT COUNT(*) as count FROM invoices
        WHERE company_id = ? AND status IN ('pending', 'pending_review')
      `).get(companyId).count,
      contracts_expiring: contracts?.expiring || 0
    };
    
    res.json({
      success: true,
      data: {
        period: { start, end },
        incomeExpense: {
          income: incomeExpense.total_income || 0,
          expense: incomeExpense.total_expense || 0,
          net: (incomeExpense.total_income || 0) - (incomeExpense.total_expense || 0),
          count: incomeExpense.transaction_count || 0
        },
        receivablesPayables: {
          receivable: receivablesPayables.total_receivable || 0,
          payable: receivablesPayables.total_payable || 0,
          received: receivablesPayables.total_received || 0,
          paid: receivablesPayables.total_paid || 0,
          remainingReceivable: receivablesPayables.remaining_receivable || 0,
          remainingPayable: receivablesPayables.remaining_payable || 0
        },
        accounts: {
          list: accounts,
          total: totalBalance
        },
        contracts: {
          total: contracts?.total || 0,
          active: contracts?.active || 0,
          expiring: contracts?.expiring || 0,
          totalAmount: contracts?.total_amount || 0
        },
        pendingItems
      }
    });
  })
);

/**
 * @route   GET /api/dashboard/cashflow
 * @desc    获取现金流数据
 */
router.get('/cashflow',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { months = 6 } = req.query;
    
    const startDate = dayjs().subtract(months - 1, 'month').startOf('month').format('YYYY-MM-DD');
    
    const cashflow = db.prepare(`
      SELECT 
        strftime('%Y-%m', transaction_date) as month,
        SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE company_id = ? AND transaction_date >= ? AND status = 'confirmed'
      GROUP BY strftime('%Y-%m', transaction_date)
      ORDER BY month
    `).all(companyId, startDate);
    
    // 填充缺失月份
    const result = [];
    for (let i = 0; i < months; i++) {
      const month = dayjs().subtract(months - 1 - i, 'month').format('YYYY-MM');
      const data = cashflow.find(c => c.month === month) || { month, income: 0, expense: 0 };
      result.push({
        month,
        income: data.income || 0,
        expense: data.expense || 0,
        net: (data.income || 0) - (data.expense || 0)
      });
    }
    
    res.json({
      success: true,
      data: result
    });
  })
);

/**
 * @route   GET /api/dashboard/category
 * @desc    获取收支分类统计
 */
router.get('/category',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { startDate, endDate, type } = req.query;
    
    const start = startDate || dayjs().startOf('month').format('YYYY-MM-DD');
    const end = endDate || dayjs().endOf('month').format('YYYY-MM-DD');
    
    let whereClause = 'WHERE company_id = ? AND transaction_date BETWEEN ? AND ? AND status = ?';
    const params = [companyId, start, end, 'confirmed'];
    
    if (type) {
      whereClause += ' AND transaction_type = ?';
      params.push(type);
    }
    
    const categories = db.prepare(`
      SELECT 
        transaction_type,
        category,
        SUM(amount) as total,
        COUNT(*) as count
      FROM transactions
      ${whereClause}
      GROUP BY transaction_type, category
      ORDER BY transaction_type, total DESC
    `).all(...params);
    
    res.json({
      success: true,
      data: {
        period: { start, end },
        categories
      }
    });
  })
);

/**
 * @route   GET /api/dashboard/receivables
 * @desc    获取应收账款账龄分析
 */
router.get('/receivables',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    const receivables = db.prepare(`
      SELECT rp.*, p.name as partner_name
      FROM receivables_payables rp
      LEFT JOIN partners p ON rp.partner_id = p.id
      WHERE rp.company_id = ? AND rp.type = 'receivable'
      ORDER BY rp.due_date
    `).all(companyId);
    
    res.json({
      success: true,
      data: { list: receivables }
    });
  })
);

/**
 * @route   GET /api/dashboard/payables
 * @desc    获取应付账款
 */
router.get('/payables',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    const payables = db.prepare(`
      SELECT rp.*, p.name as partner_name
      FROM receivables_payables rp
      LEFT JOIN partners p ON rp.partner_id = p.id
      WHERE rp.company_id = ? AND rp.type = 'payable'
      ORDER BY rp.due_date
    `).all(companyId);
    
    res.json({
      success: true,
      data: { list: payables }
    });
  })
);

/**
 * @route   GET /api/dashboard/tax
 * @desc    获取税务概览
 */
router.get('/tax',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { year, month } = req.query;
    
    const y = year || dayjs().year();
    const m = month || dayjs().month() + 1;
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD');
    
    // 进项发票统计
    const inputInvoices = db.prepare(`
      SELECT 
        COUNT(*) as count,
        SUM(amount_before_tax) as total_before_tax,
        SUM(tax_amount) as total_tax,
        SUM(total_amount) as total
      FROM invoices
      WHERE company_id = ? AND direction = 'in' AND issue_date BETWEEN ? AND ? AND status != 'cancelled'
    `).get(companyId, startDate, endDate);
    
    // 销项发票统计
    const outputInvoices = db.prepare(`
      SELECT 
        COUNT(*) as count,
        SUM(amount_before_tax) as total_before_tax,
        SUM(tax_amount) as total_tax,
        SUM(total_amount) as total
      FROM invoices
      WHERE company_id = ? AND direction = 'out' AND issue_date BETWEEN ? AND ? AND status != 'cancelled'
    `).get(companyId, startDate, endDate);
    
    // 应交增值税估算
    const estimatedVat = (outputInvoices.total_tax || 0) - (inputInvoices.total_tax || 0);
    
    res.json({
      success: true,
      data: {
        period: { year: y, month: m, startDate, endDate },
        input: {
          count: inputInvoices.count || 0,
          beforeTax: inputInvoices.total_before_tax || 0,
          tax: inputInvoices.total_tax || 0,
          total: inputInvoices.total || 0
        },
        output: {
          count: outputInvoices.count || 0,
          beforeTax: outputInvoices.total_before_tax || 0,
          tax: outputInvoices.total_tax || 0,
          total: outputInvoices.total || 0
        },
        estimatedVat: Math.max(0, estimatedVat)
      }
    });
  })
);

module.exports = router;