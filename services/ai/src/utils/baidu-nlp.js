/**
 * 百度NLP服务 - 合同审核增强
 * 
 * 支持的API（需在百度AI平台开通）：
 * - 词法分析 (lexer)
 * - 情感倾向分析 (sentiment)
 * - 实体分析 (entity)
 * - 评论观点抽取 (commentTag)
 * - 文本纠错 (ecnet)
 * 
 * 文档：https://cloud.baidu.com/doc/NLP/s/ajaxhfp5z
 */

const https = require('https');
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
} catch(e) { /* dotenv may not be available */ }

const API_KEY = process.env.BAIDU_NLP_API_KEY || process.env.BAIDU_OCR_API_KEY || '';
const SECRET_KEY = process.env.BAIDU_NLP_SECRET_KEY || process.env.BAIDU_OCR_SECRET_KEY || '';

let accessToken = null;
let tokenExpireAt = 0;

/**
 * 获取百度 access token（OAuth2）
 */
function getAccessToken() {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: API_KEY,
      client_secret: SECRET_KEY
    }).toString();

    const req = https.request({
      hostname: 'aip.baidubce.com',
      path: '/oauth/2.0/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.access_token) {
            accessToken = json.access_token;
            tokenExpireAt = Date.now() + (json.expires_in - 60) * 1000;
            resolve(accessToken);
          } else {
            reject(new Error(json.error_description || 'Failed to get token'));
          }
        } catch(e) {
          reject(new Error('Invalid token response: ' + body));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * 调用百度NLP RPC API
 */
async function callNlpApi(apiPath, params) {
  if (!accessToken || Date.now() > tokenExpireAt) {
    await getAccessToken();
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params);
    const req = https.request({
      hostname: 'aip.baidubce.com',
      path: apiPath + '?access_token=' + accessToken,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); }
        catch(e) { reject(new Error('Invalid JSON: ' + b)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * 词法分析 - 提取文本中的词汇和词性
 */
async function lexer(text) {
  try {
    const result = await callNlpApi('/rpc/2.0/nlp/v1/lexer', { text });
    if (result.error_code) {
      console.warn('[BaiduNLP] lexer error:', result.error_msg);
      return null;
    }
    return result.items || [];
  } catch(e) {
    console.warn('[BaiduNLP] lexer failed:', e.message);
    return null;
  }
}

/**
 * 情感倾向分析 - 分析文本的情感倾向（正面/负面/中性）
 */
async function sentiment(text) {
  try {
    const result = await callNlpApi('/rpc/2.0/nlp/v1/sentiment_classify', { text });
    if (result.error_code) {
      console.warn('[BaiduNLP] sentiment error:', result.error_msg);
      return null;
    }
    return {
      sentiment: result.sentiment, // 0:负面 1:中性 2:正面
      confidence: result.confidence,
      positive_prob: result.positive_prob,
      negative_prob: result.negative_prob
    };
  } catch(e) {
    console.warn('[BaiduNLP] sentiment failed:', e.message);
    return null;
  }
}

/**
 * 实体分析 - 识别人名、地名、机构名等
 */
async function entityAnalysis(text) {
  try {
    const result = await callNlpApi('/rpc/2.0/nlp/v1/entity_analysis', { text });
    if (result.error_code) {
      console.warn('[BaiduNLP] entity error:', result.error_msg);
      return null;
    }
    return result.items || [];
  } catch(e) {
    console.warn('[BaiduNLP] entity failed:', e.message);
    return null;
  }
}

/**
 * 评论观点抽取 - 从文本中提取关键观点和情感
 */
async function commentTag(text) {
  try {
    const result = await callNlpApi('/rpc/2.0/nlp/v2/comment_tag', { text });
    if (result.error_code) {
      console.warn('[BaiduNLP] comment_tag error:', result.error_msg);
      return null;
    }
    return result.items || [];
  } catch(e) {
    console.warn('[BaiduNLP] comment_tag failed:', e.message);
    return null;
  }
}

/**
 * 文本纠错 - 纠正文本中的错别字
 */
async function ecnet(text) {
  try {
    const result = await callNlpApi('/rpc/2.0/nlp/v1/ecnet', { text });
    if (result.error_code) {
      console.warn('[BaiduNLP] ecnet error:', result.error_msg);
      return null;
    }
    return result;
  } catch(e) {
    console.warn('[BaiduNLP] ecnet failed:', e.message);
    return null;
  }
}

/**
 * 关键词抽取 - 从文章中提取关键词
 */
async function keyword(title, content) {
  try {
    const result = await callNlpApi('/rpc/2.0/nlp/v1/keyword', { title, content });
    if (result.error_code) {
      console.warn('[BaiduNLP] keyword error:', result.error_msg);
      return null;
    }
    return result.keywords || [];
  } catch(e) {
    console.warn('[BaiduNLP] keyword failed:', e.message);
    return null;
  }
}

/**
 * 合同文本分析 - 综合调用多个NLP API 对合同进行全面分析
 * @param {string} text - 合同文本
 * @returns {object} 分析结果
 */
async function analyzeContract(text) {
  const results = {
    success: true,
    provider: 'baidu_nlp',
    entities: [],
    sentiment: null,
    keywords: [],
    riskIndicators: [],
    rawResults: {}
  };

  // 并行调用多个分析接口
  const [entities, sentimentResult, keywordsResult, commentResult] = await Promise.all([
    entityAnalysis(text).catch(() => null),
    sentiment(text).catch(() => null),
    keyword('合同审核', text).catch(() => null),
    commentTag(text).catch(() => null),
  ]);

  results.entities = entities;
  results.sentiment = sentimentResult;
  results.keywords = keywordsResult || [];
  results.rawResults.commentTag = commentResult;

  // 风险指标识别
  if (sentimentResult) {
    if (sentimentResult.sentiment === 0) {
      results.riskIndicators.push({
        type: '情感负面',
        level: 'medium',
        description: '合同文本整体情感偏负面，可能存在较多限制性条款'
      });
    }
  }

  // 基于实体的风险识别
  if (entities && entities.length > 0) {
    const orgs = entities.filter(e => e.type === 'ORG' || e.type === 'company');
    if (orgs.length === 1) {
      results.riskIndicators.push({
        type: '主体单一',
        level: 'low',
        description: '合同仅涉及一个主体，可能存在不对等条款'
      });
    }
  }

  // 基于关键词的风险识别
  const riskKeywords = ['违约金', '违约', '赔偿', '责任', '免除', '限制', '不得', '无权', '单方面'];
  const foundRiskWords = riskKeywords.filter(kw => text.includes(kw));
  if (foundRiskWords.length > 3) {
    results.riskIndicators.push({
      type: '高风险条款',
      level: 'medium',
      description: `发现 ${foundRiskWords.length} 个风险关键词: ${foundRiskWords.join(', ')}`
    });
  }

  return results;
}

/**
 * 检查服务状态
 */
async function getStatus() {
  if (!API_KEY || API_KEY === 'your_api_key_here') {
    return { configured: false, provider: 'Baidu NLP', reason: 'BAIDU_NLP_API_KEY 未配置' };
  }

  try {
    await getAccessToken();
    // 测试调用 lexer
    const result = await callNlpApi('/rpc/2.0/nlp/v1/lexer', { text: '测试' });
    if (result.error_code === 6) {
      return { configured: false, provider: 'Baidu NLP', reason: 'API Key 无权访问 NLP 接口（仅限 OCR）' };
    }
    if (result.error_code && result.error_code !== 0) {
      return { configured: false, provider: 'Baidu NLP', reason: result.error_msg };
    }
    return { configured: true, provider: 'Baidu NLP', apiKey: API_KEY.slice(0, 4) + '****' + API_KEY.slice(-4) };
  } catch(e) {
    return { configured: false, provider: 'Baidu NLP', reason: e.message };
  }
}

module.exports = {
  lexer,
  sentiment,
  entityAnalysis,
  commentTag,
  ecnet,
  keyword,
  analyzeContract,
  getStatus
};
