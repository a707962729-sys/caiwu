const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDatabaseCompat, saveDatabase } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');

router.use(authMiddleware);

// ============================================
// 初始化 AI 智能介入相关表
// ============================================
function initIntelligenceTables(db) {
  
  // AI推荐表
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      user_id INTEGER,
      recommendation_type VARCHAR(50) NOT NULL,
      title VARCHAR(200) NOT NULL,
      content TEXT NOT NULL,
      priority VARCHAR(20) DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
      category VARCHAR(50),
      related_entity_type VARCHAR(50),
      related_entity_id INTEGER,
      action_suggestion TEXT,
      confidence_score DECIMAL(3,2) DEFAULT 0.8,
      status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'viewed', 'accepted', 'rejected', 'expired')),
      expires_at DATETIME,
      viewed_at DATETIME,
      accepted_at DATETIME,
      rejected_at DATETIME,
      reject_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  
  // AI每日报告表
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      report_date DATE NOT NULL,
      report_type VARCHAR(50) DEFAULT 'daily' CHECK(report_type IN ('daily', 'weekly', 'monthly')),
      title VARCHAR(200),
      summary TEXT,
      highlights TEXT,
      alerts TEXT,
      opportunities TEXT,
      recommendations TEXT,
      metrics TEXT,
      generated_by VARCHAR(50) DEFAULT 'ai',
      status VARCHAR(20) DEFAULT 'generated' CHECK(status IN ('draft', 'generated', 'sent', 'archived')),
      sent_at DATETIME,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(company_id, report_date, report_type)
    )
  `);
  
  // AI操作记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      user_id INTEGER,
      action_type VARCHAR(50) NOT NULL,
      action_name VARCHAR(100) NOT NULL,
      target_entity_type VARCHAR(50),
      target_entity_id INTEGER,
      action_params TEXT,
      action_result TEXT,
      status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'executing', 'success', 'failed', 'cancelled')),
      error_message TEXT,
      executed_at DATETIME,
      duration_ms INTEGER,
      rollback_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  
  // 创建索引
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_recommendations_company_id ON ai_recommendations(company_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user_id ON ai_recommendations(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_recommendations_status ON ai_recommendations(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_recommendations_type ON ai_recommendations(recommendation_type)`);
  
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_daily_reports_company_id ON ai_daily_reports(company_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_daily_reports_date ON ai_daily_reports(report_date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_daily_reports_type ON ai_daily_reports(report_type)`);
  
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_actions_company_id ON ai_actions(company_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_actions_user_id ON ai_actions(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_actions_status ON ai_actions(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_actions_type ON ai_actions(action_type)`);
  
  saveDatabase();
}

// 初始化表（延迟到第一次请求时）
let tablesInitialized = false;

function ensureTablesInitialized() {
  if (tablesInitialized) return;
  
  try {
    const db = getDatabaseCompat();
    initIntelligenceTables(db);
    tablesInitialized = true;
  } catch (err) {
    // 数据库可能尚未初始化
    console.log('AI intelligence tables initialization deferred');
  }
}

// 尝试初始化表
try {
  const db = getDatabaseCompat();
  initIntelligenceTables(db);
  tablesInitialized = true;
} catch (err) {
  // 数据库尚未初始化，将在第一次请求时重试
}

