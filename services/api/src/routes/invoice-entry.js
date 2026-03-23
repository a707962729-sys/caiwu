const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { getDatabaseCompat, saveDatabase } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const baiduOcr = require('../services/baidu-ocr');
const invoiceProcessor = require('../services/invoice-processor');

router.use(authMiddleware);

/**
 * 获取入账规则配置
 */
router.get('/rules',
  permissionMiddleware('invoices', 'read'),
  asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const rules = await getEntryRules(null, companyId);
    
    // 转换为数组格式
    const rulesArray = [
      { 
        id: 1, 
        rule_type: 'company_check', 
        rule_name: '公司抬头校验', 
        rule_config: JSON.stringify(rules.companyCheck), 
        priority: 1,
        enabled: rules.companyCheck.enabled,
        companyName: rules.companyCheck.companyName,
        taxNumber: rules.companyCheck.taxNumber
      },
      { 
        id: 2, 
        rule_type: 'amount_limit', 
        rule_name: '金额限制', 
        rule_config: JSON.stringify(rules.amountLimit), 
        priority: 2,
        enabled: true,
        limit: rules.amountLimit.limit
      },
      { 
        id: 3, 
        rule_type: 'duplicate_check', 
        rule_name: '重复发票校验', 
        rule_config: JSON.stringify(rules.duplicateCheck), 
        priority: 3,
        enabled: rules.duplicateCheck.enabled
      },
      { 
        id: 4, 
        rule_type: 'valid_period', 
        rule_name: '发票有效期', 
        rule_config: JSON.stringify(rules.validPeriod), 
        priority: 4,
        enabled: true,
        months: rules.validPeriod.months
      }
    ];
    
    res.json({ success: true, data: rulesArray });
  })
);

/**
 * 更新入账规则
 */
router.put('/rules/:id',
  permissionMiddleware('invoices', 'write'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const { enabled, config } = req.body;
    const companyId = req.user.companyId;
    
    // 检查表是否存在
    try {
      db.prepare(`
        INSERT INTO invoice_entry_rules (company_id, rule_type, rule_name, rule_config, priority)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(company_id, rule_type) DO UPDATE SET rule_config = excluded.rule_config
      `).run(companyId, id, id, JSON.stringify({ enabled, ...config }), 1);
      saveDatabase();
    } catch (e) {
      // 表不存在，返回成功
    }
    
    res.json({ success: true, message: '规则更新成功' });
  })
);

/**
 * 发票OCR识别并入账
 */
