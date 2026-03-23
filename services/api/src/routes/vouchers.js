const express = require('express');
const router = express.Router();
const { getDatabaseCompat, saveDatabase } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const Joi = require('joi');

router.use(authMiddleware);

const voucherSchemas = {
  create: Joi.object({
    voucher_no: Joi.string().max(50).allow('', null),
    voucher_date: Joi.date().iso().required(),
    voucher_type: Joi.string().valid('general', 'receipt', 'payment', 'transfer').default('general'),
    description: Joi.string().allow(''),
    reference_no: Joi.string().max(100).allow(''),
    reference_type: Joi.string().max(50).allow(''),
    reference_id: Joi.number().integer().positive().allow(null),
    notes: Joi.string().allow(''),
    entries: Joi.array().min(2).items(Joi.object({
      subject_id: Joi.number().integer().positive().required(),
      subject_code: Joi.string().max(50).allow(''),
      subject_name: Joi.string().max(100).allow(''),
      description: Joi.string().allow(''),
      debit_amount: Joi.number().min(0).default(0),
      credit_amount: Joi.number().min(0).default(0),
      currency: Joi.string().max(10).default('CNY'),
      exchange_rate: Joi.number().positive().default(1),
      original_amount: Joi.number().allow(null),
      quantity: Joi.number().allow(null),
      unit_price: Joi.number().allow(null),
      partner_id: Joi.number().integer().positive().allow(null),
      partner_name: Joi.string().max(100).allow(''),
      project: Joi.string().max(100).allow(''),
      department: Joi.string().max(100).allow(''),
      settlement_no: Joi.string().max(50).allow(''),
      invoice_no: Joi.string().max(50).allow(''),
      notes: Joi.string().allow('')
    })).required()
  }),
  update: Joi.object({
    voucher_date: Joi.date().iso(),
    voucher_type: Joi.string().valid('general', 'receipt', 'payment', 'transfer'),
    description: Joi.string().allow(''),
    reference_no: Joi.string().max(100).allow(''),
    reference_type: Joi.string().max(50).allow(''),
    reference_id: Joi.number().integer().positive().allow(null),
    notes: Joi.string().allow(''),
    entries: Joi.array().min(2).items(Joi.object({
      id: Joi.number().integer().positive().allow(null),
      subject_id: Joi.number().integer().positive().required(),
      subject_code: Joi.string().max(50).allow(''),
      subject_name: Joi.string().max(100).allow(''),
      description: Joi.string().allow(''),
      debit_amount: Joi.number().min(0).default(0),
      credit_amount: Joi.number().min(0).default(0),
      currency: Joi.string().max(10).default('CNY'),
      exchange_rate: Joi.number().positive().default(1),
      original_amount: Joi.number().allow(null),
      quantity: Joi.number().allow(null),
      unit_price: Joi.number().allow(null),
      partner_id: Joi.number().integer().positive().allow(null),
      partner_name: Joi.string().max(100).allow(''),
      project: Joi.string().max(100).allow(''),
      department: Joi.string().max(100).allow(''),
      settlement_no: Joi.string().max(50).allow(''),
      invoice_no: Joi.string().max(50).allow(''),
      notes: Joi.string().allow('')
    }))
  })
};

// 凭证类型映射
const voucherTypeNames = {
  general: '记账凭证',
  receipt: '收款凭证',
  payment: '付款凭证',
  transfer: '转账凭证'
};

/**
 * 生成凭证号
 */
function generateVoucherNo(db, companyId, voucherDate) {
  const year = new Date(voucherDate).getFullYear();
  const month = String(new Date(voucherDate).getMonth() + 1).padStart(2, '0');

  // 获取当月最大序号
  const result = db.prepare(`
    SELECT MAX(CAST(SUBSTR(voucher_no, -4) AS INTEGER)) as max_seq
    FROM vouchers
    WHERE company_id = ? AND period_year = ? AND period_month = ?
  `).get(companyId, year, parseInt(month));

  const seq = (result?.max_seq || 0) + 1;
  const seqStr = String(seq).padStart(4, '0');

  return `${year}${month}-${seqStr}`;
}

/**
 * 验证借贷平衡
 */
