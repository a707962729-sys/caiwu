const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const dayjs = require('dayjs');

router.use(authMiddleware);

/**
 * @route   GET /api/receivables
 * @desc    获取应收账款列表
 */
router.get('/',
  permissionMiddleware('receivables', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, partner_id, status, start_date, end_date, overdue } = req.query;
    const companyId = req.user.companyId;

    let whereClause = 'WHERE r.company_id = ? AND r.type = ?';
    const params = [companyId || 1, 'receivable'];
    
    if (search) {
      whereClause += ' AND (r.rp_no LIKE ? OR r.partner_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (partner_id) {
      whereClause += ' AND r.partner_name = ?';
      params.push(partner_id);
    }
    
    if (status) {
      whereClause += ' AND r.status = ?';
      params.push(status);
    }
    
    if (start_date) {
      whereClause += ' AND r.due_date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      whereClause += ' AND r.due_date <= ?';
      params.push(end_date);
    }
    
    if (overdue === 'true' || overdue === true) {
      whereClause += " AND r.status IN ('pending', 'partial') AND r.due_date < date('now')";
    }

    // 统计
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM receivables_payables r ${whereClause}`).get(...params);
    const total = countResult.total;

    // 查询
    const offset = (page - 1) * pageSize;
    const list = db.prepare(`
      SELECT r.*
      FROM receivables_payables r
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
 * @route   GET /api/receivables/stats
 * @desc    获取应收账款统计
 */
router.get('/stats',
  permissionMiddleware('receivables', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_count,
        SUM(amount) as total_amount,
        SUM(paid_amount) as received_amount,
        SUM(remaining_amount) as unreceived_amount,
        SUM(CASE WHEN status = 'overdue' THEN remaining_amount ELSE 0 END) as overdue_amount
      FROM receivables_payables
      WHERE company_id = ? AND type = 'receivable'
    `).get(companyId || 1);

    res.json({ success: true, data: stats });
  })
);

/**
 * @route   GET /api/receivables/aging
 * @desc    获取账龄分析
 */
router.get('/aging',
  permissionMiddleware('receivables', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 简化的账龄分析
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
      WHERE company_id = ? AND type = 'receivable' AND status IN ('pending', 'partial')
      GROUP BY period
    `).all(companyId || 1);

    res.json({ success: true, data: { by_period: byPeriod } });
  })
);

/**
 * @route   GET /api/receivables/:id
 * @desc    获取应收账款详情
 */
router.get('/:id',
  permissionMiddleware('receivables', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const companyId = req.user.companyId;

    const receivable = db.prepare(`
      SELECT r.*
      FROM receivables_payables r
      WHERE r.id = ? AND r.company_id = ? AND r.type = 'receivable'
    `).get(id, companyId);

    if (!receivable) {
      throw ErrorTypes.NotFound('应收账款');
    }

    res.json({ success: true, data: receivable });
  })
);

/**
 * @route   POST /api/receivables
 * @desc    创建应收账款
 */
router.post('/',
  permissionMiddleware('receivables', 'create'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { partner_name, amount, remark } = req.body;
    const cid = companyId || 1;

    const result = db.prepare(`
      INSERT INTO receivables_payables (company_id, type, partner_name, amount, paid_amount, remaining_amount, status, notes)
      VALUES (?, 'receivable', ?, ?, 0, ?, 'pending', ?)
    `).run(cid, partner_name || null, amount, amount, remark || null);

    res.json({ success: true, data: { id: result.lastInsertRowid } });
  })
);

/**
 * @route   POST /api/receivables/:id/receive
 * @desc    收款
 */
router.post('/:id/receive',
  permissionMiddleware('receivables', 'update'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const { amount, payment_method, payment_date, account_no, voucher_no, remark } = req.body;
    const companyId = req.user.companyId;

    // 获取当前应收
    const receivable = db.prepare(`SELECT * FROM receivables_payables WHERE id = ? AND company_id = ? AND type = 'receivable'`).get(id, companyId);
    if (!receivable) {
      throw ErrorTypes.NotFound('应收账款');
    }

    // 更新收款
    const newPaidAmount = receivable.paid_amount + amount;
    const newRemainingAmount = receivable.amount - newPaidAmount;
    const newStatus = newRemainingAmount <= 0 ? 'settled' : (newPaidAmount > 0 ? 'partial' : 'pending');

    db.prepare(`
      UPDATE receivables_payables
      SET paid_amount = ?, remaining_amount = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newPaidAmount, newRemainingAmount, newStatus, id);

    res.json({ success: true, data: { paid_amount: newPaidAmount, remaining_amount: newRemainingAmount, status: newStatus } });
  })
);

module.exports = router;