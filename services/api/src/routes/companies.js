const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');

// 所有路由都需要认证
router.use(authMiddleware);

/**
 * @route   GET /api/companies/current
 * @desc    获取当前用户的公司信息
 * @access  Private
 */
router.get('/current',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    if (!companyId) {
      throw ErrorTypes.NotFound('用户未关联公司');
    }
    
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
    if (!company) {
      throw ErrorTypes.NotFound('公司不存在');
    }
    
    res.json({ success: true, data: company });
  })
);

/**
 * @route   PUT /api/companies/current
 * @desc    更新当前用户的公司信息
 * @access  Private (Boss)
 */
router.put('/current',
  roleMiddleware('boss'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    if (!companyId) {
      throw ErrorTypes.NotFound('用户未关联公司');
    }
    
    const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
    if (!existing) {
      throw ErrorTypes.NotFound('公司不存在');
    }
    
    const { name, tax_id, tax_number, short_name, address, phone, email, bank_name, bank_account, logo, invoice_header, remark } = req.body;
    
    // 构建更新字段
    const updates = [];
    const values = [];
    
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (tax_id !== undefined) { updates.push('tax_id = ?'); values.push(tax_id); }
    if (tax_number !== undefined) { updates.push('tax_id = ?'); values.push(tax_number); }
    if (short_name !== undefined) { updates.push('short_name = ?'); values.push(short_name); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (bank_name !== undefined) { updates.push('bank_name = ?'); values.push(bank_name); }
    if (bank_account !== undefined) { updates.push('bank_account = ?'); values.push(bank_account); }
    if (logo !== undefined) { updates.push('logo = ?'); values.push(logo); }
    if (invoice_header !== undefined) { updates.push('invoice_header = ?'); values.push(invoice_header); }
    if (remark !== undefined) { updates.push('remark = ?'); values.push(remark); }
    
    if (updates.length > 0) {
      values.push(companyId);
      db.prepare(`UPDATE companies SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
    res.json({ success: true, data: company, message: '公司信息更新成功' });
  })
);

/**
 * @route   GET /api/companies
 * @desc    获取公司列表
 * @access  Private (Admin)
 */
router.get('/',
  roleMiddleware('boss', 'accountant'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companies = db.prepare('SELECT * FROM companies ORDER BY created_at DESC').all();
    res.json({ success: true, data: companies });
  })
);

/**
 * @route   GET /api/companies/:id
 * @desc    获取单个公司
 * @access  Private
 */
router.get('/:id',
  validateId(),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    if (!company) {
      throw ErrorTypes.NotFound('公司不存在');
    }
    res.json({ success: true, data: company });
  })
);

/**
 * @route   POST /api/companies
 * @desc    创建公司
 * @access  Private (Admin)
 */
router.post('/',
  roleMiddleware('boss'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { name, tax_id } = req.body;
    
    if (!name) {
      throw ErrorTypes.ValidationError('公司名称不能为空');
    }
    
    const result = db.prepare('INSERT INTO companies (name, tax_id) VALUES (?, ?)').run(name, tax_id || null);
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, data: company });
  })
);

/**
 * @route   PUT /api/companies/:id
 * @desc    更新公司
 * @access  Private (Admin)
 */
router.put('/:id',
  roleMiddleware('boss'),
  validateId(),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { name, tax_id } = req.body;
    
    const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    if (!existing) {
      throw ErrorTypes.NotFound('公司不存在');
    }
    
    db.prepare('UPDATE companies SET name = ?, tax_id = ? WHERE id = ?').run(
      name || existing.name,
      tax_id !== undefined ? tax_id : existing.tax_id,
      req.params.id
    );
    
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: company });
  })
);

/**
 * @route   DELETE /api/companies/:id
 * @desc    删除公司
 * @access  Private (Admin)
 */
router.delete('/:id',
  roleMiddleware('boss'),
  validateId(),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    if (!existing) {
      throw ErrorTypes.NotFound('公司不存在');
    }
    
    db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '公司已删除' });
  })
);

module.exports = router;