/**
 * Tool Registry - 可扩展的工具注册表
 * 注册、内置、调用各种 AI 工具
 */
const logger = require('../utils/logger');
let baiduNlp = null;
try {
  baiduNlp = require('../utils/baidu-nlp');
} catch(e) {
  logger.warn('[ToolRegistry] baidu-nlp not available:', e.message);
}

// 工具执行器 map
const executors = {};

/**
 * 注册一个工具
 * @param {string} name - 工具名
 * @param {object} definition - 工具定义（OpenAI function calling 格式）
 * @param {function} executor - 执行函数 (params, session, context) => Promise<result>
 */
function register(name, definition, executor) {
  definitions[name] = definition;
  executors[name] = executor;
  logger.info(`[ToolRegistry] Registered tool: ${name}`);
}

/**
 * 获取所有工具定义（用于发给 LLM）
 */
function getDefinitions() {
  return Object.values(definitions);
}

/**
 * 获取单个工具定义
 */
function getDefinition(name) {
  return definitions[name];
}

/**
 * 执行工具
 * @param {string} name
 * @param {object} params
 * @param {object} session - 会话对象（包含 senderId 等）
 * @param {object} context - 额外上下文
 */
async function execute(name, params, session, context = {}) {
  if (!executors[name]) {
    throw new Error(`Tool not found: ${name}`);
  }
  try {
    const result = await executors[name](params, session, context);
    logger.info(`[ToolRegistry] Tool ${name} executed successfully`);
    return result;
  } catch (err) {
    logger.error(`[ToolRegistry] Tool ${name} error:`, err);
    throw err;
  }
}

/**
 * 检查工具是否存在
 */
function has(name) {
  return !!executors[name];
}

// 工具定义表（OpenAI function calling 格式）
const definitions = {};

