/**
 * AI数据分析服务 - 大数据处理、推荐、预测
 */

const aiGateway = require('./ai-gateway');
const { getDatabaseCompat } = require('../database');
const dayjs = require('dayjs');

class AIAnalyticsService {
  constructor() {
    this.db = null;
  }
  
  getDb() {
    if (!this.db) {
      this.db = getDatabaseCompat();
    }
    return this.db;
  }
  
  /**
   * 获取企业全景数据
   */
  getCompanyData(companyId, options = {}) {
    const db = this.getDb();
    const { startDate, endDate } = options;
    
    // 交易数据
    const transactions = db.prepare(`
      SELECT * FROM transactions 
      WHERE company_id = ? 
      ${startDate ? 'AND transaction_date >= ?' : ''}
      ${endDate ? 'AND transaction_date <= ?' : ''}
      ORDER BY transaction_date DESC
      LIMIT 1000
    `).all(companyId, ...[startDate, endDate].filter(Boolean));
    
    // 客户数据
    const customers = db.prepare(`
      SELECT c.* FROM customers c
      WHERE c.company_id = ?
    `).all(companyId);
    
    // 商品数据
    const products = db.prepare(`
      SELECT * FROM products WHERE company_id = ?
    `).all(companyId);
    
    // 库存数据
    let inventory = [];
    try {
      inventory = db.prepare(`
        SELECT p.*, 
          COALESCE(i.quantity, 0) as stock_quantity
        FROM products p
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE p.company_id = ?
      `).all(companyId);
    } catch (e) {
      inventory = products;
    }
    
    // 应收应付
    let receivables = [];
    let payables = [];
    try {
      receivables = db.prepare(`
        SELECT * FROM receivables_payables 
        WHERE company_id = ? AND type = 'receivable' AND status != 'paid'
      `).all(companyId);
      
      payables = db.prepare(`
        SELECT * FROM receivables_payables 
        WHERE company_id = ? AND type = 'payable' AND status != 'paid'
      `).all(companyId);
    } catch (e) {
      // 表不存在时忽略
    }
    
    // 发票数据
    const invoices = db.prepare(`
      SELECT * FROM invoices 
      WHERE company_id = ?
      ORDER BY issue_date DESC
      LIMIT 100
    `).all(companyId);
    
    return {
      transactions,
      customers,
      inventory,
      receivables,
      payables,
      invoices,
      summary: {
        totalTransactions: transactions.length,
        totalCustomers: customers.length,
        totalProducts: inventory.length || products.length,
        totalReceivables: receivables.reduce((sum, r) => sum + (r.amount || 0), 0),
        totalPayables: payables.reduce((sum, p) => sum + (p.amount || 0), 0)
      }
    };
  }
  
  /**
   * 智能财务分析报告
   */
  async generateFinancialReport(companyId, period = 'month') {
    const data = this.getCompanyData(companyId);
    
    // 计算财务指标
    const metrics = this.calculateMetrics(data);
    
    // AI分析
    const analysis = await aiGateway.analyzeData({
      period,
      metrics,
      transactions: data.transactions.slice(0, 50),
      summary: data.summary
    }, 'summary');
    
    return {
      period,
      generatedAt: new Date().toISOString(),
      metrics,
      analysis: analysis.success ? analysis.content : null,
      recommendations: await this.generateRecommendations(companyId)
    };
  }
  
  /**
   * 计算财务指标
   */
  calculateMetrics(data) {
    const { transactions, receivables, payables } = data;
    
    // 收入支出分析
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    // 按类别分组
    const byCategory = {};
    transactions.forEach(t => {
      const cat = t.category || '其他';
      byCategory[cat] = (byCategory[cat] || 0) + (t.amount || 0);
    });
    
    // 按日期分组
    const byDate = {};
    transactions.forEach(t => {
      const date = t.transaction_date;
      byDate[date] = byDate[date] || { income: 0, expense: 0 };
      if (t.type === 'income') byDate[date].income += t.amount || 0;
      else byDate[date].expense += t.amount || 0;
    });
    
    return {
      totalIncome: income,
      totalExpense: expense,
      netProfit: income - expense,
      profitMargin: income > 0 ? ((income - expense) / income * 100).toFixed(2) : 0,
      totalReceivables: data.summary.totalReceivables,
      totalPayables: data.summary.totalPayables,
      byCategory,
      byDate,
      transactionCount: transactions.length
    };
  }
  
