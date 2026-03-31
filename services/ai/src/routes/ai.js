/**
 * AI 对话路由 - 完整版（支持工具调用）
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const AIProviderFactory = require('../providers');
const { executeTool, getToolDefinitions, shouldCallTool } = require('../tools');

// 意图标签映射
const intentLabels = {
  invoice_ocr: '📄 发票识别',
  contract_review: '📋 合同审核',
  employee_onboard: '👤 员工入职',
  salary_stats: '💰 工资统计',
  parse_invoice_text: '📄 PDF发票解析'
};

// 图片类型标签
const imageTypeLabels = {
  invoice: '📄 发票',
  labor_contract: '📋 劳动合同',
  contract: '📄 普通合同',
  unknown: '❓ 未知'
};

/**
 * 验证 JWT 中间件
 */
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    // QQ机器人使用简单token，暂时跳过验证
    if (req.headers['x-qqbot-token']) {
      return next();
    }
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

// QQ机器人token验证
function qqbotAuth(req, res, next) {
  if (req.headers['x-qqbot-token']) {
    req.user = { id: 'qqbot', role: 'bot' };
  }
  next();
}

/**
 * POST /api/ai/chat - AI 对话（支持工具调用）
 */
router.post('/chat', qqbotAuth, async (req, res) => {
  try {
    const { message, context, conversationId, images, pdf_text } = req.body;
    console.log('[AI Chat] received: images=' + (images ? images.length : 0) + ', pdf=' + (pdf_text ? pdf_text.length : 0));
    
    // 消息内容或图片不能同时为空
    if (!message && (!images || images.length === 0) && !pdf_text) {
      return res.status(400).json({ error: '消息内容或图片不能为空' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-qqbot-token'] || '';

    // 0.5 检测PDF文字（如果有）
    if (pdf_text) {
      logger.info('[AI Chat] Processing PDF text, length:', pdf_text.length);
      try {
        const toolResult = await executeTool('parse_invoice_text', { invoice_text: pdf_text }, token);
        const formattedResult = formatToolResult('parse_invoice_text', toolResult);
        return res.json({
          success: true,
          data: {
            response: `[📄 PDF发票解析]\n\n${formattedResult}`,
            conversationId: conversationId || '',
            provider: 'tools',
            toolUsed: 'parse_invoice_text',
            toolResult: toolResult.data,
            isStructured: true
          }
        });
      } catch (e) {
        logger.error('[AI Chat] parse_invoice_text error:', e);
      }
    }

    // 0. 检测图片类型（如果有图片）
    if (images && images.length > 0) {
      const firstImage = images[0];
      const imageLen = firstImage ? firstImage.length : 0;
      console.log('[AI Chat] Image received: len=' + imageLen + ', prefix=' + (firstImage ? firstImage.substring(0, 30) : 'null'));
      
      if (firstImage && firstImage.length > 100) {
        let imageIntent = { type: 'unknown', confidence: 0 };
        try {
          imageIntent = await detectImageIntent(firstImage, token);
        } catch (e) {
          imageIntent = { type: 'invoice', confidence: 0.5 }; // 失败时默认当发票处理
        }

        const hasValidImage = firstImage && firstImage.length > 100;
        if (imageIntent.type === 'invoice' || (imageIntent.type === 'unknown' && hasValidImage)) {
          const toolResult = await executeTool('invoice_ocr', { image: firstImage }, token);
          const formattedResult = formatToolResult('invoice_ocr', toolResult);
          return res.json({
            success: true,
            data: {
              response: `[📄 发票识别]\n\n${formattedResult}`,
              conversationId: conversationId || '',
              provider: 'tools',
              toolUsed: 'invoice_ocr',
              toolResult: toolResult.data,
              isStructured: true,
              imageType: imageIntent.type,
              imageConfidence: imageIntent.confidence
            }
          });
        }
      }
    }

    // 1. 检测是否需要调用工具
    const toolIntent = shouldCallTool(message, req.body);

    if (toolIntent && toolIntent.tool && !req.body.skip_tools) {
      logger.info(`[AI Chat] Tool detected: ${toolIntent.tool}`, { params: toolIntent.params });

      try {
        const toolResult = await executeTool(toolIntent.tool, toolIntent.params || {}, token);
        const formattedResult = formatToolResult(toolIntent.tool, toolResult);
        const intentLabel = intentLabels[toolIntent.tool] || toolIntent.tool;
        let responseText = `[${intentLabel}]\n\n${formattedResult}`;

        if (!toolResult.success) {
          responseText += `\n\n💡 提示: ${toolResult.message || '请检查输入参数或稍后重试'}`;
        }

        return res.json({
          success: true,
          data: {
            response: responseText,
            conversationId: conversationId || '',
            provider: 'tools',
            toolUsed: toolIntent.tool,
            toolResult: toolResult.data,
            isStructured: true
          }
        });
      } catch (e) {
        logger.error('[AI Chat] Tool execution error:', e);
      }
    }

    // =============================================
    // 2. Agent Loop - 带工具调用的推理循环
    // =============================================
    let responseText = '抱歉，服务暂时不可用，请稍后再试。';
    let toolUsed = null;
    let toolResult = null;
    let isStructured = false;

    try {
      const provider = AIProviderFactory.getProvider(config.ai.provider);
      const tools = getToolDefinitions();

      const systemPrompt = `你是一个专业的财务管家AI助手。当用户提到以下关键词时，请自动调用相应工具：
- "发票"、"识别"、"扫描" → 调用 invoice_ocr（图片发票识别）
- "PDF"、"电子发票" → 调用 parse_invoice_text（PDF文字解析）
- "入账"、"录入"、"登记" → 调用 invoice_entry_create（发票入账）
- "规则"、"检查" → 调用 check_rules（规则检查）
- "应收"、"应付"、"账款" → 调用 check_receivable（账款查询）

请用专业但易懂的语言回答。如果调用了工具，工具结果会作为参考信息返回给你。`;

      // 构建消息
      const messages = [
        ...(context || []),
        { role: 'user', content: message }
      ];

      // 如果 skip_tools 为 true，直接调用不带工具
      if (req.body.skip_tools) {
        logger.info('[AI Chat] skip_tools mode - using no-tool path');
        // 使用不包含工具调用的系统提示
        const noToolSystemPrompt = `你是一个专业的合同合规审查专家。直接分析用户提供的合同内容，输出审查结果。不要使用任何工具或函数调用，直接用文字回答。`;
        const noToolMessages = [
          { role: 'system', content: noToolSystemPrompt },
          { role: 'user', content: message }
        ];
        logger.info('[AI Chat] Sending to provider with no tools');
        const response = await provider.chat({
          messages: noToolMessages,
          tools: [],
          tool_choice: 'none'
        });
        logger.info('[AI Chat] Got response, toolCalls:', response.toolCalls?.length || 0);
        responseText = response.content || '分析完成';
      } else {
        // 第一次调用 - 带工具
        const MAX_LOOP = 3;
        for (let loop = 0; loop < MAX_LOOP; loop++) {
        const response = await provider.chat({
          messages: messages,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? 'auto' : undefined
        });

        // 检查是否有工具调用
        if (response.toolCalls && response.toolCalls.length > 0) {
          const toolCall = response.toolCalls[0];
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          logger.info(`[Agent Loop] Calling tool: ${toolName}`, { args: toolArgs });

          try {
            const result = await executeTool(toolName, toolArgs, token);
            toolResult = result;
            toolUsed = toolName;
            isStructured = true;

            // 将工具结果加入对话
            const toolResultText = formatToolResult(toolName, result);
            messages.push({ role: 'assistant', content: null, tool_calls: response.toolCalls });
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });

            // 第二次调用 - 把工具结果给 LLM 生成最终回复
            const finalResponse = await provider.chat({
              messages: messages,
              tools: undefined  // 不再带工具，让 LLM 直接回复
            });
            responseText = finalResponse.content || toolResultText;
            break;
          } catch (toolErr) {
            logger.error(`[Agent Loop] Tool ${toolName} error:`, toolErr);
            responseText = `调用工具「${toolName}」失败：${toolErr.message}`;
            break;
          }
        } else {
          // 无工具调用，直接返回 LLM 回复
          responseText = response.content || '好的，有什么可以帮你？';
          break;
        }
      }
      } // end skip_tools else
    } catch (e) {
      logger.error('[AI Chat] Agent Loop error:', e);
    }

    logger.info('[AI Chat] Response sent', { userId: req.user?.id || 'qqbot', toolUsed });

    res.json({
      success: true,
      data: {
        response: responseText,
        conversationId: conversationId || Date.now().toString(),
        provider: config.ai.provider,
        toolUsed: toolUsed,
        toolResult: toolResult,
        isStructured: isStructured
      }
    });

  } catch (err) {
    logger.error('[AI Chat] Error:', err);
    res.status(500).json({ error: err.message || 'AI 服务暂时不可用' });
  }
});

/**
 * 检测图片意图
 */
async function detectImageIntent(imageBase64, token) {
  try {
    const provider = AIProviderFactory.getProvider(config.ai.provider);
    const response = await provider.chat({
      model: config.ai.visionModel || 'glm-4v-flash',
      messages: [{
        role: 'user',
        content: [{
          type: 'image_url',
          image_url: {
            url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
            detail: 'low'
          }
        }, {
          type: 'text',
          text: '这是一个什么类型的图片？只需要回答：发票、劳动合同、普通合同、或其他'
        }]
      }]
    });

    const content = response.content.toLowerCase();
    if (content.includes('发票')) return { type: 'invoice', confidence: 0.9 };
    if (content.includes('劳动')) return { type: 'labor_contract', confidence: 0.9 };
    if (content.includes('合同')) return { type: 'contract', confidence: 0.9 };
    return { type: 'unknown', confidence: 0.5 };
  } catch (e) {
    logger.error('[AI Chat] detectImageIntent error:', e);
    return { type: 'unknown', confidence: 0 };
  }
}

/**
 * 格式化工具结果
 */
function formatToolResult(tool, result) {
  if (!result) return '无结果';

  if (tool === 'invoice_ocr' || tool === 'parse_invoice_text') {
    const data = (result.data && result.data.data) || result.data || result;
    if (!result.success && result.error) {
      return `❌ ${result.error}\n\n💡 ${result.message || ''}`;
    }
    // 兼容多种字段名格式
    const invoiceNo = data.invoiceNo || data.invoice_no || data.invoiceNumber || '未知';
    const date = data.date || '未知';
    const totalAmt = data.totalAmount || data.total || data.amount || 0;
    const taxAmt = data.taxAmount || data.tax || 0;
    // 优先用 OCR 识别的不含税金额，否则用总额-税额，并处理浮点精度
    let netAmt = data.amountWithoutTax || data.netAmount || 0;
    if (!netAmt && totalAmt && taxAmt) {
      netAmt = Math.round((totalAmt - taxAmt) * 100) / 100;
    } else if (netAmt) {
      netAmt = Math.round(netAmt * 100) / 100;
    }
    const fmtAmt = (v) => typeof v === 'number' ? v.toFixed(2) : v;
    const buyerName = (data.buyer && data.buyer.name) ? data.buyer.name : (data.buyer || data.purchaser || '未知');
    const sellerName = (data.seller && data.seller.name) ? data.seller.name : (data.seller || '未知');
    return `✅ 发票信息识别成功！
    
📋 基本信息
• 发票号码：${invoiceNo}
• 开票日期：${date}
• 金额（含税）：${fmtAmt(totalAmt)}元
• 税额：${fmtAmt(taxAmt)}元
• 金额（不含税）：${fmtAmt(netAmt)}元

🏢 交易双方
• 购买方：${buyerName}
• 销售方：${sellerName}

📊 状态：${data.status || '有效'}`;
  }

  if (tool === 'contract_review') {
    const data = (result.data && result.data.data) || result.data || result;
    if (!result.success && result.error) {
      return `❌ ${result.error}\n\n💡 ${result.message || ''}`;
    }
    return `📋 合同审核结果

⚠️ 风险等级：${data.risk_level || data.riskLevel || '未知'}

🔍 主要风险点：
${(data.risk_points || data.riskPoints || []).map((p, i) => `${i+1}. ${p}`).join('\n') || '未发现明显风险'}

💡 修改建议：
${data.suggestions || '暂无'}

📝 总结：${data.summary || '请仔细阅读合同条款'}`;
  }

  if (tool === 'employee_onboard') {
    const data = (result.data && result.data.data) || result.data || result;
    return `👤 员工入职办理

✅ 办理状态：${result.success ? '成功' : '进行中'}
${result.success ? `📋 入职信息已保存：${data.name || data.employee_name || ''}
• 部门：${data.department || ''}
• 岗位：${data.position || ''}
• 入职日期：${data.join_date || data.joinDate || ''}` : ''}`;
  }

  if (tool === 'salary_stats') {
    const data = (result.data && result.data.data) || result.data || result;
    return `💰 工资统计

📊 统计周期：${data.period || '本月'}

💵 工资明细：
• 基本工资：${data.base_salary || 0}
• 绩效工资：${data.bonus || 0}
• 社保扣款：${data.social_security || 0}
• 公积金扣款：${data.housing_fund || 0}
• 个人所得税：${data.income_tax || 0}
• 实发工资：${data.net_salary || data.total || 0}

👥 员工数量：${data.employee_count || data.employeeCount || 0}`;
  }

  return JSON.stringify(result, null, 2);
}

/**
 * GET /api/ai/tools - 获取可用工具列表
 */
router.get('/tools', (req, res) => {
  try {
    const tools = getToolDefinitions();
    res.json({
      success: true,
      data: tools
    });
  } catch (err) {
    logger.error('[AI Tools] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/intent - 检测用户意图
 */
router.post('/intent', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '消息内容不能为空' });
    }

    const toolIntent = shouldCallTool(message, req.body);

    if (toolIntent && toolIntent.tool && !req.body.skip_tools) {
      return res.json({
        success: true,
        data: {
          intent: toolIntent.tool,
          params: toolIntent.params || {},
          confidence: toolIntent.confidence || 0.8,
          reason: toolIntent.reason || 'keyword match'
        }
      });
    }

    // 无法识别意图，使用AI判断
    const provider = AIProviderFactory.getProvider(config.ai.provider);
    const response = await provider.chat({
      messages: [{
        role: 'user',
        content: `判断用户意图，返回JSON格式：{"intent": "工具名或general", "params": {...}}
可选工具：invoice_ocr, contract_review, employee_onboard, salary_stats
用户消息：${message}`
      }]
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.json({
          success: true,
          data: {
            intent: parsed.intent || 'general',
            params: parsed.params || {},
            confidence: 0.7,
            reason: 'AI analysis'
          }
        });
      }
    } catch (e) {
      // 解析失败
    }

    res.json({
      success: true,
      data: {
        intent: 'general',
        params: {},
        confidence: 0,
        reason: 'no match'
      }
    });

  } catch (err) {
    logger.error('[AI Intent] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ai/providers - 查看AI提供商状态（包括百度NLP）
 */
router.get('/providers', async (req, res) => {
  try {
    const AIProviderFactory = require('../providers');
    const config = require('../config');
    
    let baiduNlpStatus = { available: false, reason: '未配置 baidu-nlp 模块' };
    try {
      const baiduNlp = require('../utils/baidu-nlp');
      baiduNlpStatus = await baiduNlp.getStatus();
    } catch(e) {
      baiduNlpStatus = { available: false, reason: e.message };
    }

    const activeProvider = config.ai.provider;
    const enabledProviders = Object.entries(config.providers)
      .filter(([name, p]) => p.enabled)
      .map(([name]) => name);

    res.json({
      success: true,
      data: {
        active: activeProvider,
        enabled: enabledProviders,
        defaultModel: config.defaultModel,
        baiduNlp: baiduNlpStatus,
        ocr: config.ocr
      }
    });
  } catch (err) {
    logger.error('[AI Providers] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
