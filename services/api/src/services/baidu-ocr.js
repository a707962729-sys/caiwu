/**
 * 百度OCR服务
 * 文档：https://cloud.baidu.com/doc/OCR/s/1k3h7y3db
 */

const dayjs = require('dayjs');
const path = require('path');

// 加载 .env 文件（支持从父目录加载）
try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  console.log('[BaiduOCR] .env loaded from services/.env');
} catch(e) { /* dotenv may not be available */ }

// 检查是否安装了baidu-aip-sdk
let AipOcrClient = null;
try {
  AipOcrClient = require('baidu-aip-sdk').ocr;
} catch (e) {
  console.log('baidu-aip-sdk not installed, using mock OCR');
}

// 配置 - 优先从 dotenv 加载，如果失败则尝试直接读取
const API_KEY = process.env.BAIDU_OCR_API_KEY || '';
const SECRET_KEY = process.env.BAIDU_OCR_SECRET_KEY || '';

// 创建客户端
let client = null;
if (AipOcrClient && API_KEY && API_KEY !== 'your_api_key_here') {
  // 百度 SDK 构造函数签名：AipOcr(appId, ak, sk)，只传两个参数会导致 sk 被截断
  client = new AipOcrClient(0, API_KEY, SECRET_KEY);
  console.log('✅ 百度OCR已初始化');
} else {
  console.log('⚠️ 百度OCR未配置，使用模拟数据');
}

/**
 * 增值税发票识别（带降级机制）
 * 优先用 VAT 专用识别，失败则降级用通用 OCR + 文本解析
 * @param {string} image - Base64编码的图片
 * @returns {object} 识别结果
 */
async function recognizeVatInvoice(image) {
  // 无图片或未配置，返回模拟数据
  if (!image || !client) {
    return mockRecognize();
  }

  // ── 步骤1：尝试 VAT 专用识别 ──
  try {
    const result = await client.vatInvoice(image);
    if (result.words_result) {
      const data = result.words_result;
      return {
        success: true,
        invoiceCode: data.InvoiceCode || '',
        invoiceNo: data.InvoiceNum || '',
        type: data.InvoiceType || '增值税专用发票',
        date: data.InvoiceDate || '',
        buyer: {
          name: data.PurchaserName || '',
          taxNumber: data.PurchaserRegisterNum || '',
          address: data.PurchaserAddress || '',
          phone: data.PurchaserBank || ''
        },
        seller: {
          name: data.SellerName || '',
          taxNumber: data.SellerRegisterNum || '',
          address: data.SellerAddress || '',
          phone: data.SellerBank || ''
        },
        totalAmount: parseFloat(data.AmountInFiguers) || 0,
        taxAmount: parseFloat(data.TotalTax) || 0,
        amountWithoutTax: parseFloat(data.AmountWithoutTax) || 0,
        items: (data.CommodityName || []).map((item, index) => ({
          name: item.word || '',
          quantity: parseFloat(data.CommodityNum?.[index]?.word) || 0,
          price: parseFloat(data.CommodityPrice?.[index]?.word) || 0,
          amount: parseFloat(data.CommodityAmount?.[index]?.word) || 0,
          tax: parseFloat(data.CommodityTax?.[index]?.word) || 0
        })),
        checkCode: data.CheckCode || '',
        remarks: data.Remarks || ''
      };
    }
    // words_result 不存在但没有抛异常，说明返回了错误结构，继续降级
  } catch (vatError) {
    console.error('[OCR] VAT 识别异常:', vatError.message);
    // 不在这里返回，继续降级
  }

  // ── 步骤2：VAT 识别失败或返回非发票格式，降级用通用 OCR + 文本解析 ──
  console.log('[OCR] VAT 识别失败，降级到通用 OCR + 文本解析');
  return recognizeFromGeneralOCR(image);
}

/**
 * 通用 OCR + 文本解析提取发票字段
 * @param {string} image - Base64编码的图片
 * @returns {object} 发票数据
 */
async function recognizeFromGeneralOCR(image) {
  try {
    // 调用百度通用 OCR（高精度版）
    const result = await client.accurate(image);
    const wordsResult = result.words_result;
    if (!wordsResult || wordsResult.length === 0) {
      return { success: false, error: '通用 OCR 也未能识别出文字' };
    }

    const fullText = wordsResult.map(w => w.words).join('\n');
    console.log('[OCR] 通用 OCR 识别文字长度:', fullText.length);
    return parseInvoiceFromText(fullText);
  } catch (genError) {
    console.error('[OCR] 通用 OCR 失败:', genError.message);
    return { success: false, error: 'OCR 识别失败' };
  }
}

/**
 * 从纯文本解析发票字段（支持多种发票格式）
 * @param {string} text - OCR 识别出的文本
 * @returns {object} 发票数据
 */
