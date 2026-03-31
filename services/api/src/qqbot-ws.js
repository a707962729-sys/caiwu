/**
 * QQ机器人 WebSocket 连接管理
 */
const WebSocket = require('ws');
const https = require('https');
const http = require('http');
// config和logger在API服务中不需要，qqbot-ws自包含
// const config = require('./config');
// const logger = require('./utils/logger');
const { execSync } = require('child_process');
const { getFileById } = require('./qqbot-api');

let ws = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let botAccessToken = null;
let botTokenExpireTime = null;
let _queryAI = null;

function getNextMsgSeq(_msgId) {
  const timePart = Date.now() % 100000000;
  const random = Math.floor(Math.random() * 65536);
  return (timePart ^ random) % 65536;
}

function getQueryAI() {
  if (!_queryAI) {
    try {
      const qqbotModule = require('./routes/qqbot');
      _queryAI = qqbotModule.queryAI;
    } catch (e) {
      console.error('[QQBot-WS] Failed to load queryAI:', e.message);
    }
  }
  return _queryAI;
}

function getQQBotConfig(db) {
  const rows = db.prepare('SELECT key, value FROM settings WHERE key LIKE "qqbot.%";').all();
  const cfg = {};
  for (const row of rows) {
    const key = row.key.replace('qqbot.', '');
    if (key === 'app_id') cfg.appId = row.value;
    else if (key === 'app_secret') cfg.clientSecret = row.value;
    else cfg[key] = row.value;
  }
  return cfg;
}

function getAccessToken(appId, appSecret) {
  return new Promise(async (resolve, reject) => {
    if (botAccessToken && botTokenExpireTime && Date.now() < botTokenExpireTime - 60000) {
      return resolve(botAccessToken);
    }
    try {
      const response = await fetch('https://bots.qq.com/app/getAppAccessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, clientSecret: appSecret })
      });
      const data = await response.json();
      if (data.access_token) {
        botAccessToken = data.access_token;
        botTokenExpireTime = Date.now() + (data.expires_in * 1000);
        console.log('[QQBot-WS] Token cached, expires in:', data.expires_in, 's');
        resolve(botAccessToken);
      } else {
        reject(new Error('Failed to get token: ' + JSON.stringify(data)));
      }
    } catch (err) {
      reject(err);
    }
  });
}

async function sendQQBotReply(content, target, botConfig) {
  const token = await getAccessToken(botConfig.appId, botConfig.clientSecret);
  const msgSeq = target.messageId ? getNextMsgSeq(target.messageId) : 1;
  const payload = { content: content, msg_type: 0, msg_seq: msgSeq };
  if (target.messageId) payload.msg_id = target.messageId;
  const isGuild = target.guildId && target.guildId !== '0';
  const url = isGuild
    ? 'https://api.sgroup.qq.com/v2/guilds/' + target.guildId + '/members/' + target.openId + '/messages'
    : 'https://api.sgroup.qq.com/v2/users/' + target.openId + '/messages';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'QQBot ' + token
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  console.log('[QQBot-WS] C2C message sent:', JSON.stringify(data).substring(0, 200));
  return data;
}

