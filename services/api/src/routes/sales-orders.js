const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');

router.use(authMiddleware);

// 获取销售订单统计
router.get('/stats', permissionMiddleware('sales', 'read'), asyncHandler(async (req, res) => {
  const db = getDatabaseCompat();
  const companyId = req.user.companyId;
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(total_amount) as total_amount,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders
    FROM orders
    WHERE company_id = ? AND order_type = 'sales'
  `).get(companyId);
  
  // 按状态统计
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count, SUM(total_amount) as amount
    FROM orders
    WHERE company_id = ? AND order_type = 'sales'
    GROUP BY status
  `).all(companyId);
  
  res.json({ success: true, data: { ...stats, by_status: byStatus } });
}));

// 获取销售订单列表
router.get('/', permissionMiddleware('sales', 'read'), asyncHandler(async (req, res) => {
  const db = getDatabaseCompat();
  const { page = 1, pageSize = 20, status } = req.query;
  const companyId = req.user.companyId;
  
  let where = 'WHERE o.company_id = ? AND o.order_type = ?';
  const params = [companyId, 'sales'];
  if (status) { where += ' AND o.status = ?'; params.push(status); }
  
  const countResult = db.prepare(`SELECT COUNT(*) as total FROM orders o ${where}`).get(...params);
  const list = db.prepare(`
    SELECT o.*, p.name as partner_name 
    FROM orders o 
    LEFT JOIN partners p ON o.partner_id = p.id 
    ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, pageSize, (page - 1) * pageSize);
  
  res.json({ success: true, data: { list, pagination: { page, pageSize, total: countResult.total } } });
}));

// 确认订单
router.post('/:id/confirm', permissionMiddleware('sales', 'write'), asyncHandler(async (req, res) => {
  const db = getDatabaseCompat();
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.companyId);
  if (!order) throw ErrorTypes.NotFound('订单');
  
  db.prepare("UPDATE orders SET status = 'confirmed' WHERE id = ?").run(req.params.id);
  res.json({ success: true, message: '订单已确认' });
}));

// 生成发货单
router.post('/:id/deliver', permissionMiddleware('sales', 'write'), asyncHandler(async (req, res) => {
  const db = getDatabaseCompat();
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.companyId);
  if (!order) throw ErrorTypes.NotFound('订单');
  
  const deliveryNo = `DO${dayjs().format('YYYYMMDD')}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  
  // 检查发货单表是否存在
  try {
    db.prepare(`
      INSERT INTO delivery_orders (company_id, delivery_no, order_id, status, created_by)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(req.user.companyId, deliveryNo, req.params.id, req.user.id);
    res.json({ success: true, data: { delivery_no: deliveryNo } });
  } catch (e) {
    // 表不存在，返回成功但提示
    res.json({ success: true, message: '发货单表未创建，请先运行数据库迁移', delivery_no: deliveryNo });
  }
}));

module.exports = router;