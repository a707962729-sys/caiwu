const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

/**
 * 获取 AI 规则
 * GET /api/ai-rules
 */
router.get('/', async (req, res) => {
  try {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { ruleType } = req.query;

    let sql = 'SELECT * FROM ai_rules WHERE company_id = ? AND status = ?';
    const params = [companyId, 'active'];

    if (ruleType) {
      sql += ' AND rule_type = ?';
      params.push(ruleType);
    }

    const rules = db.prepare(sql).all(...params);

    // 转换为对象格式
    const rulesMap = {};
    rules.forEach(rule => {
      if (!rulesMap[rule.rule_type]) {
        rulesMap[rule.rule_type] = {};
      }
      rulesMap[rule.rule_type][rule.rule_key] = {
        value: rule.rule_value,
        description: rule.description
      };
    });

    res.json({ success: true, data: rulesMap });
  } catch (error) {
    console.error('获取AI规则失败:', error);
    res.status(500).json({ success: false, error: '获取AI规则失败' });
  }
});

/**
 * 获取特定规则值
 * GET /api/ai-rules/:key
 */
router.get('/:key', async (req, res) => {
  try {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { key } = req.params;

    const rule = db.prepare(
      'SELECT * FROM ai_rules WHERE company_id = ? AND rule_key = ? AND status = ?'
    ).get(companyId, key, 'active');

    if (!rule) {
      return res.json({ success: true, data: null });
    }

    res.json({
      success: true,
      data: {
        key: rule.rule_key,
        value: rule.rule_value,
        type: rule.rule_type,
        description: rule.description
      }
    });
  } catch (error) {
    console.error('获取AI规则失败:', error);
    res.status(500).json({ success: false, error: '获取AI规则失败' });
  }
});

/**
 * 更新规则
 * PUT /api/ai-rules/:key
 */
router.put('/:key', permissionMiddleware('settings', 'write'), async (req, res) => {
  try {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { key } = req.params;
    const { value, description } = req.body;

    const result = db.prepare(
      `UPDATE ai_rules SET rule_value = ?, description = ?, updated_at = datetime('now')
       WHERE company_id = ? AND rule_key = ?`
    ).run(value, description, companyId, key);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '规则不存在' });
    }

    res.json({ success: true, message: '规则已更新' });
  } catch (error) {
    console.error('更新AI规则失败:', error);
    res.status(500).json({ success: false, error: '更新AI规则失败' });
  }
});

/**
 * 检查报销限额
 * POST /api/ai-rules/check-reimbursement
 */
router.post('/check-reimbursement', async (req, res) => {
  try {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { amount, userId } = req.body;
    const checkUserId = userId || req.user.id;

    // 获取用户角色
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(checkUserId);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    // 获取限额规则
    const limitKey = `${user.role === 'boss' ? 'boss' : user.role === 'accountant' ? 'accountant' : 'employee'}.single_limit`;
    const limitRule = db.prepare(
      'SELECT rule_value FROM ai_rules WHERE company_id = ? AND rule_key = ?'
    ).get(companyId, `reimbursement.${limitKey}`);

    const singleLimit = limitRule ? parseFloat(limitRule.rule_value) : 2000;

    // 检查本月已报销金额
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthTotal = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM reimbursements
      WHERE user_id = ? AND created_at >= ? AND status != 'rejected'
    `).get(checkUserId, monthStart.toISOString());

    const monthlyLimitRule = db.prepare(
      'SELECT rule_value FROM ai_rules WHERE company_id = ? AND rule_key = ?'
    ).get(companyId, 'reimbursement.employee.monthly_limit');

    const monthlyLimit = monthlyLimitRule ? parseFloat(monthlyLimitRule.rule_value) : 10000;

    res.json({
      success: true,
      data: {
        canSubmit: amount <= singleLimit && (monthTotal.total + amount) <= monthlyLimit,
        singleLimit,
        monthlyLimit,
        usedThisMonth: monthTotal.total,
        remainingThisMonth: Math.max(0, monthlyLimit - monthTotal.total),
        exceedsLimit: amount > singleLimit,
        exceedsMonthly: (monthTotal.total + amount) > monthlyLimit,
        requireInvoice: amount > 100 // 超过100需要发票
      }
    });
  } catch (error) {
    console.error('检查报销限额失败:', error);
    res.status(500).json({ success: false, error: '检查失败' });
  }
});

/**
 * 检查请假限额
 * POST /api/ai-rules/check-leave
 */
router.post('/check-leave', async (req, res) => {
  try {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { leaveType, days, userId } = req.body;
    const checkUserId = userId || req.user.id;

    // 获取请假类型对应的天数限制
    const typeMap = {
      annual: 'employee.annual_days',
      sick: 'employee.sick_days',
      personal: 'employee.personal_days'
    };

    const ruleKey = typeMap[leaveType] || 'employee.personal_days';
    const limitRule = db.prepare(
      'SELECT rule_value FROM ai_rules WHERE company_id = ? AND rule_key = ?'
    ).get(companyId, `leave.${ruleKey}`);

    const limit = limitRule ? parseFloat(limitRule.rule_value) : 5;

    // 获取本年已使用天数
    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);

    const usedDays = db.prepare(`
      SELECT COALESCE(SUM(days), 0) as total
      FROM leave_requests
      WHERE user_id = ? AND leave_type = ? AND start_date >= ? AND status = 'approved'
    `).get(checkUserId, leaveType, yearStart.toISOString().split('T')[0]);

    const used = usedDays ? usedDays.total : 0;

    res.json({
      success: true,
      data: {
        canApply: (used + days) <= limit,
        limit,
        used,
        remaining: Math.max(0, limit - used),
        exceeds: (used + days) > limit
      }
    });
  } catch (error) {
    console.error('检查请假限额失败:', error);
    res.status(500).json({ success: false, error: '检查失败' });
  }
});

module.exports = router;