async function handleC2CMessage(d) {
  try {
    const { getDatabaseCompat } = require('./database');
    const db = getDatabaseCompat();
    const cfg = getQQBotConfig(db);
    let content = d.content || '';
    const openId = d.author ? (d.author.open_id || d.author.id || '') : '';
    let imageBase64 = null;
    let pdfText = null; // PDF text extracted in attachment loop below
    let docxText = null; // DOCX text extracted in attachment loop below
    const attachments = d.attachments || [];
    console.log('[QQBot-WS] handleC2CMessage entry:', JSON.stringify({openId, contentLen: content.length, attachments: attachments.length, hasMsgId: !!d.messageId}).substring(0, 300));
    if (attachments.length > 0) {
      console.log('[QQBot-WS] C2C message has attachments:', attachments.length);
      for (const att of attachments) {
        console.log('[QQBot-WS] Attachment full object:', JSON.stringify(att));
        const isImage = (att.content_type && att.content_type.startsWith('image/')) ||
                        (att.filename && att.filename.match(/\.(png|jpg|jpeg|gif|bmp|webp)$/i));
        const isPdf = att.filename && att.filename.match(/\.pdf$/i);
        const isDocx = att.filename && att.filename.match(/\.docx$/i);
        if (isImage || isPdf || isDocx) {
          try {
            const fileUrl = att.url;
            console.log('[QQBot-WS] Downloading file:', att.filename, '| url:', fileUrl, '| file_id:', att.file_id);
            const token = await getAccessToken(cfg.appId, cfg.clientSecret);
            let buffer = null;

            // 优先通过 file_id 获取原图（避免缩略图）
            if (att.file_id) {
              try {
                buffer = await getFileById(token, att.file_id);
                console.log('[QQBot-WS] Downloaded via file_id, size:', buffer ? buffer.length : 0);
              } catch (fileIdErr) {
                console.warn('[QQBot-WS] file_id download failed, falling back to url:', fileIdErr.message);
              }
            }

            // 降级：从 att.url 下载（可能是缩略图）
            if (!buffer && fileUrl) {
              const response = await fetch(fileUrl, {
                headers: { 'Authorization': 'Bot ' + cfg.appId + '.' + token }
              });
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                buffer = Buffer.from(arrayBuffer);
                console.log('[QQBot-WS] Downloaded via url, size:', buffer ? buffer.length : 0);
              }
            }

            if (buffer) {
              if (isPdf) {
                // 直接将 PDF 转为图片（200dpi），然后走 OCR 识别
                try {
                  const tmpPdf = '/tmp/caiwu_pdf_img_' + Date.now() + '.pdf';
                  const tmpImgDir = '/tmp/caiwu_pdf_imgs_' + Date.now();
                  require('fs').writeFileSync(tmpPdf, buffer);
                  require('fs').mkdirSync(tmpImgDir, { recursive: true });
                  execSync('pdftoppm -r 200 -png "' + tmpPdf + '" "' + tmpImgDir + '/page"', { stdio: 'pipe' });
                  const imgFiles = require('fs').readdirSync(tmpImgDir).filter(f => f.endsWith('.png')).sort();
                  if (imgFiles.length > 0) {
                    const images = [];
                    for (const imgFile of imgFiles) {
                      const imgPath = tmpImgDir + '/' + imgFile;
                      const imgBuf = require('fs').readFileSync(imgPath);
                      images.push(imgBuf.toString('base64'));
                      require('fs').unlinkSync(imgPath);
                    }
                    imageBase64 = images.join('|||');
                    require('fs').unlinkSync(tmpPdf);
                    require('fs').rmdirSync(tmpImgDir);
                    console.log('[QQBot-WS] PDF converted to images, pages:', images.length);
                  } else {
                    require('fs').unlinkSync(tmpPdf);
                    require('fs').rmdirSync(tmpImgDir);
                    console.error('[QQBot-WS] PDF produced no images');
                  }
                } catch (pdfImgErr) {
                  console.error('[QQBot-WS] PDF to image error:', pdfImgErr.message);
                }
              } else if (isDocx) {
                // 提取 docx 文本内容
                try {
                  const tmpDocx = '/tmp/caiwu_docx_' + Date.now() + '.docx';
                  require('fs').writeFileSync(tmpDocx, buffer);
                  // macOS: textutil; Linux 可用 antiword
                  try {
                    docxText = execSync('textutil -convert txt -format docx -stdout "' + tmpDocx + '" 2>/dev/null', { encoding: 'utf-8', timeout: 15000 });
                  } catch (textutilErr) {
                    try {
                      docxText = execSync('antiword "' + tmpDocx + '" 2>/dev/null', { encoding: 'utf-8', timeout: 15000 });
                    } catch (antiwordErr) {
                      console.warn('[QQBot-WS] docx extract failed:', textutilErr.message, antiwordErr.message);
                    }
                  }
                  require('fs').unlinkSync(tmpDocx);
                  if (docxText && docxText.trim().length > 10) {
                    docxText = docxText.trim();
                    console.log('[QQBot-WS] DOCX extracted text, len:', docxText.length);
                  } else {
                    console.error('[QQBot-WS] DOCX produced no usable text');
                  }
                } catch (docxErr) {
                  console.error('[QQBot-WS] DOCX process error:', docxErr.message);
                }
              } else {
                imageBase64 = buffer.toString('base64');
              }
            }
          } catch (err) {
            console.error('[QQBot-WS] File download error:', err.message);
          }
        }
      }
    }
    console.log('[QQBot-WS] C2C message from:', openId, 'content:', content.substring(0, 100));
    if (!content && !imageBase64 && !pdfText && !docxText) return;

    let replyText = '收到您的文件了';
    let laborContractHandled = false; // 劳动合同已处理标志

    console.log('[QQBot-WS] Processing: imageBase64=', imageBase64 ? 'YES(' + imageBase64.length + ')' : 'NO');

    // =========================================
    // 图片/附件处理 - 调用 AI 服务智能分析
    // =========================================
    if (imageBase64) {
      try {
        const firstPage = imageBase64.split('|||')[0];
        const base64Clean = firstPage ? firstPage.replace(/^data:image\/\w+;base64,/, '') : null;
        const aiResponse = await callAIService(base64Clean, pdfText);
        replyText = aiResponse.reply;
        console.log('[QQBot-WS] AI service result:', aiResponse.reply ? aiResponse.reply.substring(0, 100) : 'null');

        // 如果有结构化发票数据，尝试保存到数据库
        const toolResult = aiResponse.toolResult;
        if (toolResult && (toolResult.invoiceNo || toolResult.invoice_no)) {
          try {
            const savePayload = JSON.stringify({
              invoiceData: {
                invoiceNo: toolResult.invoiceNo || toolResult.invoice_no,
                invoiceCode: toolResult.invoiceCode || toolResult.invoice_code,
                type: toolResult.type || '电子发票(普通发票)',
                date: toolResult.date || '',
                buyer: toolResult.buyer,
                seller: toolResult.seller,
                totalAmount: toolResult.totalAmount || toolResult.total_amount || toolResult.total,
                taxAmount: toolResult.taxAmount || toolResult.tax_amount || toolResult.tax,
                amountWithoutTax: toolResult.amountWithoutTax || toolResult.amount_without_tax || 0,
                items: toolResult.items || [],
                _aiRecognized: true
              },
              autoEntry: true
            });
            const saveOptions = {
              hostname: '127.0.0.1',
              port: 3000,
              path: '/api/invoice-entry/internal-ai-recognize',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(savePayload),
                'x-internal-api-key': 'caiwu-internal-service-key-2024'
              },
              timeout: 15000
            };
            // await保存完成后再回复
            await new Promise((resolve) => {
              const saveReq = http.request(saveOptions, saveRes => {
                let saveData = '';
                saveRes.on('data', c => saveData += c);
                saveRes.on('end', () => {
                  try {
                    const saveResult = JSON.parse(saveData);
                    if (saveResult.success) {
                      const needsReview = saveResult.data?.needsReview;
                      if (needsReview) {
                        console.log('[QQBot-WS] Invoice needs review:', saveResult.data?.validation?.errors?.map(e => e.message).join(', '));
                        replyText += '\n\n⚠️ 发票已识别，需人工审核（' + (saveResult.data?.validation?.errors?.[0]?.message || '验证规则未通过') + '）';
                      } else {
                        console.log('[QQBot-WS] Invoice saved: id=' + saveResult.data?.entry?.invoiceId);
                        replyText += '\n\n✅ 发票已识别并入库！';
                      }
                    } else {
                      console.log('[QQBot-WS] Invoice save warning:', saveResult.message || saveResult.error);
                      replyText += '\n\n⚠️ 发票已识别，待人工处理';
                    }
                  } catch(e) {
                    console.log('[QQBot-WS] Invoice save parse error:', saveData.substring(0, 100));
                    replyText += '\n\n⚠️ 发票已识别，待人工处理';
                  }
                  resolve();
                });
              });
              saveReq.on('error', e => { console.error('[QQBot-WS] Invoice save error:', e.message); resolve(); });
              saveReq.on('timeout', () => { saveReq.destroy(); console.error('[QQBot-WS] Invoice save timeout'); resolve(); });
              saveReq.write(savePayload);
              saveReq.end();
            });
          } catch(saveErr) {
            console.error('[QQBot-WS] Invoice save setup error:', saveErr.message);
          }
        }
      } catch (aiErr) {
        console.error('[QQBot-WS] AI service error:', aiErr.message);
        replyText = '收到您的文件，发票识别失败，请稍后手动录入。';
      }
    } else if (docxText) {
      // DOCX 文件：检测是合同还是发票，分别处理
      const contractKeywords = ['合同', '甲方', '乙方', '签订', '协议', '违约金', '合同期限', '合同编号', '合同金额', '服务', '租赁', '采购', '销售合同'];
      const laborContractKeywords = ['劳动合同', '聘用合同', '雇佣合同', '员工', '雇员', '甲方（单位）', '乙方（员工）', '试用期', '转正', '入职', '岗位', '工资', '薪酬', '社会保险'];
      const isContract = contractKeywords.some(kw => docxText.includes(kw)) && (docxText.includes('甲方') || docxText.includes('乙方') || docxText.includes('签订'));
      const isLaborContract = laborContractKeywords.some(kw => docxText.includes(kw));
      
      if (isContract) {
        // 合同：调用合同审核分析（同步方式）
        
        // 特殊处理：劳动合同 - 自动提取员工信息并创建员工档案
        if (isLaborContract && !laborContractHandled) {
          laborContractHandled = true;
          try {
            const laborPrompt = `【任务】从劳动合同中提取员工信息，直接输出提取结果，不要调用任何工具。

请从以下劳动合同文本中提取员工信息并直接回答：

**提取格式（严格按照此格式）：**
姓名：[员工姓名]
入职日期：[YYYY-MM-DD格式，注意是员工入职日期，不是签订日期，没有则写"未填写"]
岗位：[职位，没有则写"未填写"]
身份证号：[身份证号，没有则写"未填写"]
联系电话：[电话，没有则写"未填写"]
基本工资：[工资金额，没有则写"未填写"]

**重要提醒：**
- 入职日期是员工开始工作的日期，不是合同签订的日期
- 仔细区分"签订日期"和"入职日期"，不要搞混
- 日期格式统一写成YYYY-MM-DD，如2026-03-12

**劳动合同文本：**
` + docxText.substring(0, 5000) + `

请直接输出提取结果，不要说"好的"或解释，直接列出提取的信息即可。`;

            const laborBody = JSON.stringify({
              message: laborPrompt,
              images: [],
              pdf_text: null,
              skip_tools: true
            });
            
            let laborData = '';
            await new Promise((resolve) => {
              const laborReq = http.request({
                hostname: '127.0.0.1', port: 3001, path: '/api/ai/chat',
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(laborBody), 'x-qqbot-token': 'qqbot-internal' }, timeout: 30000
              }, laborRes => { laborRes.on('data', c => laborData += c); laborRes.on('end', resolve); });
              laborReq.on('error', e => { console.error('[QQBot-WS] Labor contract AI error:', e.message); resolve(); });
              laborReq.write(laborBody); laborReq.end();
            });

            if (laborData) {
              try {
                const laborResult = JSON.parse(laborData);
                let laborInfo = laborResult.data?.response || laborResult.response || laborResult.message || laborResult.reply || '';
                
                // 解析文本格式的回复
                const parseTextResponse = (text) => {
                  const result = {};
                  
                  // 尝试多种模式提取姓名
                  const patterns = [
                    /姓\s*名[为：:]\s*([^\s，,。\n,]+)/,
                    /乙方[为：:]\s*([^\s，,。\n,]+)/,
                    /劳动者[为：:]\s*([^\s，,。\n,]+)/
                  ];
                  for (const p of patterns) {
                    const m = text.match(p);
                    if (m) { result.name = m[1].trim(); break; }
                  }
                  
                  // 提取日期 - 多种格式支持
                  const dateStr = text;
                  // 多种日期格式正则
                  const datePatterns = [
                    // 2026年6月15日 或 2026年01月12日
                    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
                    // 入职日期：2026年6月15日
                    /入职日期[：:\s]*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
                    // 2026-01-12 或 2026-6-15
                    /(\d{4})-(\d{1,2})-(\d{1,2})/,
                    // 入职日期：2026-01-12
                    /入职日期[：:\s]*(\d{4})-(\d{1,2})-(\d{1,2})/
                  ];
                  
                  for (const p of datePatterns) {
                    const m = dateStr.match(p);
                    if (m) {
                      // 标准化为 YYYY-MM-DD
                      const year = m[1];
                      const month = String(m[2]).padStart(2, '0');
                      const day = String(m[3]).padStart(2, '0');
                      result.entry_date = `${year}-${month}-${day}`;
                      break;
                    }
                  }
                  
                  // 提取岗位
                  const posMatch = text.match(/岗\s*位[：:]\s*([^\s，,。\n,]+)/);
                  if (posMatch) result.position = posMatch[1].trim();
                  
                  // 提取工资（处理"工资：月薪18000元"、"基本工资：18000"、"月薪18000"等格式）
                  const salaryMatch = text.match(/(?:基本工资|工资|月\s*薪)[：:\s]*(?:月薪)?[^\d]*(\d+(?:,\d{3})*(?:\.\d+)?)/);
                  if (salaryMatch) {
                    const salaryStr = salaryMatch[1].replace(/,/g, '');
                    result.base_salary = parseFloat(salaryStr);
                  }
                  
                  return result;
                };

                const laborParsed = parseTextResponse(laborInfo);
                laborInfo = laborParsed;

                console.log('[QQBot-WS] Parsed labor info:', JSON.stringify(laborParsed));

                if (laborParsed && laborParsed.name) {
                  // 获取默认公司ID
                  const companyId = 1;
                  
                  // 检查员工是否已存在
                  const { getDatabaseCompat } = require('./database');
                  const db = getDatabaseCompat();
                  const existing = db.prepare('SELECT id FROM employees WHERE name = ? AND company_id = ? LIMIT 1').get(laborInfo.name, companyId);
                  
                  let employeeCreated = false;
                  let employeeId = existing ? existing.id : null;
                  
                  if (!existing) {
                    const entryDate = laborInfo.entry_date || new Date().toISOString().split('T')[0];
                    const position = laborInfo.position || '员工';
                    const result = db.prepare(`
                      INSERT INTO employees (company_id, name, position, hire_date, phone, id_card, base_salary, status, created_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, 'probation', datetime('now'))
                    `).run(companyId, laborInfo.name, position, entryDate, laborInfo.phone || null, laborInfo.id_card || null, laborInfo.base_salary || 0);
                    
                    employeeCreated = true;
                    employeeId = result.lastInsertRowid;
                    console.log('[QQBot-WS] Auto-created employee:', laborInfo.name, 'ID:', employeeId);
                  }
                  
                  replyText = `📋 劳动合同已收到，员工信息提取成功！\n\n`;
                  if (employeeCreated) {
                    replyText += `✅ 已自动创建员工档案：\n`;
                    replyText += `• 姓名：${laborInfo.name}\n`;
                    replyText += `• 入职日期：${laborInfo.entry_date || '未填写'}\n`;
                    replyText += `• 岗位：${laborInfo.position || '员工'}\n`;
                    if (laborInfo.base_salary) replyText += `• 基本工资：¥${laborInfo.base_salary}\n`;
                    replyText += `\n状态：试用期（试用期工资按80%计算）`;
                  } else {
                    replyText += `⚠️ 员工「${laborInfo.name}」已存在，无需重复创建`;
                  }
                } else {
                  replyText = '📋 劳动合同已收到，但无法自动提取员工信息，请手动录入。';
                }
              } catch(e) {
                console.error('[QQBot-WS] Labor contract parse error:', e.message);
                replyText = '📋 劳动合同已收到，员工信息提取失败，请手动录入。';
              }
            } else {
              replyText = '📋 劳动合同已收到，AI服务暂时不可用，请手动录入员工信息。';
            }
          } catch(laborErr) {
            console.error('[QQBot-WS] Labor contract process error:', laborErr.message);
            replyText = '📋 劳动合同已收到，处理失败，请手动录入。';
          }
        }
        
        // 只有非劳动合同才执行普通合同审核
        if (!laborContractHandled) {
          try {
          const contractPrompt = `[禁止使用任何工具] 你是一个合同合规审查专家，直接分析以下合同内容并输出审查结果。

【输出要求 - 直接输出，不要调用任何功能】
合同类型：[类型]
甲方：[甲方名称]
乙方：[乙方名称]
合同金额：[金额，没有则写"未明确"]
风险等级：[高/中/低，用一个字]
主要风险点：[列出2-3个主要风险，每条用一句话]
修改建议：[列出2-3条建议]

【合规性检查要点】
- 合同主体是否明确
- 价款支付是否合理
- 违约责任是否对等
- 争议解决是否公平
- 是否有霸王条款

合同文本：
` + docxText.substring(0, 4000);
          const body = JSON.stringify({
            message: contractPrompt,
            images: [],
            pdf_text: null,
            skip_tools: true,
            system_prompt: "你是一个合同合规审查专家。必须直接输出审查结果，禁止使用任何工具或函数调用。"
          });
          const options = {
            hostname: '127.0.0.1',
            port: 3001,
            path: '/api/ai/chat',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-qqbot-token': 'qqbot-internal' },
            timeout: 30000
          };
          let aiData = '';
          await new Promise((resolve) => {
            const aiReq = http.request(options, aiRes => {
              aiRes.on('data', c => aiData += c);
              aiRes.on('end', resolve);
            });
            aiReq.on('error', e => { console.error('[QQBot-WS] Contract AI error:', e.message); resolve(); });
            aiReq.write(body);
            aiReq.end();
          });
          if (aiData) {
            try {
              const aiResult = JSON.parse(aiData);
              let reply = aiResult.data?.response || aiResult.response || aiResult.message || aiResult.reply || '';
              replyText = '📋 合同合规性审查报告\n\n' + (reply || '分析完成');
              
              // 尝试保存审查结果到数据库
              try {
                const { getDatabaseCompat } = require('./database');
                const db = getDatabaseCompat();
                
                // 解析风险等级
                let riskLevel = 'medium';
                if (reply.includes('风险等级：高') || reply.includes('风险等级：高')) riskLevel = 'high';
                else if (reply.includes('风险等级：低') || reply.includes('风险等级：低')) riskLevel = 'low';
                
                // 提取甲方乙方
                const partyA = (reply.match(/甲方[：:]\s*([^\n，,。]+)/) || ['',''])[1] || '';
                const partyB = (reply.match(/乙方[：:]\s*([^\n，,。]+)/) || ['',''])[1] || '';
                
                // 提取合同金额
                const amountMatch = reply.match(/合同金额[：:]\s*([^\n，,。]+)/);
                
                // 提取风险点和建议
                const riskPoints = [];
                const suggestions = [];
                const riskMatch = reply.match(/主要风险点[：:]\s*([\s\S]*?)(?=修改建议|$)/);
                const suggMatch = reply.match(/修改建议[：:]\s*([\s\S]*)/);
                
                if (riskMatch) {
                  const points = riskMatch[1].split(/[；;]\s*/).filter(p => p.trim());
                  points.forEach((p, i) => riskPoints.push({ item: p.trim(), detail: '', risk_level: 'medium' }));
                }
                if (suggMatch) {
                  const sugs = suggMatch[1].split(/[；;]\s*/).filter(p => p.trim());
                  sugs.forEach((s, i) => suggestions.push({ priority: i+1, category: 'compliance', suggestion: s.trim(), reason: '' }));
                }
                
                // 查找或创建合同记录
                let contractId = null;
                const existingContract = db.prepare("SELECT id FROM contracts WHERE company_id = ? LIMIT 1").get(1);
                if (existingContract) {
                  contractId = existingContract.id;
                }
                
                if (contractId) {
                  // 保存审查结果
                  const result = db.prepare(`
                    INSERT INTO contract_reviews (
                      contract_id, party_a_risk_level, party_b_risk_level,
                      party_a_risk_factors, party_b_risk_factors,
                      contract_type, contract_type_confidence,
                      overall_risk_level, risk_score,
                      risk_findings, review_suggestions,
                      ai_model, ai_tokens_used,
                      review_status, reviewed_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', datetime('now'))
                  `).run(
                    contractId, riskLevel, riskLevel,
                    JSON.stringify([partyA ? `甲方：${partyA}` : '甲方未明确']),
                    JSON.stringify([partyB ? `乙方：${partyB}` : '乙方未明确']),
                    '', 0.8,
                    riskLevel, riskLevel === 'high' ? 75 : riskLevel === 'medium' ? 50 : 25,
                    JSON.stringify(riskPoints),
                    JSON.stringify(suggestions),
                    'openai', 0
                  );
                  
                  // 记录历史
                  db.prepare(`
                    INSERT INTO contract_review_history (review_id, action, operator_id, changes, created_at)
                    VALUES (?, 'ai_review', ?, ?, datetime('now'))
                  `).run(result.lastInsertRowid, 1, JSON.stringify({ source: 'qqbot', risk_level: riskLevel }));
                  
                  console.log('[QQBot-WS] Contract review saved, ID:', result.lastInsertRowid);
                }
              } catch (dbErr) {
                console.error('[QQBot-WS] Failed to save contract review:', dbErr.message);
              }
              
              console.log('[QQBot-WS] Contract AI result:', reply.substring(0, 100));
            } catch(e) {
              replyText = '合同已收到，分析完成，请登录系统查看审核结果。';
            }
          } else {
            replyText = '合同已收到，分析服务暂时不可用，请稍后重试。';
          }
        } catch(err) {
          console.error('[QQBot-WS] Contract process error:', err.message);
          replyText = '合同已收到，处理失败，请稍后手动上传审核。';
        }
        }
      } else {
        // 非合同：调用发票识别
        try {
          const aiResponse = await callAIService(null, docxText);
          replyText = aiResponse.reply;
          console.log('[QQBot-WS] DOCX AI result:', aiResponse.reply ? aiResponse.reply.substring(0, 100) : 'null');
          const toolResult = aiResponse.toolResult;
          if (toolResult && (toolResult.invoiceNo || toolResult.invoice_no)) {
            const savePayload = JSON.stringify({
              invoiceData: {
                invoiceNo: toolResult.invoiceNo || toolResult.invoice_no,
                invoiceCode: toolResult.invoiceCode || toolResult.invoice_code,
                type: toolResult.type || '电子发票(普通发票)',
                date: toolResult.date || '',
                buyer: toolResult.buyer,
                seller: toolResult.seller,
                totalAmount: toolResult.totalAmount || toolResult.total_amount || toolResult.total,
                taxAmount: toolResult.taxAmount || toolResult.tax_amount || toolResult.tax,
                amountWithoutTax: toolResult.amountWithoutTax || toolResult.amount_without_tax || 0,
                items: toolResult.items || [],
                _aiRecognized: true
              },
              autoEntry: true
            });
            const saveOptions = {
              hostname: '127.0.0.1',
              port: 3000,
              path: '/api/invoice-entry/internal-ai-recognize',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(savePayload),
                'x-internal-api-key': 'caiwu-internal-service-key-2024'
              },
              timeout: 15000
            };
            const saveReq = http.request(saveOptions, saveRes => {
              let saveData = '';
              saveRes.on('data', c => saveData += c);
              saveRes.on('end', () => {
                try {
                  const saveResult = JSON.parse(saveData);
                  if (saveResult.success) {
                    const needsReview = saveResult.data?.needsReview;
                    if (needsReview) {
                      console.log('[QQBot-WS] DOCX Invoice needs review:', saveResult.data?.validation?.errors?.map(e => e.message).join(', '));
                      replyText += '\n\n⚠️ 发票已识别，需人工审核（' + (saveResult.data?.validation?.errors?.[0]?.message || '验证规则未通过') + '）';
                    } else {
                      console.log('[QQBot-WS] DOCX Invoice saved: id=' + saveResult.data?.entry?.invoiceId);
                      replyText += '\n\n✅ 发票已识别并入库！';
                    }
                  } else {
                    replyText += '\n\n⚠️ 发票已识别，待人工处理';
                  }
                } catch(e) {
                  console.log('[QQBot-WS] DOCX Invoice save parse error:', saveData.substring(0, 100));
                  replyText += '\n\n⚠️ 发票已识别，待人工处理';
                }
              });
            });
            saveReq.on('error', e => { console.error('[QQBot-WS] DOCX Invoice save error:', e.message); });
            saveReq.on('timeout', () => { saveReq.destroy(); console.error('[QQBot-WS] DOCX Invoice save timeout'); });
            saveReq.write(savePayload);
            saveReq.end();
          }
        } catch(aiErr) {
          console.error('[QQBot-WS] DOCX AI service error:', aiErr.message);
          replyText = '收到您的文件，识别失败，请稍后手动处理。';
        }
      }
    } else if (content) {
      const queryAI = getQueryAI();
      if (queryAI) {
        try {
          replyText = await queryAI(content, db, null, null);
        } catch (e) {
          console.error('[QQBot-WS] queryAI error:', e.message);
        }
      }
    }

    await sendQQBotReply(replyText, { openId: openId, guildId: '0', messageId: d.messageId || null, messageType: '1' }, { appId: cfg.appId, clientSecret: cfg.clientSecret });
  } catch (error) {
    console.error('[QQBot-WS] Error handling C2C message:', error);
  }
}

