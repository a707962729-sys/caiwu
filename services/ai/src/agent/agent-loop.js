/**
 * Agent Loop - 核心智能体循环
 * 消息 → 推理 → 工具调用 → 响应
 * 支持 GLM-4-flash（免费）+ 流式响应
 */
const GLMFlashProvider = require('../providers/glm-flash');
const sessionManager = require('./session-manager');
const { getDefinitions, execute: executeTool, has: hasTool } = require('./tool-registry');
const logger = require('../utils/logger');

const MAX_LOOP = 3;        // 最多调用工具次数
const SYSTEM_PROMPT = `你是一个专业的财务管家AI助手，专门帮助用户处理发票识别、合同审核、工资统计、员工入职等财务相关问题。

你的核心能力：
1. 发票识别：当用户发送发票图片或PDF时，调用 invoice_ocr 或 parse_invoice_text 工具
2. 合同审核：当用户提供合同内容时，调用 contract_review 工具进行风险分析
3. 发票入账：当用户提供发票信息时，帮助录入系统
4. 工资统计：查询工资数据
5. 员工管理：办理入职、查询员工信息

回复原则：
- 专业但易懂，用中文回答
- 如果调用了工具，根据工具结果给出针对性的建议
- 如果不确定某项数据，提醒用户核实
- 涉及金额、数额等关键信息，务必精确
- 对于发票，总是先识别再建议下一步操作`;

class AgentLoop {
  constructor(config = {}) {
    this.config = config;
    // 优先用 GLM-4-flash，可配置 GLM_API_KEY
    // 兼容多种 GLM key 命名
    const glmKey = process.env.GLM_API_KEY
      || process.env.OPENAI_API_KEY  // .env 中用 OPENAI_API_KEY 存的也是 GLM key
      || config.glmApiKey || '';
    if (glmKey) {
      this.llm = new GLMFlashProvider({
        apiKey: glmKey,
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        model: 'glm-4-flash'
      });
      this.modelName = 'glm-4-flash';
    } else {
      // fallback 到配置中的 provider
      const AIProviderFactory = require('../providers');
      this.llm = AIProviderFactory.getProvider(config.provider || 'openai');
      this.modelName = config.provider || 'openai';
    }
    this.tools = getDefinitions();
  }

  /**
   * 处理用户消息
   * @param {string} senderId - QQ用户ID
   * @param {string} message - 用户消息
   * @param {object} opts - { images?, pdf_text?, stream?, onChunk? }
   * @returns {object} { response, toolUsed, session }
   */
  async process(senderId, message, opts = {}) {
    const { images, pdf_text, stream = false, onChunk = null } = opts;

    // 0. 图片处理 → 调用 invoice_ocr
    if (images && images.length > 0) {
      const result = await executeTool('invoice_ocr', { image: images[0] }, { senderId });
      const formatted = this._formatResult('invoice_ocr', result);
      sessionManager.addMessage(senderId, `[发票识别]\n${formatted}`, 'assistant');
      return {
        response: `📄 发票识别结果\n\n${formatted}`,
        toolUsed: 'invoice_ocr',
        session: sessionManager.getSession(senderId)
      };
    }

    // 0b. PDF文字处理 → 调用 parse_invoice_text
    if (pdf_text) {
      const result = await executeTool('parse_invoice_text', { invoice_text: pdf_text }, { senderId });
      const formatted = this._formatResult('invoice_ocr', result);
      sessionManager.addMessage(senderId, `[PDF发票解析]\n${formatted}`, 'assistant');
      return {
        response: `📄 PDF发票解析结果\n\n${formatted}`,
        toolUsed: 'parse_invoice_text',
        session: sessionManager.getSession(senderId)
      };
    }

    // 1. 意图检测（先用规则快速匹配，避免不必要的 LLM 调用）
    const intent = this._detectIntent(message);
    logger.info(`[AgentLoop] intent=${intent.tool}, senderId=${senderId}`);

    if (intent.tool && hasTool(intent.tool)) {
      // 命中工具，先执行工具，再给 LLM 生成自然语言回复
      try {
        const result = await executeTool(intent.tool, intent.params || {}, { senderId });
        const formatted = this._formatResult(intent.tool, result);
        const toolResultMsg = `[${intent.label || intent.tool}]\n\n${formatted}`;

        // 将工具调用加入历史
        const history = sessionManager.getHistory(senderId, 10);
        history.push({ role: 'user', content: message });

        let responseText = formatted;

        // 如果 LLM 可用，让它生成更友好的回复
        if (this.llm.isAvailable()) {
          try {
            const finalResp = await this.llm.chat({
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                ...history,
                { role: 'assistant', content: toolResultMsg },
                { role: 'user', content: '请根据以上工具结果，用一段话给用户一个友好的回复。' }
              ],
              maxTokens: 500
            });
            if (finalResp.content) responseText = finalResp.content;
          } catch (e) {
            logger.warn('[AgentLoop] LLM refinement failed, using raw result');
          }
        }

        sessionManager.addMessage(senderId, message, 'user');
        sessionManager.addMessage(senderId, responseText, 'assistant');

        return {
          response: responseText,
          toolUsed: intent.tool,
          toolResult: result,
          session: sessionManager.getSession(senderId)
        };
      } catch (err) {
        logger.error('[AgentLoop] Tool error:', err);
        return {
          response: `⚠️ 工具「${intent.tool}」执行失败：${err.message}`,
          toolUsed: intent.tool,
          error: err.message,
          session: sessionManager.getSession(senderId)
        };
      }
    }

