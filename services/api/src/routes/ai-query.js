const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

router.use(authMiddleware);

/**
 * 解析自然语言问题
 */
function parseQuestion(question) {
  const result = {
    type: 'unknown',
    timeRange: null,
    dimension: null,
    limit: null
  };

  // 时间范围识别
  const timePatterns = [
    { pattern: /本月|这个月/, value: 'month' },
    { pattern: /本季度|这个季度/, value: 'quarter' },
    { pattern: /本年|今年/, value: 'year' },
    { pattern: /上周|上个周/, value: 'lastWeek' },
    { pattern: /上月|上个月/, value: 'lastMonth' },
    { pattern: /昨天/, value: 'yesterday' },
    { pattern: /今天/, value: 'today' }
  ];

  for (const { pattern, value } of timePatterns) {
    if (pattern.test(question)) {
      result.timeRange = value;
      break;
    }
  }

  // 指标类型识别
  if (/销售(额|收入|金额)|卖了多少钱/.test(question)) {
    result.type = 'sales';
  } else if (/利润|赚了多少钱/.test(question)) {
    result.type = 'profit';
  } else if (/应收|欠款/.test(question)) {
    result.type = 'receivables';
  } else if (/库存|存货/.test(question)) {
    result.type = 'inventory';
  } else if (/客户.*排行|哪个客户.*赚钱|top.*客户/i.test(question)) {
    result.type = 'topCustomers';
    result.limit = 5;
  } else if (/费用|支出/.test(question)) {
    result.type = 'expenses';
  } else if (/订单|单量/.test(question)) {
    result.type = 'orders';
  }

  return result;
}

/**
 * 获取时间范围 SQL 条件
 */
function getTimeCondition(timeRange) {
  const conditions = {
    today: "date(created_at) = date('now')",
    yesterday: "date(created_at) = date('now', '-1 day')",
    week: "date(created_at) >= date('now', '-7 days')",
    month: "strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')",
    lastMonth: "strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', '-1 month')",
    quarter: "strftime('%Y', created_at) = strftime('%Y', 'now') AND ((strftime('%m', created_at) - 1) / 3) = ((strftime('%m', 'now') - 1) / 3)",
    year: "strftime('%Y', created_at) = strftime('%Y', 'now')"
  };
  return conditions[timeRange] || conditions.month;
}

/**
 * 执行查询
 */
function executeQuery(db, queryInfo, companyId) {
  const { type, timeRange } = queryInfo;
  const timeCondition = getTimeCondition(timeRange);

  switch (type) {
    case 'sales':
      return getSalesData(db, companyId, timeCondition);
    case 'profit':
      return getProfitData(db, companyId, timeCondition);
    case 'receivables':
      return getReceivablesData(db, companyId);
    case 'inventory':
      return getInventoryData(db, companyId);
    case 'topCustomers':
      return getTopCustomersData(db, companyId, timeCondition);
    case 'expenses':
      return getExpensesData(db, companyId, timeCondition);
    case 'orders':
      return getOrdersData(db, companyId, timeCondition);
    default:
      return { type: 'unknown', message: '无法识别的问题类型' };
  }
}

function getSalesData(db, companyId, timeCondition) {
  const result = db.prepare(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(total_amount), 0) as total
    FROM orders
    WHERE company_id = ? AND ${timeCondition}
  `).get(companyId);

  const byCustomer = db.prepare(`
    SELECT
      COALESCE(p.name, '未知客户') as customer_name,
      COUNT(*) as order_count,
      SUM(o.total_amount) as amount
    FROM orders o
    LEFT JOIN partners p ON o.partner_id = p.id
    WHERE o.company_id = ? AND ${timeCondition}
    GROUP BY o.partner_id
    ORDER BY amount DESC
    LIMIT 5
  `).all(companyId);

  return {
    type: 'sales',
    total: result.total || 0,
    count: result.count || 0,
    breakdown: byCustomer
  };
}

function getProfitData(db, companyId, timeCondition) {
  const revenue = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total
    FROM orders WHERE company_id = ? AND ${timeCondition}
  `).get(companyId);

  const cost = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE company_id = ? AND type = 'expense' AND ${timeCondition}
  `).get(companyId);

  const profit = (revenue.total || 0) - (cost.total || 0);
  const margin = revenue.total > 0 ? ((profit / revenue.total) * 100).toFixed(1) : 0;

  return {
    type: 'profit',
    revenue: revenue.total || 0,
    cost: cost.total || 0,
    profit,
    margin: `${margin}%`
  };
}

function getReceivablesData(db, companyId) {
  const result = db.prepare(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as total,
      COALESCE(SUM(CASE WHEN due_date < date('now') THEN amount ELSE 0 END), 0) as overdue
    FROM receivables_payables
    WHERE company_id = ? AND type = 'receivable' AND status != 'paid'
  `).get(companyId);

  return {
    type: 'receivables',
    total: result.total || 0,
    count: result.count || 0,
    overdue: result.overdue || 0
  };
}

