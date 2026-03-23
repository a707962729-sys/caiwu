const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const Joi = require('joi');

router.use(authMiddleware);

const receiptSchemas = {
  create: Joi.object({
    receipt_no: Joi.string().max(50).required(),
    po_id: Joi.number().integer().required(),
    warehouse_id: Joi.number().integer().allow(null),
    receipt_date: Joi.date().required(),
    quality_status: Joi.string().valid('qualified', 'partial_qualified', 'unqualified').default('qualified'),
    warehouse_location: Joi.string().max(100).allow(''),
    delivery_person: Joi.string().max(50).allow(''),
    delivery_phone: Joi.string().max(30).allow(''),
    vehicle_no: Joi.string().max(20).allow(''),
    description: Joi.string().allow(''),
    attachments: Joi.string().allow(''),
    notes: Joi.string().allow(''),
    items: Joi.array().items(Joi.object({
      po_item_id: Joi.number().integer().allow(null),
      product_name: Joi.string().max(200).required(),
      product_code: Joi.string().max(50).allow(''),
      specification: Joi.string().max(200).allow(''),
      unit: Joi.string().max(20).allow(''),
      ordered_quantity: Joi.number().min(0).default(0),
      received_quantity: Joi.number().min(0).required(),
      qualified_quantity: Joi.number().min(0).default(0),
      unqualified_quantity: Joi.number().min(0).default(0),
      unit_price: Joi.number().min(0).default(0),
      batch_no: Joi.string().max(50).allow(''),
      production_date: Joi.date().allow(null),
      expiry_date: Joi.date().allow(null),
      warehouse_location: Joi.string().max(100).allow(''),
      notes: Joi.string().allow('')
    })).min(1).required()
  }),
  update: Joi.object({
    receipt_date: Joi.date(),
    quality_status: Joi.string().valid('qualified', 'partial_qualified', 'unqualified'),
    warehouse_location: Joi.string().max(100).allow(''),
    description: Joi.string().allow(''),
    attachments: Joi.string().allow(''),
    notes: Joi.string().allow(''),
    items: Joi.array().items(Joi.object({
      id: Joi.number().integer(),
      po_item_id: Joi.number().integer().allow(null),
      product_name: Joi.string().max(200).required(),
      product_code: Joi.string().max(50).allow(''),
      specification: Joi.string().max(200).allow(''),
      unit: Joi.string().max(20).allow(''),
      ordered_quantity: Joi.number().min(0).default(0),
      received_quantity: Joi.number().min(0).required(),
      qualified_quantity: Joi.number().min(0).default(0),
      unqualified_quantity: Joi.number().min(0).default(0),
      unit_price: Joi.number().min(0).default(0),
      batch_no: Joi.string().max(50).allow(''),
      production_date: Joi.date().allow(null),
      expiry_date: Joi.date().allow(null),
      warehouse_location: Joi.string().max(100).allow(''),
      notes: Joi.string().allow('')
    })).min(1)
  })
};

/**
 * @route   GET /api/goods-receipts
 * @desc    获取入库单列表
 */
