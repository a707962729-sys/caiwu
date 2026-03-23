/**
 * AI数据分析路由 - 大数据处理、推荐、预测
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const aiAnalytics = require('../services/ai-analytics');
const aiGateway = require('../services/ai-gateway');

router.use(authMiddleware);

/**
 * @route   GET /api/ai-analytics/dashboard
 * @desc    AI驱动的仪表盘数据
 */
router.get('/dashboard',
  asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    
    // 获取基础数据
    const report = await aiAnalytics.generateFinancialReport(companyId);
    
    res.json({
      success: true,
      data: report
    });
  })
);

/**
 * @route   GET /api/ai-analytics/report
 * @desc    生成财务分析报告
 */
router.get('/report',
  asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { period = 'month' } = req.query;
    
    const report = await aiAnalytics.generateFinancialReport(companyId, period);
    
    res.json({
      success: true,
      data: report
    });
  })
);

/**
 * @route   GET /api/ai-analytics/cashflow/prediction
 * @desc    现金流预测
 */
router.get('/cashflow/prediction',
  asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { days = 30 } = req.query;
    
    const prediction = await aiAnalytics.predictCashFlow(companyId, parseInt(days));
    
    res.json({
      success: true,
      data: prediction
    });
  })
);

/**
 * @route   GET /api/ai-analytics/recommendations
 * @desc    智能推荐
 */
router.get('/recommendations',
  asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    
    const recommendations = await aiAnalytics.generateRecommendations(companyId);
    
    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        recommendations
      }
    });
  })
);

/**
 * @route   GET /api/ai-analytics/anomalies
 * @desc    异常交易检测
 */
router.get('/anomalies',
  permissionMiddleware('reports', 'read'),
  asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    
    const result = await aiAnalytics.detectAnomalies(companyId);
    
    res.json({
      success: true,
      data: result
    });
  })
);

/**
 * @route   GET /api/ai-analytics/customer/:customerId/credit
 * @desc    客户信用评估
 */
router.get('/customer/:customerId/credit',
  asyncHandler(async (req, res) => {
    const { customerId } = req.params;
    const companyId = req.user.companyId;
    
    const evaluation = await aiAnalytics.evaluateCustomer(companyId, customerId);
    
    res.json({
      success: true,
      data: evaluation
    });
  })
);

/**
 * @route   POST /api/ai-analytics/category/suggest
 * @desc    智能分类建议
 */
router.post('/category/suggest',
  asyncHandler(async (req, res) => {
    const { description, amount } = req.body;
    
    const suggestion = await aiAnalytics.suggestCategory(description, amount);
    
    res.json({
      success: true,
      data: suggestion
    });
  })
);

/**
 * @route   POST /api/ai-analytics/search
 * @desc    智能搜索
 */
router.post('/search',
  asyncHandler(async (req, res) => {
    const { query } = req.body;
    const companyId = req.user.companyId;
    
    const results = await aiAnalytics.smartSearch(companyId, query);
    
    res.json({
      success: true,
      data: results
    });
  })
);

/**
 * @route   POST /api/ai-analytics/chat
 * @desc    AI对话（财务助手）
 */
router.post('/chat',
  asyncHandler(async (req, res) => {
    const { message, context } = req.body;
    const companyId = req.user.companyId;
    
    // 获取上下文数据
    const companyData = aiAnalytics.getCompanyData(companyId);
    
    // 构建系统提示
    const systemPrompt = `你是财务管家AI助手，帮助企业管理财务。
当前企业数据概览：
- 总收入: ¥${companyData.summary.totalReceivables || 0}
- 总支出: ¥${companyData.summary.totalPayables || 0}
- 客户数: ${companyData.summary.totalCustomers}
- 商品数: ${companyData.summary.totalProducts}

请根据用户问题提供专业的财务建议。`;

    const result = await aiGateway.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ]);
    
    res.json({
      success: true,
      data: {
        response: result.content,
        model: result.model
      }
    });
  })
);

/**
 * @route   GET /api/ai-analytics/overview
 * @desc    AI数据概览
 */
router.get('/overview',
  asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const data = aiAnalytics.getCompanyData(companyId);
    
    res.json({
      success: true,
      data: {
        summary: data.summary,
        recentTransactions: data.transactions.slice(0, 5),
        topCustomers: data.customers.slice(0, 5),
        lowStock: data.inventory.filter(i => i.stock_quantity < 10).slice(0, 5),
        pendingReceivables: data.receivables.slice(0, 5),
        pendingPayables: data.payables.slice(0, 5)
      }
    });
  })
);

module.exports = router;
