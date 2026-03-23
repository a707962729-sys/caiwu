const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema, reimbursementSchemas } = require('../middleware/validation');
const { AuditLogger } = require('../middleware/audit');

router.use(authMiddleware);

function generateReimbursementNo(companyId) {
  const db = getDatabaseCompat();
  const today = dayjs().format('YYYYMMDD');
  const prefix = `RMB${today}`;
  
  const result = db.prepare(`
    SELECT MAX(reimbursement_no) as max_no 
    FROM reimbursements 
    WHERE company_id = ? AND reimbursement_no LIKE ?
  `).get(companyId, `${prefix}%`);
  
  let seq = 1;
  if (result && result.max_no) {
    const lastSeq = parseInt(result.max_no.slice(-4));
    seq = lastSeq + 1;
  }
  
  return `${prefix}${seq.toString().padStart(4, '0')}`;
}

/**
 * @route   GET /api/reimbursements
 * @desc    获取报销列表
 */
router.get('/',
  permissionMiddleware('reimbursements', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, status, userId, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE r.company_id = ?';
    const params = [companyId];
    
    // 非管理员只能看自己的报销
    if (req.user.role === 'employee') {
      whereClause += ' AND r.user_id = ?';
      params.push(req.user.id);
    } else if (userId) {
      whereClause += ' AND r.user_id = ?';
      params.push(parseInt(userId));
    }
    
    if (search) {
      whereClause += ' AND (r.reimbursement_no LIKE ? OR r.title LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (status) {
      whereClause += ' AND r.status = ?';
      params.push(status);
    }
    
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM reimbursements r ${whereClause}`).get(...params);
    
    // SQL 注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'reimbursement_no', 'title', 'reimbursement_type', 'amount', 'currency', 'status', 'application_date', 'expense_date', 'created_at', 'updated_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    const offset = (page - 1) * pageSize;
    const reimbursements = db.prepare(`
      SELECT r.*, u.real_name as applicant_name
      FROM reimbursements r
      LEFT JOIN users u ON r.user_id = u.id
      ${whereClause}
      ORDER BY r.${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    
    res.json({
      success: true,
      data: {
        list: reimbursements,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/reimbursements/:id
 * @desc    获取报销详情
 */
router.get('/:id',
  permissionMiddleware('reimbursements', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const reimbursement = db.prepare(`
      SELECT r.*, u.real_name as applicant_name,
             approver.real_name as approver_name,
             payer.real_name as payer_name
      FROM reimbursements r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN users approver ON r.approved_by = approver.id
      LEFT JOIN users payer ON r.paid_by = payer.id
      WHERE r.id = ? AND r.company_id = ?
    `).get(req.params.id, req.user.companyId);
    
    if (!reimbursement) {
      throw ErrorTypes.NotFound('报销单');
    }
    
    // 权限检查
    if (req.user.role === 'employee' && reimbursement.user_id !== req.user.id) {
      throw ErrorTypes.Forbidden();
    }
    
    // 获取报销明细
    const items = db.prepare('SELECT * FROM reimbursement_items WHERE reimbursement_id = ?').get(req.params.id);
    
    res.json({ success: true, data: { ...reimbursement, items } });
  })
);

/**
 * @route   POST /api/reimbursements
 * @desc    创建报销单
 */
router.post('/',
  permissionMiddleware('reimbursements', 'create'),
  validate(reimbursementSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    let { reimbursement_no, items = [], ...data } = req.body;
    if (!reimbursement_no) {
      reimbursement_no = generateReimbursementNo(companyId);
    }
    
    const existing = db.prepare('SELECT id FROM reimbursements WHERE company_id = ? AND reimbursement_no = ?').get(companyId, reimbursement_no);
    if (existing) {
      throw ErrorTypes.DuplicateEntry('报销单号');
    }
    
    // 开启事务
    const insertReimbursement = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO reimbursements (
          company_id, reimbursement_no, user_id, title, reimbursement_type,
          amount, currency, application_date, expense_date, description, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        companyId, reimbursement_no, req.user.id, data.title, data.reimbursement_type || null,
        data.amount, data.currency, data.application_date, data.expense_date || null,
        data.description || null, data.notes || null
      );
      
      const reimbursementId = result.lastInsertRowid;
      
      // 插入明细
      if (items.length > 0) {
        const insertItem = db.prepare(`
          INSERT INTO reimbursement_items (
            reimbursement_id, item_date, category, description, amount, currency, invoice_no, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const item of items) {
          insertItem.run(
            reimbursementId, item.item_date || null, item.category || null,
            item.description || null, item.amount, item.currency,
            item.invoice_no || null, item.notes || null
          );
        }
      }
      
      return reimbursementId;
    });
    
    const newId = insertReimbursement();
    const newReimbursement = db.prepare('SELECT * FROM reimbursements WHERE id = ?').get(newId);
    
    // 记录审计日志
    AuditLogger.logCreate('reimbursements', newId, newReimbursement, req);
    
    res.status(201).json({ success: true, data: newReimbursement, message: '报销单创建成功' });
  })
);

/**
 * @route   PUT /api/reimbursements/:id
 * @desc    更新报销单
 */
router.put('/:id',
  permissionMiddleware('reimbursements', 'update'),
  validateId('id'),
  validate(reimbursementSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    
    const reimbursement = db.prepare('SELECT * FROM reimbursements WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
    if (!reimbursement) {
      throw ErrorTypes.NotFound('报销单');
    }
    
    // 权限检查
    if (req.user.role === 'employee' && reimbursement.user_id !== req.user.id) {
      throw ErrorTypes.Forbidden();
    }
    
    // 只有草稿状态可以修改
    if (reimbursement.status !== 'draft') {
      throw ErrorTypes.BadRequest('只有草稿状态的报销单可以修改');
    }
    
    const updates = [];
    const values = [];
    const allowedFields = ['title', 'reimbursement_type', 'amount', 'currency', 'application_date', 'expense_date', 'description', 'notes'];
    
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
    db.prepare(`UPDATE reimbursements SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    res.json({ success: true, message: '报销单更新成功' });
  })
);

/**
 * @route   POST /api/reimbursements/:id/submit
 * @desc    提交报销单审批
 */
router.post('/:id/submit',
  permissionMiddleware('reimbursements', 'update'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const reimbursement = db.prepare('SELECT * FROM reimbursements WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!reimbursement) {
      throw ErrorTypes.NotFound('报销单');
    }
    
    if (reimbursement.status !== 'draft') {
      throw ErrorTypes.BadRequest('只有草稿状态可以提交');
    }
    
    db.prepare('UPDATE reimbursements SET status = ? WHERE id = ?').run('pending', req.params.id);
    
    res.json({ success: true, message: '报销单已提交审批' });
  })
);

/**
 * @route   POST /api/reimbursements/:id/approve
 * @desc    审批报销单
 */
router.post('/:id/approve',
  permissionMiddleware('reimbursements', 'approve'),
  validateId('id'),
  validate(reimbursementSchemas.approve),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action, reject_reason } = req.body;
    const db = getDatabaseCompat();
    
    const reimbursement = db.prepare('SELECT * FROM reimbursements WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
    if (!reimbursement) {
      throw ErrorTypes.NotFound('报销单');
    }
    
    if (reimbursement.status !== 'pending') {
      throw ErrorTypes.BadRequest('只有待审批状态可以审批');
    }
    
    if (action === 'approve') {
      db.prepare(`
        UPDATE reimbursements 
        SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(req.user.id, id);
      
      // 记录审计日志
      AuditLogger.logApprove('reimbursements', id, reimbursement, { status: 'approved' }, req);
    } else {
      db.prepare(`
        UPDATE reimbursements 
        SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP, reject_reason = ? 
        WHERE id = ?
      `).run(req.user.id, reject_reason, id);
      
      // 记录审计日志
      AuditLogger.logReject('reimbursements', id, reimbursement, { status: 'rejected', reject_reason }, req);
    }
    
    res.json({ success: true, message: action === 'approve' ? '报销单已批准' : '报销单已拒绝' });
  })
);

/**
 * @route   POST /api/reimbursements/:id/pay
 * @desc    支付报销单
 */
router.post('/:id/pay',
  permissionMiddleware('reimbursements', 'pay'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const reimbursement = db.prepare('SELECT * FROM reimbursements WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!reimbursement) {
      throw ErrorTypes.NotFound('报销单');
    }
    
    if (reimbursement.status !== 'approved') {
      throw ErrorTypes.BadRequest('只有已批准的报销单可以支付');
    }
    
    db.prepare(`
      UPDATE reimbursements 
      SET status = 'paid', paid_by = ?, paid_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(req.user.id, req.params.id);
    
    res.json({ success: true, message: '报销单已支付' });
  })
);

/**
 * @route   DELETE /api/reimbursements/:id
 * @desc    删除报销单
 */
router.delete('/:id',
  permissionMiddleware('reimbursements', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const reimbursement = db.prepare('SELECT * FROM reimbursements WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!reimbursement) {
      throw ErrorTypes.NotFound('报销单');
    }
    
    if (reimbursement.status !== 'draft' && reimbursement.status !== 'rejected') {
      throw ErrorTypes.BadRequest('只有草稿或已拒绝的报销单可以删除');
    }
    
    db.prepare('DELETE FROM reimbursement_items WHERE reimbursement_id = ?').run(req.params.id);
    db.prepare('DELETE FROM reimbursements WHERE id = ?').run(req.params.id);
    
    res.json({ success: true, message: '报销单已删除' });
  })
);

module.exports = router;