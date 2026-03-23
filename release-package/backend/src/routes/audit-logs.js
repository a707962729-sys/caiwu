const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

/**
 * 获取审计日志列表
 * GET /api/audit-logs
 */
router.get('/',
  authMiddleware,
  requireRole(['admin', 'accountant']),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { 
      page = 1, 
      pageSize = 20, 
      user_id, 
      action, 
      entity_type,
      start_date,
      end_date 
    } = req.query;
    
    const offset = (page - 1) * pageSize;
    
    let sql = `
      SELECT 
        al.*,
        u.real_name as user_name,
        u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (user_id) {
      sql += ' AND al.user_id = ?';
      params.push(user_id);
    }
    
    if (action) {
      sql += ' AND al.action = ?';
      params.push(action);
    }
    
    if (entity_type) {
      sql += ' AND al.entity_type = ?';
      params.push(entity_type);
    }
    
    if (start_date) {
      sql += ' AND DATE(al.created_at) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND DATE(al.created_at) <= ?';
      params.push(end_date);
    }
    
    // 获取总数
    const countSql = sql.replace('SELECT al.*, u.real_name as user_name, u.username', 'SELECT COUNT(*) as total');
    const countResult = db.prepare(countSql).get(...params);
    const total = countResult?.total || 0;
    
    // 获取列表
    sql += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);
    
    const list = db.prepare(sql).all(...params);
    
    res.json({
      success: true,
      data: {
        list,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  })
);

/**
 * 获取用户的操作日志
 * GET /api/audit-logs/user/:userId
 */
router.get('/user/:userId',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { userId } = req.params;
    const { page = 1, pageSize = 20 } = req.query;
    
    // 非管理员只能查看自己的日志
    if (req.user.role !== 'admin' && req.user.id != userId) {
      return res.status(403).json({
        success: false,
        message: '无权查看他人日志'
      });
    }
    
    const offset = (page - 1) * pageSize;
    
    const list = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, parseInt(pageSize), offset);
    
    const countResult = db.prepare('SELECT COUNT(*) as total FROM audit_logs WHERE user_id = ?').get(userId);
    
    res.json({
      success: true,
      data: {
        list,
        total: countResult?.total || 0
      }
    });
  })
);

/**
 * 获取指定记录的操作历史
 * GET /api/audit-logs/record/:entity_type/:entity_id
 */
router.get('/record/:entity_type/:entity_id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { entity_type, entity_id } = req.params;
    
    const list = db.prepare(`
      SELECT 
        al.*,
        u.real_name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.entity_type = ? AND al.entity_id = ?
      ORDER BY al.created_at DESC
    `).all(entity_type, entity_id);
    
    res.json({
      success: true,
      data: list
    });
  })
);

/**
 * 获取操作统计
 * GET /api/audit-logs/stats
 */
router.get('/stats',
  authMiddleware,
  requireRole(['admin']),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (start_date) {
      dateFilter += ' AND DATE(created_at) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      dateFilter += ' AND DATE(created_at) <= ?';
      params.push(end_date);
    }
    
    // 按实体类型统计
    const byEntityType = db.prepare(`
      SELECT entity_type, COUNT(*) as count
      FROM audit_logs
      WHERE 1=1 ${dateFilter}
      GROUP BY entity_type
      ORDER BY count DESC
    `).all(...params);
    
    // 按操作统计
    const byAction = db.prepare(`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      WHERE 1=1 ${dateFilter}
      GROUP BY action
      ORDER BY count DESC
    `).all(...params);
    
    // 按用户统计
    const byUser = db.prepare(`
      SELECT 
        u.id,
        u.real_name,
        u.username,
        COUNT(al.id) as count
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1 ${dateFilter}
      GROUP BY al.user_id
      ORDER BY count DESC
      LIMIT 10
    `).all(...params);
    
    // 每日趋势
    const dailyTrend = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM audit_logs
      WHERE 1=1 ${dateFilter}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `).all(...params);
    
    res.json({
      success: true,
      data: {
        byEntityType,
        byAction,
        byUser,
        dailyTrend
      }
    });
  })
);

module.exports = router;