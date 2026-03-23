/**
 * 发票处理服务 - 识别、验证、入账
 */

const fs = require('fs');
const path = require('path');
const aiGateway = require('./ai-gateway');
const { getDatabaseCompat } = require('../database');

class InvoiceProcessor {
  constructor() {
    this.uploadDir = path.join(__dirname, '../../uploads/invoices');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }
  
  /**
   * 处理发票文件（PDF或图片）
   */
  async processInvoice(filePath, companyId, userId) {
    const ext = path.extname(filePath).toLowerCase();
    
    let invoiceData;
    
    if (ext === '.pdf') {
      // PDF先用文本提取，失败则转图片用AI识别
      try {
        invoiceData = await this.extractFromPDF(filePath);
        console.log('PDF文本提取成功');
      } catch (error) {
        console.log('PDF文本提取失败，尝试转图片用AI识别...');
        // 可以添加PDF转图片逻辑
        throw new Error('PDF解析失败，请尝试发送发票图片');
      }
    } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      // 图片直接用AI视觉模型识别
      invoiceData = await this.extractFromImage(filePath);
    } else {
      throw new Error('不支持的文件格式，请发送PDF或图片(PNG/JPG/WEBP)');
    }
    
    // 标记来源
    invoiceData._source = 'file';
    invoiceData._filePath = filePath;
    
