/**
 * 自动算薪服务
 * 根据考勤记录自动计算工资
 */

const { getDatabaseCompat, transaction } = require('../database');

/**
 * 计算个人所得税（简化版）
 * @param {number} taxableIncome - 应纳税所得额
 * @returns {number} 个税
 */
function calculateTax(taxableIncome) {
  if (taxableIncome <= 0) return 0;
  
  // 个税税率表（2019年后标准）
  const taxBrackets = [
    { max: 36000, rate: 0.03, deduction: 0 },
    { max: 144000, rate: 0.10, deduction: 2520 },
    { max: 252000, rate: 0.20, deduction: 16920 },
    { max: 324000, rate: 0.25, deduction: 31920 },
    { max: 420000, rate: 0.25, deduction: 31920 },
    { max: 660000, rate: 0.30, deduction: 52920 },
    { max: 960000, rate: 0.35, deduction: 85920 },
    { max: Infinity, rate: 0.45, deduction: 181920 }
  ];
  
  for (const bracket of taxBrackets) {
    if (taxableIncome <= bracket.max) {
      return Math.round(taxableIncome * bracket.rate - bracket.deduction);
    }
  }
  
  return 0;
}

/**
 * 计算每月应工作日
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @returns {number} 应工作日数
 */
function getWorkDaysInMonth(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  let workDays = 0;
  
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workDays++;
    }
  }
  
  return workDays;
}

/**
 * 获取员工考勤统计
 * @param {number} employeeId - 员工ID
 * @param {number} companyId - 公司ID
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @returns {object} 考勤统计
 */
