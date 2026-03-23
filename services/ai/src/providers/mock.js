const BaseAIProvider = require('./base');
const logger = require('../utils/logger');

/**
 * Mock 提供商（用于测试和演示）
 */
class MockProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.name = 'mock';
  }

  isAvailable() {
    return true;
  }

  async chat(messages, options = {}) {
    const startTime = Date.now();
    
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content || '';
    
    // 模拟财务助手回复
    let response = this.generateMockResponse(content);
    
    const latency = Date.now() - startTime;
    
    logger.info('Mock chat completed', { latency });
    
    return {
      success: true,
      content: response,
      model: 'mock-model',
      usage: {
        inputTokens: Math.ceil(content.length / 4),
        outputTokens: Math.ceil(response.length / 4),
        totalTokens: Math.ceil((content.length + response.length) / 4)
      },
      latency,
      mock: true
    };
  }

  async analyzeImage(imageBase64, prompt, options = {}) {
    const startTime = Date.now();
    
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 模拟 OCR 结果
    const response = this.generateMockOCRResult(prompt);
    
    const latency = Date.now() - startTime;
    
    logger.info('Mock image analysis completed', { latency });
    
    return {
      success: true,
      content: JSON.stringify(response),
      model: 'mock-vision',
      usage: {
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300
      },
      latency,
      mock: true
    };
  }

  generateMockResponse(content) {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('收入') || lowerContent.includes('expense')) {
      return '根据您的财务数据，本月收入情况良好。建议您关注以下几点：\n\n1. 定期核对银行流水\n2. 及时开具发票\n3. 注意应收账款的催收\n\n如需详细分析，请提供更多具体信息。';
    }
    
    if (lowerContent.includes('发票') || lowerContent.includes('invoice')) {
      return '关于发票管理，我建议：\n\n1. 进项发票及时认证抵扣\n2. 销项发票按时开具\n3. 注意发票真伪核验\n\n我可以帮您识别发票信息，请上传发票图片。';
    }
    
    if (lowerContent.includes('报销') || lowerContent.includes('reimbursement')) {
      return '报销流程说明：\n\n1. 填写报销单\n2. 上传相关票据\n3. 提交审批\n4. 等待财务审核\n5. 收到报销款项\n\n请确保票据真实有效，符合公司报销标准。';
    }
    
    return '您好！我是财务管家 AI 助手，可以帮您：\n\n1. 📊 财务数据分析\n2. 🧾 发票/票据识别\n3. 💰 记账建议\n4. 📈 经营分析\n\n请问有什么可以帮您的？';
  }

  generateMockOCRResult(prompt) {
    // 模拟发票识别结果
    if (prompt.includes('发票') || prompt.includes('invoice')) {
      return {
        type: 'invoice',
        confidence: 0.95,
        data: {
          invoice_no: 'INV' + Date.now(),
          invoice_code: '1234567890',
          invoice_type: '增值税专用发票',
          issue_date: new Date().toISOString().split('T')[0],
          amount_before_tax: 10000,
          tax_rate: 13,
          tax_amount: 1300,
          total_amount: 11300,
          seller: {
            name: '示例供应商有限公司',
            tax_id: '91110000MA00XXXXX'
          },
          buyer: {
            name: '示例公司',
            tax_id: '91110000MA00YYYYY'
          }
        }
      };
    }
    
    // 模拟收据识别结果
    if (prompt.includes('收据') || prompt.includes('receipt')) {
      return {
        type: 'receipt',
        confidence: 0.90,
        data: {
          receipt_no: 'RCP' + Date.now(),
          date: new Date().toISOString().split('T')[0],
          amount: 100,
          merchant: '示例商户',
          items: [
            { name: '商品A', quantity: 2, price: 30 },
            { name: '商品B', quantity: 1, price: 40 }
          ]
        }
      };
    }
    
    // 默认识别结果
    return {
      type: 'general',
      confidence: 0.85,
      data: {
        text: '识别到的文本内容...',
        amount: null,
        date: new Date().toISOString().split('T')[0]
      }
    };
  }
}

module.exports = MockProvider;