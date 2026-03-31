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
        warnings: validationResult.warnings,
        data: invoiceData
      });
    }
    
    // 自动入账（超标发票标记待审核）
    if (autoEntry && validationResult.canAutoEntry) {
      const entryResult = createEntryFromInvoice(db, companyId, userId, invoiceData, validationResult.needsReview);
      return res.json({
        success: true,
        data: {
          invoice: invoiceData,
          validation: validationResult,
          entry: entryResult,
          needsReview: validationResult.needsReview
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

/**
 * 内部发票OCR识别（AI服务调用，免认证）
 */
router.post('/internal-recognize',
  asyncHandler(async (req, res) => {
    const { image } = req.body;
    if (!image) {
      return res.json({ success: false, error: '缺少图片' });
    }
    let base64Image = image.replace(/^data:image\/\w+;base64,/, '');
    const invoiceData = await baiduOcr.recognizeVatInvoice(base64Image);
    if (!invoiceData || !invoiceData.success) {
      return res.json({ success: false, error: invoiceData?.error || 'OCR识别失败' });
    }
    return res.json({ success: true, data: invoiceData });
  })
);

/**
 * 内部AI识别发票并入账（AI服务调用，免JWT认证，使用API Key）
 */
router.post('/internal-ai-recognize',
  asyncHandler(async (req, res) => {
    console.log('[INTERNAL-AI-RECOGNIZE] CALLED');
    const { invoiceData, autoEntry = true, companyId: reqCompanyId } = req.body;
    const db = getDatabaseCompat();
    // 内部调用使用 companyId=1（QQ机器人场景）
    const companyId = reqCompanyId || 1;
    const userId = 0; // 系统/QQBot 创建

    if (!invoiceData) {
      return res.json({ success: false, error: 'MISSING_DATA', message: '请提供发票数据' });
    }

    // 标记为AI识别
    invoiceData._aiRecognized = true;

    // 获取入账规则
    const rules = getEntryRules(db, companyId);

    // 验证发票
    const validationResult = validateInvoice(db, companyId, invoiceData, rules);

    // 金额超标时标记待审核，重复发票等错误仍阻断
    const needsReview = validationResult.needsReview;
    if (needsReview) {
      const violation = validationResult.warnings.find(w => w.code === 'EXCEEDS_LIMIT' || w.code === 'EXCEEDS_DAILY_LIMIT');
      console.log('[Invoice-Entry] 发票超出报销标准，标记为待审核:', violation?.message || '');
    }
    
    // 重复发票等 ERROR 仍然报错，不走自动入库
    if (!validationResult.valid) {
      return res.json({
        success: false,
        error: 'VALIDATION_FAILED',
        message: '发票验证失败',
        details: validationResult.errors,
        data: invoiceData
      });
    }

    // 自动入账（验证失败时也保存，状态为待审核）
    if (autoEntry || needsReview) {
      const entryResult = createEntryFromInvoice(db, companyId, userId, invoiceData, needsReview);
      return res.json({
        success: true,
        data: {
          invoice: invoiceData,
          validation: validationResult,
          entry: entryResult,
          needsReview: needsReview
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
    
    // 自动入账（超标发票标记待审核）
    if (autoEntry) {
      const entryResult = createEntryFromInvoice(db, companyId, userId, invoiceData, validationResult.needsReview);
      return res.json({
        success: true,
        data: {
          invoice: invoiceData,
          validation: validationResult,
          entry: entryResult,
          needsReview: validationResult.needsReview
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        invoice: invoiceData,
        validation: validationResult,
        needsReview: validationResult.needsReview
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
        details: validation.errors,
        warnings: validation.warnings
      });
    }
    
    // 创建入账（超标发票强制入账时也标记待审核）
    const entry = createEntryFromInvoice(db, companyId, userId, invoiceData, validation.needsReview);
    
    res.json({ success: true, data: entry, needsReview: validation.needsReview });
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
 * 验证发票 - 根据报销标准检查金额是否违规
 * 逻辑：
 * 1. 查询报销标准（按发票种类匹配）
 * 2. 检查金额是否超过单项限额
 * 3. 超标 → 标记违规（待审核）；合规 → 直接入库
 * 4. 保留重复发票校验和有效期检查（作为警告，不阻断入库）
 */
function validateInvoice(db, companyId, invoice, rules) {
  const errors = [];
  const warnings = [];
  
  // 确保 rules 存在
  rules = rules || {
    duplicateCheck: { enabled: true },
    validPeriod: { months: 6 }
  };
  
  // 1. 重复发票校验（警告，不阻断）
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
  
  // 2. 根据发票种类匹配报销标准，检查金额上限
  const invoiceType = invoice.type || invoice.invoiceType || '其他';
  const standard = findReimbursementStandard(db, companyId, invoiceType);
  
  if (standard) {
    const totalAmount = invoice.totalAmount || 0;
    const perItemLimit = parseFloat(standard.per_item_limit) || 0;
    const dailyLimit = parseFloat(standard.daily_limit) || 0;
    
    // 以 per_item_limit 为主要判断依据
    if (perItemLimit > 0 && totalAmount > perItemLimit) {
      warnings.push({
        field: 'amount',
        code: 'EXCEEDS_LIMIT',
        message: `金额超出报销标准【${standard.name}】的单项限额：标准 ¥${perItemLimit}，实际 ¥${totalAmount.toFixed(2)}`,
        standard: {
          id: standard.id,
          name: standard.name,
          category: standard.category,
          per_item_limit: perItemLimit,
          daily_limit: dailyLimit
        },
        actual: totalAmount
      });
    } else if (dailyLimit > 0 && totalAmount > dailyLimit) {
      warnings.push({
        field: 'amount',
        code: 'EXCEEDS_DAILY_LIMIT',
        message: `金额超出报销标准【${standard.name}】的日限额：标准 ¥${dailyLimit}，实际 ¥${totalAmount.toFixed(2)}`,
        standard: {
          id: standard.id,
          name: standard.name,
          category: standard.category,
          per_item_limit: perItemLimit,
          daily_limit: dailyLimit
        },
        actual: totalAmount
      });
    }
  }
  
  // 3. 发票有效期校验（警告，不阻断）
  if (invoice.date) {
    const invoiceDate = dayjs(invoice.date);
    const monthsDiff = dayjs().diff(invoiceDate, 'month');
    if (monthsDiff > (rules.validPeriod?.months || 6)) {
      warnings.push({
        field: 'date',
        message: `发票已超过 ${rules.validPeriod?.months || 6} 个月，请确认是否可入账`
      });
    }
  }
  
  // 金额超标 → 需要人工审核（但不算 errors，只是 needsReview）
  const needsReview = warnings.some(w => w.code === 'EXCEEDS_LIMIT' || w.code === 'EXCEEDS_DAILY_LIMIT');
  
  return {
    valid: errors.length === 0,
    canAutoEntry: errors.length === 0 && !needsReview,
    errors,
    warnings,
    needsReview,
    matchedStandard: standard ? {
      id: standard.id,
      name: standard.name,
      category: standard.category,
      per_item_limit: parseFloat(standard.per_item_limit) || 0,
      daily_limit: parseFloat(standard.daily_limit) || 0
    } : null
  };
}

/**
 * 根据发票种类查找报销标准
 * 匹配逻辑：
 * 1. 优先精确匹配 reimbursement_standards.category = invoiceType
 * 2. 其次模糊匹配（发票种类名称含标准类别关键词）
 * 3. 默认匹配 'other' 类别
 */
function findReimbursementStandard(db, companyId, invoiceType) {
  try {
    // 精确匹配 category = invoiceType
    let standard = db.prepare(`
      SELECT * FROM reimbursement_standards 
      WHERE company_id = ? AND category = ? AND status = 'active'
      LIMIT 1
    `).get(companyId, invoiceType);
    
    if (standard) return standard;
    
    // 模糊匹配：发票类型关键词映射到标准类别
    const typeKeywordMap = {
      '电子发票': ['electronic', '电子'],
      '增值税专用发票': ['vat_special', 'vat_special_invoice', '专用发票', '增值税专用'],
      '增值税普通发票': ['vat_normal', '普通发票', '增值税普通'],
      '定额发票': ['fixed', '定额', '定额发票'],
      '出租车票': ['taxi', 'transport', '交通', '打车'],
      '火车票': ['train', 'transport', '交通'],
      '机票': ['flight', 'transport', '交通'],
      '餐饮': ['meal', '餐饮'],
      '住宿': ['accommodation', '住宿'],
      '交通': ['transport', '交通'],
      '办公用品': ['office', '办公'],
      '其他': ['other', '其他']
    };
    
    const keywords = typeKeywordMap[invoiceType] || [];
    
    for (const keyword of keywords) {
      standard = db.prepare(`
        SELECT * FROM reimbursement_standards 
        WHERE company_id = ? AND (category LIKE ? OR name LIKE ? OR description LIKE ?) AND status = 'active'
        LIMIT 1
      `).get(companyId, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      
      if (standard) return standard;
    }
    
    // 如果 invoiceType 本身可以当作 category 关键字搜索
    standard = db.prepare(`
      SELECT * FROM reimbursement_standards 
      WHERE company_id = ? AND (category LIKE ? OR name LIKE ?) AND status = 'active'
      LIMIT 1
    `).get(companyId, `%${invoiceType}%`, `%${invoiceType}%`);
    
    if (standard) return standard;
    
    // 默认取第一条 active 标准（兜底）
    return db.prepare(`
      SELECT * FROM reimbursement_standards 
      WHERE company_id = ? AND status = 'active'
      LIMIT 1
    `).get(companyId);
    
  } catch (e) {
    console.error('[validateInvoice] findReimbursementStandard error:', e.message);
    return null;
  }
}

/**
 * 从发票创建入账记录
 */
function createEntryFromInvoice(db, companyId, userId, invoice, needsReview = false) {
  // 确保所有字段有值
  const invoiceCode = invoice.invoiceCode || '';
  const invoiceNo = invoice.invoiceNo || `INV${Date.now()}`;
  const invoiceType = invoice.type || '增值税专用发票';
  const issueDate = invoice.date || dayjs().format('YYYY-MM-DD');
  const amountBeforeTax = invoice.amountWithoutTax || invoice.totalAmount || 0;
  const taxAmount = invoice.taxAmount || 0;
  const totalAmount = invoice.totalAmount || 0;
  const sellerName = invoice.seller?.name || invoice.seller?.Name || '未知供应商';
  const sellerTaxId = invoice.seller?.taxNumber || invoice.seller?.TaxNumber || '';
  const buyerName = invoice.buyer?.name || invoice.buyer?.Name || '';
  const buyerTaxId = invoice.buyer?.taxNumber || invoice.buyer?.TaxNumber || '';
  const itemName = invoice.items?.[0]?.name || '发票入账';
  
  // 检查是否已存在
  const existingInvoice = db.prepare(`
    SELECT id FROM invoices WHERE company_id = ? AND invoice_no = ? AND invoice_code = ?
  `).get(companyId, invoiceNo, invoiceCode);
  
  let invoiceId;
  if (existingInvoice) {
    // 已存在：更新
    invoiceId = existingInvoice.id;
    db.prepare(`
      UPDATE invoices SET 
        invoice_type = ?, issue_date = ?, amount_before_tax = ?, tax_amount = ?,
        total_amount = ?, status = ?, description = ?, updated_at = datetime('now'),
        seller_name = ?, seller_tax_id = ?, buyer_name = ?, buyer_tax_id = ?
      WHERE id = ?
    `).run(invoiceType, issueDate, amountBeforeTax, taxAmount, totalAmount,
      needsReview ? 'pending_review' : 'verified',
      `${sellerName} - ${itemName}`, sellerName, sellerTaxId, buyerName, buyerTaxId, invoiceId);
    console.log('[createEntryFromInvoice] Updated existing invoice:', invoiceId);
  } else {
    // 新增发票
    const invoiceResult = db.prepare(`
      INSERT INTO invoices (
        company_id, invoice_code, invoice_no, invoice_type, direction,
        issue_date, amount_before_tax, tax_amount, total_amount, 
        status, description, created_by, seller_name, seller_tax_id, buyer_name, buyer_tax_id
      ) VALUES (?, ?, ?, ?, 'in', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, invoiceCode, invoiceNo, invoiceType,
      issueDate, amountBeforeTax, taxAmount, totalAmount,
      needsReview ? 'pending_review' : 'verified',
      `${sellerName} - ${itemName}`, userId, sellerName, sellerTaxId, buyerName, buyerTaxId
    );
    invoiceId = invoiceResult.lastInsertRowid;
  }
  
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
    invoiceId, userId
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