function callAIService(base64Image, pdfText) {
  return new Promise((resolve, reject) => {
    const hasImage = base64Image && base64Image.length > 100;
    const hasPdfText = pdfText && pdfText.length > 10;
    let message = '请识别这张发票图片，提取发票号码、开票日期、金额（含税）、销售方、购买方等信息。';
    if (!hasImage && hasPdfText) {
      message = '请识别以下发票文字内容，提取发票号码、开票日期、金额（含税）、销售方、购买方等信息。\n' + pdfText;
    }
    const body = {
      message: message,
      images: base64Image ? [base64Image] : [],
      pdf_text: (!hasImage && hasPdfText) ? pdfText : null,
    };
    const postData = JSON.stringify(body);
    const options = {
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/ai/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-qqbot-token': 'qqbot-internal'
      },
      timeout: 30000
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const reply = result.data?.response || result.data?.content || result.content || result.reply || JSON.stringify(result);
          // 提取结构化发票数据（toolResult）
          let toolResult = null;
          if (result.data?.toolResult) {
            // AI 服务返回的结构化数据：可能是 {data: invoiceData} 或直接是 invoiceData
            // 也可能是 {data: {success, data: invoiceData}}（双重嵌套bug后的样子）
            const tr = result.data.toolResult;
            // 先尝试 tr.data（解开一层嵌套）
            let candidate = tr.data && typeof tr.data === 'object' ? tr.data : tr;
            // 如果解开后还有 data 层（双重嵌套），再解一层
            if (candidate.data && typeof candidate.data === 'object' && (candidate.data.invoiceNo || candidate.data.invoice_no || candidate.data.total_amount)) {
              candidate = candidate.data;
            }
            // 支持 camelCase 和 snake_case 字段
            if (candidate && (candidate.invoiceNo || candidate.invoice_no || candidate.totalAmount || candidate.total_amount)) {
              toolResult = candidate;
            }
          }
          resolve({ reply, toolResult, success: result.success !== false });
        } catch(e) {
          console.log('[QQBot-WS] AI parse error:', data.substring(0, 200));
          resolve({ reply: '收到您的文件，发票识别失败，请稍后手动录入。', toolResult: null, success: false });
        }
      });
    });
    req.on('error', e => {
      console.error('[QQBot-WS] AI request error:', e.message);
      resolve({ reply: '收到您的文件，发票识别失败，请稍后手动录入。', toolResult: null, success: false });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ reply: '收到您的文件，发票识别失败，请稍后手动录入。', toolResult: null, success: false });
    });
    req.write(postData);
    req.end();
  });
}

