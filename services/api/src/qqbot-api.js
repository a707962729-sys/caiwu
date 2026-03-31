/**
 * QQ 机器人 API - Token 管理和消息发送
 * 基于 QQ 开放平台规范
 */

const API_BASE = 'https://api.sgroup.qq.com';
const TOKEN_URL = 'https://bots.qq.com/app/getAppAccessToken';

// Token 缓存（按 appId 隔离）
const tokenCacheMap = new Map();
const tokenFetchPromises = new Map();

/**
 * 获取 AccessToken（带缓存 + singleflight 并发安全）
 */
async function getAccessToken(appId, clientSecret) {
  const normalizedAppId = String(appId).trim();
  const cachedToken = tokenCacheMap.get(normalizedAppId);

  // 提前刷新：取 expiresIn 的 1/3 和 5 分钟的较小值
  const REFRESH_AHEAD_MS = cachedToken
    ? Math.min(5 * 60 * 1000, (cachedToken.expiresAt - Date.now()) / 3)
    : 0;

  if (cachedToken && Date.now() < cachedToken.expiresAt - REFRESH_AHEAD_MS) {
    return cachedToken.token;
  }

  // Singleflight
  let fetchPromise = tokenFetchPromises.get(normalizedAppId);
  if (fetchPromise) {
    console.log(`[qqbot-api] Token fetch in progress, waiting...`);
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      return await doFetchToken(normalizedAppId, clientSecret);
    } finally {
      tokenFetchPromises.delete(normalizedAppId);
    }
  })();
  tokenFetchPromises.set(normalizedAppId, fetchPromise);
  return fetchPromise;
}

async function doFetchToken(appId, clientSecret) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, clientSecret }),
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Failed to get access_token: ${JSON.stringify(data)}`);
  }

  const expiresAt = Date.now() + (data.expires_in ?? 7200) * 1000;
  tokenCacheMap.set(appId, { token: data.access_token, expiresAt });
  console.log(`[qqbot-api] Token cached, expires at: ${new Date(expiresAt).toISOString()}`);
  return data.access_token;
}

/**
 * 清除 Token 缓存
 */
function clearTokenCache(appId) {
  if (appId) {
    tokenCacheMap.delete(String(appId).trim());
  } else {
    tokenCacheMap.clear();
  }
}

/**
 * 获取下一个消息序号（范围 0~65535）
 */
function getNextMsgSeq(_msgId) {
  const timePart = Date.now() % 100000000;
  const random = Math.floor(Math.random() * 65536);
  return (timePart ^ random) % 65536;
}

/**
 * API 请求封装
 */
async function apiRequest(accessToken, method, path, body, timeoutMs = 30000) {
  const url = `${API_BASE}${path}`;
  const headers = {
    Authorization: `QQBot ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const options = { method, headers, signal: controller.signal };
  if (body) options.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timeout[${path}]: exceeded ${timeoutMs}ms`);
    }
    throw new Error(`Network error [${path}]: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  const rawBody = await res.text();

  if (!res.ok) {
    throw new Error(`API Error [${path}] HTTP ${res.status}: ${rawBody.slice(0, 200)}`);
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error(`Invalid JSON response [${path}]: ${rawBody.slice(0, 100)}`);
  }
}

/**
 * 带 token 过期重试的消息发送
 */
async function sendWithTokenRetry(appId, clientSecret, sendFn, accountId) {
  try {
    const token = await getAccessToken(appId, clientSecret);
    return await sendFn(token);
  } catch (err) {
    const errMsg = String(err);
    if (errMsg.includes('401') || errMsg.includes('token') || errMsg.includes('access_token')) {
      console.log(`[qqbot-api] Token may be expired, refreshing...`);
      clearTokenCache(appId);
      const newToken = await getAccessToken(appId, clientSecret);
      return await sendFn(newToken);
    }
    throw err;
  }
}

// ==================== 消息发送 ====================

/**
 * 发送 C2C（私聊）消息
 * @param openid - 用户 openid
 * @param content - 消息内容
 * @param msgId - 被回复的消息 ID（可选，用于回复特定消息）
 */
async function sendC2CMessage(accessToken, openid, content, msgId) {
  const msgSeq = msgId ? getNextMsgSeq(msgId) : 1;
  const body = {
    content,
    msg_type: 0,
    msg_seq: msgSeq,
    ...(msgId ? { msg_id: msgId } : {}),
  };
  return apiRequest(accessToken, 'POST', `/v2/users/${openid}/messages`, body);
}

/**
 * 发送频道文字子频道消息
 * @param channelId - 子频道 ID
 * @param content - 消息内容
 * @param msgId - 被回复的消息 ID（可选）
 */
async function sendChannelMessage(accessToken, channelId, content, msgId) {
  const body = {
    content,
    ...(msgId ? { msg_id: msgId } : {}),
  };
  return apiRequest(accessToken, 'POST', `/channels/${channelId}/messages`, body);
}

// ==================== 对外接口 ====================

/**
 * 发送 QQ 机器人回复（兼容原函数签名）
 * @param content - 消息内容
 * @param targets - 目标信息 { openId, guildId, channelId, messageType, messageId }
 * @param config - QQ 机器人配置 { app_id, app_secret }
 */
async function sendQQBotReply(content, targets, config) {
  const { app_id: appId, app_secret: clientSecret } = config;
  if (!appId || !clientSecret) {
    console.error('[QQBot] Missing app_id or app_secret in config');
    return { success: false, error: 'Missing app_id or app_secret' };
  }

  try {
    return await sendWithTokenRetry(appId, clientSecret, async (token) => {
      // 优先发送频道消息（来自频道/群组的回调）
      if (targets.channelId) {
        console.log(`[QQBot] Sending channel message to channelId=${targets.channelId}`);
        const result = await sendChannelMessage(token, targets.channelId, content, targets.messageId);
        console.log(`[QQBot] Channel message sent:`, JSON.stringify(result));
        return { success: true, result };
      }

      // 发送 C2C 私聊消息
      if (targets.openId) {
        console.log(`[QQBot] Sending C2C message to openId=${targets.openId}`);
        const result = await sendC2CMessage(token, targets.openId, content, targets.messageId);
        console.log(`[QQBot] C2C message sent:`, JSON.stringify(result));
        return { success: true, result };
      }

      console.warn('[QQBot] No valid target (channelId or openId) found');
      return { success: false, error: 'No valid target' };
    }, appId);

  } catch (error) {
    console.error('[QQBot] Error sending reply:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 下载文件（通过 file_id 获取原文件）
 * @param accessToken - QQ Bot access token
 * @param fileId - 文件 ID（从 attachment.file_id 获取）
 * @returns {Buffer} 文件内容
 */
async function getFileById(accessToken, fileId) {
  const response = await fetch(`${API_BASE}/v2/files/${fileId}`, {
    method: 'GET',
    headers: { 'Authorization': `QQBot ${accessToken}` }
  });
  if (!response.ok) {
    throw new Error(`getFile failed: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = {
  sendQQBotReply,
  getAccessToken,
  clearTokenCache,
  getFileById,
};
