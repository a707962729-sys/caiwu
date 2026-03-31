/**
 * QQ 机器人 HTTP 回调服务
 * 处理 QQ 开放平台的回调请求
 * 
 * 路由前缀: /api/qqbot
 * 
 * 接口:
 * - GET  /api/qqbot/callback  - QQ平台URL验证
 * - POST /api/qqbot/callback - QQ机器人消息回调
 * - GET  /api/qqbot/health   - 服务状态检查
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { asyncHandler } = require('../middleware/error');
const { sendQQBotReply } = require('../qqbot-api');
const jwt = require('jsonwebtoken');
const { getQQBotWSStatus } = require('../qqbot-ws');

// 腾讯QQ机器人回调签名验证 (基于QQ开放平台规范)
// 签名算法: sha1(sorted_query_string + app_secret)
// sorted_query_string = 按字典序排序后的query参数，用&连接

/**
 * 验证 QQ 机器人回调签名
 */
function verifyQQBotSign(req, appSecret) {
  // QQ 开放平台使用以下请求头进行签名验证
  const appId = req.headers['x-union-appid'];
  const timestamp = req.headers['x-union-timestamp'];
  const nonce = req.headers['x-union-nonce'];
  const signature = req.headers['x-union-sign'];

  if (!appId || !timestamp || !nonce || !signature) {
    // 部分版本可能使用小写
    const altAppId = req.headers['x-qq-appid'];
    const altTimestamp = req.headers['x-qq-timestamp'];
    const altNonce = req.headers['x-qq-nonce'];
    const altSign = req.headers['x-qq-sign'];

    if (!altAppId || !altTimestamp || !altNonce || !altSign) {
      return false;
    }

    // 组合用于验证的字符串: timestamp_nonce_appSecret
    const str = [altTimestamp, altNonce, appSecret].sort().join('');
    const calculatedSign = crypto.createHash('sha1').update(str).digest('hex');

    return calculatedSign === altSign;
  }

  // 组合用于验证的字符串: timestamp_nonce_appSecret
  const str = [timestamp, nonce, appSecret].sort().join('');
  const calculatedSign = crypto.createHash('sha1').update(str).digest('hex');

  return calculatedSign === signature;
}

/**
 * 获取 QQ 机器人配置
 */
function getQQBotConfig(db) {
  const rows = db.prepare(
    'SELECT key, value FROM settings WHERE key LIKE ? AND (company_id IS NULL OR company_id = 1)'
  ).all('qqbot.%');

  const config = { enabled: false, app_id: '', app_secret: '' };
  rows.forEach(r => {
    const key = r.key.replace('qqbot.', '');
    config[key] = r.value;
  });
  config.enabled = config.enabled === 'true';
  return config;
}

/**
 * @route   GET /api/qqbot/callback
 * @desc    QQ 平台验证回调URL
 * @access  Public (QQ平台调用)
 */
router.get('/callback',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const config = getQQBotConfig(db);

    // URL 验证模式：QQ平台会传递 challenge 参数
    const { challenge, verify_token, encrypt } = req.query;

    if (challenge) {
      // 返回 challenge 进行验证
      return res.json({
        challenge: challenge
      });
    }

    // 标准 URL 验证响应
    return res.json({
      success: true,
      message: 'QQ Bot callback endpoint is active',
      config: {
        enabled: config.enabled
      }
    });
  })
);

/**
 * @route   POST /api/qqbot/callback
 * @desc    QQ 机器人消息回调入口
 * @access  Public (QQ平台调用)
 */
router.post('/callback',
  asyncHandler(async (req, res) => {
    // 立即响应 200，避免 QQ 平台超时
    res.status(200).json({ ret: 0 });

    const db = getDatabaseCompat();
    const config = getQQBotConfig(db);

    // 检查是否启用
    if (!config.enabled) {
      console.log('[QQBot] Callback received but bot is disabled');
      return;
    }

    // 验证签名
    if (!verifyQQBotSign(req, config.app_secret)) {
      console.log('[QQBot] Signature verification failed');
      return;
    }

    // 异步处理消息
    processQQBotMessage(req.body, config, db).catch(err => {
      console.error('[QQBot] Error processing message:', err);
    });
  })
);

/**
 * 处理 QQ 机器人消息
 */