function callBaiduOCR(base64Image) {
  return new Promise((resolve, reject) => {
    const API_KEY = 'yb2BAkFhuYFyZbUkl63KO5uA';
    const SECRET_KEY = '4bBqL52gYuokaD300Bfn0ut1TIN0f6Ry';
    // Step 1: get token
    const postData = 'grant_type=client_credentials&client_id=' + API_KEY + '&client_secret=' + SECRET_KEY;
    const tr = https.request({
      hostname: 'aip.baidubce.com',
      path: '/oauth/2.0/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const token = JSON.parse(d).access_token;
          // Step 2: OCR
          const ocrBody = 'image=' + encodeURIComponent(base64Image);
          const buf = Buffer.from(ocrBody);
          const or = https.request({
            hostname: 'aip.baidubce.com',
            path: '/rest/2.0/ocr/v1/general_basic?access_token=' + token,
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': buf.length },
            timeout: 15000
          }, res2 => {
            let d2 = '';
            res2.on('data', c => d2 += c);
            res2.on('end', () => {
              try {
                const result = JSON.parse(d2);
                if (result.words_result) {
                  const text = result.words_result.map(w => w.words).join('\n');
                  resolve(text);
                } else {
                  console.log('[QQBot-WS] Baidu OCR error:', d2.substring(0, 200));
                  resolve('');
                }
              } catch(e) { reject(e); }
            });
            or.on('error', reject);
            or.write(buf);
            or.end();
          });
        } catch(e) { reject(e); }
      });
    });
    tr.on('error', reject);
    tr.write(postData);
    tr.end();
  });
}