router.get('/',
  permissionMiddleware('goods_receipts', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, po_id, status, startDate, endDate, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE gr.company_id = ?';
    const params = [companyId];
    
    if (search) {
      whereClause += ' AND (gr.receipt_no LIKE ? OR po.order_no LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (po_id) {
      whereClause += ' AND gr.po_id = ?';
      params.push(po_id);
    }
    
    if (status) {
      whereClause += ' AND gr.status = ?';
      params.push(status);
    }
    
    if (startDate) {
      whereClause += ' AND gr.receipt_date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      whereClause += ' AND gr.receipt_date <= ?';
      params.push(endDate);
    }
    
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM goods_receipts gr
      LEFT JOIN purchase_orders po ON gr.po_id = po.id
      ${whereClause}
    `).get(...params);
    
    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'receipt_no', 'receipt_date', 'status', 'quality_status', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    const offset = (page - 1) * pageSize;
    const receipts = db.prepare(`
      SELECT gr.*, po.order_no, s.name as supplier_name
      FROM goods_receipts gr
      LEFT JOIN purchase_orders po ON gr.po_id = po.id
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      ${whereClause}
      ORDER BY gr.${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    
    res.json({
      success: true,
      data: {
        list: receipts,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/goods-receipts/:id
 * @desc    获取入库单详情
 */
router.get('/:id',
  permissionMiddleware('goods_receipts', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const receipt = db.prepare(`
      SELECT gr.*, po.order_no, po.supplier_id, s.name as supplier_name
      FROM goods_receipts gr
      LEFT JOIN purchase_orders po ON gr.po_id = po.id
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE gr.id = ? AND gr.company_id = ?
    `).get(req.params.id, req.user.companyId);
    
    if (!receipt) {
      throw ErrorTypes.NotFound('入库单');
    }
    
    // 获取入库明细
    const items = db.prepare('SELECT * FROM goods_receipt_items WHERE receipt_id = ?').all(req.params.id);
    
    res.json({ success: true, data: { ...receipt, items } });
  })
);

/**
 * @route   POST /api/goods-receipts
 * @desc    创建入库单
 */
router.post('/',
  permissionMiddleware('goods_receipts', 'create'),
  validate(receiptSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    // 检查入库单号是否重复
    const existing = db.prepare('SELECT id FROM goods_receipts WHERE company_id = ? AND receipt_no = ?').get(companyId, req.body.receipt_no);
    if (existing) {
      throw ErrorTypes.DuplicateEntry('入库单号');
    }
    
    // 检查采购订单是否存在
    const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND company_id = ?').get(req.body.po_id, companyId);
    if (!order) {
      throw ErrorTypes.NotFound('采购订单');
    }
    
    if (order.status === 'draft' || order.status === 'cancelled') {
      throw ErrorTypes.BadRequest('采购订单状态不允许入库');
    }
    
    // 计算入库总数量和总金额
    let totalQuantity = 0;
    let totalAmount = 0;
    
    const items = req.body.items.map(item => {
      const amount = item.received_quantity * (item.unit_price || 0);
      totalQuantity += item.received_quantity;
      totalAmount += amount;
      
      // 如果没有指定合格数量，默认等于实收数量
      const qualifiedQuantity = item.qualified_quantity ?? item.received_quantity;
      const unqualifiedQuantity = item.unqualified_quantity ?? 0;
      
      return {
        ...item,
        qualified_quantity: qualifiedQuantity,
        unqualified_quantity: unqualifiedQuantity,
        amount
      };
    });
    
    // 插入入库单主表
    const result = db.prepare(`
      INSERT INTO goods_receipts (
        company_id, receipt_no, po_id, warehouse_id, receipt_date,
        status, total_quantity, total_amount, quality_status,
        warehouse_location, delivery_person, delivery_phone, vehicle_no,
        description, attachments, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, req.body.receipt_no, req.body.po_id, req.body.warehouse_id || null,
      req.body.receipt_date, 'draft', totalQuantity, totalAmount, req.body.quality_status || 'qualified',
      req.body.warehouse_location || null, req.body.delivery_person || null,
      req.body.delivery_phone || null, req.body.vehicle_no || null,
      req.body.description || null, req.body.attachments || null, req.body.notes || null,
      req.user.id
    );
    
    const receiptId = result.lastInsertRowid;
    
    // 插入入库明细
    const insertItem = db.prepare(`
      INSERT INTO goods_receipt_items (
        receipt_id, po_item_id, product_name, product_code, specification, unit,
        ordered_quantity, received_quantity, qualified_quantity, unqualified_quantity,
        unit_price, amount, batch_no, production_date, expiry_date, warehouse_location, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const item of items) {
      insertItem.run(
        receiptId, item.po_item_id || null, item.product_name, item.product_code || null,
        item.specification || null, item.unit || null,
        item.ordered_quantity || 0, item.received_quantity, item.qualified_quantity, item.unqualified_quantity,
        item.unit_price || 0, item.amount, item.batch_no || null,
        item.production_date || null, item.expiry_date || null,
        item.warehouse_location || null, item.notes || null
      );
    }
    
    const newReceipt = db.prepare('SELECT * FROM goods_receipts WHERE id = ?').get(receiptId);
    
    res.status(201).json({ success: true, data: newReceipt, message: '入库单创建成功' });
  })
);

/**
 * @route   PUT /api/goods-receipts/:id
 * @desc    更新入库单
 */
router.put('/:id',
  permissionMiddleware('goods_receipts', 'update'),
  validateId('id'),
  validate(receiptSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    
    const receipt = db.prepare('SELECT * FROM goods_receipts WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
    if (!receipt) {
      throw ErrorTypes.NotFound('入库单');
    }
    
    if (receipt.status !== 'draft') {
      throw ErrorTypes.BadRequest('只有草稿状态的入库单才能修改');
    }
    
    // 更新主表
    const updates = [];
    const values = [];
    const allowedFields = ['receipt_date', 'quality_status', 'warehouse_location', 'description', 'attachments', 'notes'];
    
    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE goods_receipts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    
    // 更新明细
    if (req.body.items && req.body.items.length > 0) {
      // 重新计算
      let totalQuantity = 0;
      let totalAmount = 0;
      
      const items = req.body.items.map(item => {
        const amount = item.received_quantity * (item.unit_price || 0);
        totalQuantity += item.received_quantity;
        totalAmount += amount;
        
        return {
          ...item,
          qualified_quantity: item.qualified_quantity ?? item.received_quantity,
          unqualified_quantity: item.unqualified_quantity ?? 0,
          amount
        };
      });
      
      // 删除原明细
      db.prepare('DELETE FROM goods_receipt_items WHERE receipt_id = ?').run(id);
      
      // 插入新明细
      const insertItem = db.prepare(`
        INSERT INTO goods_receipt_items (
          receipt_id, po_item_id, product_name, product_code, specification, unit,
          ordered_quantity, received_quantity, qualified_quantity, unqualified_quantity,
          unit_price, amount, batch_no, production_date, expiry_date, warehouse_location, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const item of items) {
        insertItem.run(
          id, item.po_item_id || null, item.product_name, item.product_code || null,
          item.specification || null, item.unit || null,
          item.ordered_quantity || 0, item.received_quantity, item.qualified_quantity, item.unqualified_quantity,
          item.unit_price || 0, item.amount, item.batch_no || null,
          item.production_date || null, item.expiry_date || null,
          item.warehouse_location || null, item.notes || null
        );
      }
      
      // 更新入库单总数量和总金额
      db.prepare(`
        UPDATE goods_receipts 
        SET total_quantity = ?, total_amount = ?
        WHERE id = ?
      `).run(totalQuantity, totalAmount, id);
    }
    
    res.json({ success: true, message: '入库单更新成功' });
  })
);

/**
 * @route   POST /api/goods-receipts/:id/confirm
 * @desc    确认入库单
 */
router.post('/:id/confirm',
  permissionMiddleware('goods_receipts', 'update'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const receipt = db.prepare('SELECT * FROM goods_receipts WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!receipt) {
      throw ErrorTypes.NotFound('入库单');
    }
    
    if (receipt.status !== 'draft' && receipt.status !== 'pending') {
      throw ErrorTypes.BadRequest('当前状态无法确认');
    }
    
    // 更新入库单状态
    db.prepare(`
      UPDATE goods_receipts 
      SET status = 'confirmed', confirmed_by = ?, confirmed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user.id, req.params.id);
    
    // 更新采购订单明细的已收货数量（修复 N+1 查询）
    const items = db.prepare('SELECT * FROM goods_receipt_items WHERE receipt_id = ?').all(req.params.id);

    // 过滤有 po_item_id 的项目并批量更新
    const itemsWithPo = items.filter(item => item.po_item_id);
    if (itemsWithPo.length > 0) {
      // 使用 CASE WHEN 批量更新
      const caseClauses = itemsWithPo.map((item, idx) => `WHEN id = ? THEN received_quantity + ?`).join(' ');
      const ids = itemsWithPo.map(item => item.po_item_id);
      const quantities = itemsWithPo.map(item => item.received_quantity);

      db.prepare(`
        UPDATE purchase_order_items 
        SET received_quantity = CASE ${caseClauses} ELSE received_quantity END
        WHERE id IN (${ids.map(() => '?').join(',')})
      `).run(...quantities, ...ids);
    }
    
    // 更新采购订单状态
    const orderItems = db.prepare(`
      SELECT id, quantity, received_quantity 
      FROM purchase_order_items 
      WHERE order_id = ?
    `).all(receipt.po_id);
    
    let allReceived = true;
    let partialReceived = false;
    
    for (const item of orderItems) {
      if (item.received_quantity < item.quantity) {
        allReceived = false;
      }
      if (item.received_quantity > 0) {
        partialReceived = true;
      }
    }
    
    const newStatus = allReceived ? 'received' : (partialReceived ? 'partial' : 'confirmed');
    db.prepare('UPDATE purchase_orders SET status = ? WHERE id = ?').run(newStatus, receipt.po_id);
    
    res.json({ success: true, message: '入库单已确认' });
  })
);

/**
 * @route   POST /api/goods-receipts/:id/cancel
 * @desc    取消入库单
 */
router.post('/:id/cancel',
  permissionMiddleware('goods_receipts', 'update'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const receipt = db.prepare('SELECT * FROM goods_receipts WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!receipt) {
      throw ErrorTypes.NotFound('入库单');
    }
    
    if (receipt.status === 'confirmed' || receipt.status === 'cancelled') {
      throw ErrorTypes.BadRequest('当前状态无法取消');
    }
    
    db.prepare('UPDATE goods_receipts SET status = ? WHERE id = ?').run('cancelled', req.params.id);
    
    res.json({ success: true, message: '入库单已取消' });
  })
);

/**
 * @route   DELETE /api/goods-receipts/:id
 * @desc    删除入库单
 */
router.delete('/:id',
  permissionMiddleware('goods_receipts', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const receipt = db.prepare('SELECT * FROM goods_receipts WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!receipt) {
      throw ErrorTypes.NotFound('入库单');
    }
    
    if (receipt.status !== 'draft' && receipt.status !== 'cancelled') {
      throw ErrorTypes.BadRequest('只有草稿或已取消的入库单才能删除');
    }
    
    // 删除明细
    db.prepare('DELETE FROM goods_receipt_items WHERE receipt_id = ?').run(req.params.id);
    // 删除主表
    db.prepare('DELETE FROM goods_receipts WHERE id = ?').run(req.params.id);
    
    res.json({ success: true, message: '入库单已删除' });
  })
);

module.exports = router;