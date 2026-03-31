/**
 * AI Tools - 意图检测
 * 检测用户消息是否需要调用工具
 */

const { toolMap } = require('./definitions');

/**
 * 关键词匹配规则
 */
const intentRules = [
  {
    tool: 'invoice_ocr',
    patterns: [
      /发票|票据|ocr|拍照上传/i,
      /增值税.{0,6}发票|专票|普票|电子发票/i,
      /扫.{0,2}描.{0,2}发|扫.{0,2}一.{0,2}下/i,
      /收据|定额发票|出租车票|火车票|机票/i,
      /上传.{0,4}发.{0,4}票|开.{0,4}发票/i,
      /记.{0,4}账.*图片|图片.*记.{0,4}账/i
    ]
  },
  {
    tool: 'contract_review',
    patterns: [
      /审.{0,4}核.{0,4}合同|合同.{0,4}审.{0,4}核|合同.{0,4}风险|合同.{0,4}分析/i,
      /查.{0,4}看.{0,4}合同.{0,4}审.{0,4}核|合同.{0,4}查.{0,4}看/i,
      /审.{0,4}核.*合同|风险.*合同|合同.*风险/i,
      /合同.{0,4}审.{0,4}查|审.{0,4}查.*合同/i,
      /报销.{0,6}审.{0,4}核|审.{0,4}核.*报销/i,
      /审.{0,4}批.{0,4}合同|合同.{0,4}审.{0,4}批/i
    ]
  },
  {
    tool: 'employee_onboard',
    patterns: [
      /入.{0,4}职|新.{0,4}员.{0,4}工|添加.{0,4}员工|招.{0,4}聘|报到/i,
      /员工.{0,4}入.{0,4}职|办理.{0,4}入职|新同事/i,
      /录入.*员工|登记.*员工|增加.*员工/i,
      /招聘.*新.{0,4}人|新.{0,4}人.{0,4}入职/i
    ]
  },
  {
    tool: 'salary_stats',
    patterns: [
      /工资|薪资|薪酬|月薪/i,
      /发工资|应发工资|实发工资|净工资/i,
      /工资.{0,4}报.{0,4}表|工资.{0,4}统.{0,4}计|工资.{0,4}明.{0,4}细/i,
      /本月.{0,6}工资|当月.{0,6}工资|薪资.{0,4}报表/i,
      /发了多少|工资.{0,4}发.{0,4}放|发薪/i,
      /个税.{0,4}计算|社保.{0,4}统计/i
    ]
  }
];

/**
 * 从消息中提取参数
 */
function extractParams(message, tool) {
  const msg = message;
  const params = {};

  if (tool === 'invoice_ocr') {
    // 发票识别主要靠图片，不需要从文本提取太多参数
    // 可能从文本中提取日期、金额等
    const amountMatch = msg.match(/(?:金额|总数|总额)[：:\s]*[¥￥]?\s*([\d.]+)/);
    if (amountMatch) params.amount_hint = parseFloat(amountMatch[1]);

    const dateMatch = msg.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)/);
    if (dateMatch) params.date_hint = dateMatch[1];
  }

  if (tool === 'contract_review') {
    // 从消息中提取合同ID
    const idMatch = msg.match(/合同[_\s]?(?:ID|id|#|编号)[：:\s#]*(\d+)/i);
    if (idMatch) {
      params.contract_id = parseInt(idMatch[1]);
    } else {
      // 尝试直接提取数字（可能是合同ID）
      const numMatch = msg.match(/(?:合同)[^0-9]*(\d{4,})/);
      if (numMatch) params.contract_id = parseInt(numMatch[1]);
    }
  }

  if (tool === 'employee_onboard') {
    // 从消息中提取员工信息
    const nameMatch = msg.match(/姓[名]+[：:\s]*([^\s,，。]+)/);
    if (nameMatch) params.name = nameMatch[1];

    const phoneMatch = msg.match(/(?:电话|手机)[：:\s]*([0-9]{11})/);
    if (phoneMatch) params.phone = phoneMatch[1];

    const deptMatch = msg.match(/(?:部门)[：:\s]*([^\s,，。]+)/);
    if (deptMatch) params.department = deptMatch[1];

    const posMatch = msg.match(/(?:职位|岗位)[：:\s]*([^\s,，。]+)/);
    if (posMatch) params.position = posMatch[1];

    const salaryMatch = msg.match(/(?:工资|薪资|月薪)[：:\s]*([0-9]+)/);
    if (salaryMatch) params.base_salary = parseInt(salaryMatch[1]);

    const dateMatch = msg.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)/);
    if (dateMatch) params.hire_date = dateMatch[1].replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '');
  }

  if (tool === 'salary_stats') {
    // 提取年月
    const monthMatch = msg.match(/(\d{4})[年\s]+(\d{1,2})[月]?/);
    if (monthMatch) {
      params.year = parseInt(monthMatch[1]);
      params.month = parseInt(monthMatch[2]);
    } else {
      const yearMatch = msg.match(/(?:20\d{2})年?/);
      if (yearMatch) params.year = parseInt(yearMatch[0]);

      const monMatch = msg.match(/(\d{1,2})月/);
      if (monMatch) params.month = parseInt(monMatch[1]);
    }
  }

  return params;
}

/**
 * 检测用户消息是否匹配工具意图
 * @param {string} message - 用户消息
 * @returns {{ tool: string|null, params: object, confidence: number }}
 */
function detectIntent(message) {
  if (!message) return { tool: null, params: {}, confidence: 0 };

  let bestMatch = null;
  let bestConfidence = 0;

  for (const rule of intentRules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(message)) {
        const confidence = pattern.global 
          ? 0.8  // 多个pattern匹配，置信度较高
          : 0.9; // 精确匹配

        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = rule.tool;
        }
      }
    }
  }

  if (bestMatch) {
    const params = extractParams(message, bestMatch);
    return { tool: bestMatch, params, confidence: bestConfidence };
  }

  return { tool: null, params: {}, confidence: 0 };
}

/**
 * 检测消息是否包含图片（Base64 或 URL）
 */
function hasImage(message, body) {
  if (body?.image) return true;
  if (typeof message === 'string' && message.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i)) return true;
  if (typeof message === 'string' && message.startsWith('http')) return true;
  return false;
}

/**
 * 判断是否需要调用工具
 * 返回工具名称或 null
 */
function shouldCallTool(message, body = {}) {
  // 1. 强意图检测
  const intent = detectIntent(message);
  if (intent.tool && intent.confidence >= 0.8) {
    return { tool: intent.tool, params: intent.params, confidence: intent.confidence, reason: 'intent_match' };
  }

  // 2. 特殊命令
  const lowerMsg = message?.toLowerCase() || '';
  if (lowerMsg.startsWith('/发票')) return { tool: 'invoice_ocr', params: {}, reason: 'command' };
  if (lowerMsg.startsWith('/合同审核')) return { tool: 'contract_review', params: {}, reason: 'command' };
  if (lowerMsg.startsWith('/入职')) return { tool: 'employee_onboard', params: {}, reason: 'command' };
  if (lowerMsg.startsWith('/工资')) return { tool: 'salary_stats', params: {}, reason: 'command' };

  // 3. 附带图片的情况
  if (hasImage(message, body)) {
    return { tool: 'invoice_ocr', params: {}, reason: 'image_attached' };
  }

  return null;
}

module.exports = { detectIntent, shouldCallTool, extractParams };
