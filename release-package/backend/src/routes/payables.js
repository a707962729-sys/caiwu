const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const dayjs = require('dayjs');

router.use(authMiddleware);

/**
 * @route   GET /api/payables
 * @desc    获取应付账款列表
 */
router.get('/',
  permissionMiddleware('payables', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, partner_id, status, startDate, endDate } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE r.company_id = ? AND r.type = ?';
    const params = [companyId, 'payable'];
    
    if (search) {
      whereClause += ' AND (r.rp_no LIKE ? OR p.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (partner_id) {
      whereClause += ' AND r.partner_id = ?';
      params.push(partner_id);
    }
    
    if (status) {
      whereClause += ' AND r.status = ?';
      params.push(status);
    }
    
    if (startDate) {
      whereClause += ' AND r.due_date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      whereClause += ' AND r.due_date <= ?';
      params.push(endDate);
    }
    
    // 统计
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM receivables_payables r ${whereClause}`).get(...params);
    const total = countResult.total;
    
    // 查询
    const offset = (page - 1) * pageSize;
    const list = db.prepare(`
      SELECT r.*, p.name as partner_name
      FROM receivables_payables r
      LEFT JOIN partners p ON r.partner_id = p.id
      ${whereClause}
      ORDER BY r.due_date ASC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    
    res.json({
      success: true,
      data: {
        list,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/payables/stats
 * @desc    获取应付账款统计
 */
router.get('/stats',
  permissionMiddleware('payables', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_count,
        SUM(amount) as total_amount,
        SUM(paid_amount) as paid_amount,
        SUM(remaining_amount) as unpaid_amount,
        SUM(CASE WHEN status = 'overdue' THEN remaining_amount ELSE 0 END) as overdue_amount
      FROM receivables_payables
      WHERE company_id = ? AND type = 'payable'
    `).get(companyId);
    
    res.json({ success: true, data: stats });
  })
);

/**
 * @route   GET /api/payables/aging
 * @desc    获取账龄分析
 */
router.get('/aging',
  permissionMiddleware('payables', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    const byPeriod = db.prepare(`
      SELECT 
        CASE 
          WHEN julianday('now') - julianday(due_date) < 0 THEN '未到期'
          WHEN julianday('now') - julianday(due_date) < 30 THEN '0-30天'
          WHEN julianday('now') - julianday(due_date) < 60 THEN '30-60天'
          WHEN julianday('now') - julianday(due_date) < 90 THEN '60-90天'
          ELSE '90天以上'
        END as period,
        COUNT(*) as count,
        SUM(remaining_amount) as amount
      FROM receivables_payables
      WHERE company_id = ? AND type = 'payable' AND status IN ('pending', 'partial')
      GROUP BY period
    `).all(companyId);
    
    res.json({ success: true, data: { by_period: byPeriod } });
  })
);

/**
 * @route   GET /api/payables/:id
 * @desc    获取应付账款详情
 */
router.get('/:id',
  permissionMiddleware('payables', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const companyId = req.user.companyId;
    
    const payable = db.prepare(`
      SELECT r.*, p.name as partner_name
      FROM receivables_payables r
      LEFT JOIN partners p ON r.partner_id = p.id
      WHERE r.id = ? AND r.company_id = ? AND r.type = 'payable'
    `).get(id, companyId);
    
    if (!payable) {
      throw ErrorTypes.NotFound('应付账款');
    }
    
    res.json({ success: true, data: payable });
  })
);

/**
 * @route   POST /api/payables
 * @desc    创建应付账款
 */
router.post('/',
  permissionMiddleware('payables', 'create'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { partner_id, invoice_no, amount, due_date, transaction_date, description } = req.body;
    
    const today = dayjs().format('YYYYMMDD');
    const count = db.prepare(`SELECT COUNT(*) as count FROM receivables_payables WHERE company_id = ? AND type = 'payable' AND created_at >= date('now')`).get(companyId);
    const rp_no = `AP${today}${(count.count + 1).toString().padStart(4, '0')}`;
    
    const result = db.prepare(`
      INSERT INTO receivables_payables (company_id, type, rp_no, partner_id, amount, paid_amount, remaining_amount, due_date, transaction_date, status, notes, created_by, created_at, updated_at)
      VALUES (?, 'payable', ?, ?, ?, 0, ?, ?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))
    `).run(companyId, rp_no, partner_id, amount, amount, due_date, transaction_date || dayjs().format('YYYY-MM-DD'), description || null, req.user.id);
    
    res.json({ success: true, data: { id: result.lastInsertRowid, rp_no } });
  })
);

/**
 * @route   POST /api/payables/:id/pay
 * @desc    付款
 */
router.post('/:id/pay',
  permissionMiddleware('payables', 'update'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const { amount, payment_date, payment_method, account, remark } = req.body;
    const companyId = req.user.companyId;
    
    const payable = db.prepare(`SELECT * FROM receivables_payables WHERE id = ? AND company_id = ? AND type = 'payable'`).get(id, companyId);
    if (!payable) {
      throw ErrorTypes.NotFound('应付账款');
    }
    
    const newPaidAmount = payable.paid_amount + amount;
    const newRemainingAmount = payable.amount - newPaidAmount;
    const newStatus = newRemainingAmount <= 0 ? 'settled' : (newPaidAmount > 0 ? 'partial' : 'pending');
    
    db.prepare(`
      UPDATE receivables_payables 
      SET paid_amount = ?, remaining_amount = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newPaidAmount, newRemainingAmount, newStatus, id);
    
    res.json({ success: true, data: { paid_amount: newPaidAmount, remaining_amount: newRemainingAmount, status: newStatus } });
  })
);

/**
 * @route   GET /api/payables/:id/payments
 * @desc    获取付款记录
 */
router.get('/:id/payments',
  permissionMiddleware('payables', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    // 暂时返回空数组
    res.json({ success: true, data: [] });
  })
);

module.exports = router;