// ============================================
// 路由：GET /api/ai/recommend - 获取智能推荐
// ============================================
router.get('/recommend',
  asyncHandler(async (req, res) => {
    // 确保表已初始化
    ensureTablesInitialized();
    
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { type, status, limit = 20, offset = 0 } = req.query;
    
    // 构建查询条件
    let whereClause = 'WHERE company_id = ?';
    const params = [companyId];
    
    if (type) {
      whereClause += ' AND recommendation_type = ?';
      params.push(type);
    }
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    // 获取推荐列表
    const recommendations = db.prepare(`
      SELECT * FROM ai_recommendations
      ${whereClause}
      ORDER BY priority DESC, created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), parseInt(offset));
    
    // 获取总数
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM ai_recommendations ${whereClause}
    `).get(...params);
    
    // 如果没有推荐或需要刷新，生成新的推荐
    if (recommendations.length === 0 || req.query.refresh === 'true') {
      const newRecommendations = await generateRecommendations(db, companyId, userId);
      
      // 保存新生成的推荐
      for (const rec of newRecommendations) {
        db.prepare(`
          INSERT INTO ai_recommendations (
            company_id, user_id, recommendation_type, title, content, priority,
            category, related_entity_type, related_entity_id, action_suggestion,
            confidence_score, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+7 days'))
        `).run(
          companyId, userId, rec.type, rec.title, rec.content, rec.priority,
          rec.category, rec.relatedEntityType, rec.relatedEntityId, rec.actionSuggestion,
          rec.confidenceScore
        );
      }
      
      saveDatabase();
      
      // 重新获取推荐列表
      const updatedRecs = db.prepare(`
        SELECT * FROM ai_recommendations
        ${whereClause}
        ORDER BY priority DESC, created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, parseInt(limit), parseInt(offset));
      
      return res.json({
        success: true,
        data: {
          recommendations: updatedRecs,
          total: countResult.total + newRecommendations.length,
          generated: newRecommendations.length
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        recommendations,
        total: countResult.total,
        generated: 0
      }
    });
  })
);

// ============================================
// 路由：POST /api/ai/daily-report - 生成每日报告
// ============================================
router.post('/daily-report',
  asyncHandler(async (req, res) => {
    // 确保表已初始化
    ensureTablesInitialized();
    
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { date, type = 'daily', regenerate = false } = req.body;
    
    const reportDate = date || dayjs().format('YYYY-MM-DD');
    
    // 检查是否已存在报告
    const existingReport = db.prepare(`
      SELECT * FROM ai_daily_reports
      WHERE company_id = ? AND report_date = ? AND report_type = ?
    `).get(companyId, reportDate, type);
    
    if (existingReport && !regenerate) {
      return res.json({
        success: true,
        data: existingReport,
        message: '报告已存在'
      });
    }
    
    // 生成报告数据
    const reportData = await generateDailyReport(db, companyId, reportDate, type);
    
    if (existingReport && regenerate) {
      // 更新现有报告
      db.prepare(`
        UPDATE ai_daily_reports SET
          title = ?, summary = ?, highlights = ?, alerts = ?,
          opportunities = ?, recommendations = ?, metrics = ?,
          status = 'generated', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        reportData.title, reportData.summary, reportData.highlights,
        reportData.alerts, reportData.opportunities, reportData.recommendations,
        reportData.metrics, existingReport.id
      );
      
      const updatedReport = db.prepare(`
        SELECT * FROM ai_daily_reports WHERE id = ?
      `).get(existingReport.id);
      
      saveDatabase();
      
      // 记录AI操作日志
      logAIAction(db, companyId, userId, 'generate_report', 'daily_report', existingReport.id, {
        reportDate, type, regenerated: true
      });
      
      return res.json({
        success: true,
        data: updatedReport,
        message: '报告已更新'
      });
    }
    
    // 创建新报告
    const result = db.prepare(`
      INSERT INTO ai_daily_reports (
        company_id, report_date, report_type, title, summary,
        highlights, alerts, opportunities, recommendations, metrics,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, reportDate, type, reportData.title, reportData.summary,
      JSON.stringify(reportData.highlightsArr || []),
      JSON.stringify(reportData.alertsArr || []),
      JSON.stringify(reportData.opportunitiesArr || []),
      JSON.stringify(reportData.recommendationsArr || []),
      JSON.stringify(reportData.metricsObj || {}),
      userId
    );
    
    const newReport = db.prepare(`
      SELECT * FROM ai_daily_reports WHERE id = ?
    `).get(result.lastInsertRowid);
    
    saveDatabase();
    
    // 记录AI操作日志
    logAIAction(db, companyId, userId, 'generate_report', 'daily_report', result.lastInsertRowid, {
      reportDate, type
    });
    
    res.json({
      success: true,
      data: newReport,
      message: '报告生成成功'
    });
  })
);

// ============================================
// 路由：POST /api/ai/action - 执行AI操作
// ============================================
router.post('/action',
  asyncHandler(async (req, res) => {
    // 确保表已初始化
    ensureTablesInitialized();
    
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { actionType, actionName, targetType, targetId, params } = req.body;
    
    if (!actionType || !actionName) {
      throw ErrorTypes.ValidationError('操作类型和操作名称不能为空');
    }
    
    // 创建操作记录
    const actionResult = db.prepare(`
      INSERT INTO ai_actions (
        company_id, user_id, action_type, action_name,
        target_entity_type, target_entity_id, action_params, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      companyId, userId, actionType, actionName,
      targetType, targetId, JSON.stringify(params || {})
    );
    
    const actionId = actionResult.lastInsertRowid;
    
    try {
      // 更新状态为执行中
      db.prepare(`
        UPDATE ai_actions SET status = 'executing', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(actionId);
      
      saveDatabase();
      
      // 执行具体操作
      const startTime = Date.now();
      const result = await executeAIAction(db, companyId, userId, {
        actionType,
        actionName,
        targetType,
        targetId,
        params,
        actionId
      });
      const duration = Date.now() - startTime;
      
      // 更新操作状态为成功
      db.prepare(`
        UPDATE ai_actions SET
          status = 'success',
          action_result = ?,
          executed_at = CURRENT_TIMESTAMP,
          duration_ms = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(JSON.stringify(result), duration, actionId);
      
      saveDatabase();
      
      // 记录到AI日志
      logAIAction(db, companyId, userId, actionType, targetType, targetId, {
        actionName,
        params,
        result,
        duration
      });
      
      res.json({
        success: true,
        data: {
          actionId,
          status: 'success',
          result,
          duration
        },
        message: '操作执行成功'
      });
      
    } catch (err) {
      // 更新操作状态为失败
      db.prepare(`
        UPDATE ai_actions SET
          status = 'failed',
          error_message = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(err.message, actionId);
      
      saveDatabase();
      
      throw err;
    }
  })
);

// ============================================
// 辅助函数：生成智能推荐
// ============================================
async function generateRecommendations(db, companyId, userId) {
  const recommendations = [];
  
  // 获取财务数据
  const thisMonth = dayjs().format('YYYY-MM');
  const finance = db.prepare(`
    SELECT 
      SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) as expense,
      COUNT(*) as count
    FROM transactions
    WHERE company_id = ? AND strftime('%Y-%m', transaction_date) = ? AND status = 'confirmed'
  `).get(companyId, thisMonth);
  
  const income = finance?.income || 0;
  const expense = finance?.expense || 0;
  const netProfit = income - expense;
  
  // 1. 利润分析推荐
  if (netProfit < 0) {
    recommendations.push({
      type: 'financial_alert',
      title: '本月利润预警',
      content: `本月净利润为 ¥${formatMoney(netProfit)}，支出超过收入。建议审查支出明细，优化成本结构。`,
      priority: 'urgent',
      category: '财务健康',
      confidenceScore: 0.95,
      actionSuggestion: '查看支出明细，识别可削减的成本项目',
      relatedEntityType: 'transactions',
      relatedEntityId: null
    });
  }
  
  // 2. 应收账款推荐
  const overdueReceivables = db.prepare(`
    SELECT COUNT(*) as count, SUM(remaining_amount) as total
    FROM receivables_payables
    WHERE company_id = ? AND type = 'receivable' AND status = 'overdue'
  `).get(companyId);
  
  if (overdueReceivables && overdueReceivables.count > 0) {
    recommendations.push({
      type: 'receivable_alert',
      title: '应收账款逾期提醒',
      content: `当前有 ${overdueReceivables.count} 笔应收账款逾期，总金额 ¥${formatMoney(overdueReceivables.total)}。建议及时跟进催收。`,
      priority: 'high',
      category: '应收管理',
      confidenceScore: 0.90,
      actionSuggestion: '查看逾期应收列表，制定催收计划',
      relatedEntityType: 'receivables_payables',
      relatedEntityId: null
    });
  }
  
  // 3. 合同到期推荐
  const expiringContracts = db.prepare(`
    SELECT COUNT(*) as count
    FROM contracts
    WHERE company_id = ? AND status = 'active'
    AND end_date BETWEEN date('now') AND date('now', '+30 days')
  `).get(companyId);
  
  if (expiringContracts && expiringContracts.count > 0) {
    recommendations.push({
      type: 'contract_alert',
      title: '合同即将到期提醒',
      content: `有 ${expiringContracts.count} 份合同将在30天内到期。请及时安排续签或终止。`,
      priority: 'normal',
      category: '合同管理',
      confidenceScore: 0.85,
      actionSuggestion: '查看即将到期合同列表',
      relatedEntityType: 'contracts',
      relatedEntityId: null
    });
  }
  
  // 4. 待审批推荐
  const pendingApprovals = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM reimbursements WHERE company_id = ? AND status = 'pending') as reimbursements,
      (SELECT COUNT(*) FROM transactions WHERE company_id = ? AND status = 'pending') as transactions
  `).get(companyId, companyId);
  
  if (pendingApprovals && (pendingApprovals.reimbursements > 0 || pendingApprovals.transactions > 0)) {
    const total = (pendingApprovals.reimbursements || 0) + (pendingApprovals.transactions || 0);
    recommendations.push({
      type: 'approval_reminder',
      title: '待审批事项提醒',
      content: `当前有 ${total} 项待审批事项（报销 ${pendingApprovals.reimbursements} 条，记账 ${pendingApprovals.transactions} 条）。`,
      priority: 'normal',
      category: '流程管理',
      confidenceScore: 0.95,
      actionSuggestion: '前往审批中心处理待办事项',
      relatedEntityType: 'approvals',
      relatedEntityId: null
    });
  }
  
  // 5. 成本优化推荐
  const expenseByCategory = db.prepare(`
    SELECT category, SUM(amount) as total
    FROM transactions
    WHERE company_id = ? AND transaction_type = 'expense' AND status = 'confirmed'
    AND strftime('%Y-%m', transaction_date) = ?
    GROUP BY category
    ORDER BY total DESC
    LIMIT 3
  `).all(companyId, thisMonth);
  
  if (expenseByCategory && expenseByCategory.length > 0) {
    const topCategory = expenseByCategory[0];
    const percentage = expense > 0 ? ((topCategory.total / expense) * 100).toFixed(1) : 0;
    
    recommendations.push({
      type: 'cost_insight',
      title: '支出分析洞察',
      content: `本月"${topCategory.category}"支出最高，占比 ${percentage}%，金额 ¥${formatMoney(topCategory.total)}。`,
      priority: 'low',
      category: '成本分析',
      confidenceScore: 0.80,
      actionSuggestion: '查看该类别详细支出，寻找优化空间',
      relatedEntityType: 'transactions',
      relatedEntityId: null
    });
  }
  
  // 6. 采购建议（基于采购订单）
  const pendingPOs = db.prepare(`
    SELECT COUNT(*) as count, SUM(total_amount) as total
    FROM purchase_orders
    WHERE company_id = ? AND status IN ('pending', 'confirmed')
  `).get(companyId);
  
  if (pendingPOs && pendingPOs.count > 0) {
    recommendations.push({
      type: 'purchase_tracking',
      title: '采购订单跟进',
      content: `当前有 ${pendingPOs.count} 笔采购订单待处理，总金额 ¥${formatMoney(pendingPOs.total)}。`,
      priority: 'normal',
      category: '采购管理',
      confidenceScore: 0.85,
      actionSuggestion: '查看采购订单状态，跟进到货进度',
      relatedEntityType: 'purchase_orders',
      relatedEntityId: null
    });
  }
  
  return recommendations;
}

// ============================================
// 辅助函数：生成每日报告
// ============================================
async function generateDailyReport(db, companyId, reportDate, reportType) {
  const date = dayjs(reportDate);
  const startOfMonth = date.startOf('month').format('YYYY-MM-DD');
  const endOfMonth = date.endOf('month').format('YYYY-MM-DD');
  
  // 获取财务概览
  const finance = db.prepare(`
    SELECT 
      SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) as expense,
      COUNT(*) as count
    FROM transactions
    WHERE company_id = ? AND transaction_date BETWEEN ? AND ? AND status = 'confirmed'
  `).get(companyId, startOfMonth, endOfMonth);
  
  const income = finance?.income || 0;
  const expense = finance?.expense || 0;
  const netProfit = income - expense;
  
  // 构建报告内容
  const title = `${date.format('YYYY年MM月DD日')} ${reportType === 'daily' ? '每日' : reportType === 'weekly' ? '每周' : '每月'}财务报告`;
  
  const summary = `本${reportType === 'daily' ? '日' : reportType === 'weekly' ? '周' : '月'}财务状况：收入 ¥${formatMoney(income)}，支出 ¥${formatMoney(expense)}，净利润 ¥${formatMoney(netProfit)}。`;
  
  // 要点
  const highlightsArr = [];
  if (income > 0) highlightsArr.push({ icon: '💰', text: `总收入 ¥${formatMoney(income)}` });
  if (expense > 0) highlightsArr.push({ icon: '💸', text: `总支出 ¥${formatMoney(expense)}` });
  highlightsArr.push({ icon: netProfit >= 0 ? '📈' : '📉', text: `净利润 ¥${formatMoney(netProfit)}` });
  
  // 预警
  const alertsArr = [];
  
  const overdueReceivables = db.prepare(`
    SELECT COUNT(*) as count, SUM(remaining_amount) as total
    FROM receivables_payables
    WHERE company_id = ? AND type = 'receivable' AND status = 'overdue'
  `).get(companyId);
  
  if (overdueReceivables && overdueReceivables.count > 0) {
    alertsArr.push({
      level: 'warning',
      title: '应收账款逾期',
      content: `${overdueReceivables.count} 笔应收账款逾期，金额 ¥${formatMoney(overdueReceivables.total)}`
    });
  }
  
  if (netProfit < 0) {
    alertsArr.push({
      level: 'danger',
      title: '利润预警',
      content: '本月净利润为负，建议关注成本控制'
    });
  }
  
  // 机会
  const opportunitiesArr = [];
  
  const pendingReceivables = db.prepare(`
    SELECT COUNT(*) as count, SUM(remaining_amount) as total
    FROM receivables_payables
    WHERE company_id = ? AND type = 'receivable' AND status IN ('pending', 'partial')
  `).get(companyId);
  
  if (pendingReceivables && pendingReceivables.total > 0) {
    opportunitiesArr.push({
      title: '应收账款回笼',
      content: `待收回 ¥${formatMoney(pendingReceivables.total)}，加速回款可改善现金流`
    });
  }
  
  // 建议
  const recommendationsArr = [
    { priority: 'high', text: '定期审查财务报表，及时发现问题' },
    { priority: 'normal', text: '优化支出结构，控制非必要开支' },
    { priority: 'normal', text: '加强应收账款管理，缩短回款周期' }
  ];
  
  // 指标
  const metricsObj = {
    income,
    expense,
    netProfit,
    profitMargin: income > 0 ? ((netProfit / income) * 100).toFixed(2) + '%' : '0%',
    transactionCount: finance?.count || 0,
    overdueReceivables: overdueReceivables?.count || 0
  };
  
  return {
    title,
    summary,
    highlights: JSON.stringify(highlightsArr),
    alerts: JSON.stringify(alertsArr),
    opportunities: JSON.stringify(opportunitiesArr),
    recommendations: JSON.stringify(recommendationsArr),
    metrics: JSON.stringify(metricsObj),
    highlightsArr,
    alertsArr,
    opportunitiesArr,
    recommendationsArr,
    metricsObj
  };
}

// ============================================
// 辅助函数：执行AI操作
// ============================================
async function executeAIAction(db, companyId, userId, action) {
  const { actionType, actionName, targetType, targetId, params } = action;
  
  switch (actionType) {
    case 'approve':
      return await executeApproveAction(db, companyId, userId, actionName, targetId, params);
    
    case 'create':
      return await executeCreateAction(db, companyId, userId, actionName, params);
    
    case 'update':
      return await executeUpdateAction(db, companyId, userId, actionName, targetId, params);
    
    case 'analyze':
      return await executeAnalyzeAction(db, companyId, userId, actionName, params);
    
    case 'notify':
      return await executeNotifyAction(db, companyId, userId, actionName, params);
    
    case 'auto_entry':
      return await executeAutoEntryAction(db, companyId, userId, params);
    
    default:
      throw new Error(`未知的操作类型: ${actionType}`);
  }
}

// 执行审批操作
async function executeApproveAction(db, companyId, userId, actionName, targetId, params) {
  if (actionName === 'approve_reimbursement') {
    db.prepare(`
      UPDATE reimbursements SET
        status = 'approved',
        approved_by = ?,
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ?
    `).run(userId, targetId, companyId);
    
    return { message: '报销已审批通过', targetId };
  }
  
  if (actionName === 'approve_transaction') {
    db.prepare(`
      UPDATE transactions SET
        status = 'confirmed',
        confirmed_by = ?,
        confirmed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ?
    `).run(userId, targetId, companyId);
    
    return { message: '记账已确认', targetId };
  }
  
  throw new Error(`未知的审批操作: ${actionName}`);
}

// 执行创建操作
async function executeCreateAction(db, companyId, userId, actionName, params) {
  if (actionName === 'create_transaction') {
    const { transactionDate, transactionType, category, amount, description } = params;
    const txnNo = generateTransactionNo(db, companyId);
    
    const result = db.prepare(`
      INSERT INTO transactions (
        company_id, transaction_no, transaction_date, transaction_type,
        category, amount, description, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)
    `).run(companyId, txnNo, transactionDate, transactionType, category, amount, description, userId);
    
    return { message: '记账创建成功', transactionId: result.lastInsertRowid, transactionNo: txnNo };
  }
  
  throw new Error(`未知的创建操作: ${actionName}`);
}

// 执行更新操作
async function executeUpdateAction(db, companyId, userId, actionName, targetId, params) {
  if (actionName === 'update_contract_status') {
    const { status } = params;
    db.prepare(`
      UPDATE contracts SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ?
    `).run(status, targetId, companyId);
    
    return { message: '合同状态已更新', contractId: targetId, newStatus: status };
  }
  
  throw new Error(`未知的更新操作: ${actionName}`);
}

// 执行分析操作
async function executeAnalyzeAction(db, companyId, userId, actionName, params) {
  if (actionName === 'analyze_expense') {
    const { period } = params || {};
    const thisMonth = dayjs().format('YYYY-MM');
    
    const expenses = db.prepare(`
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM transactions
      WHERE company_id = ? AND transaction_type = 'expense' AND status = 'confirmed'
      AND strftime('%Y-%m', transaction_date) = ?
      GROUP BY category
      ORDER BY total DESC
    `).all(companyId, period || thisMonth);
    
    return {
      message: '支出分析完成',
      period: period || thisMonth,
      categories: expenses
    };
  }
  
  throw new Error(`未知的分析操作: ${actionName}`);
}

// 执行通知操作
async function executeNotifyAction(db, companyId, userId, actionName, params) {
  if (actionName === 'send_reminder') {
    const { targetUserId, title, content } = params;
    
    db.prepare(`
      INSERT INTO notifications (company_id, user_id, title, content, type, priority)
      VALUES (?, ?, ?, ?, 'reminder', 'normal')
    `).run(companyId, targetUserId, title, content);
    
    return { message: '提醒已发送', targetUserId };
  }
  
  throw new Error(`未知的通知操作: ${actionName}`);
}

// 执行自动入账操作
async function executeAutoEntryAction(db, companyId, userId, params) {
  const { invoiceData, autoApprove = false } = params;
  
  if (!invoiceData || !invoiceData.amount) {
    throw new Error('发票数据不完整');
  }
  
  const txnNo = generateTransactionNo(db, companyId);
  const status = autoApprove ? 'confirmed' : 'pending';
  
  const result = db.prepare(`
    INSERT INTO transactions (
      company_id, transaction_no, transaction_date, transaction_type,
      category, amount, description, status, created_by
    ) VALUES (?, ?, ?, 'expense', ?, ?, 'AI自动入账', ?, ?)
  `).run(
    companyId, txnNo, invoiceData.date || dayjs().format('YYYY-MM-DD'),
    invoiceData.category || '办公费用', invoiceData.amount, status, userId
  );
  
  return {
    message: '自动入账完成',
    transactionId: result.lastInsertRowid,
    transactionNo: txnNo,
    status
  };
}

// ============================================
// 辅助函数：生成交易号
// ============================================
function generateTransactionNo(db, companyId) {
  const today = dayjs().format('YYYYMMDD');
  const prefix = `TXN${today}`;
  
  const result = db.prepare(`
    SELECT MAX(transaction_no) as max_no 
    FROM transactions 
    WHERE company_id = ? AND transaction_no LIKE ?
  `).get(companyId, `${prefix}%`);
  
  let seq = 1;
  if (result && result.max_no) {
    const lastSeq = parseInt(result.max_no.slice(-4));
    seq = lastSeq + 1;
  }
  
  return `${prefix}${seq.toString().padStart(4, '0')}`;
}

// ============================================
// 辅助函数：记录AI操作日志
// ============================================
function logAIAction(db, companyId, userId, actionType, module, entityId, data) {
  db.prepare(`
    INSERT INTO ai_logs (
      company_id, user_id, action_type, module, output_data, status
    ) VALUES (?, ?, ?, ?, ?, 'success')
  `).run(companyId, userId, actionType, module || 'intelligence', JSON.stringify(data));
  
  saveDatabase();
}

// ============================================
// 辅助函数：格式化金额
// ============================================
function formatMoney(n) {
  if (!n) return '0';
  if (Math.abs(n) >= 10000) return (n / 10000).toFixed(2) + '万';
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = router;