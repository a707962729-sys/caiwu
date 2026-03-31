/**
 * 合同审核 AI 服务
 * 调用 AI 模型进行合同风险分析
 */
const config = require('../config');
const aiGateway = require('./ai-gateway');

/**
 * 合同类型识别关键词
 */
const CONTRACT_TYPE_KEYWORDS = {
  purchase: ['采购', '产品买卖', '货物', '订购', '供货', '采购合同', '买卖合同'],
  service: ['服务', '咨询', '设计', '外包', '服务合同', '委托', '代理'],
  labor: ['劳动合同', '聘用', '雇佣', '工资', '劳务', '人事'],
  rental: ['租赁', '房租', '租用', '租金', '租赁合同', '设备租赁'],
  loan: ['借款', '贷款', '融资', '借贷', '借款合同', '信用']
};

/**
 * 系统提示词
 */
const SYSTEM_PROMPT = `你是一位资深法务顾问，专门分析合同风险。请严格按以下要求分析：

1. 识别合同类型（purchase/service/labor/rental/loan/other）及置信度
2. 识别甲方乙方，并评估各方风险（历史信用、资质、履约能力）
3. 识别合同中的风险条款（付款、违约、终止、赔偿等）
4. 生成整改建议，按优先级排序

重要：所有金额、日期等数字信息要准确提取。`;

/**
 * 合同审核 AI 分析器
 */
class ContractReviewAI {
  constructor() {
    this.provider = null;
    this._initProvider();
  }

  _initProvider() {
    // AI gateway handles provider selection internally
  }

