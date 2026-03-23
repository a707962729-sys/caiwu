/**
 * AI 对话路由
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const AIProviderFactory = require('../providers');

/**
 * 验证 JWT 中间件
 */
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌', code: 'NO_TOKEN' });
  }
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '令牌无效或已过期', code: 'INVALID_TOKEN' });
  }
}

/**
 * POST /api/ai/chat - AI 对话
 */
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { message, context, conversationId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '消息内容不能为空' });
    }
    
    // 获取 AI 提供商
    const provider = AIProviderFactory.getProvider(config.ai.provider);
    
    // 构建系统提示
    const systemPrompt = `你是财务管家的 AI 助手，专门帮助企业用户处理财务相关问题。
你可以帮助用户：
1. 解答财务会计问题
2. 分析财务数据
3. 提供财务管理建议
4. 解释财务术语和法规

请用专业但易懂的语言回答用户问题。`;

    // 调用 AI
    const response = await provider.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        ...(context || []),
        { role: 'user', content: message }
      ]
    });
    
    // 记录日志
    logger.info('AI Chat', {
      userId: req.user.id,
      message: message.substring(0, 100),
      provider: config.ai.provider
    });
    
    res.json({
      success: true,
      data: {
        response: response.content,
        conversationId: conversationId || Date.now().toString(),
        provider: config.ai.provider
      }
    });
    
  } catch (err) {
    logger.error('AI Chat Error:', err);
    res.status(500).json({ error: err.message || 'AI 服务暂时不可用' });
  }
});

/**
 * POST /api/ai/smart-entry - 智能录入
 */
router.post('/smart-entry', authMiddleware, async (req, res) => {
  try {
    const { type, description, amount, date, category } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: '描述不能为空' });
    }
    
    const provider = AIProviderFactory.getProvider(config.ai.provider);
    
    const prompt = `请分析以下财务信息，返回结构化的记账数据：

描述：${description}
${amount ? `金额：${amount}` : ''}
${date ? `日期：${date}` : ''}
${category ? `分类：${category}` : ''}

请返回 JSON 格式：
{
  "type": "income/expense",
  "category": "分类",
  "amount": 数字,
  "date": "YYYY-MM-DD",
  "description": "整理后的描述",
  "notes": "备注"
}`;

    const response = await provider.chat({
      messages: [{ role: 'user', content: prompt }]
    });
    
    // 解析 JSON
    let result;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      result = null;
    }
    
    res.json({
      success: true,
      data: result || { error: '无法解析' }
    });
    
  } catch (err) {
    logger.error('Smart Entry Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ai/logs - AI 操作日志（管理员）
 */
router.get('/logs', authMiddleware, async (req, res) => {
  // 简化实现，实际应从数据库查询
  res.json({
    success: true,
    data: {
      logs: [],
      total: 0
    }
  });
});

module.exports = router;