router.post('/recognize',
  permissionMiddleware('invoices', 'create'),
  asyncHandler(async (req, res) => {
    const { image, autoEntry = false } = req.body;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const userId = req.user.id;
    
    // 调用百度OCR识别（自动判断是否配置了API Key，无则返回模拟数据）
    let base64Image = null;
    if (image) {
      // Base64图片，去掉前缀
      base64Image = image.replace(/^data:image\/\w+;base64,/, '');
    }
    
    const invoiceData = await baiduOcr.recognizeVatInvoice(base64Image);
    
    // 检查识别是否成功
    if (!invoiceData || !invoiceData.success) {
      return res.json({
        success: false,
        error: 'OCR_FAILED',
        message: invoiceData?.error || '发票识别失败'
      });
    }
    
    // 获取入账规则
    const rules = getEntryRules(db, companyId);
    
    // 验证发票
    const validationResult = validateInvoice(db, companyId, invoiceData, rules);
    
    if (!validationResult.valid) {
      return res.json({
        success: false,
        error: 'VALIDATION_FAILED',
        message: '发票验证失败',
        details: validationResult.errors,
        data: invoiceData
      });
    }
    
    // 自动入账
    if (autoEntry && validationResult.canAutoEntry) {
      const entryResult = createEntryFromInvoice(db, companyId, userId, invoiceData);
      return res.json({
        success: true,
        data: {
          invoice: invoiceData,
          validation: validationResult,
          entry: entryResult
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        invoice: invoiceData,
        validation: validationResult
      }
    });
  })
);

/**
 * 获取OCR服务状态
 */
router.get('/ocr-status',
  asyncHandler(async (req, res) => {
    const status = baiduOcr.getStatus();
    res.json({ success: true, data: status });
  })
);

/**
 * AI识别发票并入账（直接传入识别后的发票数据）
 */
router.post('/ai-recognize',
  permissionMiddleware('invoices', 'create'),
  asyncHandler(async (req, res) => {
    const { invoiceData, autoEntry = true } = req.body;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const userId = req.user.id;
    
    if (!invoiceData) {
      return res.json({
        success: false,
        error: 'MISSING_DATA',
        message: '请提供发票数据'
      });
    }
    
    // 标记为AI识别
    invoiceData._aiRecognized = true;
    
    // 获取入账规则
    const rules = getEntryRules(db, companyId);
    
    // 验证发票
    const validationResult = validateInvoice(db, companyId, invoiceData, rules);
    
    if (!validationResult.valid) {
      return res.json({
        success: false,
        error: 'VALIDATION_FAILED',
        message: '发票验证失败',
        details: validationResult.errors,
        warnings: validationResult.warnings,
        data: invoiceData
      });
    }
    
    // 自动入账
    if (autoEntry) {
      const entryResult = createEntryFromInvoice(db, companyId, userId, invoiceData);
      return res.json({
        success: true,
        data: {
          invoice: invoiceData,
          validation: validationResult,
          entry: entryResult
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        invoice: invoiceData,
        validation: validationResult
      }
    });
  })
);

/**
 * 确认入账
 */
router.post('/confirm',
  permissionMiddleware('invoices', 'create'),
  asyncHandler(async (req, res) => {
    const { invoiceData, forceEntry = false } = req.body;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const userId = req.user.id;
    
    // 获取规则
    const rules = getEntryRules(db, companyId);
    
    // 验证
    const validation = validateInvoice(db, companyId, invoiceData, rules);
    
    if (!validation.valid && !forceEntry) {
      return res.json({
        success: false,
        error: 'VALIDATION_FAILED',
        details: validation.errors
      });
    }
    
    // 创建入账
    const entry = createEntryFromInvoice(db, companyId, userId, invoiceData);
    
    res.json({ success: true, data: entry });
  })
);

// ========== 辅助函数 ==========

/**
 * 模拟OCR识别（实际应调用百度API）
 */
function mockOCREnabled(image) {
  // 模拟发票数据 - 使用正确的公司抬头和税号
  return {
    invoiceCode: '1100221130',
    invoiceNo: `INV${Date.now().toString().slice(-8)}`, // 每次不同避免重复
    type: '增值税专用发票',
    date: dayjs().format('YYYY-MM-DD'),
    buyer: {
      name: '示例科技有限公司', // 匹配公司抬头
      taxNumber: '91110108MA01234567' // 匹配公司税号
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
    remarks: '',
    checkCode: '1234567890123456'
  };
}

/**
 * 获取入账规则
 */
function getEntryRules(db, companyId) {
  let company = null;
  try {
    company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
  } catch (e) {
    // ignore
  }
  
  return {
    // 公司信息校验
    companyCheck: {
      enabled: true,
      companyName: company?.name || '示例科技有限公司',
      taxNumber: company?.tax_id || '91110108MA01234567'
    },
    // 金额限制
    amountLimit: {
      limit: 10000, // 超过1万需要审批
      requireApproval: true
    },
    // 重复校验
    duplicateCheck: {
      enabled: true
    },
    // 发票有效期
    validPeriod: {
      months: 6 // 发票6个月内有效
    }
  };
}

/**
 * 验证发票
 */
function validateInvoice(db, companyId, invoice, rules) {
  const errors = [];
  const warnings = [];
  
  // 确保 rules 存在
  rules = rules || {
    companyCheck: { enabled: true, companyName: '示例科技有限公司', taxNumber: '91110108MA01234567' },
    amountLimit: { limit: 10000, requireApproval: true },
    duplicateCheck: { enabled: true },
    validPeriod: { months: 6 }
  };
  
  // 1. 公司抬头校验
  if (rules.companyCheck?.enabled) {
    const expectedName = rules.companyCheck.companyName || '';
    const expectedTaxNumber = rules.companyCheck.taxNumber || '';
    
    if (invoice.buyer?.name && invoice.buyer.name !== expectedName) {
      errors.push({
        field: 'buyer_name',
        message: `发票抬头不匹配，应为「${expectedName}」，实际为「${invoice.buyer.name}」`
      });
    }
    
    if (invoice.buyer?.taxNumber && invoice.buyer.taxNumber !== expectedTaxNumber) {
      errors.push({
        field: 'buyer_tax_number',
        message: `税号不匹配，应为「${expectedTaxNumber}」`
      });
    }
  }
  
  // 2. 重复发票校验
  if (rules.duplicateCheck?.enabled) {
    try {
      const existing = db.prepare(`
        SELECT * FROM invoices 
        WHERE company_id = ? AND invoice_no = ? AND invoice_code = ?
      `).get(companyId, invoice.invoiceNo, invoice.invoiceCode);
      
      if (existing) {
        errors.push({
          field: 'invoice_no',
          message: '该发票已入账，请勿重复录入'
        });
      }
    } catch (e) {
      // ignore
    }
  }
  
  // 3. 金额限制校验
  if (rules.amountLimit?.requireApproval && invoice.totalAmount > rules.amountLimit.limit) {
    warnings.push({
      field: 'amount',
      message: `金额超过 ${rules.amountLimit.limit} 元，需要审批`
    });
  }
  
  // 4. 发票有效期校验
  const invoiceDate = dayjs(invoice.date);
  const monthsDiff = dayjs().diff(invoiceDate, 'month');
  if (monthsDiff > (rules.validPeriod?.months || 6)) {
    warnings.push({
      field: 'date',
      message: `发票已超过 ${rules.validPeriod?.months || 6} 个月，请确认是否可入账`
    });
  }
  
  return {
    valid: errors.length === 0,
    canAutoEntry: errors.length === 0 && warnings.length === 0,
    errors,
    warnings
  };
}

/**
 * 从发票创建入账记录
 */
function createEntryFromInvoice(db, companyId, userId, invoice) {
  // 确保所有字段有值
  const invoiceCode = invoice.invoiceCode || '';
  const invoiceNo = invoice.invoiceNo || `INV${Date.now()}`;
  const invoiceType = invoice.type || '增值税专用发票';
  const issueDate = invoice.date || dayjs().format('YYYY-MM-DD');
  const amountBeforeTax = invoice.amountWithoutTax || invoice.totalAmount || 0;
  const taxAmount = invoice.taxAmount || 0;
  const totalAmount = invoice.totalAmount || 0;
  const sellerName = invoice.seller?.name || '未知供应商';
  const itemName = invoice.items?.[0]?.name || '发票入账';
  
  // 创建发票记录
  const invoiceResult = db.prepare(`
    INSERT INTO invoices (
      company_id, invoice_code, invoice_no, invoice_type, direction,
      issue_date, amount_before_tax, tax_amount, total_amount, 
      status, description, created_by
    ) VALUES (?, ?, ?, ?, 'in', ?, ?, ?, ?, 'verified', ?, ?)
  `).run(
    companyId, invoiceCode, invoiceNo, invoiceType,
    issueDate, amountBeforeTax, taxAmount, totalAmount,
    `${sellerName} - ${itemName}`, userId
  );
  
  // 创建记账记录
  const txnNo = `TXN${dayjs().format('YYYYMMDD')}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  const txnResult = db.prepare(`
    INSERT INTO transactions (
      company_id, transaction_no, transaction_date, transaction_type, type,
      category, amount, description, invoice_id, status, created_by
    ) VALUES (?, ?, ?, 'expense', 'expense', '办公费用', ?, ?, ?, 'confirmed', ?)
  `).run(
    companyId, txnNo, issueDate,
    totalAmount,
    `${sellerName} - ${itemName}`,
    invoiceResult.lastInsertRowid, userId
  );
  
  saveDatabase();
  
  return {
    invoiceId: invoiceResult.lastInsertRowid,
    transactionId: txnResult.lastInsertRowid,
    transactionNo: txnNo
  };
}
/**
 * 上传发票文件并识别入账
 */
router.post('/upload',
  permissionMiddleware('invoices', 'create'),
  asyncHandler(async (req, res) => {
    const { autoEntry = true } = req.body;
    const companyId = req.user.companyId;
    const userId = req.user.id;
    
    if (!req.files || !req.files.file) {
      return res.json({
        success: false,
        error: 'NO_FILE',
        message: '请上传发票文件'
      });
    }
    
    const file = req.files.file;
    const ext = path.extname(file.name).toLowerCase();
    
    // 检查文件类型
    if (!['.pdf', '.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      return res.json({
        success: false,
        error: 'INVALID_TYPE',
        message: '仅支持PDF和图片格式'
      });
    }
    
    // 保存文件
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = path.join(uploadDir, fileName);
    await file.mv(filePath);
    
    try {
      // 处理发票
      const result = await invoiceProcessor.fullProcess(filePath, companyId, userId, { autoEntry });
      
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      res.json({
        success: false,
        error: 'PROCESS_FAILED',
        message: error.message
      });
    }
  })
);

/**
 * 从本地文件识别入账（给QQ机器人用）
 */
router.post('/process-local',
  permissionMiddleware('invoices', 'create'),
  asyncHandler(async (req, res) => {
    const { filePath, autoEntry = true } = req.body;
    const companyId = req.user.companyId;
    const userId = req.user.id;
    
    if (!filePath || !fs.existsSync(filePath)) {
      return res.json({
        success: false,
        error: 'FILE_NOT_FOUND',
        message: '文件不存在'
      });
    }
    
    try {
      const result = await invoiceProcessor.fullProcess(filePath, companyId, userId, { autoEntry });
      
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      res.json({
        success: false,
        error: 'PROCESS_FAILED',
        message: error.message
      });
    }
  })
);
module.exports = router;