function parseInvoiceFromText(text) {
  const d = {
    invoiceCode: '', invoiceNo: '', type: '发票',
    date: '', buyer: { name: '' }, seller: { name: '' },
    totalAmount: 0, taxAmount: 0, amountWithoutTax: 0,
    items: [], checkCode: '', remarks: ''
  };

  // 发票号码：各种格式
  const patterns = [
    /发票号[码]?[：:]\s*([A-Z0-9]{6,20})/i,
    /发票编号[：:]\s*([A-Z0-9]{6,20})/i,
    /No\.?\s*([A-Z0-9]{6,20})/i,
    /(?:invoice|no)[：:\s]*([A-Z0-9]{6,20})/i,
    /编号[：:]\s*([A-Z0-9]{6,20})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) { d.invoiceNo = m[1]; break; }
  }

  // 开票日期
  const datePatterns = [
    /开票日期[：:]\s*(\d{4}[年\-/]\d{1,2}[月\-/]\d{1,2}[日]?)/,
    /开票[日]?[：:]\s*(\d{4}[年\-/]\d{1,2}[月\-/]\d{1,2}[日]?)/,
    /日期[：:]\s*(\d{4}[年\-/]\d{1,2}[月\-/]\d{1,2}[日]?)/,
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
  ];
  for (const p of datePatterns) {
    const m = text.match(p);
    if (m) {
      if (m[3]) d.date = `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
      else d.date = m[1];
      break;
    }
  }

  // 金额（价税合计）
  const totalPatterns = [
    /价税合计[（(][^）)]*[）)]\s*[¥￥]?\s*([\d,]+\.?\d*)/,
    /价税合计[：:]\s*[¥￥]?\s*([\d,]+\.?\d*)/,
    /合计[（(]含税[）)]\s*[¥￥]?\s*([\d,]+\.?\d*)/,
    /总计[：:]\s*[¥￥]?\s*([\d,]+\.?\d*)/,
    /总[额金][：:]\s*[¥￥]?\s*([\d,]+\.?\d*)/,
    /金额[（(]含税[）)][：:]\s*[¥￥]?\s*([\d,]+\.?\d*)/,
    /[¥￥]\s*([\d,]+\.?\d*)\s*$/m,
  ];
  for (const p of totalPatterns) {
    const m = text.match(p);
    if (m) { d.totalAmount = parseFloat(m[1].replace(/,/g, '')); break; }
  }

  // 税额
  const taxPatterns = [
    /税额[：:]\s*[¥￥]?\s*([\d,]+\.?\d*)\s*元?/,
    /税[额金][：:]\s*[¥￥]?\s*([\d,]+\.?\d*)\s*元?/,
  ];
  for (const p of taxPatterns) {
    const m = text.match(p);
    if (m) { d.taxAmount = parseFloat(m[1].replace(/,/g, '')); break; }
  }

  // 不含税金额
  const netPatterns = [
    /金额[（(]不含税[）)][：:]\s*[¥￥]?\s*([\d,]+\.?\d*)\s*元?/,
    /不含税[金额][：:]\s*[¥￥]?\s*([\d,]+\.?\d*)\s*元?/,
    /金额[（(]不含税[）)][：:]\s*[¥￥]?\s*([\d,]+\.?\d*)\s*元?/,
  ];
  for (const p of netPatterns) {
    const m = text.match(p);
    if (m) { d.amountWithoutTax = parseFloat(m[1].replace(/,/g, '')); break; }
  }

  // 购买方
  const buyerPatterns = [
    /购买方[名称]?[：:]\s*(.+)/,
    /收票单位[：:]\s*(.+)/,
    /购货单位[：:]\s*(.+)/,
  ];
  for (const p of buyerPatterns) {
    const m = text.match(p);
    if (m) { d.buyer.name = m[1].trim().split(/[\n\r]/)[0]; break; }
  }

  // 销售方
  const sellerPatterns = [
    /销售方[名称]?[：:]\s*(.+)/,
    /开票单位[：:]\s*(.+)/,
    /供货单位[：:]\s*(.+)/,
  ];
  for (const p of sellerPatterns) {
    const m = text.match(p);
    if (m) { d.seller.name = m[1].trim().split(/[\n\r]/)[0]; break; }
  }

  // 如果没有找到税额，从总额和不含税金额反推
  if (!d.taxAmount && d.totalAmount && d.amountWithoutTax) {
    d.taxAmount = Math.round((d.totalAmount - d.amountWithoutTax) * 100) / 100;
  }

  // 判断是否有效发票
  if (text.includes('作废') || text.includes('红字')) {
    d.remarks += '[作废] ';
  }

  const hasData = d.invoiceNo || d.date || d.totalAmount > 0;
  if (!hasData) {
    return { success: false, error: '未能从图片中解析出发票信息' };
  }

  return { success: true, ...d };
}

/**
 * 通用票据识别（定额发票、出租车票等）
 * @param {string} image - Base64编码的图片
 */
async function recognizeReceipt(image) {
  if (!client || !image) {
    return mockRecognize();
  }

  try {
    const result = await client.receipt(image);
    return {
      success: true,
      text: result.words_result?.map(w => w.words).join('\n') || '',
      raw: result
    };
  } catch (error) {
    console.error('票据识别错误:', error);
    return mockRecognize();
  }
}

/**
 * 模拟识别（无API Key时使用）
 */
function mockRecognize() {
  return {
    success: true,
    invoiceCode: '1100221130',
    invoiceNo: `INV${Date.now().toString().slice(-8)}`,
    type: '增值税专用发票',
    date: dayjs().format('YYYY-MM-DD'),
    buyer: {
      name: '示例科技有限公司',
      taxNumber: '91110108MA01234567'
    },
    seller: {
      name: '供应商公司',
      taxNumber: '91110000MA00YYYYY'
    },
    totalAmount: 1130.00,
    taxAmount: 130.00,
    amountWithoutTax: 1000.00,
    items: [
      { name: '办公用品', quantity: 1, price: 1000, amount: 1000, tax: 130 }
    ],
    checkCode: '1234567890123456',
    remarks: '',
    _mock: true // 标记为模拟数据
  };
}

/**
 * 检查OCR服务状态
 */
function getStatus() {
  return {
    configured: !!client,
    provider: client ? '百度OCR' : '模拟数据',
    apiKey: API_KEY ? `${API_KEY.slice(0, 4)}****${API_KEY.slice(-4)}` : '未配置'
  };
}

module.exports = {
  recognizeVatInvoice,
  recognizeReceipt,
  getStatus
};