// ─────────────────────────────────────────────
// 内置工具：发票识别 (复用百度OCR)
// ─────────────────────────────────────────────
register(
  'invoice_ocr',
  {
    type: 'function',
    function: {
      name: 'invoice_ocr',
      description: '识别发票图片，提取发票信息（抬头、金额、日期、税号等）。当用户发送发票图片、票据照片、或提到"识别发票"、"扫描发票"、"发票OCR"时使用。',
      parameters: {
        type: 'object',
        properties: {
          image: {
            type: 'string',
            description: '发票图片的 Base64 编码（不含 data:image/... 前缀），或图片URL'
          }
        },
        required: ['image']
      }
    }
  },
  async (params, session) => {
    // 调用内部 OCR 服务
    const API_BASE = 'http://localhost:3000/api';
    const INTERNAL_KEY = 'caiwu-internal-service-key-2024';
    try {
      const imageData = params.image.startsWith('data:')
        ? params.image
        : `data:image/jpeg;base64,${params.image}`;
      const resp = await fetch(`${API_BASE}/internal/ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': INTERNAL_KEY
        },
        body: JSON.stringify({ image: imageData })
      });
      const json = await resp.json();
      return { success: json.success, data: json.data, error: json.error };
    } catch (e) {
      return { success: false, error: `OCR服务调用失败: ${e.message}` };
    }
  }
);

// ─────────────────────────────────────────────
// 内置工具：PDF发票文字解析
// ─────────────────────────────────────────────
register(
  'parse_invoice_text',
  {
    type: 'function',
    function: {
      name: 'parse_invoice_text',
      description: '解析PDF发票或文本形式的发票内容，提取发票信息。当用户发送PDF文件或粘贴发票文字时使用。',
      parameters: {
        type: 'object',
        properties: {
          invoice_text: {
            type: 'string',
            description: '发票的文本内容（OCR识别结果或PDF文字）'
          }
        },
        required: ['invoice_text']
      }
    }
  },
  async (params) => {
    const t = params.invoice_text || '';
    if (!t) return { success: false, error: '缺少文字内容' };

    const d = {
      invoice_no: '', date: '', amount: 0, tax: 0, total: 0,
      buyer: '', seller: '', status: '有效'
    };

    const lines = t.split('\n').map(l => l.trim()).filter(l => l);

    // 发票号码
    for (const l of lines) {
      const m = l.match(/(?:发票号(?:码)?[：:]\s*)([A-Z0-9]{6,})/i)
        || l.match(/(?:invoice|no)[：:\s]*([A-Z0-9]{6,})/i);
      if (m) { d.invoice_no = m[1]; break; }
    }

    // 日期
    for (const l of lines) {
      const m = l.match(/(\d{4})[年\-/](\d{1,2})[月\-/]?(\d{0,2})/)
        || l.match(/开票日期[：:\s]*(\d{4})[年\-/](\d{1,2})[月\-/]?(\d{0,2})/);
      if (m) {
        d.date = m[1] + '-' + m[2].padStart(2, '0') + '-' + (m[3] || '01').padStart(2, '0');
        break;
      }
    }

    // 金额
    let amount = 0, tax = 0, total = 0;
    const totalMatch = t.match(/价税合计[^¥￥\n]*?([\d,]+\.?\d*)\s*(?:元|NT)?/);
    if (totalMatch) total = parseFloat(totalMatch[1].replace(/,/g, ''));
    if (!total) {
      const sm = t.match(/[（(]\s*小\s*写\s*[）)]\s*[¥￥]?\s*([\d,]+\.?\d*)/);
      if (sm) total = parseFloat(sm[1].replace(/,/g, ''));
    }
    const yenAmounts = [...t.matchAll(/¥\s*([\d,]+\.?\d*)/g)]
      .map(m => parseFloat(m[1].replace(/,/g, '')));
    if (yenAmounts.length >= 3) {
      const sorted = [...yenAmounts].sort((a, b) => a - b);
      total = sorted[sorted.length - 1];
      amount = sorted[1];
      tax = sorted[0];
    } else if (yenAmounts.length === 2) {
      total = Math.max(...yenAmounts);
      amount = Math.min(...yenAmounts);
    } else if (yenAmounts.length === 1) {
      total = yenAmounts[0];
    }
    d.amount = amount;
    d.tax = tax;
    d.total = total || amount;

    if (t.includes('作废')) d.status = '作废';

    const hasSomething = d.invoice_no || d.date || d.amount > 0;
    if (!hasSomething) return { success: false, error: '无法解析出发票信息' };

    return { success: true, data: d };
  }
);

// ─────────────────────────────────────────────
// 内置工具：合同审核（规则引擎 + LLM 辅助）
// ─────────────────────────────────────────────
register(
  'contract_review',
  {
    type: 'function',
    function: {
      name: 'contract_review',
      description: '对合同进行AI风险审核，识别风险点并给出修改建议。当用户提到"审核合同"、"合同风险"、"合同分析"、"审查合同"时使用。',
      parameters: {
        type: 'object',
        properties: {
          contract_id: {
            type: 'integer',
            description: '合同ID（已有合同时使用）'
          },
          contract_text: {
            type: 'string',
            description: '合同文本内容（没有合同ID时直接传入文本）'
          },
          contract_type: {
            type: 'string',
            description: '合同类型：labor（劳动合同）、purchase（采购合同）、service（服务合同）、lease（租赁合同）、other'
          }
        },
        required: []
      }
    }
  },
  async (params, session, context) => {
    const { contract_id, contract_text, contract_type = 'other' } = params;

    // 1. 尝试加载合同内容
    let text = contract_text || '';
    if (contract_id && !text) {
      try {
        const API_BASE = 'http://localhost:3000/api';
        const resp = await fetch(`${API_BASE}/contracts/${contract_id}`, {
          headers: { 'x-internal-api-key': 'caiwu-internal-service-key-2024' }
        });
        if (resp.ok) {
          const json = await resp.json();
          text = json.data?.content || json.data?.terms_and_conditions || '';
        }
      } catch (e) {
        logger.warn('[contract_review] Failed to fetch contract:', e.message);
      }
    }

    if (!text || text.length < 20) {
      return { success: false, error: '合同内容为空或过短，无法审核' };
    }

    // 2. 规则引擎快速扫描
    const rules = buildRiskRules();
    const ruleFindings = [];
    let riskScore = 0;
    let riskLevel = 'low';

    for (const rule of rules) {
      if (rule.condition(text)) {
        ruleFindings.push({ level: rule.level, point: rule.point, suggestion: rule.suggestion });
        riskScore += rule.score;
      }
    }

    if (riskScore >= 60) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';

    // 3. 百度NLP辅助分析（词法、情感、实体、观点抽取）
    let nlpResults = null;
    let nlpSuggestions = [];
    if (baiduNlp) {
      try {
        nlpResults = await baiduNlp.analyzeContract(text);
        logger.info('[contract_review] Baidu NLP result:', JSON.stringify({
          hasEntities: !!(nlpResults.entities && nlpResults.entities.length),
          sentiment: nlpResults.sentiment,
          riskIndicators: nlpResults.riskIndicators?.length
        }).substring(0, 200));
        
        // 将NLP风险指标加入建议
        if (nlpResults.riskIndicators) {
          for (const indicator of nlpResults.riskIndicators) {
            if (indicator.level === 'high') {
              nlpSuggestions.push(`[百度AI] ${indicator.type}: ${indicator.description}`);
              riskScore += 15;
            } else if (indicator.level === 'medium') {
              nlpSuggestions.push(`[百度AI] ${indicator.type}: ${indicator.description}`);
              riskScore += 8;
            }
          }
        }
        
        // 如果NLP识别到负面情感，增加风险评分
        if (nlpResults.sentiment && nlpResults.sentiment.sentiment === 0) {
          riskScore += 10;
        }
      } catch (e) {
        logger.warn('[contract_review] Baidu NLP failed:', e.message);
      }
    }

    // 重新计算风险等级
    if (riskScore >= 60) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';

    // 4. LLM 辅助深度分析（通过 agentLoop 的 llm 参数）
    let aiSuggestions = [];
    let summary = '';
    if (context.llm) {
      try {
        const review = await context.llm(text, contract_type, ruleFindings);
        aiSuggestions = review.suggestions || [];
        summary = review.summary || '';
      } catch (e) {
        logger.warn('[contract_review] LLM review failed:', e.message);
        summary = '（LLM深度分析暂时不可用，请参考规则引擎结果）';
      }
    }

    const allSuggestions = [...ruleFindings.map(f => f.suggestion), ...nlpSuggestions, ...aiSuggestions];
    const allPoints = ruleFindings.map(f => f.point);

    return {
      success: true,
      data: {
        contract_id,
        contract_type,
        risk_level: riskLevel,
        risk_score: riskScore,
        risk_points: allPoints,
        suggestions: allSuggestions,
        summary: summary || `共发现${ruleFindings.length + nlpSuggestions.length}个风险点，建议${riskLevel === 'high' ? '务必修改' : '关注'}。`,
        rule_based: true,
        baidu_nlp: nlpResults ? {
          enabled: true,
          sentiment: nlpResults.sentiment,
          entitiesCount: nlpResults.entities?.length || 0,
          keywords: nlpResults.keywords || []
        } : { enabled: false }
      }
    };
  }
);

/**
 * 构建风险规则
 */
function buildRiskRules() {
  return [
    {
      name: '违约金过高',
      condition: (text) => /\b违约金[是为是\s]+[\d]+%/.test(text) && /违约金.{0,5}[3-9][0-9]%|违约金.{0,5}[1-9]\d{2,}%/.test(text),
      level: 'high',
      score: 30,
      point: '违约金金额过高，可能超出法定上限（通常为损失的30%）',
      suggestion: '建议将违约金调整为不超过实际损失的30%'
    },
    {
      name: '无限期条款',
      condition: (text) => /本合同自签字之日起生效，有效期为?[无期限永久]/.test(text),
      level: 'high',
      score: 25,
      point: '合同未约定有效期或为永久合同，解除困难',
      suggestion: '建议明确约定合同有效期，并设置合理的终止条款'
    },
    {
      name: '单方解除权',
      condition: (text) => /甲方.{0,30}有权.{0,20}解除|乙方.{0,10}无权.{0,20}解除/.test(text),
      level: 'high',
      score: 25,
      point: '存在单方面限制解除权的不公平条款',
      suggestion: '建议赋予双方平等的合同解除权'
    },
    {
      name: '知识产权归属不清',
      condition: (text) => /知识产权.{0,30}(未作约定|归属|归甲方|归乙方)/.test(text) && !/知识产权归乙方/.test(text),
      level: 'medium',
      score: 20,
      point: '知识产权归属约定不明确或仅归一方',
      suggestion: '建议明确约定知识产权的归属和使用范围'
    },
    {
      name: '保密条款缺失',
      condition: (text) => !/保密|机密|confidential/i.test(text) && /合同金额|商业|技术/.test(text),
      level: 'medium',
      score: 15,
      point: '重要商业合同缺少保密条款',
      suggestion: '建议增加保密条款，明确双方保密义务'
    },
    {
      name: '争议解决方式',
      condition: (text) => !/仲裁|诉讼|法院|管辖/i.test(text),
      level: 'low',
      score: 10,
      point: '未约定争议解决方式',
      suggestion: '建议明确约定争议解决方式（推荐仲裁）'
    },
    {
      name: '付款条件不明确',
      condition: (text) => /付款|结算|支付/.test(text) && !/付款方式|结算方式|支付方式|账期/.test(text),
      level: 'medium',
      score: 15,
      point: '付款条件约定不明确',
      suggestion: '建议明确付款方式、账期、发票要求等细节'
    },
    {
      name: '发票条款',
      condition: (text) => !/发票|增值税|开票/.test(text) && /(采购|供货|服务|租赁)合同/.test(text),
      level: 'low',
      score: 10,
      point: '合同中未明确发票相关条款',
      suggestion: '建议明确发票类型（增值税专用/普通）、开票时间等'
    }
  ];
}

module.exports = { register, getDefinitions, getDefinition, execute, has };
