/**
 * QQ Bot Agent 路由 - 集成 AgentLoop 到 QQ 机器人
 * 挂载在 /api/ai/agent 下，提供 QQ 用户维度的内置 AI 智能体服务
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { AgentLoop, sessionManager, toolRegistry } = require('../agent');

/**
 * 获取 AgentLoop 实例（带缓存）
 */
let agentInstance = null;
function getAgent() {
  if (!agentInstance) {
    agentInstance = new AgentLoop({
      provider: 'glm-flash',
      glmApiKey: process.env.GLM_API_KEY
    });
    logger.info('[QQBotAgent] AgentLoop initialized with glm-4-flash');
  }
  return agentInstance;
}

/**
 * POST /api/ai/agent/chat - QQ用户对话入口
 * Body: { sender_id, message, images?, pdf_text?, stream? }
 */
router.post('/chat', async (req, res) => {
  try {
    const { sender_id, message, images, pdf_text, stream } = req.body;

    if (!sender_id) {
      return res.status(400).json({ success: false, error: '缺少 sender_id' });
    }
    if (!message && !images && !pdf_text) {
      return res.status(400).json({ success: false, error: '消息内容或图片不能为空' });
    }

    const agent = getAgent();
    const result = await agent.process(sender_id, message || '', {
      images: images || undefined,
      pdf_text: pdf_text || undefined,
      stream: stream || false
    });

    logger.info(`[QQBotAgent] Response to ${sender_id}, tool=${result.toolUsed || 'none'}`);

    res.json({
      success: true,
      data: {
        response: result.response,
        sender_id,
        tool_used: result.toolUsed || null,
        conversation_id: sender_id
      }
    });

  } catch (err) {
    logger.error('[QQBotAgent] Error:', err);
    res.status(500).json({ success: false, error: err.message || '服务暂时不可用' });
  }
});

/**
 * POST /api/ai/agent/chat/stream - 流式对话（SSE）
 */
router.post('/chat/stream', async (req, res) => {
  try {
    const { sender_id, message, images } = req.body;

    if (!sender_id || !message) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const agent = getAgent();
    await agent.process(sender_id, message, {
      images: images || undefined,
      stream: true,
      onChunk: (text, isFinal, toolCalls) => {
        res.write(`data: ${JSON.stringify({ text, isFinal, toolCalls })}\n\n`);
        if (isFinal) res.end();
      }
    });

  } catch (err) {
    logger.error('[QQBotAgent] Stream error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ai/agent/session/:sender_id - 获取会话状态
 */
router.get('/session/:sender_id', (req, res) => {
  try {
    const { sender_id } = req.params;
    const session = sessionManager.getSession(sender_id);
    res.json({
      success: true,
      data: {
        sender_id: session.senderId,
        message_count: session.messages.length,
        total_messages: session.metadata.totalMessages,
        long_term_memory_count: session.longTermMemory.length,
        updated_at: new Date(session.updatedAt).toISOString()
      }
    });
  } catch (err) {
    logger.error('[QQBotAgent] Session error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/ai/agent/session/:sender_id - 清除会话历史
 */
router.delete('/session/:sender_id', (req, res) => {
  try {
    const { sender_id } = req.params;
    sessionManager.clearHistory(sender_id);
    res.json({ success: true, message: '会话历史已清除' });
  } catch (err) {
    logger.error('[QQBotAgent] Clear session error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ai/agent/tools - 获取可用工具列表
 */
router.get('/tools', (req, res) => {
  try {
    const tools = toolRegistry.getDefinitions();
    res.json({
      success: true,
      data: tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters
      }))
    });
  } catch (err) {
    logger.error('[QQBotAgent] Tools error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ai/agent/health - 健康检查
 */
router.get('/health', (req, res) => {
  const agent = getAgent();
  res.json({
    success: true,
    data: {
      status: 'ok',
      model: agent.modelName,
      llm_available: agent.llm.isAvailable(),
      tools_count: toolRegistry.getDefinitions().length
    }
  });
});

module.exports = router;
