const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId } = require('../middleware/validation');
const Joi = require('joi');

router.use(authMiddleware);

// 验证 Schema
const reconciliationSchema = Joi.object({
  payment_id: Joi.number().integer().positive().required(),
  receivable_id: Joi.number().integer().positive().required(),
  amount: Joi.number().positive().required()
});

/**
 * @route   GET /api/finance/profit/calculate
 * @desc    利润计算
 */
router.get('/profit/calculate',
  permissionMiddleware('reports', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { startDate, endDate } = req.query;
    const companyId = req.user.companyId;

    // 收入（销售订单）
    const revenue = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM orders
      WHERE company_id = ? AND date(created_at) BETWEEN ? AND ?
    `).get(companyId, startDate || '2000-01-01', endDate || '2099-12-31');

    // 成本（采购订单）
    const cost = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM purchase_orders
      WHERE company_id = ? AND date(created_at) BETWEEN ? AND ?
    `).get(companyId, startDate || '2000-01-01', endDate || '2099-12-31');

    // 费用
    const expenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE company_id = ? AND type = 'expense' AND date(date) BETWEEN ? AND ?
    `).get(companyId, startDate || '2000-01-01', endDate || '2099-12-31');

    const totalRevenue = revenue.total || 0;
    const totalCost = cost.total || 0;
    const totalExpenses = expenses.total || 0;
    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalExpenses;

    // 按产品统计
    const byProduct = db.prepare(`
      SELECT
        p.name as product_name,
        SUM(oi.quantity) as quantity,
        SUM(oi.amount) as revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.company_id = ? AND date(o.created_at) BETWEEN ? AND ?
      GROUP BY oi.product_id
      ORDER BY revenue DESC
      LIMIT 10
    `).all(companyId, startDate || '2000-01-01', endDate || '2099-12-31');

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalCost,
        grossProfit,
        grossMargin: totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(2) : 0,
        expenses: totalExpenses,
        netProfit,
        netMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0,
        byProduct
      }
    });
  })
);

/**
 * @route   GET /api/finance/receivables/aging
 * @desc    账龄分析
 */
router.get('/receivables/aging',
  permissionMiddleware('reports', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const total = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM receivables_payables
      WHERE company_id = ? AND type = 'receivable' AND status != 'paid'
    `).get(companyId);

    // 账龄区间统计
    const ranges = [
      { range: '0-30天', min: 0, max: 30 },
      { range: '31-60天', min: 31, max: 60 },
      { range: '61-90天', min: 61, max: 90 },
      { range: '91-180天', min: 91, max: 180 },
      { range: '180天以上', min: 181, max: 99999 }
    ];

    const agingData = ranges.map(({ range, min, max }) => {
      const result = db.prepare(`
        SELECT
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as amount
        FROM receivables_payables
        WHERE company_id = ?
          AND type = 'receivable'
          AND status != 'paid'
          AND julianday('now') - julianday(due_date) >= ?
          AND julianday('now') - julianday(due_date) < ?
      `).get(companyId, min, max + 1);

      return {
        range,
        amount: result.amount || 0,
        count: result.count || 0
      };
    });

    // 逾期统计
    const overdue = db.prepare(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as amount
      FROM receivables_payables
      WHERE company_id = ?
        AND type = 'receivable'
        AND status != 'paid'
        AND due_date < date('now')
    `).get(companyId);

    res.json({
      success: true,
      data: {
        total: total.total || 0,
        ranges: agingData,
        overdue: {
          amount: overdue.amount || 0,
          count: overdue.count || 0
        }
      }
    });
  })
);

/**
 * @route   GET /api/finance/risk/alerts
 * @desc    风险预警
 */
router.get('/risk/alerts',
  permissionMiddleware('reports', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 逾期应收
    const overdueReceivables = db.prepare(`
      SELECT
        rp.*,
        p.name as partner_name,
        julianday('now') - julianday(rp.due_date) as overdue_days
      FROM receivables_payables rp
      LEFT JOIN partners p ON rp.partner_id = p.id
      WHERE rp.company_id = ?
        AND rp.type = 'receivable'
        AND rp.status != 'paid'
        AND rp.due_date < date('now')
      ORDER BY overdue_days DESC
      LIMIT 20
    `).all(companyId);

    // 高风险客户（信用额度使用率 > 80%）
    const highRiskCustomers = db.prepare(`
      SELECT
        p.*,
        p.credit_limit,
        COALESCE(SUM(rp.amount), 0) as outstanding,
        CASE WHEN p.credit_limit > 0
          THEN ROUND(COALESCE(SUM(rp.amount), 0) * 100.0 / p.credit_limit, 2)
          ELSE 0
        END as usage_rate
      FROM partners p
      LEFT JOIN receivables_payables rp ON p.id = rp.partner_id AND rp.type = 'receivable' AND rp.status != 'paid'
      WHERE p.company_id = ? AND p.credit_limit > 0
      GROUP BY p.id
      HAVING usage_rate > 80
      ORDER BY usage_rate DESC
      LIMIT 20
    `).all(companyId);

    // 库存预警
    const lowStockProducts = db.prepare(`
      SELECT
        p.id, p.name, p.sku, p.min_stock,
        COALESCE(SUM(i.quantity), 0) as current_stock
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.company_id = ? AND p.status = 'active'
      GROUP BY p.id
      HAVING current_stock <= p.min_stock
      ORDER BY current_stock ASC
      LIMIT 20
    `).all(companyId);

    res.json({
      success: true,
      data: {
        overdueReceivables,
        highRiskCustomers,
        lowStockProducts,
        summary: {
          overdueCount: overdueReceivables.length,
          overdueAmount: overdueReceivables.reduce((sum, r) => sum + (r.amount || 0), 0),
          highRiskCount: highRiskCustomers.length,
          lowStockCount: lowStockProducts.length
        }
      }
    });
  })
);

/**
 * @route   POST /api/finance/reconciliation/auto-match
 * @desc    自动对账核销
 */
router.post('/reconciliation/auto-match',
  permissionMiddleware('finance', 'update'),
  validate(reconciliationSchema),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { payment_id, receivable_id, amount } = req.body;
    const companyId = req.user.companyId;
    const userId = req.user.id;

    // 验证收款记录
    const payment = db.prepare(`
      SELECT * FROM payment_records
      WHERE id = ? AND company_id = ? AND type = 'receipt'
    `).get(payment_id, companyId);

    if (!payment) {
      throw ErrorTypes.NotFound('收款记录');
    }

    // 验证应收记录
    const receivable = db.prepare(`
      SELECT * FROM receivables_payables
      WHERE id = ? AND company_id = ? AND type = 'receivable'
    `).get(receivable_id, companyId);

    if (!receivable) {
      throw ErrorTypes.NotFound('应收记录');
    }

    // 检查核销金额是否合理
    if (amount > payment.amount) {
      throw ErrorTypes.BadRequest('核销金额不能大于收款金额');
    }

    if (amount > receivable.amount) {
      throw ErrorTypes.BadRequest('核销金额不能大于应收金额');
    }

    // 创建核销记录
    const result = db.prepare(`
      INSERT INTO reconciliations (payment_id, receivable_id, amount, reconciled_by, reconciled_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(payment_id, receivable_id, amount, userId);

    // 更新应收状态
    const newReceivableAmount = receivable.amount - amount;
    if (newReceivableAmount <= 0) {
      db.prepare(`UPDATE receivables_payables SET status = 'paid', paid_amount = amount WHERE id = ?`).run(receivable_id);
    } else {
      db.prepare(`UPDATE receivables_payables SET paid_amount = COALESCE(paid_amount, 0) + ? WHERE id = ?`).run(amount, receivable_id);
    }

    res.json({
      success: true,
      message: '核销成功',
      data: {
        reconciliationId: result.lastInsertRowid,
        reconciledAmount: amount,
        receivableRemaining: newReceivableAmount
      }
    });
  })
);