function getAttendanceStats(employeeId, companyId, year, month) {
  const db = getDatabaseCompat();
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_days,
      SUM(CASE WHEN status = 'normal' THEN 1 ELSE 0 END) as normal_days,
      SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
      SUM(CASE WHEN status = 'early_leave' THEN 1 ELSE 0 END) as early_leave_days,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
      SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave_days,
      SUM(work_hours) as total_work_hours,
      SUM(overtime_hours) as total_overtime_hours
    FROM attendance
    WHERE company_id = ? 
      AND employee_id = ?
      AND strftime('%Y', date) = ?
      AND strftime('%m', date) = ?
  `).get(
    companyId, 
    employeeId, 
    String(year), 
    String(month).padStart(2, '0')
  );
  
  return stats;
}

/**
 * 获取员工请假统计
 * @param {number} employeeId - 员工ID
 * @param {number} companyId - 公司ID
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @returns {object} 请假统计
 */
function getLeaveStats(employeeId, companyId, year, month) {
  const db = getDatabaseCompat();
  
  const stats = db.prepare(`
    SELECT 
      SUM(days) as total_leave_days,
      SUM(CASE WHEN leave_type = 'annual' THEN days ELSE 0 END) as annual_leave_days,
      SUM(CASE WHEN leave_type = 'sick' THEN days ELSE 0 END) as sick_leave_days,
      SUM(CASE WHEN leave_type = 'unpaid' THEN days ELSE 0 END) as unpaid_leave_days
    FROM leave_requests
    WHERE company_id = ?
      AND employee_id = ?
      AND status = 'approved'
      AND strftime('%Y', start_date) <= ?
      AND strftime('%Y', end_date) >= ?
  `).all(
    companyId, 
    employeeId, 
    String(year), 
    String(month).padStart(2, '0')
  );
  
  return stats[0] || {};
}

/**
 * 自动计算员工月薪
 * @param {number} employeeId - 员工ID
 * @param {number} companyId - 公司ID
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @returns {object} 工资计算结果
 */
function calculateMonthlySalary(employeeId, companyId, year, month) {
  const db = getDatabaseCompat();
  
  // 获取员工信息
  const employee = db.prepare(`
    SELECT * FROM employees WHERE id = ? AND company_id = ?
  `).get(employeeId, companyId);
  
  if (!employee) {
    throw new Error('员工不存在');
  }
  
  // 获取考勤统计
  const attendanceStats = getAttendanceStats(employeeId, companyId, year, month);
  
  // 计算应工作日
  const workDays = getWorkDaysInMonth(year, month);
  
  // 实际工作日 = 正常出勤 + 请假（带薪假）
  // 如果没有考勤数据，默认满勤（应付全月工资）
  const hasAttendanceData = attendanceStats.total_days > 0;
  let actualWorkDays = (attendanceStats.normal_days || 0) + 
                       (attendanceStats.late_days || 0) + 
                       (attendanceStats.leave_days || 0);
  if (!hasAttendanceData) {
    actualWorkDays = workDays; // 默认满勤
  }
  
  // 旷工天数
  const absentDays = hasAttendanceData ? (attendanceStats.absent_days || 0) : 0;
  
  // 基本工资
  let baseSalary = parseFloat(employee.base_salary) || 0;
  const positionAllowance = parseFloat(employee.position_allowance) || 0;
  
  // 根据入职日期和状态判断是否试用期
  // 试用期：入职未满3个月或状态为probation
  let isProbation = false;
  if (employee.hire_date) {
    const hireDate = new Date(employee.hire_date);
    const now = new Date();
    const monthsDiff = (now.getFullYear() - hireDate.getFullYear()) * 12 + (now.getMonth() - hireDate.getMonth());
    isProbation = monthsDiff < 3;
  }
  // 如果状态明确为probation，也是试用期
  if (employee.status === 'probation') {
    isProbation = true;
  }
  
  // 试用期员工工资按80%计算
  if (isProbation) {
    baseSalary = baseSalary * 0.8;
  }
  
  // 按实际工作日比例计算应发基本工资
  let dailySalary = workDays > 0 ? baseSalary / workDays : 0;
  let calculatedBaseSalary = dailySalary * actualWorkDays;
  
  // 扣除旷工工资
  const absentDeduction = dailySalary * absentDays;
  calculatedBaseSalary = Math.max(0, calculatedBaseSalary - absentDeduction);
  
  // 加班费（按基本工资的1.5倍计算）
  const overtimeHours = parseFloat(attendanceStats.total_overtime_hours) || 0;
  const hourlyRate = baseSalary / (workDays * 8);
  const overtimePay = overtimeHours * hourlyRate * 1.5;
  
  // 应发工资
  const grossSalary = calculatedBaseSalary + positionAllowance + overtimePay;
  
  // 社保公积金（简化计算，个人部分约为应发工资的10.5%）
  const socialInsurance = grossSalary * 0.105;
  const housingFund = grossSalary * 0.07;
  
  // 个税前工资
  const preTaxSalary = grossSalary - socialInsurance - housingFund;
  
  // 计算个税（简化：按月计算，每月减除5000元）
  const taxableIncome = Math.max(0, preTaxSalary - 5000);
  const tax = calculateTax(taxableIncome);
  
  // 实发工资
  const actualSalary = preTaxSalary - tax;
  
  return {
    employee_id: employeeId,
    employee_name: employee.name,
    year,
    month,
    base_salary: baseSalary,
    original_base_salary: parseFloat(employee.base_salary) || 0,
    is_probation: isProbation,
    status: employee.status,
    position_allowance: positionAllowance,
    work_days: workDays,
    actual_work_days: actualWorkDays,
    absent_days: absentDays,
    overtime_hours: overtimeHours,
    overtime_pay: Math.round(overtimePay * 100) / 100,
    gross_salary: Math.round(grossSalary * 100) / 100,
    social_insurance: Math.round(socialInsurance * 100) / 100,
    housing_fund: Math.round(housingFund * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    actual_salary: Math.round(actualSalary * 100) / 100,
    attendance_stats: attendanceStats
  };
}

/**
 * 自动为所有员工生成月薪
 * @param {number} companyId - 公司ID
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @returns {array} 生成结果列表
 */
function autoGenerateMonthlySalaries(companyId, year, month) {
  const db = getDatabaseCompat();
  
  // 获取所有在职员工（包括试用期）
  const employees = db.prepare(`
    SELECT * FROM employees WHERE company_id = ? AND status IN ('active', 'probation')
  `).all(companyId);
  
  const results = [];
  
  for (const employee of employees) {
    try {
      const salaryData = calculateMonthlySalary(employee.id, companyId, year, month);
      
      // 检查是否已存在
      const existing = db.prepare(`
        SELECT * FROM salaries 
        WHERE company_id = ? AND employee_id = ? AND year = ? AND month = ?
      `).get(companyId, employee.id, year, month);
      
      if (existing) {
        // 更新
        db.prepare(`
          UPDATE salaries SET
            base_salary = ?, position_allowance = ?,
            work_days = ?, actual_work_days = ?,
            overtime_pay = ?,
            social_insurance = ?, housing_fund = ?, tax = ?,
            gross_salary = ?, actual_salary = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `).run(
          salaryData.base_salary,
          salaryData.position_allowance,
          salaryData.work_days,
          salaryData.actual_work_days,
          salaryData.overtime_pay,
          salaryData.social_insurance,
          salaryData.housing_fund,
          salaryData.tax,
          salaryData.gross_salary,
          salaryData.actual_salary,
          existing.id
        );
        
        results.push({
          employee_id: employee.id,
          employee_name: employee.name,
          status: 'updated',
          ...salaryData
        });
      } else {
        // 创建
        db.prepare(`
          INSERT INTO salaries (
            company_id, employee_id, year, month,
            base_salary, position_allowance,
            work_days, actual_work_days,
            overtime_pay,
            social_insurance, housing_fund, tax,
            gross_salary, actual_salary,
            status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          companyId, employee.id, year, month,
          salaryData.base_salary,
          salaryData.position_allowance,
          salaryData.work_days,
          salaryData.actual_work_days,
          salaryData.overtime_pay,
          salaryData.social_insurance,
          salaryData.housing_fund,
          salaryData.tax,
          salaryData.gross_salary,
          salaryData.actual_salary,
          'draft'
        );
        
        results.push({
          employee_id: employee.id,
          employee_name: employee.name,
          status: 'created',
          ...salaryData
        });
      }
    } catch (err) {
      results.push({
        employee_id: employee.id,
        employee_name: employee.name,
        status: 'error',
        error: err.message
      });
    }
  }
  
  return results;
}

module.exports = {
  calculateMonthlySalary,
  autoGenerateMonthlySalaries,
  calculateTax,
  getWorkDaysInMonth,
  getAttendanceStats,
  getLeaveStats
};
