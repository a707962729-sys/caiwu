const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');

// Simple mutex lock to prevent race condition in quotation number generation
let quotationLock = Promise.resolve();
function acquireQuotationLock() {
  let release;
  const p = new Promise(resolve => { release = resolve; });
  quotationLock = quotationLock.then(() => p).catch(() => p);
  return release;
}

router.use(authMiddleware);

/**
 * @route   GET /api/quotations/info
 * @desc    获取报价单端点信息
 */
router.get('/info',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: {
        endpoints: [
          { path: '/', method: 'GET', desc: '获取报价单列表' },
          { path: '/', method: 'POST', desc: '创建报价单' },
          { path: '/:id/convert', method: 'POST', desc: '转为订单' }
        ]
      }
    });
  })
);


// 获取报价单列表
router.get('/', permissionMiddleware('sales', 'read'), asyncHandler(async (req, res) => {
  const db = getDatabaseCompat();
  const { page = 1, pageSize = 20, status } = req.query;
  const companyId = req.user.companyId;
  
  let where = 'WHERE q.company_id = ?';
  const params = [companyId];
  if (status) { where += ' AND q.status = ?'; params.push(status); }
  
  const countResult = db.prepare(`SELECT COUNT(*) as total FROM quotations q ${where}`).get(...params);
  const list = db.prepare(`
    SELECT q.*, c.name as customer_name 
    FROM quotations q 
    LEFT JOIN customers c ON q.customer_id = c.id 
    ${where} ORDER BY q.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, pageSize, (page - 1) * pageSize);
  
  res.json({ success: true, data: { list, pagination: { page, pageSize, total: countResult.total } } });
}));

// 创建报价单
router.post('/', permissionMiddleware('sales', 'write'), asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;

  // Acquire lock to ensure read-max + insert is atomic (prevents race condition)
  const release = await acquireQuotationLock();
  try {
    const db = getDatabaseCompat();
    const today = dayjs().format('YYYYMMDD');
    const prefix = `QT${today}`;
    const result = db.prepare(`
      SELECT MAX(number) as max_no FROM quotations
      WHERE company_id = ? AND number LIKE ?
    `).get(companyId, `${prefix}%`);
    let seq = 1;
    if (result && result.max_no) {
      seq = parseInt(result.max_no.slice(-4)) + 1;
    }
    const quotationNo = `${prefix}${seq.toString().padStart(4, '0')}`;
    const insertResult = db.prepare(`
      INSERT INTO quotations (company_id, number, customer_id, amount, status, valid_until, created_by)
      VALUES (?, ?, ?, ?, 'draft', ?, ?)
    `).run(companyId, quotationNo, req.body.customer_id, req.body.amount || 0,
      req.body.valid_until || dayjs().add(30, 'day').format('YYYY-MM-DD'), req.user.id);

    res.json({ success: true, data: { id: insertResult.lastInsertRowid, number: quotationNo } });
  } finally {
    release();
  }
}));

// 转为订单
router.post('/:id/convert', permissionMiddleware('sales', 'write'), asyncHandler(async (req, res) => {
  const db = getDatabaseCompat();
  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.companyId);
  if (!quotation) throw ErrorTypes.NotFound('报价单');
  
  // 创建订单
  const orderNo = `SO${dayjs().format('YYYYMMDD')}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  db.prepare(`
    INSERT INTO orders (company_id, order_no, name, order_type, partner_id, amount, amount, status, created_by)
    VALUES (?, ?, ?, 'sales', ?, ?, ?, 'pending', ?)
  `).run(req.user.companyId, orderNo, `报价单${quotation.number}转订单`, 
    quotation.customer_id, quotation.amount, quotation.amount, req.user.id);
  
  // 更新报价单状态
  db.prepare("UPDATE quotations SET status = 'converted' WHERE id = ?").run(req.params.id);
  
  res.json({ success: true, data: { order_no: orderNo } });
}));

module.exports = router;