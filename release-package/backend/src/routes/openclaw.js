/**
 * OpenClaw 深度集成 API
 * 提供 AI 能力的完整接口
 */

const express = require('express');
const router = express.Router();
const { openclawService } = require('../services/openclaw');
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

router.use(authMiddleware);

/**
 * @route   POST /api/openclaw/query
 * @desc    自然语言查询（深度集成）
 */
router.post('/query',
  permissionMiddleware('reports', 'read'),
  asyncHandler(async (req, res) => {
    const { question } = req.body;
    const db = getDatabaseCompat();
    
    // 设置数据库连接
    openclawService.setDatabase(db);
    
    const context = {
      companyId: req.user.companyId,
      userId: req.user.id,
      roleName: req.user.roleName
    };

    const result = await openclawService.query(question, context);

    res.json({
      success: result.success,
      question,
      answer: result.answer,
      data: result.data || null,
      fallback: result.fallback || false
    });
  })
);

/**
 * @route   POST /api/openclaw/analyze
 * @desc    智能分析
 */
router.post('/analyze',
  permissionMiddleware('reports', 'read'),
  asyncHandler(async (req, res) => {
    const { type } = req.body; // sales, inventory, customer, financial
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 根据类型获取数据
    let data = {};
    
    switch (type) {
      case 'sales':
        data.orders = db.prepare(`
          SELECT date(created_at) as date, SUM(total_amount) as amount, COUNT(*) as count
          FROM orders WHERE company_id = ? AND created_at >= date('now', '-30 days')
          GROUP BY date(created_at) ORDER BY date
        `).all(companyId);
        break;
        
      case 'inventory':
        data.products = db.prepare(`
          SELECT p.name, p.sku, COALESCE(SUM(i.qty), 0) as stock, p.min_stock
          FROM products p LEFT JOIN inventory i ON p.id = i.product_id
          WHERE p.company_id = ? AND p.status = 'active'
          GROUP BY p.id
        `).all(companyId);
        break;
        
      case 'customer':
        data.customers = db.prepare(`
          SELECT c.name, c.level, COUNT(o.id) as order_count, SUM(o.total_amount) as total_amount
          FROM customers c LEFT JOIN orders o ON c.id = o.partner_id
          WHERE c.company_id = ?
          GROUP BY c.id
          ORDER BY total_amount DESC
          LIMIT 20
        `).all(companyId);
        break;
        
      case 'financial':
        data.revenue = db.prepare(`
          SELECT SUM(total_amount) as total FROM orders
          WHERE company_id = ? AND created_at >= date('now', '-30 days')
        `).get(companyId);
        data.expenses = db.prepare(`
          SELECT SUM(amount) as total FROM transactions
          WHERE company_id = ? AND transaction_type = 'expense' AND transaction_date >= date('now', '-30 days')
        `).get(companyId);
        data.receivables = db.prepare(`
          SELECT SUM(amount) as total FROM receivables_payables
          WHERE company_id = ? AND type = 'receivable' AND status != 'paid'
        `).get(companyId);
        break;
    }

    const result = await openclawService.analyze(type, data);

    res.json({
      success: result.success,
      type,
      analysis: result.analysis || result.message,
      recommendations: result.recommendations || []
    });
  })
);

/**
 * @route   POST /api/openclaw/report
 * @desc    生成智能报告
 */
router.post('/report',
  permissionMiddleware('reports', 'read'),
  asyncHandler(async (req, res) => {
    const { type, startDate, endDate } = req.body;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 收集报告数据
    const data = {
      period: { startDate, endDate },
      summary: {},
      details: {}
    };

    // 销售汇总
    data.summary.sales = db.prepare(`
      SELECT COUNT(*) as count, SUM(total_amount) as total
      FROM orders WHERE company_id = ? AND date(created_at) BETWEEN ? AND ?
    `).get(companyId, startDate || '2000-01-01', endDate || '2099-12-31');

    // 采购汇总
    data.summary.purchase = db.prepare(`
      SELECT COUNT(*) as count, SUM(total_amount) as total
      FROM purchase_orders WHERE company_id = ? AND date(created_at) BETWEEN ? AND ?
    `).get(companyId, startDate || '2000-01-01', endDate || '2099-12-31');

    // 应收汇总
    data.summary.receivables = db.prepare(`
      SELECT COUNT(*) as count, SUM(amount) as total,
        SUM(CASE WHEN due_date < date('now') THEN amount ELSE 0 END) as overdue
      FROM receivables_payables
      WHERE company_id = ? AND type = 'receivable' AND status != 'paid'
    `).get(companyId);

    const result = await openclawService.generateReport(type || 'daily', data);

    res.json({
      success: result.success,
      report: result.report || data,
      format: 'markdown'
    });
  })
);

/**
 * @route   POST /api/openclaw/recommend
 * @desc    智能推荐
 */
router.post('/recommend',
  permissionMiddleware('reports', 'read'),
  asyncHandler(async (req, res) => {
    const { scene } = req.body; // restock, pricing, followup, payment
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    let context = {};

    switch (scene) {
      case 'restock':
        // 补货推荐
        context.lowStock = db.prepare(`
          SELECT p.id, p.name, p.sku, COALESCE(SUM(i.qty), 0) as stock, p.min_stock
          FROM products p LEFT JOIN inventory i ON p.id = i.product_id
          WHERE p.company_id = ? AND p.status = 'active'
          GROUP BY p.id
          HAVING qty <= p.min_stock
        `).all(companyId);
        break;
        
      case 'followup':
        // 跟进推荐
        context.dueToday = db.prepare(`
          SELECT fr.*, c.name as customer_name
          FROM follow_records fr
          JOIN customers c ON fr.customer_id = c.id
          WHERE c.company_id = ? AND date(fr.next_date) = date('now')
        `).all(companyId);
        break;
        
      case 'payment':
        // 付款提醒
        context.overdue = db.prepare(`
          SELECT rp.*, p.name as partner_name
          FROM receivables_payables rp
          JOIN partners p ON rp.partner_id = p.id
          WHERE rp.company_id = ? AND rp.type = 'payable' 
            AND rp.status != 'paid' AND rp.due_date <= date('now', '+7 days')
        `).all(companyId);
        break;
    }

    const result = await openclawService.recommend(scene, context);

    res.json({
      success: result.success,
      scene,
      recommendations: result.recommendations || [],
      context
    });
  })
);

/**
 * @route   GET /api/openclaw/health
 * @desc    OpenClaw 服务状态
 */
router.get('/health',
  asyncHandler(async (req, res) => {
    const health = await openclawService.healthCheck();
    res.json({
      success: true,
      openclaw: health
    });
  })
);

/**
 * @route   POST /api/openclaw/chat
 * @desc    与 AI 对话（多轮）
 */
router.post('/chat',
  permissionMiddleware('reports', 'read'),
  asyncHandler(async (req, res) => {
    const { message, history = [] } = req.body;
    const context = {
      companyId: req.user.companyId,
      userId: req.user.id
    };

    // 简单的对话处理
    const result = await openclawService.query(message, context);

    res.json({
      success: result.success,
      message: result.answer,
      fallback: result.fallback || false
    });
  })
);

module.exports = router;