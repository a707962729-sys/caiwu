/**
 * AI Gateway服务 - 连接OpenClaw
 */

const axios = require('axios');
const AI_CONFIG = require('../config/ai');

class AIGatewayService {
  constructor() {
    this.baseUrl = AI_CONFIG.gateway.baseUrl;
    this.token = AI_CONFIG.gateway.token;
    this.timeout = AI_CONFIG.gateway.timeout;
    
    // 创建axios实例
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      }
    });
  }
  
  /**
   * 通用聊天接口
   */
  async chat(messages, options = {}) {
    const model = options.model || AI_CONFIG.models.default;
    
    try {
      const response = await this.client.post('/v1/chat/completions', {
        model,
        messages,
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7,
        stream: false
      });
      
      return {
        success: true,
        content: response.data.choices[0].message.content,
        usage: response.data.usage,
        model: response.data.model
      };
    } catch (error) {
      console.error('AI Gateway Error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * 发票识别（使用视觉模型）
   */
  async recognizeInvoice(imageData) {
    // 支持 data URL 或纯 base64
    const imageUrl = imageData.startsWith('data:') 
      ? imageData 
      : `data:image/png;base64,${imageData}`;
    
    const messages = [
      {
        role: 'system',
        content: `你是一个专业的发票识别助手。请从图片中提取发票信息，返回严格的JSON格式，不要有其他文字：
{
  "invoiceCode": "发票代码",
  "invoiceNo": "发票号码",
  "type": "发票类型",
  "date": "开票日期(YYYY-MM-DD)",
  "buyer": { "name": "购买方名称", "taxNumber": "税号" },
  "seller": { "name": "销售方名称", "taxNumber": "税号" },
  "totalAmount": 金额(数字),
  "taxAmount": 税额(数字),
  "amountWithoutTax": 不含税金额(数字),
  "items": [{ "name": "商品名", "quantity": 数量, "price": 单价, "amount": 金额, "tax": 税额 }],
  "remarks": "备注"
}

注意：
1. totalAmount是价税合计（总金额）
2. taxAmount是税额
3. amountWithoutTax是不含税金额
4. 金额必须是数字，不要带单位`
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: '请识别这张发票图片，提取所有信息并返回JSON格式。确保金额字段是数字类型。' },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    ];
    
    return this.chat(messages, { model: AI_CONFIG.models.vision, maxTokens: 4000 });
  }
  
  /**
   * 智能查询 - 自然语言转SQL
   */
  async naturalLanguageToSQL(query, schema) {
    const messages = [
      {
        role: 'system',
        content: `你是一个SQL专家。根据用户的问题和数据库结构，生成合适的SQL查询语句。

数据库表结构：
${schema}

规则：
1. 只返回SQL语句，不要解释
2. 使用SQLite语法
3. 确保SQL安全，防止注入
4. 添加适当的LIMIT限制`
      },
      { role: 'user', content: query }
    ];
    
    const result = await this.chat(messages, { model: AI_CONFIG.models.coder });
    return result.success ? result.content : null;
  }
  
  /**
   * 数据分析
   */
  async analyzeData(data, analysisType) {
    const prompts = {
      summary: '请分析以下财务数据，提供摘要报告：',
      trend: '请分析以下财务数据的趋势：',
      anomaly: '请检测以下财务数据中的异常项：',
      prediction: '请基于以下历史数据预测未来趋势：',
      recommendation: '请基于以下数据提供优化建议：'
    };
    
    const messages = [
      {
        role: 'system',
        content: '你是一个专业的财务数据分析师，擅长数据分析、趋势预测和风险评估。'
      },
      {
        role: 'user',
        content: `${prompts[analysisType] || '请分析：'}\n\n${JSON.stringify(data, null, 2)}`
      }
    ];
    
    return this.chat(messages, { maxTokens: 3000 });
  }
  
  /**
   * 现金流预测
   */
  async predictCashFlow(historicalData) {
    const messages = [
      {
        role: 'system',
        content: `你是一个财务预测专家。基于历史数据预测未来现金流。
返回JSON格式：
{
  "prediction": [
    { "date": "日期", "inflow": 预计流入, "outflow": 预计流出, "balance": 预计余额 }
  ],
  "confidence": 置信度(0-1),
  "factors": ["影响因素1", "影响因素2"],
  "recommendations": ["建议1", "建议2"]
}`
      },
      {
        role: 'user',
        content: `历史数据：\n${JSON.stringify(historicalData, null, 2)}\n\n请预测未来30天的现金流。`
      }
    ];
    
    return this.chat(messages, { maxTokens: 4000 });
  }
  
  /**
   * 智能推荐
   */
  async getRecommendations(context) {
    const { transactions, inventory, customers, pendingPayments } = context;
    
    const messages = [
      {
        role: 'system',
        content: `你是一个企业财务顾问。基于数据提供智能建议：
1. 资金优化建议
2. 成本控制建议
3. 库存管理建议
4. 应收账款提醒
5. 风险预警

返回JSON数组格式。`
      },
      {
        role: 'user',
        content: `当前数据状态：
- 交易记录：${JSON.stringify(transactions?.slice(0, 10))}
- 库存状态：${JSON.stringify(inventory?.slice(0, 10))}
- 客户信息：${JSON.stringify(customers?.slice(0, 10))}
- 待付款项：${JSON.stringify(pendingPayments)}

请提供智能建议。`
      }
    ];
    
    return this.chat(messages, { maxTokens: 3000 });
  }
  
  /**
   * 异常检测
   */
  async detectAnomalies(transactions) {
    const messages = [
      {
        role: 'system',
        content: `你是一个财务风控专家。分析交易数据，识别异常：
- 异常金额
- 异常频率
- 可疑模式
- 潜在风险

返回JSON：
{
  "anomalies": [{ "id": "交易ID", "type": "异常类型", "severity": "严重程度", "reason": "原因" }],
  "riskScore": 风险评分(0-100),
  "suggestions": ["处理建议"]
}`
      },
      {
        role: 'user',
        content: `交易数据：\n${JSON.stringify(transactions, null, 2)}`
      }
    ];
    
    return this.chat(messages, { maxTokens: 2000 });
  }
  
  /**
   * 客户信用评估
   */
  async evaluateCustomerCredit(customerData) {
    const messages = [
      {
        role: 'system',
        content: `你是一个信用评估专家。基于客户数据评估信用等级。
返回JSON：
{
  "creditScore": 信用分(0-100),
  "level": "A级/B级/C级/D级",
  "factors": { "positive": ["正面因素"], "negative": ["负面因素"] },
  "suggestions": ["信用建议"],
  "recommendedCreditLimit": 建议信用额度
}`
      },
      {
        role: 'user',
        content: `客户数据：\n${JSON.stringify(customerData, null, 2)}`
      }
    ];
    
    return this.chat(messages, { maxTokens: 2000 });
  }
}

// 单例
const aiGateway = new AIGatewayService();
module.exports = aiGateway;