/**
 * @route   GET /api/finance/reconciliation/matches/:paymentId
 * @desc    查找可匹配的应收记录
 */
router.get('/reconciliation/matches/:paymentId',
  permissionMiddleware('finance', 'read'),
  validateId('paymentId'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { paymentId } = req.params;
    const companyId = req.user.companyId;

    // 获取收款记录
    const payment = db.prepare(`
      SELECT * FROM payment_records
      WHERE id = ? AND company_id = ? AND type = 'receipt'
    `).get(paymentId, companyId);

    if (!payment) {
      throw ErrorTypes.NotFound('收款记录');
    }

    // 查找匹配的应收记录（同客户、金额相近）
    const matches = db.prepare(`
      SELECT
        rp.*,
        p.name as partner_name,
        ABS(rp.amount - ?) as amount_diff
      FROM receivables_payables rp
      LEFT JOIN partners p ON rp.partner_id = p.id
      WHERE rp.company_id = ?
        AND rp.type = 'receivable'
        AND rp.status != 'paid'
        AND (rp.partner_id = ? OR ABS(rp.amount - ?) < 100)
      ORDER BY
        CASE WHEN rp.partner_id = ? AND rp.amount = ? THEN 0
             WHEN rp.partner_id = ? AND ABS(rp.amount - ?) < 10 THEN 1
             WHEN rp.partner_id = ? THEN 2
             ELSE 3
        END,
        amount_diff
      LIMIT 10
    `).all(payment.amount, companyId, payment.partner_id, payment.amount, payment.partner_id, payment.amount, payment.partner_id, payment.amount, payment.partner_id);

    res.json({
      success: true,
      data: {
        payment,
        matches
      }
    });
  })
);

/**
 * @route   GET /api/finance/reconciliation/list
 * @desc    对账记录列表
 */
router.get('/reconciliation/list',
  permissionMiddleware('finance', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20 } = req.query;
    const companyId = req.user.companyId;

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM reconciliations r
      JOIN payment_records pr ON r.payment_id = pr.id
      WHERE pr.company_id = ?
    `).get(companyId);

    const offset = (page - 1) * pageSize;
    const list = db.prepare(`
      SELECT
        r.*,
        pr.amount as payment_amount,
        rp.amount as receivable_amount,
        p.name as partner_name,
        u.real_name as reconciled_by_name
      FROM reconciliations r
      JOIN payment_records pr ON r.payment_id = pr.id
      JOIN receivables_payables rp ON r.receivable_id = rp.id
      LEFT JOIN partners p ON pr.partner_id = p.id
      LEFT JOIN users u ON r.reconciled_by = u.id
      WHERE pr.company_id = ?
      ORDER BY r.reconciled_at DESC
      LIMIT ? OFFSET ?
    `).all(companyId, pageSize, offset);

    res.json({
      success: true,
      data: {
        list,
        pagination: {
          page,
          pageSize,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / pageSize)
        }
      }
    });
  })
);

module.exports = router;