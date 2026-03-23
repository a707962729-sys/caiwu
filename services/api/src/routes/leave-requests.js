const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { AuditLog } = require('../middleware/audit');

router.use(authMiddleware);

/**
 * 获取请假申请列表
 * GET /api/leave-requests
 */
router.get('/',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, userId, status, year, month } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE lr.company_id = ?';
    const params = [companyId];
    
    // 非管理员只能查看自己的请假
    if (req.user.role !== 'boss' && req.user.role !== 'accountant') {
      whereClause += ' AND lr.user_id = ?';
      params.push(req.user.id);
    } else if (userId) {
      whereClause += ' AND lr.user_id = ?';
      params.push(userId);
    }
    
    if (status) {
      whereClause += ' AND lr.status = ?';
      params.push(status);
    }
    
    if (year && month) {
      whereClause += ' AND (strftime("%Y", start_date) = ? OR strftime("%Y", end_date) = ?)';
      params.push(String(year), String(year));
    }
    
    const offset = (page - 1) * pageSize;
    
    const list = db.prepare(`
      SELECT 
        lr.*,
        u.real_name as user_name,
        u.department,
        approver.real_name as approver_name
      FROM leave_requests lr
      LEFT JOIN users u ON lr.user_id = u.id
      LEFT JOIN users approver ON lr.approved_by = approver.id
      ${whereClause}
      ORDER BY lr.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(pageSize), offset);
    
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM leave_requests lr ${whereClause}
    `).get(...params);
    
    res.json({
      success: true,
      data: {
        list,
        total: countResult?.total || 0,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  })
);

/**
 * 创建请假申请
 * POST /api/leave-requests
 */
router.post('/',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { leave_type, start_date, end_date, days, reason } = req.body;
    
    if (!leave_type || !start_date || !end_date || !days) {
      throw ErrorTypes.BadRequest('请填写完整的请假信息');
    }
    
    const result = db.prepare(`
      INSERT INTO leave_requests (company_id, user_id, leave_type, start_date, end_date, days, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.companyId, req.user.id, leave_type, start_date, end_date, days, reason || null);
    
    const newRequest = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(result.lastInsertRowid);
    
    AuditLog.create(req.user.id, 'leave_requests', result.lastInsertRowid, newRequest, req);
    
    res.status(201).json({
      success: true,
      data: newRequest,
      message: '请假申请已提交'
    });
  })
);

/**
 * 审批请假申请
 * POST /api/leave-requests/:id/approve
 */
router.post('/:id/approve',
  
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action, reject_reason } = req.body;
    const db = getDatabaseCompat();
    
    const leaveRequest = db.prepare(`
      SELECT * FROM leave_requests WHERE id = ? AND company_id = ?
    `).get(id, req.user.companyId);
    
    if (!leaveRequest) {
      throw ErrorTypes.NotFound('请假申请');
    }
    
    if (leaveRequest.status !== 'pending') {
      throw ErrorTypes.BadRequest('该申请已处理');
    }
    
    if (action === 'approve') {
      db.prepare(`
        UPDATE leave_requests 
        SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(req.user.id, id);
      
      AuditLog.approve(req.user.id, 'leave_requests', id, leaveRequest, { status: 'approved' }, req);
      
      res.json({ success: true, message: '请假申请已批准' });
    } else {
      db.prepare(`
        UPDATE leave_requests 
        SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP, reject_reason = ?
        WHERE id = ?
      `).run(req.user.id, reject_reason || null, id);
      
      AuditLog.reject(req.user.id, 'leave_requests', id, leaveRequest, req);
      
      res.json({ success: true, message: '请假申请已拒绝' });
    }
  })
);

/**
 * 取消请假申请
 * POST /api/leave-requests/:id/cancel
 */
router.post('/:id/cancel',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    
    const leaveRequest = db.prepare(`
      SELECT * FROM leave_requests WHERE id = ? AND user_id = ?
    `).get(id, req.user.id);
    
    if (!leaveRequest) {
      throw ErrorTypes.NotFound('请假申请');
    }
    
    if (leaveRequest.status !== 'pending') {
      throw ErrorTypes.BadRequest('只能取消待审批的申请');
    }
    
    db.prepare(`
      UPDATE leave_requests SET status = 'cancelled' WHERE id = ?
    `).run(id);
    
    AuditLog.log({
      userId: req.user.id,
      module: 'leave_requests',
      action: 'cancel',
      recordId: id,
      oldValue: leaveRequest,
      newValue: { status: 'cancelled' },
      request: req
    });
    
    res.json({ success: true, message: '请假申请已取消' });
  })
);

/**
 * 获取请假统计
 * GET /api/leave-requests/stats
 */
router.get('/stats',
  permissionMiddleware('leave', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { year } = req.query;
    const companyId = req.user.companyId;
    
    // 非管理员只能查看自己的统计
    const userIdFilter = (req.user.role !== 'boss' && req.user.role !== 'accountant')
      ? 'AND user_id = ?'
      : '';
    
    const params = [companyId];
    if (userIdFilter) params.push(req.user.id);
    
    const stats = db.prepare(`
      SELECT 
        leave_type,
        SUM(days) as total_days,
        COUNT(*) as count
      FROM leave_requests
      WHERE company_id = ? AND status = 'approved' ${userIdFilter}
        AND strftime('%Y', start_date) = ?
      GROUP BY leave_type
    `).all(...params, String(year || new Date().getFullYear()));
    
    res.json({
      success: true,
      data: stats
    });
  })
);

module.exports = router;