async function processQQBotMessage(body, config, db) {
  try {
    console.log('[QQBot] Received callback:', JSON.stringify(body));

    // 解析消息内容
    // QQ 开放平台消息格式
    let userMessage = '';
    let openId = '';
    let guildId = '';
    let channelId = '';
    let messageType = '';
    let messageId = '';

    // 兼容多种消息格式
    if (body.d) {
      // 私域消息格式 (d 字段)
      const d = body.d;
      openId = d.author?.open_id || d.user_id || '';
      guildId = d.guild_id || '';
      channelId = d.channel_id || '';
      messageType = d.type?.toString() || '1';
      messageId = d.id || '';

      // 提取文本内容
      if (d.content) {
        userMessage = d.content.trim();
      } else if (d.msg?.content) {
        userMessage = d.msg.content.trim();
      } else if (d.msg?.text) {
        userMessage = d.msg.text.trim();
      }
    } else if (body.msg) {
      // 直接消息格式
      userMessage = body.msg?.content || body.msg || '';
      openId = body.openid || body.user_id || body.open_id || '';
      messageId = body.message_id || body.msg_id || '';
    } else if (body.content) {
      // 最简格式
      userMessage = body.content;
      openId = body.openid || body.user_id || '';
    }

    // 忽略空消息
    if (!userMessage) {
      console.log('[QQBot] Empty message, ignoring');
      return;
    }

    // 忽略 bot 自身消息
    if (body.self || body.is_bot) {
      console.log('[QQBot] Ignoring bot message');
      return;
    }

    console.log('[QQBot] Processing message:', userMessage, 'from:', openId);

    // 调用 AI 服务处理自然语言
    const aiResponse = await queryAI(userMessage, db);

    // 发送回复
    await sendQQBotReply(aiResponse, {
      openId,
      guildId,
      channelId,
      messageType,
      messageId
    }, config);

  } catch (error) {
    console.error('[QQBot] Error in processQQBotMessage:', error);
  }
}

/**
 * 调用 AI 服务处理自然语言
 */
async function queryAI(message, db, imageBase64 = null, pdfText = null) {
  try {
    // 获取当前 AI 配置
    const aiConfig = db.prepare(
      'SELECT value FROM settings WHERE key = ? AND (company_id IS NULL OR company_id = 1)'
    ).get('ai.model');

    const model = aiConfig?.value || 'default';

    // 调用真实AI服务
    try {
      const jwt = require('jsonwebtoken');
      const aiToken = jwt.sign({ userId: 'qqbot', role: 'bot' }, 'your-super-secret-jwt-key-change-in-production', { expiresIn: '1h' });
      
      // 构建请求体
      const requestBody = { message: message };
      if (imageBase64) {
        // Support multi-page PDF images (delimited by |||)
        if (imageBase64.includes('|||')) {
          requestBody.images = imageBase64.split('|||');
        } else {
          requestBody.images = [imageBase64];
        }
      }
      if (pdfText) {
        requestBody.pdf_text = pdfText;
      }
      
      const response = await fetch('http://localhost:3001/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + aiToken
        },
        body: JSON.stringify(requestBody)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[QQBot] AI response:', JSON.stringify(data).substring(0, 200));
        return data.data?.response || data.response || data.message || '收到您的消息了';
      } else {
        console.error('[QQBot] AI response not ok:', response.status);
      }
    } catch (e) {
      console.error('[QQBot] AI call failed:', e.message);
    }
    return '消息已收到，我会尽快处理';

  } catch (error) {
    console.error('[QQBot] AI query error:', error);
    return '服务暂时不可用，请稍后再试。';
  }
}

// sendQQBotReply 已移至 ../qqbot-api.js 模块，通过 import 引入

/**
 * @route   GET /api/qqbot/health
 * @desc    QQ 机器人服务状态
 */
router.get('/health',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const config = getQQBotConfig(db);

    res.json({
      success: true,
      qqbot: {
        enabled: config.enabled,
        configured: !!(config.app_id && config.app_secret)
      }
    });
  })
);

/**
 * @route   GET /api/qqbot/ws-status
 * @desc    QQ 机器人 WebSocket 连接状态
 * @access  Private
 */
router.get('/ws-status',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const config = getQQBotConfig(db);
    const wsStatus = getQQBotWSStatus();

    res.json({
      success: true,
      ws: {
        enabled: config.enabled,
        ...wsStatus
      }
    });
  })
);

module.exports = router;
module.exports.queryAI = queryAI;
