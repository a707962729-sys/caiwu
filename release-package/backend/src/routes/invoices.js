const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema, invoiceSchemas } = require('../middleware/validation');
const { AuditLogger } = require('../middleware/audit');
const invoiceProcessor = require('../services/invoice-processor');

router.use(authMiddleware);

/**
 * @route   POST /api/invoices/auto-process
 * @desc    自动处理发票并入库
 */
router.post('/auto-process',
  permissionMiddleware('invoices', 'create'),
  asyncHandler(async (req, res) => {
    const { filePath, companyId, userId, autoEntry = true } = req.body;
    
    if (!filePath) {
      throw ErrorTypes.BadRequest('filePath 参数必填');
    }
    
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      throw ErrorTypes.BadRequest(`文件不存在: ${filePath}`);
    }
    
    // 使用请求用户的公司和ID（如果未提供）
    const targetCompanyId = companyId || req.user.companyId;
    const targetUserId = userId || req.user.id;
    
    // 调用发票处理器完整流程
    const result = await invoiceProcessor.fullProcess(filePath, targetCompanyId, targetUserId, { autoEntry });
    
    if (result.success) {
      // 记录审计日志
      AuditLogger.logCreate('invoices', result.invoiceId, result.invoiceData, req);
      
      res.status(201).json({
        success: true,
        data: {
          invoiceId: result.invoiceId,
          invoiceNo: result.invoiceData.invoiceNo,
          totalAmount: result.invoiceData.totalAmount,
          seller: result.invoiceData.seller?.name,
          date: result.invoiceData.date,
          entry: result.entry,
          warnings: result.validation?.warnings || []
        },
        message: result.entry ? '发票已识别并自动入账' : '发票已识别，待人工审核'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        code: result.error,
        details: result.details,
        warnings: result.warnings,
        invoiceData: result.invoiceData
      });
    }
  })
);

/**
 * @route   GET /api/invoices
 * @desc    获取票据列表
 */
