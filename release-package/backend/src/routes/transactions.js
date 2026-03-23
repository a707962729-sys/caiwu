const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema, transactionSchemas } = require('../middleware/validation');
const { AuditLogger } = require('../middleware/audit');

// 所有路由都需要认证
router.use(authMiddleware);

/**
 * 生成记账单号
 */
function generateTransactionNo(companyId) {
  const db = getDatabaseCompat();
  const today = dayjs().format('YYYYMMDD');
  const prefix = `TXN${today}`;
  
  // 获取今日最大序号
  const result = db.prepare(`
    SELECT MAX(transaction_no) as max_no 
    FROM transactions 
    WHERE company_id = ? AND transaction_no LIKE ?
  `).get(companyId, `${prefix}%`);
  
  let seq = 1;
  if (result && result.max_no) {
    const lastSeq = parseInt(result.max_no.slice(-4));
    seq = lastSeq + 1;
  }
  
  return `${prefix}${seq.toString().padStart(4, '0')}`;
}

/**
 * @route   GET /api/transactions
 * @desc    获取记账记录列表
 * @access  Private
 */
router.get('/',
  permissionMiddleware('transactions', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { 
      page = 1, pageSize = 20, 
      search, transactionType, category, status,
      startDate, endDate, partnerId, contractId, orderId,
      sortBy = 'transaction_date', sortOrder = 'desc' 
    } = req.query;
    const companyId = req.user.companyId;
    
    // 构建查询条件 - 处理 company_id 为 null 的情况
    let whereClause = companyId ? 'WHERE t.company_id = ?' : 'WHERE t.company_id IS NULL';
    const params = companyId ? [companyId] : [];
    
    if (search) {
      whereClause += ' AND (t.transaction_no LIKE ? OR t.description LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }
    
    if (transactionType) {
      whereClause += ' AND t.transaction_type = ?';
      params.push(transactionType);
    }
    
    if (category) {
      whereClause += ' AND t.category = ?';
      params.push(category);
    }
    
    if (status) {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }
    
    if (startDate) {
      whereClause += ' AND t.transaction_date >= ?';
      // 确保 startDate 是字符串格式
      params.push(typeof startDate === 'string' ? startDate : dayjs(startDate).format('YYYY-MM-DD'));
    }
    
    if (endDate) {
      whereClause += ' AND t.transaction_date <= ?';
      // 确保 endDate 是字符串格式
      params.push(typeof endDate === 'string' ? endDate : dayjs(endDate).format('YYYY-MM-DD'));
    }
    
    if (partnerId) {
      whereClause += ' AND t.partner_id = ?';
      params.push(parseInt(partnerId));
    }
    
    if (contractId) {
      whereClause += ' AND t.contract_id = ?';
      params.push(parseInt(contractId));
    }
    
    if (orderId) {
      whereClause += ' AND t.order_id = ?';
      params.push(parseInt(orderId));
    }
    
    // 统计总数
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM transactions t ${whereClause}`).get(...params);
    const total = countResult?.total || 0;
    
    // 汇总统计
    const summary = db.prepare(`
      SELECT 
        SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END) as total_income,
        SUM(CASE WHEN t.transaction_type = 'expense' THEN t.amount ELSE 0 END) as total_expense,
        SUM(CASE WHEN t.transaction_type = 'transfer' THEN t.amount ELSE 0 END) as total_transfer
      FROM transactions t
      ${whereClause}
    `).get(...params);
    
    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'transaction_no', 'transaction_date', 'transaction_type', 'amount', 'status', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'transaction_date';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    // 查询列表
    const offset = (page - 1) * pageSize;
    
    const transactions = db.prepare(`
      SELECT t.*, 
             p.name as partner_name,
             c.name as contract_name,
             o.name as order_name,
             u.real_name as creator_name
      FROM transactions t
      LEFT JOIN partners p ON t.partner_id = p.id
      LEFT JOIN contracts c ON t.contract_id = c.id
      LEFT JOIN orders o ON t.order_id = o.id
      LEFT JOIN users u ON t.created_by = u.id
      ${whereClause}
      ORDER BY t.${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    
    res.json({
      success: true,
      data: {
        list: transactions,
        summary,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    });
  })
);

/**
 * @route   GET /api/transactions/stats
 * @desc    获取记账统计
 * @access  Private
 */
router.get('/stats',
  permissionMiddleware('transactions', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { startDate, endDate } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE t.company_id = ?';
    const params = [companyId];
    
    if (startDate) {
      whereClause += ' AND t.transaction_date >= ?';
      // 确保 startDate 是字符串格式
      params.push(typeof startDate === 'string' ? startDate : dayjs(startDate).format('YYYY-MM-DD'));
    }
    
    if (endDate) {
      whereClause += ' AND t.transaction_date <= ?';
      // 确保 endDate 是字符串格式
      params.push(typeof endDate === 'string' ? endDate : dayjs(endDate).format('YYYY-MM-DD'));
    }
    
    // 收支统计
    const incomeExpense = db.prepare(`
      SELECT 
        transaction_type,
        category,
        SUM(amount) as total_amount,
        COUNT(*) as count
      FROM transactions t
      ${whereClause}
      GROUP BY transaction_type, category
      ORDER BY transaction_type, total_amount DESC
    `).all(...params);
    
    // 月度统计
    const monthly = db.prepare(`
      SELECT 
        strftime('%Y-%m', transaction_date) as month,
        SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) as expense
      FROM transactions t
      ${whereClause}
      GROUP BY strftime('%Y-%m', transaction_date)
      ORDER BY month DESC
      LIMIT 12
    `).all(...params);
    
    // 状态统计
    const statusStats = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM transactions t
      ${whereClause}
      GROUP BY status
    `).all(...params);
    
    res.json({
      success: true,
      data: {
        incomeExpense,
        monthly,
        statusStats
      }
    });
  })
);

/**
 * @route   GET /api/transactions/:id
 * @desc    获取单条记账记录
 * @access  Private
 */
router.get('/:id',
  permissionMiddleware('transactions', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    // 处理 company_id 为 null 的情况
    let transaction;
    if (companyId) {
      transaction = db.prepare(`
        SELECT t.*, 
               p.name as partner_name,
               c.name as contract_name,
               o.name as order_name,
               inv.invoice_no as invoice_number,
               r.title as reimbursement_title,
               u.real_name as creator_name,
               confirmer.real_name as confirmer_name
        FROM transactions t
        LEFT JOIN partners p ON t.partner_id = p.id
        LEFT JOIN contracts c ON t.contract_id = c.id
        LEFT JOIN orders o ON t.order_id = o.id
        LEFT JOIN invoices inv ON t.invoice_id = inv.id
        LEFT JOIN reimbursements r ON t.reimbursement_id = r.id
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN users confirmer ON t.confirmed_by = confirmer.id
        WHERE t.id = ? AND t.company_id = ?
      `).get(id, companyId);
    } else {
      transaction = db.prepare(`
        SELECT t.*, 
               p.name as partner_name,
               c.name as contract_name,
               o.name as order_name,
               inv.invoice_no as invoice_number,
               r.title as reimbursement_title,
               u.real_name as creator_name,
               confirmer.real_name as confirmer_name
        FROM transactions t
        LEFT JOIN partners p ON t.partner_id = p.id
        LEFT JOIN contracts c ON t.contract_id = c.id
        LEFT JOIN orders o ON t.order_id = o.id
        LEFT JOIN invoices inv ON t.invoice_id = inv.id
        LEFT JOIN reimbursements r ON t.reimbursement_id = r.id
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN users confirmer ON t.confirmed_by = confirmer.id
        WHERE t.id = ? AND (t.company_id IS NULL OR t.company_id = 0)
      `).get(id);
    }
    
    if (!transaction) {
      throw ErrorTypes.NotFound('记账记录');
    }
    
    res.json({
      success: true,
      data: transaction
    });
  })
);

/**
 * @route   POST /api/transactions
 * @desc    创建记账记录
 * @access  Private
 */
router.post('/',
  permissionMiddleware('transactions', 'create'),
  validate(transactionSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    let { transaction_no, ...data } = req.body;
    
    // 自动生成单号
    if (!transaction_no) {
      transaction_no = generateTransactionNo(companyId);
    }
    
    // 检查单号是否重复
    const existing = db.prepare('SELECT id FROM transactions WHERE company_id = ? AND transaction_no = ?').get(companyId, transaction_no);
    if (existing) {
      throw ErrorTypes.DuplicateEntry('记账单号');
    }
    
    // 计算人民币金额
    const amountCny = data.exchange_rate ? data.amount * data.exchange_rate : data.amount;
    
    // 插入记录
    const result = db.prepare(`
      INSERT INTO transactions (
        company_id, transaction_no, transaction_date, transaction_type,
        category, sub_category, amount, currency, exchange_rate, amount_cny,
        account_from, account_to, partner_id, contract_id, order_id, invoice_id,
        reimbursement_id, description, voucher_no, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, transaction_no, data.transaction_date, data.transaction_type,
      data.category, data.sub_category || null, data.amount, data.currency, data.exchange_rate || 1, amountCny,
      data.account_from || null, data.account_to || null, data.partner_id || null, 
      data.contract_id || null, data.order_id || null, data.invoice_id || null,
      data.reimbursement_id || null, data.description || null, data.voucher_no || null, req.user.id
    );
    
    const newTransaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
    
    // 记录审计日志
    AuditLogger.logCreate('transactions', result.lastInsertRowid, newTransaction, req);
    
    res.status(201).json({
      success: true,
      data: newTransaction,
      message: '记账记录创建成功'
    });
  })
);

