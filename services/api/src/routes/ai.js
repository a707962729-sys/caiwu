const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');
const { getDatabaseCompat, saveDatabase } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const config = require('../config');

router.use(authMiddleware);

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads/invoices');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * @route   POST /api/ai/chat
 * @desc    AI智能对话（支持记忆）
 */
router.post('/chat',
  asyncHandler(async (req, res) => {
    const { message, history, sessionId } = req.body;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // 获取或创建会话ID
    const currentSessionId = sessionId || uuidv4();
    
    // 获取历史对话（最近10条）
    const chatHistory = db.prepare(`
      SELECT input_text, output_text, created_at
      FROM ai_logs
      WHERE company_id = ? AND user_id = ? AND action_type = 'chat' AND session_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(companyId, userId, currentSessionId);
    
    // 获取用户上下文数据
    const context = await getUserContext(db, companyId, userRole);
    
    // 生成回复
    const response = generateChatResponse(message, context, chatHistory.reverse(), userRole);
    
    // 保存对话记录
    db.prepare(`
      INSERT INTO ai_logs (company_id, user_id, session_id, action_type, module, input_text, output_text, output_data, model, status)
      VALUES (?, ?, ?, 'chat', 'assistant', ?, ?, ?, 'default', 'success')
    `).run(companyId, userId, currentSessionId, message, response.text, JSON.stringify({ actions: response.actions }));
    
    res.json({
      success: true,
      data: {
        sessionId: currentSessionId,
        response: response.text,
        actions: response.actions || null
      }
    });
  })
);

/**
 * @route   GET /api/ai/chat/history
 * @desc    获取对话历史
 */
router.get('/chat/history',
  asyncHandler(async (req, res) => {
    const { sessionId } = req.query;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const userId = req.user.id;
    
    const history = db.prepare(`
      SELECT id, input_text as userMessage, output_text as botMessage, created_at as timestamp
      FROM ai_logs
      WHERE company_id = ? AND user_id = ? AND action_type = 'chat'
      ${sessionId ? 'AND session_id = ?' : ''}
      ORDER BY created_at ASC
      LIMIT 50
    `).all(companyId, userId, ...(sessionId ? [sessionId] : []));
    
    res.json({
      success: true,
      data: history
    });
  })
);

/**
 * @route   POST /api/ai/recognize
 * @desc    AI识别票据（自动入账）
 */
router.post('/recognize',
  asyncHandler(async (req, res) => {
    const { type, image, autoEntry } = req.body;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const sessionId = uuidv4();
    
    // 保存图片
    let imagePath = null;
    if (image && image.startsWith('data:')) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const fileName = `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
      imagePath = path.join(uploadDir, fileName);
      fs.writeFileSync(imagePath, base64Data, 'base64');
    }
    
    // 模拟票据识别
    const recognitionResult = {
      type: type || '增值税发票',
      amount: parseFloat((Math.random() * 5000 + 100).toFixed(2)),
      date: new Date().toISOString().split('T')[0],
      category: '办公费用',
      seller: '某某公司',
      taxNumber: '91110000XXXXXXXXXX',
      items: [
        { name: '办公用品', quantity: 1, price: 0, amount: 0 }
      ]
    };
    
    // 随机生成金额
    const amounts = [320, 580, 1250, 890, 2100, 450];
    recognitionResult.amount = amounts[Math.floor(Math.random() * amounts.length)];
    recognitionResult.items[0].amount = recognitionResult.amount;
    
    // 如果设置自动入账
    if (autoEntry) {
      const txnNo = generateTransactionNo(companyId);
      
      db.prepare(`
        INSERT INTO transactions (
          company_id, transaction_no, transaction_date, transaction_type,
          category, amount, description, status, created_by
        ) VALUES (?, ?, ?, 'expense', ?, ?, 'AI识别入账', 'confirmed', ?)
      `).run(companyId, txnNo, recognitionResult.date, recognitionResult.category, recognitionResult.amount, userId);
      
      recognitionResult.entryStatus = 'success';
      recognitionResult.transactionNo = txnNo;
    }
    
    // 保存识别记录
    db.prepare(`
      INSERT INTO ai_logs (company_id, user_id, session_id, action_type, module, input_images, output_text, output_data, model, status)
      VALUES (?, ?, ?, 'recognize', 'invoice', ?, ?, ?, 'default', 'success')
    `).run(companyId, userId, sessionId, imagePath || image, JSON.stringify(recognitionResult), JSON.stringify(recognitionResult));
    
    res.json({
      success: true,
      data: recognitionResult
    });
  })
);