router.get('/',
  permissionMiddleware('invoices', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, status, direction, partnerId, startDate, endDate, sortBy = 'issue_date', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;
    
    // 处理 company_id 为 null 的情况
    let whereClause = companyId ? 'WHERE i.company_id = ?' : 'WHERE (i.company_id IS NULL OR i.company_id = 0)';
    const params = companyId ? [companyId] : [];
    
    if (search) {
      whereClause += ' AND (i.invoice_no LIKE ? OR i.invoice_code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (status) {
      whereClause += ' AND i.status = ?';
      params.push(status);
    }
    
    if (direction) {
      whereClause += ' AND i.direction = ?';
      params.push(direction);
    }
    
    if (partnerId) {
      whereClause += ' AND i.partner_id = ?';
      params.push(parseInt(partnerId));
    }
    
    if (startDate) {
      whereClause += ' AND i.issue_date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      whereClause += ' AND i.issue_date <= ?';
      params.push(endDate);
    }
    
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM invoices i ${whereClause}`).get(...params);
    const total = countResult?.total || 0;
    
    // SQL 注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'invoice_no', 'invoice_code', 'invoice_type', 'issue_date', 'direction', 'status', 'amount_before_tax', 'tax_amount', 'total_amount', 'currency', 'created_at', 'updated_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'issue_date';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    const offset = (page - 1) * pageSize;
    const invoices = db.prepare(`
      SELECT i.*, p.name as partner_name, c.name as contract_name, o.name as order_name
      FROM invoices i
      LEFT JOIN partners p ON i.partner_id = p.id
      LEFT JOIN contracts c ON i.contract_id = c.id
      LEFT JOIN orders o ON i.order_id = o.id
      ${whereClause}
      ORDER BY i.${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    
    res.json({
      success: true,
      data: {
        list: invoices,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/invoices/stats
 * @desc    获取票据统计
 */
router.get('/stats',
  permissionMiddleware('invoices', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { startDate, endDate } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE company_id = ?';
    const params = [companyId];
    
    if (startDate) {
      whereClause += ' AND issue_date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      whereClause += ' AND issue_date <= ?';
      params.push(endDate);
    }
    
    const stats = db.prepare(`
      SELECT 
        direction,
        SUM(amount_before_tax) as total_before_tax,
        SUM(tax_amount) as total_tax,
        SUM(total_amount) as total_amount,
        COUNT(*) as count
      FROM invoices
      ${whereClause}
      GROUP BY direction
    `).all(...params);
    
    const monthly = db.prepare(`
      SELECT 
        strftime('%Y-%m', issue_date) as month,
        direction,
        SUM(total_amount) as total_amount,
        COUNT(*) as count
      FROM invoices
      ${whereClause}
      GROUP BY strftime('%Y-%m', issue_date), direction
      ORDER BY month DESC
      LIMIT 24
    `).all(...params);
    
    // 按状态统计
    const byStatus = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(total_amount) as total_amount
      FROM invoices
      ${whereClause}
      GROUP BY status
    `).all(...params);
    
    // 计算待审核数量
    const pendingReview = byStatus.find(s => s.status === 'pending_review')?.count || 0;
    const total = stats.reduce((sum, s) => sum + s.count, 0);
    const totalAmount = stats.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    
    res.json({ 
      success: true, 
      data: { 
        stats, 
        monthly, 
        byStatus,
        total,
        totalAmount,
        pendingReview
      } 
    });
  })
);

/**
 * @route   GET /api/invoices/:id
 * @desc    获取票据详情
 */
router.get('/:id',
  permissionMiddleware('invoices', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const companyId = req.user.companyId;
    let invoice;
    
    if (companyId) {
      invoice = db.prepare(`
        SELECT i.*, p.name as partner_name, c.name as contract_name, o.name as order_name
        FROM invoices i
        LEFT JOIN partners p ON i.partner_id = p.id
        LEFT JOIN contracts c ON i.contract_id = c.id
        LEFT JOIN orders o ON i.order_id = o.id
        WHERE i.id = ? AND i.company_id = ?
      `).get(req.params.id, companyId);
    } else {
      // company_id 为 null 时，查询所有公司或无公司的发票
      invoice = db.prepare(`
        SELECT i.*, p.name as partner_name, c.name as contract_name, o.name as order_name
        FROM invoices i
        LEFT JOIN partners p ON i.partner_id = p.id
        LEFT JOIN contracts c ON i.contract_id = c.id
        LEFT JOIN orders o ON i.order_id = o.id
        WHERE i.id = ? AND (i.company_id IS NULL OR i.company_id = 0)
      `).get(req.params.id);
    }
    
    if (!invoice) {
      throw ErrorTypes.NotFound('票据');
    }
    
    res.json({ success: true, data: invoice });
  })
);

/**
 * @route   POST /api/invoices
 * @desc    创建票据
 */
router.post('/',
  permissionMiddleware('invoices', 'create'),
  validate(invoiceSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    const existing = db.prepare('SELECT id FROM invoices WHERE company_id = ? AND invoice_no = ?').get(companyId, req.body.invoice_no);
    if (existing) {
      throw ErrorTypes.DuplicateEntry('发票号码');
    }
    
    const result = db.prepare(`
      INSERT INTO invoices (
        company_id, invoice_type, invoice_no, invoice_code, direction,
        partner_id, contract_id, order_id, issue_date, amount_before_tax,
        tax_rate, tax_amount, total_amount, currency, description, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, req.body.invoice_type, req.body.invoice_no, req.body.invoice_code || null,
      req.body.direction, req.body.partner_id || null, req.body.contract_id || null,
      req.body.order_id || null, req.body.issue_date, req.body.amount_before_tax,
      req.body.tax_rate || 0, req.body.tax_amount || 0, req.body.total_amount,
      req.body.currency, req.body.description || null, req.body.notes || null, req.user.id
    );
    
    const newInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(result.lastInsertRowid);
    
    // 记录审计日志
    AuditLog.create(req.user.id, AuditLog.MODULES.INVOICES, result.lastInsertRowid, newInvoice, req);
    
    res.status(201).json({ success: true, data: newInvoice, message: '票据创建成功' });
  })
);

/**
 * @route   PUT /api/invoices/:id
 * @desc    更新票据
 */
router.put('/:id',
  permissionMiddleware('invoices', 'update'),
  validateId('id'),
  validate(invoiceSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
    if (!invoice) {
      throw ErrorTypes.NotFound('票据');
    }
    
    const updates = [];
    const values = [];
    const allowedFields = [
      'invoice_type', 'invoice_code', 'partner_id', 'contract_id', 'order_id',
      'issue_date', 'amount_before_tax', 'tax_rate', 'tax_amount', 'total_amount',
      'currency', 'status', 'description', 'notes'
    ];
    
    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (updates.length === 0) {
      throw ErrorTypes.BadRequest('没有要更新的数据');
    }
    
    values.push(id);
    db.prepare(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    const updatedInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    
    // 记录审计日志
    AuditLog.update(req.user.id, AuditLog.MODULES.INVOICES, id, invoice, updatedInvoice, req);
    
    res.json({ success: true, data: updatedInvoice, message: '票据更新成功' });
  })
);

/**
 * @route   POST /api/invoices/:id/verify
 * @desc    认证进项发票
 */
router.post('/:id/verify',
  permissionMiddleware('invoices', 'verify'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!invoice) {
      throw ErrorTypes.NotFound('票据');
    }
    
    if (invoice.direction !== 'in') {
      throw ErrorTypes.BadRequest('只能认证进项发票');
    }
    
    if (!['pending', 'pending_review'].includes(invoice.status)) {
      throw ErrorTypes.BadRequest('发票已处理，无法审核');
    }
    
    // 更新状态
    db.prepare(`
      UPDATE invoices 
      SET status = 'verified', verify_date = date('now'), verify_status = 'verified' 
      WHERE id = ?
    `).run(req.params.id);
    
    // 如果超标发票审核通过，创建入账记录
    if (invoice.status === 'pending_review') {
      const invoiceProcessor = require('../services/invoice-processor');
      const entryResult = invoiceProcessor.createEntry({
        invoiceNo: invoice.invoice_no,
        totalAmount: invoice.total_amount,
        date: invoice.issue_date,
        seller: { name: invoice.partner_name || '未知商家' },
        items: [{ name: '发票入账' }]
      }, req.user.companyId, req.user.id);
      
      // 更新发票的交易ID
      if (entryResult) {
        db.prepare('UPDATE invoices SET transaction_id = ? WHERE id = ?')
          .run(entryResult.transactionId, req.params.id);
      }
    }
    
    // 记录审计日志
    AuditLogger.log({
      userId: req.user.id,
      module: 'invoices',
      action: 'verify',
      recordId: req.params.id,
      oldValue: invoice,
      newValue: { status: 'verified' },
      request: req
    });
    
    res.json({ success: true, message: '发票审核通过' });
  })
);

/**
 * @route   DELETE /api/invoices/:id
 * @desc    删除票据
 */
router.delete('/:id',
  permissionMiddleware('invoices', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!invoice) {
      throw ErrorTypes.NotFound('票据');
    }
    
    if (invoice.status === 'verified' || invoice.status === 'used') {
      throw ErrorTypes.BadRequest('已认证或已使用的发票不能删除');
    }
    
    db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    
    // 记录审计日志
    AuditLogger.logDelete('invoices', req.params.id, invoice, req);
    
    res.json({ success: true, message: '票据已删除' });
  })
);

module.exports = router;