const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { validate, paginationSchema } = require('../middleware/validation');
const Joi = require('joi');

router.use(authMiddleware);

const accountSchemas = {
  create: Joi.object({
    name: Joi.string().max(100).required(),
    account_type: Joi.string().max(50),
    account_no: Joi.string().max(50),
    balance: Joi.number().min(0).default(0),
    status: Joi.string().valid('active', 'inactive').default('active')
  }),
  update: Joi.object({
    name: Joi.string().max(100),
    account_type: Joi.string().max(50),
    account_no: Joi.string().max(50),
    balance: Joi.number().min(0),
    status: Joi.string().valid('active', 'inactive')
  })
};

/**
 * @route   GET /api/accounts
 * @desc    获取账户列表
 */
router.get('/',
  permissionMiddleware('accounts', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, account_type, status, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;

    let whereClause = 'WHERE company_id = ?';
    const params = [companyId];

    if (search) {
      whereClause += ' AND (name LIKE ? OR account_no LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (account_type) {
      whereClause += ' AND account_type = ?';
      params.push(account_type);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM accounts ${whereClause}`).get(...params);

    const allowedSortFields = ['id', 'name', 'account_type', 'account_no', 'balance', 'status', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const offset = (page - 1) * pageSize;
    const accounts = db.prepare(`
      SELECT * FROM accounts ${whereClause}
      ORDER BY ${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: accounts,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/accounts/:id
 * @desc    获取账户详情
 */
router.get('/:id',
  permissionMiddleware('accounts', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '账户不存在' });
    }
    res.json({ success: true, data: account });
  })
);

/**
 * @route   POST /api/accounts
 * @desc    创建账户
 */
router.post('/',
  permissionMiddleware('accounts', 'create'),
  validate(accountSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { name, account_type, account_no, balance, status } = req.body;
    const companyId = req.user.companyId;

    const result = db.prepare(`
      INSERT INTO accounts (company_id, name, account_type, account_no, balance, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(companyId, name, account_type || null, account_no || null, balance || 0, status || 'active');

    const newAccount = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: newAccount, message: '账户创建成功' });
  })
);

/**
 * @route   PUT /api/accounts/:id
 * @desc    更新账户
 */
router.put('/:id',
  permissionMiddleware('accounts', 'update'),
  validate(accountSchemas.update),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const existing = db.prepare('SELECT id FROM accounts WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '账户不存在' });
    }

    const { name, account_type, account_no, balance, status } = req.body;
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (account_type !== undefined) { fields.push('account_type = ?'); values.push(account_type); }
    if (account_no !== undefined) { fields.push('account_no = ?'); values.push(account_no); }
    if (balance !== undefined) { fields.push('balance = ?'); values.push(balance); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }

    if (fields.length > 0) {
      values.push(req.params.id, req.user.companyId);
      db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ? AND company_id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated, message: '账户更新成功' });
  })
);

/**
 * @route   DELETE /api/accounts/:id
 * @desc    删除账户
 */
router.delete('/:id',
  permissionMiddleware('accounts', 'delete'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const existing = db.prepare('SELECT id FROM accounts WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '账户不存在' });
    }
    db.prepare('DELETE FROM accounts WHERE id = ? AND company_id = ?').run(req.params.id, req.user.companyId);
    res.json({ success: true, message: '账户删除成功' });
  })
);

module.exports = router;