function extractInvoiceFromResponse(response) {
  if (!response || typeof response !== 'string') return null;
  const r = response;
  const invoice_no_match = r.match(/发票号码[：:]\s*([A-Z0-9]{10,})/);
  const invoice_no = invoice_no_match ? invoice_no_match[1] : '';
  const date_match = r.match(/日期[：:]\s*([\d年月日-]+)/);
  const date = date_match ? date_match[1] : '';
  // 找所有金额相关的数字，取最大的那个作为 total
  const amounts = r.match(/[\d]+\.?\d{0,2}/g) || [];
  const validAmounts = amounts.map(a => parseFloat(a)).filter(v => v > 0 && v < 1000000).sort((a,b) => b-a);
  const total = validAmounts[0] || 0;
  const tax = validAmounts[1] > 0 ? validAmounts[1] : 0;
  const buyer_match = r.match(/(?:购买方|抬头)[：:]\s*([^\n]{2,30})/);
  const buyer = buyer_match ? buyer_match[1].trim() : '';
  const seller_match = r.match(/(?:销售方|商家|开票单位)[：:]\s*([^\n]{2,30})/);
  const seller = seller_match ? seller_match[1].trim() : '';
  if (!invoice_no && !date && !total) return null;
  return { invoice_no, date, amount: total, tax, total, buyer, seller };
}