    // 2. Agent Loop - LLM 对话（含工具调用循环）
    // 先存消息再处理（避免多轮对话丢失上下文）
    sessionManager.addMessage(senderId, message, 'user');
    const history = sessionManager.getHistory(senderId, 20);

    if (stream && onChunk && this.llm.supportsStreaming) {
      return this._streamProcess(senderId, history, onChunk);
    }

    return this._chatProcess(senderId, history);
  }

  /**
   * 普通对话处理
   */
  async _chatProcess(senderId, history) {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT }
    ].concat(history);

    for (let loop = 0; loop < MAX_LOOP; loop++) {
      try {
        const resp = await this.llm.chat({
          messages,
          tools: this.tools.length > 0 ? this.tools : undefined,
          tool_choice: 'auto',
          maxTokens: 2000
        });

        if (resp.toolCalls && resp.toolCalls.length > 0) {
          const tc = resp.toolCalls[0];
          const toolName = tc.function.name;
          const toolArgs = JSON.parse(tc.function.arguments);

          logger.info(`[AgentLoop] Calling tool: ${toolName}`, toolArgs);

          // 执行工具
          const result = await executeTool(toolName, toolArgs, { senderId });
          const formatted = this._formatResult(toolName, result);

          messages.push({ role: 'assistant', content: null, tool_calls: resp.toolCalls });
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result)
          });

          // 最终回复
          const finalResp = await this.llm.chat({
            messages: messages.map(m => ({ ...m, content: m.content || '[工具结果]' })),
            maxTokens: 1000
          });

          const responseText = finalResp.content || formatted;
          sessionManager.addMessage(senderId, responseText, 'assistant');

          return {
            response: responseText,
            toolUsed: toolName,
            toolResult: result,
            session: sessionManager.getSession(senderId)
          };
        } else {
          const responseText = resp.content || '好的，有什么可以帮你？';
          sessionManager.addMessage(senderId, responseText, 'assistant');
          return {
            response: responseText,
            toolUsed: null,
            session: sessionManager.getSession(senderId)
          };
        }
      } catch (err) {
        logger.error(`[AgentLoop] Loop ${loop} error:`, err);
        if (loop === MAX_LOOP - 1) {
          return {
            response: `⚠️ 服务暂时不可用：${err.message}`,
            error: err.message,
            session: sessionManager.getSession(senderId)
          };
        }
      }
    }
  }

  /**
   * 流式对话处理
   */
  async _streamProcess(senderId, history, onChunk) {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT }
    ].concat(history);

    let fullContent = '';
    let toolCalls = [];

    await this.llm.streamChat(
      messages,
      (text, isFinal, tcs) => {
        if (!isFinal) {
          fullContent += text;
          onChunk(text, false, []);
        } else {
          toolCalls = tcs;
          onChunk('', true, tcs);
        }
      },
      {
        tools: this.tools.length > 0 ? this.tools : undefined,
        tool_choice: 'auto',
        maxTokens: 2000
      }
    );

    if (toolCalls && toolCalls.length > 0) {
      const tc = toolCalls[0];
      const toolName = tc.function.name;
      const toolArgs = JSON.parse(tc.function.arguments);

      const result = await executeTool(toolName, toolArgs, { senderId });
      const formatted = this._formatResult(toolName, result);

      messages.push({ role: 'assistant', content: fullContent, tool_calls: toolCalls });
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result)
      });

      const finalResp = await this.llm.chat({
        messages: messages.map(m => ({ ...m, content: m.content || '[工具结果]' })),
        maxTokens: 1000
      });

      const responseText = finalResp.content || formatted;
      sessionManager.addMessage(senderId, message, 'user');
      sessionManager.addMessage(senderId, responseText, 'assistant');

      return { response: responseText, toolUsed: toolName, toolResult: result };
    }

    sessionManager.addMessage(senderId, fullContent, 'assistant');
    return { response: fullContent, toolUsed: null };
  }

  /**
   * 用意图检测（规则匹配，快速）
   */
  _detectIntent(message) {
    const msg = message.toLowerCase();

    if (/发票|扫描|识别|ocr|拍照|票据/.test(msg) && !/合同|审核/.test(msg)) {
      // 注意：发票识别需要图片，这里只返回意图，实际图片在 process 中处理
      return { tool: 'invoice_ocr', label: '📄 发票识别' };
    }
    if (/pdf|电子发票|文字.*发票|发票.*文字/.test(msg)) {
      return { tool: 'parse_invoice_text', label: '📄 PDF发票解析' };
    }
    if (/合同|审核|风险|审查|分析.*合同/.test(msg)) {
      return { tool: 'contract_review', label: '📋 合同审核' };
    }
    if (/工资|薪资|发工资|薪酬/.test(msg)) {
      return { tool: 'salary_stats', label: '💰 工资统计' };
    }
    if (/入职|新员工|添加.*员工|招聘/.test(msg)) {
      return { tool: 'employee_onboard', label: '👤 员工入职' };
    }
    return { tool: null };
  }

  /**
   * 格式化工具结果
   */
  _formatResult(tool, result) {
    if (!result) return '无结果';

    if (tool === 'invoice_ocr' || tool === 'parse_invoice_text') {
      const data = (result.data && result.data.data) || result.data || result;
      if (!result.success && result.error) {
        return `❌ ${result.error}`;
      }
      const invoiceNo = data.invoiceNo || data.invoice_no || '未知';
      const date = data.date || '未知';
      const totalAmt = data.totalAmount || data.total || data.amount || 0;
      const taxAmt = data.taxAmount || data.tax || 0;
      let netAmt = data.amountWithoutTax || data.netAmount || 0;
      if (!netAmt && totalAmt && taxAmt) netAmt = Math.round((totalAmt - taxAmt) * 100) / 100;
      const fmtAmt = v => typeof v === 'number' ? v.toFixed(2) : v;
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
      if (!result.success && result.error) return `❌ ${result.error}`;
      return `📋 合同审核结果
⚠️ 风险等级：${data.risk_level || '未知'}
🔍 主要风险点：
${(data.risk_points || []).map((p, i) => `${i+1}. ${p}`).join('\n') || '未发现明显风险'}
💡 修改建议：
${(data.suggestions || []).map((s, i) => `${i+1}. ${s}`).join('\n') || '暂无'}
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
👥 员工数量：${data.employee_count || 0}`;
    }

    return JSON.stringify(result, null, 2);
  }
}

module.exports = AgentLoop;
