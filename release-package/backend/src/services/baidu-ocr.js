/**
 * 百度OCR服务
 * 文档：https://cloud.baidu.com/doc/OCR/s/1k3h7y3db
 */

const dayjs = require('dayjs');

// 检查是否安装了baidu-aip-sdk
let AipOcrClient = null;
try {
  AipOcrClient = require('baidu-aip-sdk').ocr;
} catch (e) {
  console.log('baidu-aip-sdk not installed, using mock OCR');
}

// 配置
const API_KEY = process.env.BAIDU_OCR_API_KEY || '';
const SECRET_KEY = process.env.BAIDU_OCR_SECRET_KEY || '';

// 创建客户端
let client = null;
if (AipOcrClient && API_KEY && API_KEY !== 'your_api_key_here') {
  client = new AipOcrClient(API_KEY, SECRET_KEY);
  console.log('✅ 百度OCR已初始化');
} else {
  console.log('⚠️ 百度OCR未配置，使用模拟数据');
}

/**
 * 增值税发票识别
 * @param {string} image - Base64编码的图片
 * @returns {object} 识别结果
 */
async function recognizeVatInvoice(image) {
  // 无图片或未配置，返回模拟数据
  if (!image || !client) {
    return mockRecognize();
  }

  try {
    // 调用百度增值税发票识别API
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
    
    return { success: false, error: '识别失败' };
  } catch (error) {
    console.error('百度OCR错误:', error);
    // 出错时返回模拟数据
    return mockRecognize();
  }
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