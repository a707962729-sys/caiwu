const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware, requireRole } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { AuditLog } = require('../middleware/audit');
const { calculateMonthlySalary, autoGenerateMonthlySalaries } = require('../services/salary-calculator');

router.use(authMiddleware);

/**
 * 获取工资列表
 * GET /api/salaries
 */
router.get('/',
  permissionMiddleware('salaries', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, userId, year, month, status } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE s.company_id = ?';
    const params = [companyId];
    
    // 员工只能查看自己的工资
    if (req.user.role === 'employee') {
      whereClause += ' AND s.user_id = ?';
      params.push(req.user.id);
    } else if (userId) {
      whereClause += ' AND s.user_id = ?';
      params.push(userId);
    }
    
    if (year) {
      whereClause += ' AND s.year = ?';
      params.push(parseInt(year));
    }
    
    if (month) {
      whereClause += ' AND s.month = ?';
      params.push(parseInt(month));
    }
    
    if (status) {
      whereClause += ' AND s.status = ?';
      params.push(status);
    }
    
    const offset = (page - 1) * pageSize;
    
    const list = db.prepare(`
      SELECT 
        s.*,
        u.real_name as user_name,
        u.department,
        u.position
      FROM salaries s
      LEFT JOIN users u ON s.user_id = u.id
      ${whereClause}
      ORDER BY s.year DESC, s.month DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(pageSize), offset);
    
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM salaries s ${whereClause}
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
 * 创建/更新工资记录
 * POST /api/salaries
 */
router.post('/',
  requireRole(['boss', 'accountant']),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const {
      user_id, year, month,
      base_salary, position_allowance, performance_bonus,
      overtime_pay, other_bonus,
      social_insurance, housing_fund, tax, other_deduction,
      notes
    } = req.body;
    
    if (!user_id || !year || !month || base_salary === undefined) {
      throw ErrorTypes.BadRequest('请填写完整的工资信息');
    }
    
    // 计算实发工资
    const totalIncome = 
      parseFloat(base_salary || 0) + 
      parseFloat(position_allowance || 0) + 
      parseFloat(performance_bonus || 0) + 
      parseFloat(overtime_pay || 0) + 
      parseFloat(other_bonus || 0);
    
    const totalDeduction = 
      parseFloat(social_insurance || 0) + 
      parseFloat(housing_fund || 0) + 
      parseFloat(tax || 0) + 
      parseFloat(other_deduction || 0);
    
    const actual_salary = totalIncome - totalDeduction;
    
    // 检查是否已存在
    const existing = db.prepare(`
      SELECT * FROM salaries WHERE company_id = ? AND user_id = ? AND year = ? AND month = ?
    `).get(req.user.companyId, user_id, year, month);
    
    if (existing) {
      // 更新
      db.prepare(`
        UPDATE salaries SET
          base_salary = ?, position_allowance = ?, performance_bonus = ?,
          overtime_pay = ?, other_bonus = ?,
          social_insurance = ?, housing_fund = ?, tax = ?, other_deduction = ?,
          actual_salary = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        base_salary, position_allowance || 0, performance_bonus || 0,
        overtime_pay || 0, other_bonus || 0,
        social_insurance || 0, housing_fund || 0, tax || 0, other_deduction || 0,
        actual_salary, notes || null, existing.id
      );
      
      const updated = db.prepare('SELECT * FROM salaries WHERE id = ?').get(existing.id);
      AuditLog.update(req.user.id, 'salaries', existing.id, existing, updated, req);
      
      res.json({ success: true, data: updated, message: '工资记录已更新' });
    } else {
      // 查找employee_id
      const emp = db.prepare('SELECT id FROM employees WHERE company_id = ? AND user_id = ?').get(req.user.companyId, user_id);
      const employee_id = emp ? emp.id : null;

      // 创建
      const result = db.prepare(`
        INSERT INTO salaries (
          company_id, employee_id, user_id, year, month,
          base_salary, position_allowance, performance_bonus,
          overtime_pay, other_bonus,
          social_insurance, housing_fund, tax, other_deduction,
          actual_salary, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.companyId, employee_id, user_id, year, month,
        base_salary, position_allowance || 0, performance_bonus || 0,
        overtime_pay || 0, other_bonus || 0,
        social_insurance || 0, housing_fund || 0, tax || 0, other_deduction || 0,
        actual_salary, notes || null, req.user.id
      );
      
      const newSalary = db.prepare('SELECT * FROM salaries WHERE id = ?').get(result.lastInsertRowid);
      AuditLog.create(req.user.id, 'salaries', result.lastInsertRowid, newSalary, req);
      
      res.status(201).json({ success: true, data: newSalary, message: '工资记录已创建' });
    }
  })
);

/**
 * 确认工资
 * POST /api/salaries/:id/confirm
 */
router.post('/:id/confirm',
  requireRole(['boss', 'accountant']),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const salary = db.prepare(`
      SELECT * FROM salaries WHERE id = ? AND company_id = ?
    `).get(req.params.id, req.user.companyId);
    
    if (!salary) {
      throw ErrorTypes.NotFound('工资记录');
    }
    
    if (salary.status !== 'draft') {
      throw ErrorTypes.BadRequest('该工资记录已确认或已发放');
    }
    
    db.prepare(`
      UPDATE salaries SET status = 'confirmed' WHERE id = ?
    `).run(req.params.id);
    
    AuditLog.log({
      userId: req.user.id,
      module: 'salaries',
      action: 'confirm',
      recordId: req.params.id,
      oldValue: salary,
      newValue: { status: 'confirmed' },
      request: req
    });
    
    res.json({ success: true, message: '工资已确认' });
  })
);

/**
 * 发放工资
 * POST /api/salaries/:id/pay
 */
router.post('/:id/pay',
  requireRole(['boss', 'accountant']),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const salary = db.prepare(`
      SELECT * FROM salaries WHERE id = ? AND company_id = ?
    `).get(req.params.id, req.user.companyId);
    
    if (!salary) {
      throw ErrorTypes.NotFound('工资记录');
    }
    
    if (salary.status !== 'confirmed') {
      throw ErrorTypes.BadRequest('请先确认工资');
    }
    
    db.prepare(`
      UPDATE salaries SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.params.id);
    
    AuditLog.log({
      userId: req.user.id,
      module: 'salaries',
      action: 'pay',
      recordId: req.params.id,
      oldValue: salary,
      newValue: { status: 'paid' },
      request: req
    });
    
    res.json({ success: true, message: '工资已发放' });
  })
);

