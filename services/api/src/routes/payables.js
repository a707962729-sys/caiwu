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
    
    let whereClause = 'WHERE company_id = ? AND type = ?';
    const params = [companyId, 'payable'];
    
    if (search) {
      whereClause += ' AND (partner_name LIKE ?)';
      params.push(`%${search}%`);
    }
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    // 统计
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM receivables_payables ${whereClause}`).get(...params);
    const total = countResult.total;
    
    // 查询
    const offset = (page - 1) * pageSize;
    const list = db.prepare(`
      SELECT *
      FROM receivables_payables
      ${whereClause}
      ORDER BY created_at DESC
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
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN status != 'paid' THEN amount ELSE 0 END) as unpaid_amount
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
          WHEN status = 'paid' THEN '已付款'
          ELSE '未付款'
        END as period,
        COUNT(*) as count,
        SUM(amount) as amount
      FROM receivables_payables
      WHERE company_id = ? AND type = 'payable'
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