/**
 * @route   PUT /api/transactions/:id
 * @desc    更新记账记录
 * @access  Private
 */
router.put('/:id',
  permissionMiddleware('transactions', 'update'),
  validateId('id'),
  validate(transactionSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    // 检查记录是否存在，处理 company_id 为 null 的情况
    let transaction;
    if (companyId) {
      transaction = db.prepare('SELECT * FROM transactions WHERE id = ? AND company_id = ?').get(id, companyId);
    } else {
      transaction = db.prepare('SELECT * FROM transactions WHERE id = ? AND (company_id IS NULL OR company_id = 0)').get(id);
    }
    if (!transaction) {
      throw ErrorTypes.NotFound('记账记录');
    }
    
    // 已确认的记录不能修改
    if (transaction.status === 'confirmed') {
      throw ErrorTypes.BadRequest('已确认的记录不能修改');
    }
    
    // 构建更新数据
    const updates = [];
    const values = [];
    
    const allowedFields = [
      'transaction_date', 'transaction_type', 'category', 'sub_category',
      'amount', 'currency', 'exchange_rate', 'account_from', 'account_to',
      'partner_id', 'contract_id', 'order_id', 'invoice_id', 'reimbursement_id',
      'description', 'voucher_no', 'notes'
    ];
    
    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    // 重新计算人民币金额
    if (req.body.amount !== undefined || req.body.exchange_rate !== undefined) {
      const amount = req.body.amount || transaction.amount;
      const rate = req.body.exchange_rate || transaction.exchange_rate;
      updates.push('amount_cny = ?');
      values.push(amount * rate);
    }
    
    if (updates.length === 0) {
      throw ErrorTypes.BadRequest('没有要更新的数据');
    }
    
    values.push(id);
    
    db.prepare(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    const updatedTransaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    
    // 记录审计日志
    AuditLogger.logUpdate('transactions', id, transaction, updatedTransaction, req);
    
    res.json({
      success: true,
      data: updatedTransaction,
      message: '记账记录更新成功'
    });
  })
);