/**
 * 获取工资统计
 * GET /api/salaries/stats
 */
router.get('/stats',
  requireRole(['boss', 'accountant']),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { year, month } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE company_id = ?';
    const params = [companyId];
    
    if (year) {
      whereClause += ' AND year = ?';
      params.push(parseInt(year));
    }
    
    if (month) {
      whereClause += ' AND month = ?';
      params.push(parseInt(month));
    }
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as employee_count,
        SUM(base_salary) as total_base,
        SUM(performance_bonus) as total_bonus,
        SUM(actual_salary) as total_actual,
        AVG(actual_salary) as avg_salary
      FROM salaries
      ${whereClause}
    `).get(...params);
    
    // 按部门统计
    const byDepartment = db.prepare(`
      SELECT 
        u.department,
        COUNT(*) as count,
        SUM(s.actual_salary) as total_salary,
        AVG(s.actual_salary) as avg_salary
      FROM salaries s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.company_id = ? ${year ? 'AND s.year = ?' : ''} ${month ? 'AND s.month = ?' : ''}
      GROUP BY u.department
    `).all(...params);
    
    res.json({
      success: true,
      data: {
        overview: stats,
        byDepartment
      }
    });
  })
);

/**
 * 获取员工工资详情
 * GET /api/salaries/my
 */
router.get('/my',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { year } = req.query;
    
    const list = db.prepare(`
      SELECT * FROM salaries
      WHERE company_id = ? AND user_id = ?
      ${year ? 'AND year = ?' : ''}
      ORDER BY year DESC, month DESC
    `).all(
      req.user.companyId, 
      req.user.id,
      ...(year ? [parseInt(year)] : [])
    );
    
    res.json({
      success: true,
      data: list
    });
  })
);

/**
 * 计算员工月薪（预览）
 * GET /api/salaries/calculate/:employeeId
 */
router.get('/calculate/:employeeId',
  requireRole(['boss', 'accountant']),
  asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    let { year, month } = req.query;
    const companyId = req.user.companyId;
    
    // 支持 YYYY-MM 格式
    if (month && month.includes('-')) {
      const parts = month.split('-');
      year = parts[0];
      month = parts[1];
    }
    
    if (!year || !month) {
      throw ErrorTypes.BadRequest('请提供年份和月份');
    }
    
    const result = calculateMonthlySalary(
      parseInt(employeeId),
      companyId,
      parseInt(year),
      parseInt(month)
    );
    
    res.json({ success: true, data: result });
  })
);

/**
 * 自动为所有员工生成月薪
 * POST /api/salaries/auto-generate
 */
router.post('/auto-generate',
  requireRole(['boss', 'accountant']),
  asyncHandler(async (req, res) => {
    const { year, month } = req.body;
    const companyId = req.user.companyId;
    
    if (!year || !month) {
      throw ErrorTypes.BadRequest('请提供年份和月份');
    }
    
    const results = autoGenerateMonthlySalaries(
      companyId,
      parseInt(year),
      parseInt(month)
    );
    
    res.json({
      success: true,
      data: results,
      message: `已为 ${results.filter(r => r.status !== 'error').length} 名员工生成工资`
    });
  })
);

module.exports = router;