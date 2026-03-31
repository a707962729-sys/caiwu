const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware, requireRole } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { AuditLogger } = require('../middleware/audit');

router.use(authMiddleware);

/**
 * 获取员工列表
 * GET /api/employees
 */
router.get('/',
  permissionMiddleware('employees', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, status, department, position, keyword } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE e.company_id = ?';
    const params = [companyId];
    
    if (status) {
      whereClause += ' AND e.status = ?';
      params.push(status);
    }
    
    if (department) {
      whereClause += ' AND e.department = ?';
      params.push(department);
    }
    
    if (position) {
      whereClause += ' AND e.position = ?';
      params.push(position);
    }
    
    if (keyword) {
      whereClause += ' AND (e.name LIKE ? OR e.id_card LIKE ? OR e.phone LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw);
    }
    
    const offset = (page - 1) * pageSize;
    
    const list = db.prepare(`
      SELECT 
        e.*,
        u.username,
        u.email as user_email,
        u.phone as user_phone,
        c.contract_no,
        c.start_date as contract_start,
        c.end_date as contract_end
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN contracts c ON e.contract_id = c.id
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(pageSize), offset);
    
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM employees e ${whereClause}
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
 * 获取员工统计
 * GET /api/employees/stats
 */
router.get('/stats',
  permissionMiddleware('employees', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive
      FROM employees
      WHERE company_id = ?
    `).get(companyId);
    
    const byDepartment = db.prepare(`
      SELECT department, COUNT(*) as count
      FROM employees
      WHERE company_id = ? AND department IS NOT NULL AND department != ''
      GROUP BY department
      ORDER BY count DESC
    `).all(companyId);
    
    res.json({
      success: true,
      data: {
        total: stats.total || 0,
        active: stats.active || 0,
        inactive: stats.inactive || 0,
        by_department: byDepartment
      }
    });
  })
);

/**
 * 获取单个员工
 * GET /api/employees/:id
 */
router.get('/:id',
  permissionMiddleware('employees', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const companyId = req.user.companyId;
    
    const employee = db.prepare(`
      SELECT 
        e.*,
        u.username,
        u.email as user_email,
        u.phone as user_phone,
        c.contract_no,
        c.start_date as contract_start,
        c.end_date as contract_end,
        c.amount as contract_amount
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN contracts c ON e.contract_id = c.id
      WHERE e.id = ? AND e.company_id = ?
    `).get(id, companyId);
    
    if (!employee) {
      throw ErrorTypes.NotFound('员工');
    }
    
    res.json({ success: true, data: employee });
  })
);

/**
 * 创建员工
 * POST /api/employees
 */
router.post('/',
  requireRole(['boss', 'accountant']),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const {
      name, id_card, phone, email,
      position, department, hire_date,
      contract_id, contract_no,
      base_salary, position_allowance,
      bank_name, bank_account,
      remark
    } = req.body;
    
    if (!name) {
      throw ErrorTypes.BadRequest('请填写员工姓名');
    }
    
    const result = db.prepare(`
      INSERT INTO employees (
        company_id, name, id_card, phone, email,
        position, department, hire_date,
        contract_id, contract_no,
        base_salary, position_allowance,
        bank_name, bank_account, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.companyId, name, id_card || null, phone || null, email || null,
      position || null, department || null, hire_date || null,
      contract_id || null, contract_no || null,
      base_salary || 0, position_allowance || 0,
      bank_name || null, bank_account || null, remark || null
    );
    
    const newEmployee = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
    AuditLogger.logCreate('employees', result.lastInsertRowid, newEmployee, req);
    
    res.status(201).json({
      success: true,
      data: newEmployee,
      message: '员工创建成功'
    });
  })
);

/**
 * 更新员工
 * PUT /api/employees/:id
 */
router.put('/:id',
  requireRole(['boss', 'accountant']),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const companyId = req.user.companyId;
    
    const existing = db.prepare(`
      SELECT * FROM employees WHERE id = ? AND company_id = ?
    `).get(id, companyId);
    
    if (!existing) {
      throw ErrorTypes.NotFound('员工');
    }
    
    const {
      name, id_card, phone, email,
      position, department, hire_date,
      contract_id, contract_no,
      base_salary, position_allowance,
      status, bank_name, bank_account,
      remark
    } = req.body;
    
    db.prepare(`
      UPDATE employees SET
        name = ?, id_card = ?, phone = ?, email = ?,
        position = ?, department = ?, hire_date = ?,
        contract_id = ?, contract_no = ?,
        base_salary = ?, position_allowance = ?,
        status = ?, bank_name = ?, bank_account = ?,
        remark = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name || existing.name,
      id_card !== undefined ? id_card : existing.id_card,
      phone !== undefined ? phone : existing.phone,
      email !== undefined ? email : existing.email,
      position !== undefined ? position : existing.position,
      department !== undefined ? department : existing.department,
      hire_date !== undefined ? hire_date : existing.hire_date,
      contract_id !== undefined ? contract_id : existing.contract_id,
      contract_no !== undefined ? contract_no : existing.contract_no,
      base_salary !== undefined ? base_salary : existing.base_salary,
      position_allowance !== undefined ? position_allowance : existing.position_allowance,
      status || existing.status,
      bank_name !== undefined ? bank_name : existing.bank_name,
      bank_account !== undefined ? bank_account : existing.bank_account,
      remark !== undefined ? remark : existing.remark,
      id
    );
    
    const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    AuditLogger.logUpdate('employees', id, existing, updated, req);
    
    res.json({ success: true, data: updated, message: '员工信息已更新' });
  })
);