  /**
   * 现金流预测
   */
  async predictCashFlow(companyId, days = 30) {
    const data = this.getCompanyData(companyId);
    
    // 获取历史现金流数据
    const historicalData = this.getHistoricalCashFlow(companyId, 90);
    
    // AI预测
    const prediction = await aiGateway.predictCashFlow(historicalData);
    
    return {
      days,
      historical: historicalData,
      prediction: prediction.success ? JSON.parse(prediction.content) : null,
      generatedAt: new Date().toISOString()
    };
  }
  
  /**
   * 获取历史现金流
   */
  getHistoricalCashFlow(companyId, days = 90) {
    const db = this.getDb();
    const startDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD');
    
    return db.prepare(`
      SELECT 
        transaction_date as date,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as inflow,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as outflow,
        SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as net
      FROM transactions
      WHERE company_id = ? AND transaction_date >= ?
      GROUP BY transaction_date
      ORDER BY transaction_date
    `).all(companyId, startDate);
  }
  
  /**
   * 智能推荐
   */
  async generateRecommendations(companyId) {
    const data = this.getCompanyData(companyId);
    
    const result = await aiGateway.getRecommendations({
      transactions: data.transactions.slice(0, 20),
      inventory: data.inventory,
      customers: data.customers,
      pendingPayments: [...data.receivables, ...data.payables]
    });
    
    if (result.success) {
      try {
        return JSON.parse(result.content);
      } catch {
        return [{ type: 'general', content: result.content }];
      }
    }
    return [];
  }
  
  /**
   * 异常交易检测
   */
  async detectAnomalies(companyId) {
    const data = this.getCompanyData(companyId);
    
    if (data.transactions.length < 10) {
      return { anomalies: [], message: '数据不足，需要至少10条交易记录' };
    }
    
    const result = await aiGateway.detectAnomalies(data.transactions);
    
    return {
      companyId,
      scanAt: new Date().toISOString(),
      result: result.success ? JSON.parse(result.content) : null
    };
  }
  
  /**
   * 客户信用评估
   */
  async evaluateCustomer(companyId, customerId) {
    const db = this.getDb();
    
    // 获取客户数据
    const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND company_id = ?')
      .get(customerId, companyId);
    
    if (!customer) {
      return { error: '客户不存在' };
    }
    
    // 获取客户订单历史
    const orders = db.prepare(`
      SELECT * FROM sales_orders 
      WHERE customer_id = ? 
      ORDER BY order_date DESC
      LIMIT 50
    `).all(customerId);
    
    // 获取付款记录
    const payments = db.prepare(`
      SELECT * FROM receivables 
      WHERE customer_id = ?
    `).all(customerId);
    
    const result = await aiGateway.evaluateCustomerCredit({
      customer,
      orders,
      payments,
      totalOrders: orders.length,
      totalAmount: orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
    });
    
    return {
      customerId,
      customerName: customer.name,
      evaluatedAt: new Date().toISOString(),
      evaluation: result.success ? JSON.parse(result.content) : null
    };
  }
  
  /**
   * 智能分类建议
   */
  async suggestCategory(description, amount) {
    const result = await aiGateway.chat([
      {
        role: 'system',
        content: `你是财务分类专家。根据描述和金额，建议合适的会计分类。
返回JSON: { "category": "分类", "account": "科目", "confidence": 置信度(0-1) }
可选分类：办公费用、差旅费、餐饮费、交通费、通讯费、采购支出、工资支出、租金、水电费、其他`
      },
      { role: 'user', content: `描述：${description}，金额：${amount}` }
    ], { maxTokens: 200 });
    
    if (result.success) {
      try {
        return JSON.parse(result.content);
      } catch {
        return { category: '其他', confidence: 0.5 };
      }
    }
    return { category: '其他', confidence: 0.5 };
  }
  
  /**
   * 智能搜索
   */
  async smartSearch(companyId, query) {
    const data = this.getCompanyData(companyId);
    
    // AI理解查询意图
    const intentResult = await aiGateway.chat([
      {
        role: 'system',
        content: `分析用户查询意图，返回JSON：
{
  "type": "transaction|customer|product|invoice|report",
  "filters": { "field": "value" },
  "dateRange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "sortBy": "field",
  "limit": number
}`
      },
      { role: 'user', content: query }
    ], { maxTokens: 300 });
    
    let intent;
    if (intentResult.success) {
      try {
        intent = JSON.parse(intentResult.content);
      } catch {
        intent = { type: 'transaction' };
      }
    }
    
    // 根据意图搜索数据
    // ... 实现搜索逻辑
    
    return {
      query,
      intent,
      results: data.transactions.slice(0, 10),
      answer: `找到 ${data.transactions.length} 条相关记录`
    };
  }
}

// 单例
const aiAnalytics = new AIAnalyticsService();
module.exports = aiAnalytics;