  /**
   * 识别合同类型（基于关键词）
   */
  classifyContractType(text) {
    const scores = {};
    
    for (const [type, keywords] of Object.entries(CONTRACT_TYPE_KEYWORDS)) {
      let score = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score += 1;
        }
      }
      scores[type] = score;
    }
    
    // 找最高分
    let maxType = 'other';
    let maxScore = 0;
    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxType = type;
      }
    }
    
    // 计算置信度
    const confidence = maxScore > 0 ? Math.min(0.9, 0.5 + maxScore * 0.1) : 0.5;
    
    return {
      type: maxType,
      confidence: parseFloat(confidence.toFixed(2))
    };
  }

  /**
   * 提取合同基本信息
   */
  extractBasicInfo(text) {
    const result = {
      parties: { partyA: null, partyB: null },
      amount: null,
      dates: { start: null, end: null, sign: null },
      paymentTerms: null
    };

    // 提取金额
    const amountPatterns = [
      /合同总[金额价款][为是]?\s*([\d,，.]+)\s*(?:万|元|RMB|CNY)?/i,
      /金额[为是]?\s*([\d,，.]+)\s*(?:万|元|RMB|CNY)?/i,
      /总计\s*([\d,，.]+)\s*(?:万|元|RMB|CNY)?/i
    ];
    
    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        let amount = match[1].replace(/[,，]/g, '');
        if (match[0].includes('万')) {
          amount = parseFloat(amount) * 10000;
        }
        result.amount = parseFloat(amount);
        break;
      }
    }

    // 提取甲方乙方
    const partyPatterns = [
      /甲方[：:]\s*([^\n，,，\s]{2,30})/,
      /乙方[：:]\s*([^\n，,，\s]{2,30})/
    ];
    
    const partyAMatch = text.match(/甲方[：:]\s*([^\n，,，\s]{2,30})/);
    const partyBMatch = text.match(/乙方[：:]\s*([^\n，,，\s]{2,30})/);
    
    if (partyAMatch) result.parties.partyA = partyAMatch[1].trim();
    if (partyBMatch) result.parties.partyB = partyBMatch[1].trim();

    // 提取日期
    const datePatterns = [
      /(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日]?/g,
    ];
    
    const dates = [];
    let match;
    while ((match = datePatterns[0].exec(text)) !== null) {
      dates.push(`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`);
    }
    
    if (dates.length >= 2) {
      result.dates.start = dates[0];
      result.dates.end = dates[1];
    }
    if (dates.length >= 3) {
      result.dates.sign = dates[2];
    }

    // 提取付款条件
    const paymentPatterns = [
      /(预付款?|首款?|尾款?|进度款?|月结|季结)[^\n，,。]{0,50}/gi,
      /(付款|支付)[^\n，,。]{0,50}/gi
    ];
    
    const payments = [];
    for (const pattern of paymentPatterns) {
      let m;
      while ((m = pattern.exec(text)) !== null) {
        if (m[0].length > 5) {
          payments.push(m[0].trim());
        }
      }
    }
    result.paymentTerms = payments.slice(0, 3).join('; ');

    return result;
  }

  /**
   * 构建 AI 分析提示词
   */
  buildAnalysisPrompt(contractText, basicInfo, partnerRisks) {
    const { parties, amount, paymentTerms } = basicInfo;
    
    return `请分析以下合同文本，返回结构化的风险分析结果：

合同文本：
${contractText.substring(0, 8000)}

已知信息：
- 甲方：${parties.partyA || '未明确'}
- 乙方：${parties.partyB || '未明确'}
- 合同金额：${amount ? amount.toLocaleString() + ' 元' : '未明确'}
- 付款条件：${paymentTerms || '未明确'}
- 甲方合作方风险等级：${partnerRisks?.partyA || 'unknown'}
- 乙方合作方风险等级：${partnerRisks?.partyB || 'unknown'}

请返回严格的JSON格式（不要有额外文本）：
{
  "contract_type": "purchase|service|labor|rental|loan|other",
  "contract_type_confidence": 0.0-1.0,
  "parties_risk": {
    "party_a": {"risk_level": "low|medium|high", "risk_factors": ["风险因子1", "风险因子2"]},
    "party_b": {"risk_level": "low|medium|high", "risk_factors": ["风险因子1", "风险因子2"]}
  },
  "risk_findings": [
    {"item": "风险条款名称", "detail": "具体描述", "risk_level": "low|medium|high"}
  ],
  "review_suggestions": [
    {"priority": 1-5, "category": "payment|term|liability|other", "suggestion": "建议内容", "reason": "原因"}
  ],
  "overall_risk_score": 0-100,
  "overall_risk_level": "low|medium|high"
}

要求：
1. risk_findings 至少识别3个风险点
2. review_suggestions 按优先级排序
3. overall_risk_score 要综合考虑所有风险因素`;
  }

  /**
   * 计算风险评分
   */
  calculateRiskScore(aiResult, partnerRisks, contractAmount) {
    let score = 50; // 基础分

    // 合作方风险加成
    if (partnerRisks?.partyA === 'high') score += 20;
    else if (partnerRisks?.partyA === 'medium') score += 10;
    
    if (partnerRisks?.partyB === 'high') score += 20;
    else if (partnerRisks?.partyB === 'medium') score += 10;

    // 合同金额风险
    if (contractAmount > 5000000) score += 15;
    else if (contractAmount > 1000000) score += 10;
    else if (contractAmount > 500000) score += 5;

    // AI 识别风险点加成
    if (aiResult.risk_findings) {
      for (const finding of aiResult.risk_findings) {
        if (finding.risk_level === 'high') score += 10;
        else if (finding.risk_level === 'medium') score += 5;
      }
    }

    // 限制范围
    return Math.min(100, Math.max(0, score));
  }

  /**
   * 执行 AI 合同分析
   */
  async analyze(contractText, options = {}) {
    const startTime = Date.now();
    
    try {
      // 1. 提取基本信息
      const basicInfo = this.extractBasicInfo(contractText);
      
      // 2. 关键词预分类
      const keywordClassification = this.classifyContractType(contractText);
      
      // 3. 构建 AI 提示
      const prompt = this.buildAnalysisPrompt(
        contractText, 
        basicInfo, 
        options.partnerRisks
      );

      // 4. 调用 AI
      const response = await aiGateway.chat([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ], { maxTokens: options.maxTokens || 3000 });

      if (!response.success) {
        throw new Error(response.error || 'AI analysis failed');
      }

      // 5. 解析 AI 返回
      let aiResult;
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseErr) {
        console.error('AI response parse failed:', parseErr);
        // 返回默认值
        aiResult = {
          contract_type: keywordClassification.type,
          contract_type_confidence: keywordClassification.confidence,
          parties_risk: {
            party_a: { risk_level: 'unknown', risk_factors: [] },
            party_b: { risk_level: 'unknown', risk_factors: [] }
          },
          risk_findings: [],
          review_suggestions: [],
          overall_risk_score: 50,
          overall_risk_level: 'medium'
        };
      }

      // 6. 融合结果
      // 如果 AI 置信度低于阈值，采用关键词分类
      if (aiResult.contract_type_confidence < 0.7 && keywordClassification.confidence > aiResult.contract_type_confidence) {
        aiResult.contract_type = keywordClassification.type;
        aiResult.contract_type_confidence = keywordClassification.confidence;
      }

      // 7. 计算最终风险评分
      const riskScore = this.calculateRiskScore(
        aiResult, 
        options.partnerRisks, 
        basicInfo.amount
      );

      const latency = Date.now() - startTime;

      console.log('Contract review AI completed', {
        contractType: aiResult.contract_type,
        riskScore,
        latency,
        tokens: response.usage?.totalTokens
      });

      return {
        success: true,
        data: {
          contract_type: aiResult.contract_type,
          contract_type_confidence: aiResult.contract_type_confidence,
          party_a_risk_level: aiResult.parties_risk?.party_a?.risk_level || 'unknown',
          party_b_risk_level: aiResult.parties_risk?.party_b?.risk_level || 'unknown',
          party_a_risk_factors: aiResult.parties_risk?.party_a?.risk_factors || [],
          party_b_risk_factors: aiResult.parties_risk?.party_b?.risk_factors || [],
          risk_findings: aiResult.risk_findings || [],
          review_suggestions: aiResult.review_suggestions || [],
          overall_risk_score: riskScore,
          overall_risk_level: riskScore <= 30 ? 'low' : riskScore <= 60 ? 'medium' : 'high',
          basic_info: basicInfo,
          ai_model: response.model || 'glm',
          ai_tokens_used: response.usage?.totalTokens || 0,
          latency_ms: latency
        }
      };

    } catch (err) {
      console.error('Contract review AI failed:', err);
      throw err;
    }
  }
}

module.exports = new ContractReviewAI();