/**
 * @route   POST /api/transactions/:id/confirm
 * @desc    确认记账记录
 * @access  Private (Accountant/Boss)
 */
router.post('/:id/confirm',
  permissionMiddleware('transactions', 'confirm'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    // 处理 company_id 为 null 的情况
    let transaction;
    if (companyId) {
      transaction = db.prepare('SELECT * FROM transactions WHERE id = ? AND company_id = ?').get(id, companyId);
    } else {
      transaction = db.prepare('SELECT * FROM transactions WHERE id = ? AND (company_id IS NULL OR company_id = 0)').get(id);
    }
    if (!transaction) {
      throw ErrorTypes.NotFound('记账记录');
    }
    
    if (transaction.status === 'confirmed') {
      throw ErrorTypes.BadRequest('记录已确认');
    }
    
    db.prepare(`
      UPDATE transactions 
      SET status = 'confirmed', confirmed_by = ?, confirmed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(req.user.id, id);
    
    res.json({
      success: true,
      message: '记账记录已确认'
    });
  })
);

/**
 * @route   POST /api/transactions/:id/reverse
 * @desc    冲销记账记录
 * @access  Private (Accountant/Boss)
 */
router.post('/:id/reverse',
  permissionMiddleware('transactions', 'reverse'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    // 处理 company_id 为 null 的情况
    let transaction;
    if (companyId) {
      transaction = db.prepare('SELECT * FROM transactions WHERE id = ? AND company_id = ?').get(id, companyId);
    } else {
      transaction = db.prepare('SELECT * FROM transactions WHERE id = ? AND (company_id IS NULL OR company_id = 0)').get(id);
    }
    if (!transaction) {
      throw ErrorTypes.NotFound('记账记录');
    }
    
    if (transaction.status !== 'confirmed') {
      throw ErrorTypes.BadRequest('只能冲销已确认的记录');
    }
    
    // 创建冲销记录
    const reverseNo = transaction.transaction_no + '-R';
    
    const result = db.prepare(`
      INSERT INTO transactions (
        company_id, transaction_no, transaction_date, transaction_type,
        category, sub_category, amount, currency, exchange_rate, amount_cny,
        account_from, account_to, partner_id, contract_id, order_id, invoice_id,
        description, status, created_by, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reversed', ?, ?)
    `).run(
      transaction.company_id, reverseNo, transaction.transaction_date, transaction.transaction_type,
      transaction.category, transaction.sub_category, -transaction.amount, transaction.currency,
      transaction.exchange_rate, -transaction.amount_cny,
      transaction.account_to, transaction.account_from, // 反转收支账户
      transaction.partner_id, transaction.contract_id, transaction.order_id, transaction.invoice_id,
      `冲销: ${transaction.description}`, req.user.id, `冲销原单: ${transaction.transaction_no}`
    );
    
    // 更新原单状态
    db.prepare('UPDATE transactions SET status = ? WHERE id = ?').run('reversed', id);
    
    res.json({
      success: true,
      data: { reverseId: result.lastInsertRowid },
      message: '记账记录已冲销'
    });
  })
);

/**
 * @route   DELETE /api/transactions/:id
 * @desc    删除记账记录
 * @access  Private
 */
router.delete('/:id',
  permissionMiddleware('transactions', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    // 处理 company_id 为 null 的情况
    let transaction;
    if (companyId) {
      transaction = db.prepare('SELECT * FROM transactions WHERE id = ? AND company_id = ?').get(id, companyId);
    } else {
      transaction = db.prepare('SELECT * FROM transactions WHERE id = ? AND (company_id IS NULL OR company_id = 0)').get(id);
    }
    
    if (!transaction) {
      throw ErrorTypes.NotFound('记账记录');
    }
    
    if (transaction.status === 'confirmed') {
      throw ErrorTypes.BadRequest('已确认的记录不能删除，请使用冲销功能');
    }
    
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    
    // 记录审计日志
    AuditLogger.logDelete('transactions', id, transaction, req);
    
    res.json({
      success: true,
      message: '记账记录已删除'
    });
  })
);

module.exports = router;