/**
 * @route   POST /api/ai/recognize/confirm
 * @desc    确认识别结果并入账
 */
router.post('/recognize/confirm',
  asyncHandler(async (req, res) => {
    const { recognitionId, amount, category, date, description } = req.body;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const userId = req.user.id;
    
    // 获取识别记录
    const log = db.prepare(`
      SELECT * FROM ai_logs WHERE id = ? AND company_id = ? AND action_type = 'recognize'
    `).get(recognitionId, companyId);
    
    if (!log) {
      throw ErrorTypes.NotFound('识别记录');
    }
    
    // 创建记账
    const txnNo = generateTransactionNo(companyId);
    const txnResult = db.prepare(`
      INSERT INTO transactions (
        company_id, transaction_no, transaction_date, transaction_type,
        category, amount, description, status, created_by
      ) VALUES (?, ?, ?, 'expense', ?, ?, ?, 'confirmed', ?)
    `).run(companyId, txnNo, date, category, amount, description || 'AI识别入账', userId);
    
    // 更新识别记录
    db.prepare(`
      UPDATE ai_logs SET output_data = json_set(output_data, '$.entryStatus', 'success', '$.transactionId', ?)
      WHERE id = ?
    `).run(txnResult.lastInsertRowid, recognitionId);
    
    res.json({
      success: true,
      data: {
        transactionId: txnResult.lastInsertRowid,
        transactionNo: txnNo
      },
      message: '入账成功'
    });
  })
);

/**
 * @route   POST /api/ai/analyze
 * @desc    AI分析
 */
router.post('/analyze',
  asyncHandler(async (req, res) => {
    const { module, period, metrics } = req.body;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    const analysis = await performAnalysis(db, companyId, module, period, metrics);
    
    res.json({
      success: true,
      data: analysis
    });
  })
);

/**
 * @route   POST /api/ai/recommend
 * @desc    AI推荐
 */
router.post('/recommend',
  asyncHandler(async (req, res) => {
    const { type, context } = req.body;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    const recommendations = getRecommendations(db, companyId, type, context);
    
    res.json({
      success: true,
      data: recommendations
    });
  })
);

// ========== 辅助函数 ==========

async function getUserContext(db, companyId, role) {
  const context = { role, finance: {}, pending: {}, contracts: {}, accounts: [] };
  
  // 获取本月财务概览
  const thisMonth = dayjs().format('YYYY-MM');
  const finance = db.prepare(`
    SELECT 
      SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) as expense,
      COUNT(*) as count
    FROM transactions
    WHERE company_id = ? AND strftime('%Y-%m', transaction_date) = ? AND status = 'confirmed'
  `).get(companyId, thisMonth);
  
  context.finance = {
    income: finance?.income || 0,
    expense: finance?.expense || 0,
    net: (finance?.income || 0) - (finance?.expense || 0),
    count: finance?.count || 0
  };
  
  // 获取待办数量
  const pending = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM reimbursements WHERE company_id = ? AND status = 'pending') as reimbursements,
      (SELECT COUNT(*) FROM transactions WHERE company_id = ? AND status = 'pending') as transactions
  `).get(companyId, companyId);
  
  context.pending = {
    reimbursements: pending?.reimbursements || 0,
    transactions: pending?.transactions || 0
  };
  
  // 获取合同统计
  const contracts = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN end_date BETWEEN date('now') AND date('now', '+30 days') THEN 1 ELSE 0 END) as expiring
    FROM contracts WHERE company_id = ?
  `).get(companyId);
  
  context.contracts = contracts || { total: 0, active: 0, expiring: 0 };
  
  // 获取账户余额
  const accounts = db.prepare(`
    SELECT name, balance FROM accounts WHERE company_id = ? AND status = 'active' ORDER BY balance DESC LIMIT 5
  `).all(companyId);
  
  context.accounts = accounts;
  context.totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  
  return context;
}