/**
 * 删除员工
 * DELETE /api/employees/:id
 */
router.delete('/:id',
  requireRole(['boss', 'accountant']),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const companyId = req.user.companyId;
    
    const existing = db.prepare(`
      SELECT * FROM employees WHERE id = ? AND company_id = ?
    `).get(id, companyId);
    
    if (!existing) {
      throw ErrorTypes.NotFound('员工');
    }
    
    if (existing.status === 'active') {
      throw ErrorTypes.BadRequest('只能删除已离职的员工');
    }
    
    db.prepare('DELETE FROM employees WHERE id = ?').run(id);
    AuditLogger.logDelete('employees', id, existing, req);
    
    res.json({ success: true, message: '员工已删除' });
  })
);

/**
 * 员工入职 - 从合同自动创建
 * POST /api/employees/onboard
 */
router.post('/onboard',
  requireRole(['boss', 'accountant']),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { contract_id, name, id_card, phone, email, position, department, hire_date, base_salary, position_allowance } = req.body;
    
    if (!contract_id && !name) {
      throw ErrorTypes.BadRequest('请提供合同ID或员工姓名');
    }
    
    let employeeData = {
      company_id: req.user.companyId,
      name, id_card, phone, email,
      position, department, hire_date,
      contract_id, base_salary, position_allowance
    };
    
    // 如果提供了合同ID，从合同中提取信息
    if (contract_id) {
      const contract = db.prepare(`
        SELECT * FROM contracts WHERE id = ? AND company_id = ?
      `).get(contract_id, req.user.companyId);
      
      if (!contract) {
        throw ErrorTypes.NotFound('合同');
      }
      
      // 合同绑定员工
      if (contract.employee_id) {
        throw ErrorTypes.BadRequest('该合同已绑定其他员工');
      }
      
      // 自动从合同提取信息（覆盖手动提供的信息）
      if (contract.name && !name) employeeData.name = contract.name;
      if (contract.start_date && !hire_date) employeeData.hire_date = contract.start_date;
      if (contract.partner_id) {
        const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(contract.partner_id);
        if (partner && !name) employeeData.name = partner.name;
      }
    }
    
    if (!employeeData.name) {
      throw ErrorTypes.BadRequest('无法从合同提取员工姓名');
    }
    
    // 创建员工
    const result = db.prepare(`
      INSERT INTO employees (
        company_id, name, id_card, phone, email,
        position, department, hire_date,
        contract_id, base_salary, position_allowance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      employeeData.company_id,
      employeeData.name,
      employeeData.id_card || null,
      employeeData.phone || null,
      employeeData.email || null,
      employeeData.position || null,
      employeeData.department || null,
      employeeData.hire_date || null,
      employeeData.contract_id || null,
      employeeData.base_salary || 0,
      employeeData.position_allowance || 0
    );
    
    const newEmployee = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
    
    // 如果有合同ID，更新合同的 employee_id
    if (contract_id) {
      db.prepare(`
        UPDATE contracts SET employee_id = ? WHERE id = ?
      `).run(newEmployee.id, contract_id);
    }
    
    AuditLogger.logCreate('employees', newEmployee.id, newEmployee, req);
    
    res.status(201).json({
      success: true,
      data: newEmployee,
      message: '员工入职办理成功'
    });
  })
);

/**
 * 获取员工考勤记录
 * GET /api/employees/:id/attendance
 */
router.get('/:id/attendance',
  permissionMiddleware('attendance', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const { year, month } = req.query;
    const companyId = req.user.companyId;
    
    const employee = db.prepare(`
      SELECT * FROM employees WHERE id = ? AND company_id = ?
    `).get(id, companyId);
    
    if (!employee) {
      throw ErrorTypes.NotFound('员工');
    }
    
    let whereClause = 'WHERE a.employee_id = ?';
    const params = [id];
    
    if (year) {
      whereClause += ' AND strftime("%Y", a.date) = ?';
      params.push(String(year));
    }
    
    if (month) {
      whereClause += ' AND strftime("%m", a.date) = ?';
      params.push(String(month).padStart(2, '0'));
    }
    
    const list = db.prepare(`
      SELECT * FROM attendance a
      ${whereClause}
      ORDER BY a.date DESC
    `).all(...params);
    
    res.json({ success: true, data: list });
  })
);

/**
 * 获取员工工资记录
 * GET /api/employees/:id/salaries
 */
router.get('/:id/salaries',
  permissionMiddleware('salaries', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const { year } = req.query;
    const companyId = req.user.companyId;
    
    const employee = db.prepare(`
      SELECT * FROM employees WHERE id = ? AND company_id = ?
    `).get(id, companyId);
    
    if (!employee) {
      throw ErrorTypes.NotFound('员工');
    }
    
    let whereClause = 'WHERE s.employee_id = ?';
    const params = [id];
    
    if (year) {
      whereClause += ' AND s.year = ?';
      params.push(parseInt(year));
    }
    
    const list = db.prepare(`
      SELECT * FROM salaries s
      ${whereClause}
      ORDER BY s.year DESC, s.month DESC
    `).all(...params);
    
    res.json({ success: true, data: list });
  })
);

module.exports = router;
