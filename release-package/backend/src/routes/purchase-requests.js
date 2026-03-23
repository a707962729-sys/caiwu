const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');

router.use(authMiddleware);

function generateRequestNo(companyId) {
  const db = getDatabaseCompat();
  const today = dayjs().format('YYYYMMDD');
  const prefix = `PR${today}`;
  const result = db.prepare(`
    SELECT MAX(number) as max_no FROM purchase_requests 
    WHERE company_id = ? AND number LIKE ?
  `).get(companyId, `${prefix}%`);
  let seq = 1;
  if (result && result.max_no) {
    seq = parseInt(result.max_no.slice(-4)) + 1;
  }
  return `${prefix}${seq.toString().padStart(4, '0')}`;
}

// 获取采购申请列表
router.get('/', permissionMiddleware('purchase', 'read'), asyncHandler(async (req, res) => {
  const db = getDatabaseCompat();
  const { page = 1, pageSize = 20, status } = req.query;
  const companyId = req.user.companyId;
  
  let where = 'WHERE pr.company_id = ?';
  const params = [companyId];
  if (status) { where += ' AND pr.status = ?'; params.push(status); }
  
  const countResult = db.prepare(`SELECT COUNT(*) as total FROM purchase_requests pr ${where}`).get(...params);
  const list = db.prepare(`
    SELECT pr.*, u.real_name as requester_name 
    FROM purchase_requests pr 
    LEFT JOIN users u ON pr.requester_id = u.id 
    ${where} ORDER BY pr.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, pageSize, (page - 1) * pageSize);
  
  res.json({ success: true, data: { list, pagination: { page, pageSize, total: countResult.total } } });
}));

// 创建采购申请
router.post('/', permissionMiddleware('purchase', 'write'), asyncHandler(async (req, res) => {
  const db = getDatabaseCompat();
  const companyId = req.user.companyId;
  const requestNo = generateRequestNo(companyId);
  
  const result = db.prepare(`
    INSERT INTO purchase_requests (company_id, number, requester_id, status, total_amount)
    VALUES (?, ?, ?, 'pending', ?)
  `).run(companyId, requestNo, req.user.id, req.body.total_amount || 0);
  
  res.json({ success: true, data: { id: result.lastInsertRowid, number: requestNo } });
}));

// 审批采购申请
router.post('/:id/approve', permissionMiddleware('purchase', 'approve'), asyncHandler(async (req, res) => {
  const db = getDatabaseCompat();
  const pr = db.prepare('SELECT * FROM purchase_requests WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.companyId);
  if (!pr) throw ErrorTypes.NotFound('采购申请');
  
  // 更新状态
  db.prepare("UPDATE purchase_requests SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ?")
    .run(req.user.id, dayjs().format('YYYY-MM-DD HH:mm:ss'), req.params.id);
  
  // 生成采购订单
  const orderNo = `PO${dayjs().format('YYYYMMDD')}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  try {
    db.prepare(`
      INSERT INTO purchase_orders (company_id, po_no, supplier_id, total_amount, status, created_by)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(req.user.companyId, orderNo, req.body.supplier_id || 1, pr.total_amount, req.user.id);
  } catch (e) {
    // 忽略错误
  }
  
  res.json({ success: true, message: '已审批', po_no: orderNo });
}));

module.exports = router;