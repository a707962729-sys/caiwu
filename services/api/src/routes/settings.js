const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');

// 所有路由都需要认证
router.use(authMiddleware);

/**
 * @route   GET /api/settings
 * @desc    获取系统设置
 * @access  Private
 */
router.get('/',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId || null;
    
    const settings = db.prepare('SELECT * FROM settings WHERE company_id = ? OR company_id IS NULL').all(companyId);
    
    // 转换为键值对格式
    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });
    
    res.json({ success: true, data: settingsMap, list: settings });
  })
);

/**
 * @route   PUT /api/settings/batch
 * @desc    批量更新设置项
 * @access  Private
 */
router.put('/batch',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId || null;
    const { configs } = req.body;
    
    if (!Array.isArray(configs) || configs.length === 0) {
      throw ErrorTypes.VALIDATION_ERROR('配置项列表不能为空');
    }
    
    const results = [];
    
    for (const { key, value } of configs) {
      if (!key) continue;
      
      // 检查是否已存在
      const existing = db.prepare('SELECT * FROM settings WHERE key = ? AND (company_id = ? OR company_id IS NULL)').get(key, companyId);
      
      if (existing) {
        // 更新
        db.prepare('UPDATE settings SET value = ? WHERE id = ?').run(value, existing.id);
      } else {
        // 新建
        db.prepare('INSERT INTO settings (company_id, key, value) VALUES (?, ?, ?)').run(companyId, key, value);
      }
      
      results.push({ key, value });
    }
    
    res.json({ success: true, data: results, message: `成功更新 ${results.length} 个配置项` });
  })
);


// ==================== QQ 机器人配置 ====================

/**
 * @route   GET /api/settings/qqbot-config
 * @desc    获取 QQ 机器人配置
 */
router.get('/qqbot-config',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const rows = db.prepare('SELECT key, value FROM settings WHERE key LIKE ? AND (company_id = ? OR company_id IS NULL)')
      .all('qqbot.%', req.user.companyId || 1);
    const config = {};
    rows.forEach(r => { config[r.key.replace("qqbot.", "")] = r.value; });
    res.json({ success: true, data: config });
  })
);

/**
 * @route   PUT /api/settings/qqbot-config
 * @desc    保存 QQ 机器人配置
 */
router.put('/qqbot-config',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const cid = req.user.companyId || 1;
    const { app_id, app_secret, enabled } = req.body;
    const entries = [
      ['qqbot.app_id', app_id || ''],
      ['qqbot.app_secret', app_secret || ''],
      ['qqbot.enabled', String(enabled ?? false)],
    ];
    for (const [key, value] of entries) {
      const existing = db.prepare('SELECT id FROM settings WHERE key = ? AND (company_id = ? OR company_id IS NULL)').get(key, cid);
      if (existing) {
        db.prepare('UPDATE settings SET value = ? WHERE id = ?').run(value, existing.id);
      } else {
        db.prepare('INSERT INTO settings (company_id, key, value) VALUES (?, ?, ?)').run(cid, key, value);
      }
    }
    res.json({ success: true, message: 'QQ 机器人配置已保存' });
  })
);

/**
 * @route   GET /api/settings/:key
 * @desc    获取单个设置项
 * @access  Private
 */
router.get('/:key',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId || null;
    
    const setting = db.prepare('SELECT * FROM settings WHERE key = ? AND (company_id = ? OR company_id IS NULL)').get(req.params.key, companyId);
    if (!setting) {
      throw ErrorTypes.NOT_FOUND('设置项不存在');
    }
    
    res.json({ success: true, data: setting });
  })
);

/**
 * @route   POST /api/settings
 * @desc    创建或更新设置项（upsert）
 * @access  Private
 */
router.post('/',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId || null;
    const { key, value } = req.body;
    
    if (!key) {
      throw ErrorTypes.VALIDATION_ERROR('设置键不能为空');
    }
    
    // 检查是否已存在
    const existing = db.prepare('SELECT * FROM settings WHERE key = ? AND (company_id = ? OR company_id IS NULL)').get(key, companyId);
    
    if (existing) {
      // 更新
      db.prepare('UPDATE settings SET value = ? WHERE id = ?').run(value, existing.id);
    } else {
      // 新建
      db.prepare('INSERT INTO settings (company_id, key, value) VALUES (?, ?, ?)').run(companyId, key, value);
    }
    
    const setting = db.prepare('SELECT * FROM settings WHERE key = ? AND (company_id = ? OR company_id IS NULL)').get(key, companyId);
    res.json({ success: true, data: setting });
  })
);

/**
 * @route   PUT /api/settings/:key
 * @desc    更新设置项
 * @access  Private
 */
router.put('/:key',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId || null;
    const { value } = req.body;
    
    const existing = db.prepare('SELECT * FROM settings WHERE key = ? AND (company_id = ? OR company_id IS NULL)').get(req.params.key, companyId);
    if (!existing) {
      throw ErrorTypes.NOT_FOUND('设置项不存在');
    }
    
    db.prepare('UPDATE settings SET value = ? WHERE id = ?').run(value, existing.id);
    const setting = db.prepare('SELECT * FROM settings WHERE id = ?').get(existing.id);
    
    res.json({ success: true, data: setting });
  })
);

/**
 * @route   DELETE /api/settings/:key
 * @desc    删除设置项
 * @access  Private
 */
router.delete('/:key',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId || null;
    
    const existing = db.prepare('SELECT * FROM settings WHERE key = ? AND (company_id = ? OR company_id IS NULL)').get(req.params.key, companyId);
    if (!existing) {
      throw ErrorTypes.NOT_FOUND('设置项不存在');
    }
    
    db.prepare('DELETE FROM settings WHERE id = ?').run(existing.id);
    res.json({ success: true, message: '设置项已删除' });
  })
);

module.exports = router;