function saveInvoiceToDB(invoiceData) {
  try {
    const { getDatabaseCompat } = require('./database');
    const db = getDatabaseCompat();
    const invoice_no = invoiceData.invoice_no || '';
    const total = invoiceData.total || invoiceData.amount || 0;
    const tax = invoiceData.tax || 0;
    const issue_date = invoiceData.date || '';
    db.exec(`INSERT OR REPLACE INTO invoices (invoice_no, invoice_type, total_amount, tax_amount, issue_date, status, direction, created_at) VALUES ('${invoice_no}', '普通发票', ${total}, ${tax}, '${issue_date}', 'verified', 'inbound', datetime('now'))`);
    console.log('[QQBot-WS] Invoice saved to DB');
  } catch (err) {
    console.error('[QQBot-WS] Save invoice error:', err.message);
  }
}

function handleGuildMessage(d) {
  console.log('[QQBot-WS] Guild message received:', d.channelId);
}

function startQQBotWS() {
  const { getDatabaseCompat } = require('./database');
  const db = getDatabaseCompat();
  const cfg = getQQBotConfig(db);
  if (!cfg.appId || !cfg.clientSecret) {
    console.log('[QQBot-WS] QQBot not configured');
    return;
  }
  console.log('[QQBot-WS] Starting connection...');
  const INTENTS = (1 << 30) | (1 << 12) | (1 << 25);
  
  getAccessToken(cfg.appId, cfg.clientSecret)
    .then(token => {
      const url = 'wss://api.sgroup.qq.com/websocket';
      console.log('[QQBot-WS] Connecting to:', url);
      ws = new WebSocket(url);
      
      ws.on('open', () => {
        console.log('[QQBot-WS] WebSocket connected');
        // 发送 IDENTIFY
        ws.send(JSON.stringify({
          op: 2,
          d: {
            token: 'QQBot ' + token,
            intents: INTENTS,
            shard: [0, 1]
          }
        }));
      });
      
      ws.on('message', async (raw) => {
        try {
          const d = JSON.parse(raw);
          
          // DEBUG: log ALL op=0 events to catch unhandled event types
          if (d.op === 0 && d.t) {
            console.log('[QQBot-WS] WS EVENT:', d.t, '| keys:', Object.keys(d.d || {}).join(','));
          }
          
          // Dispatch event
          if (d.op === 0) {
            if (d.t === 'READY') {
              console.log('[QQBot-WS] Bot is ready!');
              if (d.d && d.d.user) {
                console.log('[QQBot-WS] Logged in as:', d.d.user.username);
              }
            }
            if (d.t === 'C2C_MESSAGE_CREATE' || d.t === 'C2C_MSG_CREATE') {
              await handleC2CMessage(d.d);
            }
            if (d.t === 'AT_MESSAGE_CREATE') {
              handleGuildMessage(d.d);
            }
            // TODO: also handle C2C image-specific events if QQ sends them separately
          }
          
          // Hello - start heartbeat
          if (d.op === 10) {
            console.log('[QQBot-WS] Received hello, starting heartbeat');
            startHeartbeat(d.d.heartbeat_interval);
          }
          
          // Heartbeat ACK
          if (d.op === 11) { /* heartbeat ack */ }
          
        } catch (err) {
          console.error('[QQBot-WS] Message error:', err);
        }
      });
      
      ws.on('error', (err) => { console.error('[QQBot-WS] Error:', err.message); });
      ws.on('close', (code, reason) => {
        console.log('[QQBot-WS] Connection closed:', code, reason ? reason.toString() : '');
        scheduleReconnect();
      });
    })
    .catch(err => {
      console.error('[QQBot-WS] Auth failed:', err.message);
      scheduleReconnect();
    });
}

function startHeartbeat(interval) {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (!interval || interval <= 0) interval = 30000;
  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ op: 1, d: null }));
    }
  }, interval);
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    console.log('[QQBot-WS] Reconnecting...');
    startQQBotWS();
  }, 5000);
}

function stop() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (ws) { ws.close(); ws = null; }
}

function getStatus() {
  return { connected: ws ? ws.readyState === WebSocket.OPEN : false, ready: ws ? ws.readyState === WebSocket.OPEN : false };
}

module.exports = {
  startQQBotWS,
  stopQQBotWS: stop,
  reconnect: startQQBotWS,
  getQQBotWSStatus: getStatus
};
