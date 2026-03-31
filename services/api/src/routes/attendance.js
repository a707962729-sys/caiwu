const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware, requireRole } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { AuditLog } = require('../middleware/audit');

router.use(authMiddleware);

/**
 * 获取考勤记录列表
 * GET /api/attendance
 */
router.get('/',
  permissionMiddleware('attendance', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { 
      page = 1, pageSize = 20, 
      userId, startDate, endDate, status 
    } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE a.company_id = ?';
    const params = [companyId];
    
    // 非管理员只能查看自己的考勤
    if (req.user.role !== 'boss' && req.user.role !== 'accountant') {
      whereClause += ' AND a.user_id = ?';
      params.push(req.user.id);
    } else if (userId) {
      whereClause += ' AND a.user_id = ?';
      params.push(userId);
    }
    
    if (startDate) {
      whereClause += ' AND a.date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      whereClause += ' AND a.date <= ?';
      params.push(endDate);
    }
    
    if (status) {
      whereClause += ' AND a.status = ?';
      params.push(status);
    }
    
    const offset = (page - 1) * pageSize;
    
    const list = db.prepare(`
      SELECT 
        a.*,
        u.real_name as user_name,
        u.department,
        u.position
      FROM attendance a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.date DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(pageSize), offset);
    
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM attendance a ${whereClause}
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
 * 打卡签到
 * POST /api/attendance/check-in
 */
router.post('/check-in',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().split(' ')[0];
    
    // 检查是否已打卡
    const existing = db.prepare(`
      SELECT * FROM attendance WHERE company_id = ? AND user_id = ? AND date = ?
    `).get(companyId, req.user.id, today);
    
    if (existing && existing.check_in_time) {
      throw ErrorTypes.BadRequest('今日已签到');
    }
    
    // 判断是否迟到 (假设9:00上班)
    const isLate = now > '09:00:00';
    const status = isLate ? 'late' : 'normal';
    
    if (existing) {
      // 更新签到时间
      db.prepare(`
        UPDATE attendance SET check_in_time = ?, status = ? WHERE id = ?
      `).run(now, status, existing.id);
    } else {
      // 创建新记录
      db.prepare(`
        INSERT INTO attendance (company_id, user_id, date, check_in_time, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(companyId, req.user.id, today, now, status);
    }
    
    res.json({
      success: true,
      message: '签到成功',
      data: { time: now, status }
    });
  })
);

/**
 * 打卡签退
 * POST /api/attendance/check-out
 */
router.post('/check-out',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().split(' ')[0];
    
    const record = db.prepare(`
      SELECT * FROM attendance WHERE company_id = ? AND user_id = ? AND date = ?
    `).get(companyId, req.user.id, today);
    
    if (!record || !record.check_in_time) {
      throw ErrorTypes.BadRequest('请先签到');
    }
    
    if (record.check_out_time) {
      throw ErrorTypes.BadRequest('今日已签退');
    }
    
    // 计算工作时长
    const checkIn = new Date(`2000-01-01 ${record.check_in_time}`);
    const checkOut = new Date(`2000-01-01 ${now}`);
    const workHours = (checkOut - checkIn) / (1000 * 60 * 60);
    
    // 判断是否早退 (假设18:00下班)
    const isEarlyLeave = now < '18:00:00' && workHours < 8;
    const status = isEarlyLeave ? 'early_leave' : record.status;
    
    db.prepare(`
      UPDATE attendance 
      SET check_out_time = ?, work_hours = ?, status = ?
      WHERE id = ?
    `).run(now, workHours.toFixed(2), status, record.id);
    
    res.json({
      success: true,
      message: '签退成功',
      data: { time: now, workHours: workHours.toFixed(2) }
    });
  })
);

/**
 * 获取考勤统计
 * GET /api/attendance/employee/:id - 获取员工考勤记录
 */
router.get('/employee/:id',
  permissionMiddleware('attendance', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const { month } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE a.company_id = ? AND a.employee_id = ?';
    const params = [companyId, parseInt(id)];
    
    if (month) {
      whereClause += ' AND a.date LIKE ?';
      params.push(`${month}-%`);
    }
    
    const records = db.prepare(`
      SELECT a.*, e.name as employee_name
      FROM attendance a
      LEFT JOIN employees e ON a.employee_id = e.id
      ${whereClause}
      ORDER BY a.date DESC
    `).all(...params);
    
    res.json({ success: true, data: records });
  })
);

/**
 * GET /api/attendance/stats
 */
router.get('/stats',
  permissionMiddleware('attendance', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { userId, year, month } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE company_id = ?';
    const params = [companyId];
    
    // 非管理员只能查看自己的统计
    const targetUserId = (req.user.role === 'boss' || req.user.role === 'accountant') 
      ? userId 
      : req.user.id;
    
    if (targetUserId) {
      whereClause += ' AND user_id = ?';
      params.push(targetUserId);
    }
    
    if (year && month) {
      whereClause += ' AND strftime("%Y", date) = ? AND strftime("%m", date) = ?';
      params.push(String(year), String(month).padStart(2, '0'));
    }
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN a.status = 'normal' THEN 1 ELSE 0 END) as normal_days,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_days,
        SUM(CASE WHEN a.status = 'early_leave' THEN 1 ELSE 0 END) as early_leave_days,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN a.status = 'leave' THEN 1 ELSE 0 END) as leave_days,
        SUM(a.work_hours) as total_work_hours,
        SUM(a.overtime_hours) as total_overtime_hours
      FROM attendance a
      ${whereClause}
    `).get(...params);
    
    res.json({
      success: true,
      data: stats
    });
  })
);

module.exports = router;