function validateBalance(entries) {
  const totalDebit = entries.reduce((sum, e) => sum + (parseFloat(e.debit_amount) || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + (parseFloat(e.credit_amount) || 0), 0);

  // 允许0.01的误差
  return Math.abs(totalDebit - totalCredit) < 0.01;
}

/**
 * @route   GET /api/vouchers
 * @desc    获取凭证列表
 */
router.get('/',
  permissionMiddleware('vouchers', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, voucher_type, status, period_year, period_month, startDate, endDate, sortBy = 'voucher_date', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;

    let whereClause = 'WHERE v.company_id = ?';
    const params = [companyId];

    if (search) {
      whereClause += ' AND (v.voucher_no LIKE ? OR v.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (voucher_type) {
      whereClause += ' AND v.voucher_type = ?';
      params.push(voucher_type);
    }

    if (status) {
      whereClause += ' AND v.status = ?';
      params.push(status);
    }

    if (period_year) {
      whereClause += ' AND v.period_year = ?';
      params.push(parseInt(period_year));
    }

    if (period_month) {
      whereClause += ' AND v.period_month = ?';
      params.push(parseInt(period_month));
    }

    if (startDate) {
      whereClause += ' AND v.voucher_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND v.voucher_date <= ?';
      params.push(endDate);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM vouchers v ${whereClause}`).get(...params);

    // SQL 注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'voucher_no', 'voucher_date', 'voucher_type', 'status', 'period_year', 'period_month', 'total_debit', 'total_credit', 'entries_count', 'created_at', 'updated_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'voucher_date';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const offset = (page - 1) * pageSize;
    const vouchers = db.prepare(`
      SELECT v.*, u.real_name as created_by_name
      FROM vouchers v
      LEFT JOIN users u ON v.created_by = u.id
      ${whereClause}
      ORDER BY v.${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: vouchers,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/vouchers/:id
 * @desc    获取凭证详情
 */
router.get('/:id',
  permissionMiddleware('vouchers', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const voucher = db.prepare(`
      SELECT v.*, u.real_name as created_by_name, p.real_name as posted_by_name
      FROM vouchers v
      LEFT JOIN users u ON v.created_by = u.id
      LEFT JOIN users p ON v.posted_by = p.id
      WHERE v.id = ? AND v.company_id = ?
    `).get(req.params.id, req.user.companyId);

    if (!voucher) {
      throw ErrorTypes.NotFound('凭证');
    }

    // 获取分录明细
    const entries = db.prepare(`
      SELECT ve.*, s.subject_code, s.subject_name as subject_name_full, s.direction
      FROM voucher_entries ve
      LEFT JOIN accounting_subjects s ON ve.subject_id = s.id
      WHERE ve.voucher_id = ?
      ORDER BY ve.entry_no ASC
    `).all(req.params.id);

    res.json({
      success: true,
      data: {
        ...voucher,
        entries
      }
    });
  })
);

/**
 * @route   POST /api/vouchers
 * @desc    创建凭证
 */
router.post('/',
  permissionMiddleware('vouchers', 'create'),
  validate(voucherSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { entries, ...voucherData } = req.body;

    // 验证借贷平衡
    if (!validateBalance(entries)) {
      throw ErrorTypes.BadRequest('凭证借贷不平衡');
    }

    // 验证每个分录至少有借或贷一方有金额
    for (const entry of entries) {
      if ((!entry.debit_amount || entry.debit_amount === 0) && (!entry.credit_amount || entry.credit_amount === 0)) {
        throw ErrorTypes.BadRequest('分录必须至少有借方或贷方金额');
      }
      if (entry.debit_amount > 0 && entry.credit_amount > 0) {
        throw ErrorTypes.BadRequest('分录不能同时有借方和贷方金额');
      }
    }

    // 批量验证科目（修复 N+1 查询）
    const subjectIds = entries.map(e => e.subject_id);
    const placeholders = subjectIds.map(() => '?').join(',');
    const subjects = db.prepare(
      `SELECT * FROM accounting_subjects WHERE id IN (${placeholders}) AND company_id = ?`
    ).all(...subjectIds, companyId);

    const subjectMap = new Map(subjects.map(s => [s.id, s]));

    for (const entry of entries) {
      const subject = subjectMap.get(entry.subject_id);
      if (!subject) {
        throw ErrorTypes.NotFound(`科目ID ${entry.subject_id}`);
      }
      // 填充科目信息
      entry.subject_code = subject.subject_code;
      entry.subject_name = subject.subject_name;
    }

    // 生成凭证号
    const voucherNo = voucherData.voucher_no || generateVoucherNo(db, companyId, voucherData.voucher_date);

    // 检查凭证号是否重复
    const existing = db.prepare('SELECT id FROM vouchers WHERE company_id = ? AND voucher_no = ?').get(companyId, voucherNo);
    if (existing) {
      throw ErrorTypes.DuplicateEntry('凭证号');
    }

    const voucherDate = new Date(voucherData.voucher_date);
    const periodYear = voucherDate.getFullYear();
    const periodMonth = voucherDate.getMonth() + 1;

    // 计算合计金额
    const totalDebit = entries.reduce((sum, e) => sum + (parseFloat(e.debit_amount) || 0), 0);
    const totalCredit = entries.reduce((sum, e) => sum + (parseFloat(e.credit_amount) || 0), 0);

    // 插入凭证
    const result = db.prepare(`
      INSERT INTO vouchers (
        company_id, voucher_no, voucher_date, period_year, period_month, voucher_type,
        description, total_debit, total_credit, entries_count, reference_no, reference_type,
        reference_id, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, voucherNo, voucherData.voucher_date, periodYear, periodMonth, voucherData.voucher_type,
      voucherData.description || null, totalDebit, totalCredit, entries.length,
      voucherData.reference_no || null, voucherData.reference_type || null,
      voucherData.reference_id || null, voucherData.notes || null, req.user.id
    );

    const voucherId = result.lastInsertRowid;

    // 插入分录
    const insertEntry = db.prepare(`
      INSERT INTO voucher_entries (
        company_id, voucher_id, entry_no, subject_id, subject_code, subject_name,
        description, debit_amount, credit_amount, currency, exchange_rate, original_amount,
        quantity, unit_price, partner_id, partner_name, project, department,
        settlement_no, invoice_no, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      insertEntry.run(
        companyId, voucherId, i + 1, entry.subject_id, entry.subject_code, entry.subject_name,
        entry.description || null, entry.debit_amount || 0, entry.credit_amount || 0,
        entry.currency || 'CNY', entry.exchange_rate || 1, entry.original_amount || null,
        entry.quantity || null, entry.unit_price || null, entry.partner_id || null,
        entry.partner_name || null, entry.project || null, entry.department || null,
        entry.settlement_no || null, entry.invoice_no || null, entry.notes || null
      );
    }

    const newVoucher = db.prepare('SELECT * FROM vouchers WHERE id = ?').get(voucherId);

    res.status(201).json({ success: true, data: newVoucher, message: '凭证创建成功' });
  })
);

/**
 * @route   PUT /api/vouchers/:id
 * @desc    更新凭证
 */
router.put('/:id',
  permissionMiddleware('vouchers', 'update'),
  validateId('id'),
  validate(voucherSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { entries, ...voucherData } = req.body;

    const voucher = db.prepare('SELECT * FROM vouchers WHERE id = ? AND company_id = ?').get(id, companyId);
    if (!voucher) {
      throw ErrorTypes.NotFound('凭证');
    }

    // 已过账的凭证不能修改
    if (voucher.status === 'posted') {
      throw ErrorTypes.BadRequest('已过账的凭证不能修改');
    }

    // 如果有分录数据，验证并更新
    if (entries && entries.length > 0) {
      // 验证借贷平衡
      if (!validateBalance(entries)) {
        throw ErrorTypes.BadRequest('凭证借贷不平衡');
      }

      // 批量验证科目（修复 N+1 查询）
      const subjectIds = entries.map(e => e.subject_id);
      const placeholders = subjectIds.map(() => '?').join(',');
      const subjects = db.prepare(
        `SELECT * FROM accounting_subjects WHERE id IN (${placeholders}) AND company_id = ?`
      ).all(...subjectIds, companyId);

      const subjectMap = new Map(subjects.map(s => [s.id, s]));

      for (const entry of entries) {
        const subject = subjectMap.get(entry.subject_id);
        if (!subject) {
          throw ErrorTypes.NotFound(`科目ID ${entry.subject_id}`);
        }
        entry.subject_code = subject.subject_code;
        entry.subject_name = subject.subject_name;
      }

      // 删除原有分录
      db.prepare('DELETE FROM voucher_entries WHERE voucher_id = ?').run(id);

      // 插入新分录
      const insertEntry = db.prepare(`
        INSERT INTO voucher_entries (
          company_id, voucher_id, entry_no, subject_id, subject_code, subject_name,
          description, debit_amount, credit_amount, currency, exchange_rate, original_amount,
          quantity, unit_price, partner_id, partner_name, project, department,
          settlement_no, invoice_no, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        insertEntry.run(
          companyId, parseInt(id), i + 1, entry.subject_id, entry.subject_code, entry.subject_name,
          entry.description || null, entry.debit_amount || 0, entry.credit_amount || 0,
          entry.currency || 'CNY', entry.exchange_rate || 1, entry.original_amount || null,
          entry.quantity || null, entry.unit_price || null, entry.partner_id || null,
          entry.partner_name || null, entry.project || null, entry.department || null,
          entry.settlement_no || null, entry.invoice_no || null, entry.notes || null
        );
      }

      // 更新凭证合计
      const totalDebit = entries.reduce((sum, e) => sum + (parseFloat(e.debit_amount) || 0), 0);
      const totalCredit = entries.reduce((sum, e) => sum + (parseFloat(e.credit_amount) || 0), 0);

      db.prepare(`
        UPDATE vouchers SET 
          total_debit = ?, total_credit = ?, entries_count = ?
          ${voucherData.voucher_date ? ', voucher_date = ?, period_year = ?, period_month = ?' : ''}
          ${voucherData.voucher_type ? ', voucher_type = ?' : ''}
          ${voucherData.description !== undefined ? ', description = ?' : ''}
          ${voucherData.reference_no !== undefined ? ', reference_no = ?' : ''}
          ${voucherData.notes !== undefined ? ', notes = ?' : ''}
        WHERE id = ?
      `).run(
        totalDebit, totalCredit, entries.length,
        ...(voucherData.voucher_date ? [voucherData.voucher_date, new Date(voucherData.voucher_date).getFullYear(), new Date(voucherData.voucher_date).getMonth() + 1] : []),
        ...(voucherData.voucher_type ? [voucherData.voucher_type] : []),
        ...(voucherData.description !== undefined ? [voucherData.description || null] : []),
        ...(voucherData.reference_no !== undefined ? [voucherData.reference_no || null] : []),
        ...(voucherData.notes !== undefined ? [voucherData.notes || null] : []),
        parseInt(id)
      );
    } else {
      // 只更新凭证基本信息
      const updates = [];
      const values = [];
      const allowedFields = ['voucher_date', 'voucher_type', 'description', 'reference_no', 'reference_type', 'reference_id', 'notes'];

      for (const [key, value] of Object.entries(voucherData)) {
        if (allowedFields.includes(key) && value !== undefined) {
          if (key === 'voucher_date') {
            updates.push('voucher_date = ?, period_year = ?, period_month = ?');
            values.push(value, new Date(value).getFullYear(), new Date(value).getMonth() + 1);
          } else {
            updates.push(`${key} = ?`);
            values.push(value || null);
          }
        }
      }

      if (updates.length > 0) {
        values.push(parseInt(id));
        db.prepare(`UPDATE vouchers SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }
    }

    res.json({ success: true, message: '凭证更新成功' });
  })
);

/**
 * @route   POST /api/vouchers/:id/post
 * @desc    过账凭证
 */
router.post('/:id/post',
  permissionMiddleware('vouchers', 'update'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const voucher = db.prepare('SELECT * FROM vouchers WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!voucher) {
      throw ErrorTypes.NotFound('凭证');
    }

    if (voucher.status !== 'draft') {
      throw ErrorTypes.BadRequest('只有草稿状态的凭证可以过账');
    }

    // 更新凭证状态
    db.prepare(`
      UPDATE vouchers SET status = 'posted', posted_by = ?, posted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user.id, req.params.id);

    // 更新科目余额（修复 N+1 查询）
    const entries = db.prepare('SELECT * FROM voucher_entries WHERE voucher_id = ?').all(req.params.id);

    // 批量获取科目
    const subjectIds = [...new Set(entries.map(e => e.subject_id))];
    const placeholders = subjectIds.map(() => '?').join(',');
    const subjects = db.prepare(
      `SELECT * FROM accounting_subjects WHERE id IN (${placeholders})`
    ).all(...subjectIds);
    const subjectMap = new Map(subjects.map(s => [s.id, s]));

    // 计算每个科目的余额变化
    const balanceChanges = new Map();
    for (const entry of entries) {
      const subject = subjectMap.get(entry.subject_id);
      if (subject) {
        if (!balanceChanges.has(entry.subject_id)) {
          balanceChanges.set(entry.subject_id, { current: parseFloat(subject.balance) || 0, direction: subject.direction, change: 0 });
        }
        const change = balanceChanges.get(entry.subject_id);
        if (subject.direction === 'debit') {
          change.change += (parseFloat(entry.debit_amount) || 0) - (parseFloat(entry.credit_amount) || 0);
        } else {
          change.change += (parseFloat(entry.credit_amount) || 0) - (parseFloat(entry.debit_amount) || 0);
        }
      }
    }

    // 批量更新余额
    const updateBalance = db.prepare('UPDATE accounting_subjects SET balance = ? WHERE id = ?');
    for (const [subjectId, data] of balanceChanges) {
      updateBalance.run(data.current + data.change, subjectId);
    }

    res.json({ success: true, message: '凭证已过账' });
  })
);

/**
 * @route   POST /api/vouchers/:id/void
 * @desc    作废凭证
 */
router.post('/:id/void',
  permissionMiddleware('vouchers', 'update'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { void_reason } = req.body;

    const voucher = db.prepare('SELECT * FROM vouchers WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!voucher) {
      throw ErrorTypes.NotFound('凭证');
    }

    if (voucher.status === 'voided') {
      throw ErrorTypes.BadRequest('凭证已作废');
    }

    // 如果是已过账凭证，需要冲回科目余额（修复 N+1 查询）
    if (voucher.status === 'posted') {
      const entries = db.prepare('SELECT * FROM voucher_entries WHERE voucher_id = ?').all(req.params.id);

      // 批量获取科目
      const subjectIds = [...new Set(entries.map(e => e.subject_id))];
      const placeholders = subjectIds.map(() => '?').join(',');
      const subjects = db.prepare(
        `SELECT * FROM accounting_subjects WHERE id IN (${placeholders})`
      ).all(...subjectIds);
      const subjectMap = new Map(subjects.map(s => [s.id, s]));

      // 计算每个科目的余额冲回
      const balanceChanges = new Map();
      for (const entry of entries) {
        const subject = subjectMap.get(entry.subject_id);
        if (subject) {
          if (!balanceChanges.has(entry.subject_id)) {
            balanceChanges.set(entry.subject_id, { current: parseFloat(subject.balance) || 0, direction: subject.direction, change: 0 });
          }
          const change = balanceChanges.get(entry.subject_id);
          // 冲回：与过账相反
          if (subject.direction === 'debit') {
            change.change -= (parseFloat(entry.debit_amount) || 0) - (parseFloat(entry.credit_amount) || 0);
          } else {
            change.change -= (parseFloat(entry.credit_amount) || 0) - (parseFloat(entry.debit_amount) || 0);
          }
        }
      }

      // 批量更新余额
      const updateBalance = db.prepare('UPDATE accounting_subjects SET balance = ? WHERE id = ?');
      for (const [subjectId, data] of balanceChanges) {
        updateBalance.run(data.current + data.change, subjectId);
      }
    }

    // 更新凭证状态
    db.prepare(`
      UPDATE vouchers SET status = 'voided', voided_by = ?, voided_at = CURRENT_TIMESTAMP, void_reason = ?
      WHERE id = ?
    `).run(req.user.id, void_reason || null, req.params.id);

    res.json({ success: true, message: '凭证已作废' });
  })
);

/**
 * @route   DELETE /api/vouchers/:id
 * @desc    删除凭证
 */
router.delete('/:id',
  permissionMiddleware('vouchers', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const voucher = db.prepare('SELECT * FROM vouchers WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!voucher) {
      throw ErrorTypes.NotFound('凭证');
    }

    // 只有草稿状态可以删除
    if (voucher.status !== 'draft') {
      throw ErrorTypes.BadRequest('只有草稿状态的凭证可以删除');
    }

    // 删除分录
    db.prepare('DELETE FROM voucher_entries WHERE voucher_id = ?').run(req.params.id);
    // 删除凭证
    db.prepare('DELETE FROM vouchers WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: '凭证已删除' });
  })
);

/**
 * @route   GET /api/vouchers/periods/available
 * @desc    获取可用会计期间
 */
router.get('/periods/available',
  permissionMiddleware('vouchers', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const periods = db.prepare(`
      SELECT DISTINCT period_year, period_month
      FROM vouchers
      WHERE company_id = ?
      ORDER BY period_year DESC, period_month DESC
    `).all(companyId);

    res.json({ success: true, data: periods });
  })
);

module.exports = router;