/**
 * OpenClaw 集成服务（已解耦）
 * 提供 AI 能力的深度集成
 * 已移除对 OpenClaw 的依赖，改为调用本地 caiwu-ai 服务
 */

const path = require('path');

// 本地 AI 服务配置
const AI_SERVICE_CONFIG = {
  // AI 服务地址
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:3001',

  // 超时设置
  timeout: parseInt(process.env.AI_SERVICE_TIMEOUT) || 30000,

  // 是否启用 AI 功能
  enabled: process.env.AI_SERVICE_ENABLED !== 'false'
};

/**
 * OpenClaw AI 服务
 */
class OpenClawService {
  constructor() {
    this.config = AI_SERVICE_CONFIG;
    this.initialized = false;
    this.db = null;
  }

  /**
   * 设置数据库连接
   */
  setDatabase(db) {
    this.db = db;
  }

  /**
   * 初始化服务
   * 检查本地 AI 服务是否可用
   */
  async init() {
    if (this.initialized) return;

    try {
      const response = await fetch(`${this.config.aiServiceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        console.log('✅ caiwu-ai service connected');
        this.initialized = true;
      }
    } catch (error) {
      console.warn('⚠️ caiwu-ai service not available, AI features will use local processing');
      this.initialized = false;
    }
  }

  /**
   * 自然语言查询
   */
  async query(question, context = {}) {
    return this.intelligentQuery(question, context);
  }

  /**
   * 智能查询 - 解析意图并查询数据
   */
  intelligentQuery(question, context) {
    const { companyId } = context;
    
    // 意图识别
    const intents = this.detectIntent(question);
    
    if (intents.length === 0) {
      return {
        success: false,
        answer: '抱歉，我不太理解您的问题。您可以问我：\n• 有多少客户？\n• 库存情况如何？\n• 本月销售额是多少？\n• 经营概况',
        fallback: true
      };
    }

    // 执行查询并生成答案
    const results = [];
    
    for (const intent of intents) {
      const result = this.executeQuery(intent, companyId);
      if (result) {
        results.push(result);
      }
    }

    if (results.length === 0) {
      return {
        success: true,
        answer: '查询完成，暂无相关数据。',
        data: null
      };
    }

    // 生成自然语言回答
    const answer = this.generateAnswer(results, question);
    
    return {
      success: true,
      answer,
      data: results,
      fallback: false
    };
  }

  /**
   * 意图检测
   */
  detectIntent(question) {
    const intents = [];
    const q = question.toLowerCase();

    // 客户相关
    if (q.includes('客户') || q.includes('顾客')) {
      if (q.includes('多少') || q.includes('数量') || q.includes('几个')) {
        intents.push({ type: 'customer_count' });
      }
      if (q.includes('列表') || q.includes('都有')) {
        intents.push({ type: 'customer_list' });
      }
    }

    // 供应商相关
    if (q.includes('供应商') || q.includes('供货商')) {
      intents.push({ type: 'supplier_count' });
    }

    // 商品/库存相关
    if (q.includes('商品') || q.includes('产品') || q.includes('库存')) {
      if (q.includes('多少') || q.includes('数量')) {
        intents.push({ type: 'product_count' });
      }
      if (q.includes('库存') || q.includes('库存量')) {
        intents.push({ type: 'inventory_status' });
      }
      if (q.includes('预警') || q.includes('不足') || q.includes('缺货')) {
        intents.push({ type: 'inventory_warning' });
      }
    }

    // 销售相关
    if (q.includes('销售') || q.includes('订单') || q.includes('卖')) {
      if (q.includes('多少') || q.includes('金额') || q.includes('总额')) {
        intents.push({ type: 'sales_amount' });
      }
      if (q.includes('订单') && (q.includes('多少') || q.includes('数量'))) {
        intents.push({ type: 'order_count' });
      }
    }

    // 采购相关
    if (q.includes('采购') || q.includes('进货')) {
      intents.push({ type: 'purchase_status' });
    }

    // 财务相关
    if (q.includes('利润') || q.includes('盈利')) {
      intents.push({ type: 'profit' });
    }
    if (q.includes('应收') || q.includes('欠款')) {
      intents.push({ type: 'receivables' });
    }
    if (q.includes('应付')) {
      intents.push({ type: 'payables' });
    }

    // 综合查询
    if (q.includes('概况') || q.includes('概览') || q.includes('情况') || q.includes('怎么样')) {
      intents.push({ type: 'overview' });
    }

    return intents;
  }

  /**
   * 执行查询
   */
  executeQuery(intent, companyId) {
    if (!this.db) return null;

    try {
      switch (intent.type) {
        case 'customer_count':
          const customers = this.db.prepare(`
            SELECT COUNT(*) as count FROM customers WHERE company_id = ? AND status = 'active'
          `).get(companyId);
          return { type: 'customer_count', label: '客户数量', value: customers?.count || 0, unit: '个' };

        case 'customer_list':
          const customerList = this.db.prepare(`
            SELECT name, level, industry FROM customers WHERE company_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 10
          `).all(companyId);
          return { type: 'customer_list', label: '客户列表', value: customerList };

        case 'supplier_count':
          const suppliers = this.db.prepare(`
            SELECT COUNT(*) as count FROM suppliers WHERE company_id = ? AND status = 'active'
          `).get(companyId);
          return { type: 'supplier_count', label: '供应商数量', value: suppliers?.count || 0, unit: '个' };

        case 'product_count':
          const products = this.db.prepare(`
            SELECT COUNT(*) as count FROM products WHERE company_id = ? AND status = 'active'
          `).get(companyId);
          return { type: 'product_count', label: '商品数量', value: products?.count || 0, unit: '个' };

        case 'inventory_status':
          const inventory = this.db.prepare(`
            SELECT p.name, p.sku, COALESCE(SUM(i.qty), 0) as stock, p.min_stock
            FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id
            WHERE p.company_id = ? AND p.status = 'active'
            GROUP BY p.id
            ORDER BY stock ASC
            LIMIT 10
          `).all(companyId);
          return { type: 'inventory_status', label: '库存情况', value: inventory };

        case 'inventory_warning':
          const warnings = this.db.prepare(`
            SELECT p.name, p.sku, COALESCE(SUM(i.qty), 0) as stock, p.min_stock
            FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id
            WHERE p.company_id = ? AND p.status = 'active'
            GROUP BY p.id
            HAVING stock <= p.min_stock
          `).all(companyId);
          return { type: 'inventory_warning', label: '库存预警', value: warnings };

        case 'sales_amount':
          const sales = this.db.prepare(`
            SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count
            FROM orders WHERE company_id = ? AND status != 'cancelled'
          `).get(companyId);
          return { type: 'sales_amount', label: '销售总额', value: sales?.total || 0, unit: '元', count: sales?.count || 0 };

        case 'order_count':
          const orders = this.db.prepare(`
            SELECT COUNT(*) as count FROM orders WHERE company_id = ? AND status != 'cancelled'
          `).get(companyId);
          return { type: 'order_count', label: '订单数量', value: orders?.count || 0, unit: '个' };

        case 'profit':
          const profit = this.db.prepare(`
            SELECT 
              (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE company_id = ?) as revenue,
              (SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE company_id = ?) as cost
          `).get(companyId, companyId);
          const profitValue = (profit?.revenue || 0) - (profit?.cost || 0);
          return { 
            type: 'profit', 
            label: '利润', 
            value: profitValue, 
            unit: '元',
            revenue: profit?.revenue || 0,
            cost: profit?.cost || 0
          };

        case 'receivables':
          const receivables = this.db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total FROM receivables_payables
            WHERE company_id = ? AND type = 'receivable' AND status != 'paid'
          `).get(companyId);
          return { type: 'receivables', label: '应收账款', value: receivables?.total || 0, unit: '元' };

        case 'payables':
          const payables = this.db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total FROM receivables_payables
            WHERE company_id = ? AND type = 'payable' AND status != 'paid'
          `).get(companyId);
          return { type: 'payables', label: '应付账款', value: payables?.total || 0, unit: '元' };

        case 'overview':
          const overview = this.db.prepare(`
            SELECT 
              (SELECT COUNT(*) FROM customers WHERE company_id = ? AND status = 'active') as customers,
              (SELECT COUNT(*) FROM products WHERE company_id = ? AND status = 'active') as products,
              (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE company_id = ?) as sales,
              (SELECT COALESCE(SUM(amount), 0) FROM receivables_payables WHERE company_id = ? AND type = 'receivable' AND status != 'paid') as receivables
          `).get(companyId, companyId, companyId, companyId);
          return { type: 'overview', label: '经营概况', value: overview };

        default:
          return null;
      }
    } catch (error) {
      console.error('Query error:', error);
      return null;
    }
  }

  /**
   * 生成自然语言回答
   */
  generateAnswer(results, question) {
    if (results.length === 1) {
      const r = results[0];
      
      switch (r.type) {
        case 'customer_count':
          return `📊 您目前共有 **${r.value} 个客户**。`;
        
        case 'customer_list':
          if (!r.value || r.value.length === 0) return '暂无客户数据。';
          const customerNames = r.value.map(c => `- ${c.name}（${c.level || '普通'}级）`).join('\n');
          return `📋 客户列表：\n${customerNames}`;
        
        case 'supplier_count':
          return `📊 您目前共有 **${r.value} 个供应商**。`;
        
        case 'product_count':
          return `📊 您目前共有 **${r.value} 种商品**。`;
        
        case 'inventory_status':
          if (!r.value || r.value.length === 0) return '暂无库存数据。';
          const inventoryList = r.value.map(i => `- ${i.name}：${i.stock} ${i.min_stock ? `(预警线: ${i.min_stock})` : ''}`).join('\n');
          return `📦 库存情况：\n${inventoryList}`;
        
        case 'inventory_warning':
          if (!r.value || r.value.length === 0) return '✅ 目前没有库存预警，所有商品库存充足。';
          const warningList = r.value.map(w => `⚠️ ${w.name}：当前 ${w.stock}，预警线 ${w.min_stock}`).join('\n');
          return `⚠️ 库存预警：\n${warningList}\n\n建议尽快补货。`;
        
        case 'sales_amount':
          return `💰 销售总额：**${r.value.toLocaleString()} 元**，共 ${r.count} 笔订单。`;
        
        case 'order_count':
          return `📊 您目前共有 **${r.value} 个订单**。`;
        
        case 'profit':
          return `💰 利润情况：\n- 收入：${r.revenue.toLocaleString()} 元\n- 成本：${r.cost.toLocaleString()} 元\n- **利润：${r.value.toLocaleString()} 元**`;
        
        case 'receivables':
          return `💵 应收账款：**${r.value.toLocaleString()} 元**`;
        
        case 'payables':
          return `💵 应付账款：**${r.value.toLocaleString()} 元**`;
        
        case 'overview':
          const o = r.value || {};
          return `📊 经营概况：\n- 客户数：${o.customers || 0} 个\n- 商品种类：${o.products || 0} 种\n- 销售总额：${(o.sales || 0).toLocaleString()} 元\n- 应收账款：${(o.receivables || 0).toLocaleString()} 元`;
        
        default:
          return `查询结果：${JSON.stringify(r.value)}`;
      }
    }

    // 多个结果
    const parts = results.map(r => {
      if (r.unit) {
        return `${r.label}：${r.value} ${r.unit}`;
      }
      return `${r.label}：查询完成`;
    });
    
    return `📊 查询结果：\n${parts.join('\n')}`;
  }

  /**
   * 检查服务状态
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.config.aiServiceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        aiServiceUrl: this.config.aiServiceUrl
      };
    } catch (error) {
      return {
        status: 'unavailable',
        aiServiceUrl: this.config.aiServiceUrl,
        error: error.message
      };
    }
  }
}

// 导出单例
const openclawService = new OpenClawService();

module.exports = {
  OpenClawService,
  openclawService,
  AI_SERVICE_CONFIG
};