    return invoiceData;
  }
  
  /**
   * 从PDF提取发票信息
   */
  async extractFromPDF(filePath) {
    const { execSync } = require('child_process');
    
    try {
      // 使用pdftotext提取文本
      const text = execSync(`pdftotext "${filePath}" -`, { encoding: 'utf-8' });
      
      // 解析发票信息
      return this.parseInvoiceText(text);
    } catch (error) {
      console.error('PDF提取失败:', error.message);
      throw new Error('PDF解析失败，请检查文件是否有效');
    }
  }
  
  /**
   * 从图片提取发票信息（使用AI视觉模型）
   */
  async extractFromImage(filePath) {
    const imageBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    // 根据扩展名确定MIME类型
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp'
    };
    const mimeType = mimeTypes[ext] || 'image/png';
    
    const imageBase64 = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;
    
    console.log('使用AI视觉模型识别发票...');
    
    // 调用AI视觉模型识别
    const result = await aiGateway.recognizeInvoice(dataUrl);
    
    if (result.success) {
      try {
        // 尝试解析JSON
        let jsonStr = result.content;
        
        // 提取JSON部分
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          console.log('AI识别成功:', data.invoiceNo, data.totalAmount);
          return data;
        }
      } catch (e) {
        console.error('AI返回格式解析失败:', e);
      }
    }
    
    throw new Error('发票识别失败，请确保图片清晰');
  }
  
  /**
   * 解析发票文本
   */
  parseInvoiceText(text) {
    const invoice = {
      type: '电子发票(普通发票)',
      buyer: {},
      seller: {},
      items: []
    };
    
    // 发票号码
    const invoiceNoMatch = text.match(/发票号码[：:]\s*(\S+)/);
    if (invoiceNoMatch) invoice.invoiceNo = invoiceNoMatch[1];
    
    // 开票日期
    const dateMatch = text.match(/开票日期[：:]\s*(\d{4}年\d{1,2}月\d{1,2}日)/);
    if (dateMatch) {
      invoice.date = dateMatch[1].replace(/年|月/g, '-').replace('日', '');
    }
    
    // 购买方
    const buyerNameMatch = text.match(/名\s*称[：:]\s*(.+?)(?:\n|统一社会)/);
    if (buyerNameMatch) invoice.buyer.name = buyerNameMatch[1].trim();
    
    const buyerTaxMatch = text.match(/纳税人识别号[：:]\s*(\S+)/);
    if (buyerTaxMatch) invoice.buyer.taxNumber = buyerTaxMatch[1];
    
    // 销售方
    const lines = text.split('\n');
    let inSeller = false;
    for (const line of lines) {
      if (line.includes('销售方') || line.includes('销')) {
        inSeller = true;
      }
      if (inSeller && line.includes('名') && line.includes('称')) {
        const nameMatch = line.match(/名\s*称[：:]\s*(.+)/);
        if (nameMatch) invoice.seller.name = nameMatch[1].trim();
      }
    }
    
    // 金额 - 查找所有金额
    const allText = text.replace(/\n/g, ' ');
    
    // 尝试匹配 ¥金额 格式
    const amountMatches = allText.match(/¥(\d+\.?\d*)/g);
    if (amountMatches && amountMatches.length >= 3) {
      // 发票格式通常是: 不含税金额, 价税合计, 税额
      invoice.amountWithoutTax = parseFloat(amountMatches[0].replace('¥', ''));
      invoice.totalAmount = parseFloat(amountMatches[1].replace('¥', ''));
      invoice.taxAmount = parseFloat(amountMatches[2].replace('¥', ''));
    } else if (amountMatches && amountMatches.length >= 1) {
      // 只有总金额
      invoice.totalAmount = parseFloat(amountMatches[0].replace('¥', ''));
    }
    
    // 商品明细
    const itemMatch = text.match(/\*\s*([^*]+)\*([^0-9]+)(\d+\.?\d*)/);
    if (itemMatch) {
      invoice.items.push({
        name: itemMatch[2].trim(),
        quantity: 1,
        price: parseFloat(itemMatch[3]),
        amount: parseFloat(itemMatch[3]),
        tax: invoice.taxAmount || 0
      });
    }
    
    return invoice;
  }
  
  /**
   * 验证发票
   */
  validateInvoice(invoiceData, companyId) {
    const db = getDatabaseCompat();
    const errors = [];
    const warnings = [];
    
    // 检查必填字段
    if (!invoiceData.invoiceNo) {
      errors.push({ field: 'invoiceNo', message: '发票号码不能为空' });
    }
    
    if (!invoiceData.totalAmount || invoiceData.totalAmount <= 0) {
      errors.push({ field: 'totalAmount', message: '发票金额无效' });
    }
    
    if (!invoiceData.date) {
      warnings.push({ field: 'date', message: '发票日期未识别' });
    }
    
    // 检查重复
    if (invoiceData.invoiceNo) {
      const existing = db.prepare(`
        SELECT id FROM invoices WHERE invoice_no = ? AND company_id = ?
      `).get(invoiceData.invoiceNo, companyId);
      
      if (existing) {
        errors.push({ field: 'invoiceNo', message: '发票已存在，不能重复入账' });
      }
    }
    
    // 检查公司抬头
    const company = db.prepare('SELECT name, tax_id FROM companies WHERE id = ?').get(companyId);
    if (company && invoiceData.buyer?.name) {
      if (!invoiceData.buyer.name.includes(company.name.substring(0, 4))) {
        warnings.push({ 
          field: 'buyer_name', 
          message: `发票抬头可能与公司名称不符（${invoiceData.buyer.name}）` 
        });
      }
    }
    
    // 检查报销标准
    const complianceCheck = this.checkCompliance(invoiceData, companyId);
    if (complianceCheck.warnings.length > 0) {
      warnings.push(...complianceCheck.warnings);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      canAutoEntry: errors.length === 0 && warnings.length <= 2 && complianceCheck.isCompliant,
      compliance: complianceCheck
    };
  }
  
  /**
   * 检查报销标准
   */
  checkCompliance(invoiceData, companyId) {
    const db = getDatabaseCompat();
    const warnings = [];
    let isCompliant = true;
    
    // 判断发票类型
    const categoryMap = {
      '餐饮': 'meal',
      '住宿': 'accommodation', 
      '交通': 'transport',
      '打车': 'transport',
      '出租车': 'transport'
    };
    
    let category = 'other';
    const itemName = (invoiceData.items?.[0]?.name || invoiceData.type || '').toLowerCase();
    for (const [keyword, cat] of Object.entries(categoryMap)) {
      if (itemName.includes(keyword)) {
        category = cat;
        break;
      }
    }
    
    // 查询报销标准
    const standards = db.prepare(`
      SELECT * FROM reimbursement_standards 
      WHERE company_id = ? AND category = ? AND status = 'active'
    `).all(companyId, category);
    
    if (standards.length > 0 && invoiceData.totalAmount) {
      const standard = standards[0];
      const amount = invoiceData.totalAmount;
      
      if (standard.daily_limit && amount > standard.daily_limit) {
        warnings.push({ 
          field: 'amount', 
          message: `超出日报销标准: 标准 ¥${standard.daily_limit}, 实际 ¥${amount.toFixed(2)}`,
          standard,
          actual: amount 
        });
        isCompliant = false;
      }
      
      if (standard.per_item_limit && amount > standard.per_item_limit) {
        warnings.push({ 
          field: 'amount', 
          message: `超出单项限额: 标准 ¥${standard.per_item_limit}, 实际 ¥${amount.toFixed(2)}`,
          standard,
          actual: amount 
        });
        isCompliant = false;
      }
    }
    
    return { warnings, isCompliant, category };
  }
  
  /**
   * 创建入账记录
   */
  createEntry(invoiceData, companyId, userId) {
    const db = getDatabaseCompat();
    
    // 生成凭证号
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = db.prepare(`
      SELECT COUNT(*) as cnt FROM transactions 
      WHERE company_id = ? AND transaction_date = ?
    `).get(companyId, date.toISOString().slice(0, 10))?.cnt || 0;
    const transactionNo = `TXN${dateStr}${String(count + 1).padStart(4, '0')}`;
    
    // 创建交易记录
    const result = db.prepare(`
      INSERT INTO transactions (
        company_id, transaction_no, transaction_date, type,
        category, amount, currency, status,
        description, created_by
      ) VALUES (?, ?, ?, 'expense', '办公费用', ?, 'CNY', 'confirmed', ?, ?)
    `).run(
      companyId,
      transactionNo,
      invoiceData.date || date.toISOString().slice(0, 10),
      invoiceData.totalAmount,
      `${invoiceData.seller?.name || '未知商家'} - ${invoiceData.items?.[0]?.name || '发票入账'}`,
      userId
    );
    
    // 更新发票状态
    db.prepare(`
      UPDATE invoices SET 
        status = 'verified',
        transaction_id = ?,
        verify_date = ?
      WHERE invoice_no = ? AND company_id = ?
    `).run(
      result.lastInsertRowid,
      date.toISOString().slice(0, 10),
      invoiceData.invoiceNo,
      companyId
    );
    
    return {
      transactionId: result.lastInsertRowid,
      transactionNo,
      amount: invoiceData.totalAmount
    };
  }
  
  /**
   * 完整入账流程
   */
  async fullProcess(filePath, companyId, userId, options = {}) {
    const { autoEntry = true, skipValidation = false } = options;
    
    // 1. 提取发票信息
    const invoiceData = await this.processInvoice(filePath, companyId, userId);
    
    // 2. 先验证（检查重复等）
    const validation = this.validateInvoice(invoiceData, companyId);
    
    if (!validation.valid) {
      return {
        success: false,
        error: 'VALIDATION_FAILED',
        message: validation.errors[0]?.message || '发票验证失败',
        details: validation.errors,
        warnings: validation.warnings,
        invoiceData
      };
    }
    
    // 3. 决定发票状态：超标则待审核
    const invoiceStatus = validation.compliance?.isCompliant === false ? 'pending_review' : 'verified';
    
    // 4. 保存发票记录
    const db = getDatabaseCompat();
    const invoiceResult = db.prepare(`
      INSERT INTO invoices (
        company_id, invoice_type, invoice_no, invoice_code,
        direction, issue_date, amount_before_tax, tax_amount,
        total_amount, status, created_by, seller_name, buyer_name
      ) VALUES (?, ?, ?, ?, 'in', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId,
      invoiceData.type || '电子发票(普通发票)',
      invoiceData.invoiceNo,
      invoiceData.invoiceCode || invoiceData.invoiceNo,
      invoiceData.date || new Date().toISOString().slice(0, 10),
      invoiceData.amountWithoutTax || 0,
      invoiceData.taxAmount || 0,
      invoiceData.totalAmount || 0,
      invoiceStatus,
      userId,
      invoiceData.seller?.name || '',
      invoiceData.buyer?.name || ''
    );
    
    // 5. 只有合规的发票才自动入账
    let entryResult = null;
    if (autoEntry && validation.canAutoEntry && invoiceStatus === 'verified') {
      entryResult = this.createEntry(invoiceData, companyId, userId);
    }
    
    return {
      success: true,
      invoiceData,
      validation,
      entry: entryResult,
      invoiceId: invoiceResult.lastInsertRowid,
      status: invoiceStatus
    };
  }
}

// 单例
const invoiceProcessor = new InvoiceProcessor();
module.exports = invoiceProcessor;