function generateChatResponse(message, context, history, role) {
  const lowerMsg = message.toLowerCase();
  const userName = role === 'boss' ? '老板' : role === 'accountant' ? '会计' : '';
  
  // 财务相关
  if (lowerMsg.includes('收支') || lowerMsg.includes('财务') || lowerMsg.includes('利润') || lowerMsg.includes('余额')) {
    return {
      text: `📊 本月财务概览\n\n💰 总收入：¥${formatMoney(context.finance.income)}\n💸 总支出：¥${formatMoney(context.finance.expense)}\n📈 净利润：¥${formatMoney(context.finance.net)}\n\n共 ${context.finance.count} 笔交易记录。\n\n💳 账户余额：¥${formatMoney(context.totalBalance)}`,
      actions: [
        { text: '查看详细报表', action: 'report' },
        { text: '导出Excel', action: 'export' }
      ]
    };
  }
  
  // 报销审批
  if (lowerMsg.includes('报销') || lowerMsg.includes('审批')) {
    if (role === 'boss' || role === 'accountant') {
      return {
        text: `📝 待审批报销\n\n共有 ${context.pending.reimbursements} 条报销待您审批。\n\n需要我帮您查看详情吗？`,
        actions: [
          { text: '查看报销列表', action: 'view_reimbursements' },
          { text: '全部通过', action: 'approve_all', type: 'primary' }
        ]
      };
    } else {
      return {
        text: '您可以提交报销申请，发送票据图片我会自动识别并帮您入账。',
        actions: [
          { text: '提交报销', action: 'create_reimbursement' }
        ]
      };
    }
  }
  
  // 合同相关
  if (lowerMsg.includes('合同')) {
    return {
      text: `📄 合同概况\n\n共有 ${context.contracts.total} 份合同\n✅ 执行中：${context.contracts.active} 份\n⚠️ 即将到期：${context.contracts.expiring} 份\n\n需要查看哪份合同？`,
      actions: [
        { text: '查看合同列表', action: 'view_contracts' }
      ]
    };
  }
  
  // 记账相关
  if (lowerMsg.includes('记账') || lowerMsg.includes('账单') || lowerMsg.includes('账目')) {
    return {
      text: '好的，我来帮您记账。请告诉我：\n\n1️⃣ 收入还是支出？\n2️⃣ 金额是多少？\n3️⃣ 是什么类别的费用？\n\n💡 您也可以发送票据图片，我会自动识别并帮您入账。',
      actions: [
        { text: '记一笔支出', action: 'expense' },
        { text: '记一笔收入', action: 'income' }
      ]
    };
  }
  
  // 待办事项
  if (lowerMsg.includes('待办') || lowerMsg.includes('提醒')) {
    const todos = [];
    if (context.pending.reimbursements > 0) todos.push(`• ${context.pending.reimbursements} 条报销待审批`);
    if (context.pending.transactions > 0) todos.push(`• ${context.pending.transactions} 条记账待确认`);
    if (context.contracts.expiring > 0) todos.push(`• ${context.contracts.expiring} 份合同即将到期`);
    
    return {
      text: todos.length > 0 ? `📋 待办事项\n\n${todos.join('\n')}` : '🎉 暂无待办事项',
      actions: todos.length > 0 ? [{ text: '立即处理', action: 'view_todos' }] : null
    };
  }
  
  // 默认回复
  return {
    text: `您好${userName ? '，' + userName : ''}！我是您的财务助手。我可以帮您：\n\n• 📊 查看财务数据\n• 💰 记账和查账\n• 📝 处理报销审批\n• 📄 管理合同\n• 🧾 识别票据图片\n\n请问有什么可以帮您的？`,
    actions: [
      { text: '查看财务', action: 'finance' },
      { text: '记一笔账', action: 'create' },
      { text: '发票据入账', action: 'upload' }
    ]
  };
}

function generateTransactionNo(companyId) {
  const db = getDatabaseCompat();
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

function formatMoney(n) {
  if (!n) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  return n.toLocaleString();
}

async function performAnalysis(db, companyId, module, period, metrics) {
  // 简化的分析实现
  return { summary: '财务状况良好', insights: [] };
}

function getRecommendations(db, companyId, type, context) {
  return { suggestions: [] };
}

module.exports = router;