function getInventoryData(db, companyId) {
  const result = db.prepare(`
    SELECT
      COUNT(DISTINCT product_id) as product_count,
      COALESCE(SUM(quantity), 0) as total_quantity
    FROM inventory
    WHERE company_id = ?
  `).get(companyId);

  const lowStock = db.prepare(`
    SELECT p.name, p.sku, i.quantity, p.min_stock
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    WHERE i.company_id = ? AND i.quantity <= p.min_stock
    ORDER BY i.quantity ASC
    LIMIT 10
  `).all(companyId);

  return {
    type: 'inventory',
    productCount: result.product_count || 0,
    totalQuantity: result.total_quantity || 0,
    lowStockProducts: lowStock
  };
}

function getTopCustomersData(db, companyId, timeCondition) {
  const topCustomers = db.prepare(`
    SELECT
      p.name as customer_name,
      COUNT(o.id) as order_count,
      SUM(o.total_amount) as total_amount
    FROM orders o
    JOIN partners p ON o.partner_id = p.id
    WHERE o.company_id = ? AND ${timeCondition}
    GROUP BY o.partner_id
    ORDER BY total_amount DESC
    LIMIT 5
  `).all(companyId);

  return {
    type: 'topCustomers',
    customers: topCustomers
  };
}

function getExpensesData(db, companyId, timeCondition) {
  const result = db.prepare(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE company_id = ? AND type = 'expense' AND ${timeCondition}
  `).get(companyId);

  const byCategory = db.prepare(`
    SELECT
      COALESCE(category, '其他') as category,
      SUM(amount) as total
    FROM transactions
    WHERE company_id = ? AND type = 'expense' AND ${timeCondition}
    GROUP BY category
    ORDER BY total DESC
    LIMIT 5
  `).all(companyId);

  return {
    type: 'expenses',
    total: result.total || 0,
    count: result.count || 0,
    breakdown: byCategory
  };
}

function getOrdersData(db, companyId, timeCondition) {
  const result = db.prepare(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(total_amount), 0) as total_amount
    FROM orders
    WHERE company_id = ? AND ${timeCondition}
  `).get(companyId);

  const byStatus = db.prepare(`
    SELECT
      status,
      COUNT(*) as count,
      SUM(total_amount) as total
    FROM orders
    WHERE company_id = ? AND ${timeCondition}
    GROUP BY status
  `).all(companyId);

  return {
    type: 'orders',
    count: result.count || 0,
    totalAmount: result.total_amount || 0,
    byStatus
  };
}

/**
 * 生成自然语言回答
 */
function generateAnswer(question, queryInfo, data) {
  const timeNames = {
    today: '今天',
    yesterday: '昨天',
    week: '本周',
    month: '本月',
    lastMonth: '上月',
    quarter: '本季度',
    year: '今年'
  };

  const timeName = timeNames[queryInfo.timeRange] || '本月';

  switch (data.type) {
    case 'sales':
      return `${timeName}销售额为 ${(data.total || 0).toLocaleString()} 元，共 ${(data.count || 0)} 笔订单。`;
    case 'profit':
      return `${timeName}收入 ${(data.revenue || 0).toLocaleString()} 元，支出 ${(data.cost || 0).toLocaleString()} 元，净利润 ${(data.profit || 0).toLocaleString()} 元，利润率 ${data.margin}。`;
    case 'receivables':
      return `当前应收账款共 ${(data.total || 0).toLocaleString()} 元，${data.count} 笔待收，其中逾期 ${(data.overdue || 0).toLocaleString()} 元。`;
    case 'inventory':
      return `当前库存 ${(data.totalQuantity || 0)} 件，涉及 ${data.productCount} 种商品。${data.lowStockProducts.length > 0 ? `有 ${data.lowStockProducts.length} 种商品库存不足。` : ''}`;
    case 'topCustomers':
      if (data.customers.length === 0) {
        return `${timeName}暂无客户订单数据。`;
      }
      return `${timeName}最赚钱的客户是「${data.customers[0].customer_name}」，销售额 ${(data.customers[0].total_amount || 0).toLocaleString()} 元。`;
    case 'expenses':
      return `${timeName}支出共 ${(data.total || 0).toLocaleString()} 元，${data.count} 笔。`;
    case 'orders':
      return `${timeName}共 ${(data.count || 0)} 笔订单，总金额 ${(data.totalAmount || 0).toLocaleString()} 元。`;
    default:
      return '抱歉，我无法理解您的问题。请尝试询问销售额、利润、应收账款或库存情况。';
  }
}

/**
 * @route   POST /api/ai-query
 * @desc    自然语言查询
 */
router.post('/',
  asyncHandler(async (req, res) => {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        message: '请提供问题'
      });
    }

    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 解析问题
    const queryInfo = parseQuestion(question);

    // 执行查询
    const data = executeQuery(db, queryInfo, companyId);

    // 生成回答
    const answer = generateAnswer(question, queryInfo, data);

    res.json({
      success: true,
      question,
      answer,
      data,
      queryInfo,
      chart: data.type === 'topCustomers' || data.type === 'sales' ? 'bar' :
             data.type === 'profit' || data.type === 'expenses' ? 'pie' : 'number'
    });
  })
);

module.exports = router;