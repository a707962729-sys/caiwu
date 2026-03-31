/**
 * Session Manager - QQ用户维度的会话持久化
 * 每个QQ用户（sender_id）独立会话，会话历史持久化到本地JSON文件
 */
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const SESSIONS_DIR = path.join('/Users/mac/caiwu/data', 'sessions');
const MAX_HISTORY = 50;        // 单会话最大消息数
const MAX_LONG_TERM = 200;     // 长期记忆最大条数
const SESSION_TTL_HOURS = 72;  // 会话有效期（小时）

// 确保目录存在
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

class SessionManager {
  /**
   * 获取或创建会话
   * @param {string} senderId - QQ用户ID
   * @returns {object} session对象
   */
  getSession(senderId) {
    const filePath = this._getSessionFile(senderId);
    const now = Date.now();

    let session = {
      senderId,
      createdAt: now,
      updatedAt: now,
      messages: [],          // 短期会话历史
      longTermMemory: [],     // 长期记忆
      metadata: {
        name: senderId,
        firstSeen: now,
        totalMessages: 0
      }
    };

    if (fs.existsSync(filePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        // 检查是否过期
        const ageHours = (now - raw.updatedAt) / 1000 / 3600;
        if (ageHours < SESSION_TTL_HOURS) {
          session = raw;
        } else {
          logger.info(`[Session] Session expired for ${senderId}, creating new`);
        }
      } catch (e) {
        logger.warn(`[Session] Failed to load session ${senderId}:`, e.message);
      }
    }

    session.updatedAt = now;
    return session;
  }

  /**
   * 保存会话到磁盘
   * @param {object} session
   */
  saveSession(session) {
    const filePath = this._getSessionFile(session.senderId);
    try {
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
    } catch (e) {
      logger.error(`[Session] Failed to save session ${session.senderId}:`, e.message);
    }
  }

  /**
   * 添加用户消息到会话
   * @param {string} senderId
   * @param {string|object} content - 消息内容（文本或对象）
   * @param {string} role - 角色 user|assistant|system|tool
   */
  addMessage(senderId, content, role = 'user') {
    const session = this.getSession(senderId);

    const msg = {
      role,
      content: typeof content === 'string' ? content : JSON.stringify(content),
      timestamp: Date.now()
    };

    session.messages.push(msg);
    session.metadata.totalMessages++;

    // 截断超长历史
    if (session.messages.length > MAX_HISTORY) {
      // 把最早的1/3条移入长期记忆（只保留关键内容）
      const toPromote = session.messages.splice(0, Math.floor(MAX_HISTORY / 3));
      for (const m of toPromote) {
        if (m.content && m.content.length > 20) {
          this._addLongTermMemory(session, {
            role: m.role,
            summary: m.content.substring(0, 100),
            timestamp: m.timestamp
          });
        }
      }
    }

    this.saveSession(session);
    return session;
  }

  /**
   * 添加长期记忆
   */
  _addLongTermMemory(session, item) {
    session.longTermMemory = session.longTermMemory.filter(m => m.summary !== item.summary);
    session.longTermMemory.push(item);
    if (session.longTermMemory.length > MAX_LONG_TERM) {
      session.longTermMemory = session.longTermMemory.slice(-MAX_LONG_TERM);
    }
  }

  /**
   * 获取会话历史（用于 LLM 对话）
   * @param {string} senderId
   * @param {number} limit - 最大返回条数
   * @returns {Array} 消息列表
   */
  getHistory(senderId, limit = 20) {
    const session = this.getSession(senderId);
    const history = session.messages.slice(-limit);

    // 如果有长期记忆，附加在前面
    if (session.longTermMemory.length > 0 && history.length < limit) {
      const memorySummary = this._summarizeMemory(session.longTermMemory);
      if (memorySummary) {
        history.unshift({
          role: 'system',
          content: `【用户背景记忆】${memorySummary}`
        });
      }
    }

    return history;
  }

  /**
   * 生成长期记忆摘要
   */
  _summarizeMemory(memories) {
    if (!memories || memories.length === 0) return '';
    const recent = memories.slice(-10);
    return recent.map(m => `[${m.role}] ${m.summary}`).join(' | ');
  }

  /**
   * 存储关键信息到长期记忆
   * @param {string} senderId
   * @param {string} key - 记忆键
   * @param {any} value - 记忆值
   */
  remember(senderId, key, value) {
    const session = this.getSession(senderId);
    this._addLongTermMemory(session, {
      role: 'system',
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
      timestamp: Date.now()
    });
    this.saveSession(session);
  }

  /**
   * 检索长期记忆
   * @param {string} senderId
   * @param {string} keyword - 关键词
   */
  recall(senderId, keyword) {
    const session = this.getSession(senderId);
    return session.longTermMemory.filter(m =>
      (m.key && m.key.includes(keyword)) ||
      (m.summary && m.summary.includes(keyword)) ||
      (m.value && m.value.includes(keyword))
    );
  }

  /**
   * 清除会话历史（保留长期记忆）
   * @param {string} senderId
   */
  clearHistory(senderId) {
    const session = this.getSession(senderId);
    session.messages = [];
    session.updatedAt = Date.now();
    this.saveSession(session);
  }

  /**
   * 获取所有活跃会话
   */
  listActiveSessions() {
    if (!fs.existsSync(SESSIONS_DIR)) return [];
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
    const now = Date.now();
    return files.map(f => {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8'));
        return {
          senderId: raw.senderId,
          updatedAt: raw.updatedAt,
          messageCount: raw.messages.length,
          totalMessages: raw.metadata.totalMessages
        };
      } catch (e) { return null; }
    }).filter(Boolean);
  }

  _getSessionFile(senderId) {
    // sanitize senderId for filesystem
    const safe = String(senderId).replace(/[^a-zA-Z0-9_\-]/g, '_');
    return path.join(SESSIONS_DIR, `session_${safe}.json`);
  }
}

module.exports = new SessionManager();
