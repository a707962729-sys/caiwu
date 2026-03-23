const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const Joi = require('joi');

router.use(authMiddleware);

const orderSchemas = {
  create: Joi.object({
    order_no: Joi.string().max(50).required(),
    request_id: Joi.number().integer().allow(null),
    supplier_id: Joi.number().integer().required(),
    order_date: Joi.date().required(),
    expected_date: Joi.date().allow(null),
    order_type: Joi.string().max(50).allow(''),
    payment_terms: Joi.string().allow(''),
    delivery_address: Joi.string().allow(''),
    contact_person: Joi.string().max(50).allow(''),
    contact_phone: Joi.string().max(30).allow(''),
    description: Joi.string().allow(''),
    attachments: Joi.string().allow(''),
    notes: Joi.string().allow(''),
    items: Joi.array().items(Joi.object({
      item_no: Joi.number().integer(),
      product_name: Joi.string().max(200).required(),
      product_code: Joi.string().max(50).allow(''),
      specification: Joi.string().max(200).allow(''),
      unit: Joi.string().max(20).allow(''),
      quantity: Joi.number().min(0).required(),
      unit_price: Joi.number().min(0).required(),
      tax_rate: Joi.number().min(0).max(100).default(0),
      discount_rate: Joi.number().min(0).max(100).default(0),
      notes: Joi.string().allow('')
    })).min(1).required()
  }),
  update: Joi.object({
    expected_date: Joi.date().allow(null),
    order_type: Joi.string().max(50).allow(''),
    payment_terms: Joi.string().allow(''),
    delivery_address: Joi.string().allow(''),
    contact_person: Joi.string().max(50).allow(''),
    contact_phone: Joi.string().max(30).allow(''),
    description: Joi.string().allow(''),
    attachments: Joi.string().allow(''),
    notes: Joi.string().allow(''),
    items: Joi.array().items(Joi.object({
      id: Joi.number().integer(),
      item_no: Joi.number().integer(),
      product_name: Joi.string().max(200).required(),
      product_code: Joi.string().max(50).allow(''),
      specification: Joi.string().max(200).allow(''),
      unit: Joi.string().max(20).allow(''),
      quantity: Joi.number().min(0).required(),
      unit_price: Joi.number().min(0).required(),
      tax_rate: Joi.number().min(0).max(100).default(0),
      discount_rate: Joi.number().min(0).max(100).default(0),
      notes: Joi.string().allow('')
    })).min(1)
  })
};

/**
 * @route   GET /api/purchase-orders
 * @desc    获取采购订单列表
 */
router.get('/',
  permissionMiddleware('purchase_orders', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, supplier_id, status, startDate, endDate, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;
    
    let whereClause = 'WHERE po.company_id = ?';
    const params = [companyId];
    
    if (search) {
      whereClause += ' AND (po.order_no LIKE ? OR s.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (supplier_id) {
      whereClause += ' AND po.supplier_id = ?';
      params.push(supplier_id);
    }
    
    if (status) {
      whereClause += ' AND po.status = ?';
      params.push(status);
    }
    
    if (startDate) {
      whereClause += ' AND po.order_date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      whereClause += ' AND po.order_date <= ?';
      params.push(endDate);
    }
    
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      ${whereClause}
    `).get(...params);
    
    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'order_no', 'order_date', 'expected_date', 'status', 'total_amount', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    const offset = (page - 1) * pageSize;
    const orders = db.prepare(`
      SELECT po.*, s.name as supplier_name, s.contact as supplier_contact
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      ${whereClause}
      ORDER BY po.${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    
    res.json({
      success: true,
      data: {
        list: orders,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/purchase-orders/:id
 * @desc    获取采购订单详情
 */
router.get('/:id',
  permissionMiddleware('purchase_orders', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const order = db.prepare(`
      SELECT po.*, s.name as supplier_name, s.contact as supplier_contact, s.phone as supplier_phone
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = ? AND po.company_id = ?
    `).get(req.params.id, req.user.companyId);
    
    if (!order) {
      throw ErrorTypes.NotFound('采购订单');
    }
    
    // 获取订单明细
    const items = db.prepare('SELECT * FROM purchase_order_items WHERE order_id = ? ORDER BY item_no').all(req.params.id);
    
    res.json({ success: true, data: { ...order, items } });
  })
);

/**
 * @route   POST /api/purchase-orders
 * @desc    创建采购订单
 */
router.post('/',
  permissionMiddleware('purchase_orders', 'create'),
  validate(orderSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    // 检查订单号是否重复
    const existing = db.prepare('SELECT id FROM purchase_orders WHERE company_id = ? AND order_no = ?').get(companyId, req.body.order_no);
    if (existing) {
      throw ErrorTypes.DuplicateEntry('采购订单号');
    }
    
    // 检查供应商是否存在
    const supplier = db.prepare('SELECT id FROM suppliers WHERE id = ? AND company_id = ?').get(req.body.supplier_id, companyId);
    if (!supplier) {
      throw ErrorTypes.NotFound('供应商');
    }
    
    // 计算订单金额
    let totalAmount = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    
    const items = req.body.items.map((item, index) => {
      const amount = item.quantity * item.unit_price;
      const taxAmount = amount * (item.tax_rate || 0) / 100;
      const discountAmount = amount * (item.discount_rate || 0) / 100;
      const finalAmount = amount + taxAmount - discountAmount;
      
      totalAmount += amount;
      totalTax += taxAmount;
      totalDiscount += discountAmount;
      
      return {
        ...item,
        item_no: item.item_no || index + 1,
        amount,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        final_amount: finalAmount
      };
    });
    
    const finalAmount = totalAmount + totalTax - totalDiscount;
    
    // 插入订单主表
    const result = db.prepare(`
      INSERT INTO purchase_orders (
        company_id, order_no, request_id, supplier_id, order_date, expected_date,
        order_type, total_amount, tax_amount, discount_amount, final_amount,
        payment_terms, delivery_address, contact_person, contact_phone,
        description, attachments, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, req.body.order_no, req.body.request_id || null, req.body.supplier_id,
      req.body.order_date, req.body.expected_date || null, req.body.order_type || null,
      totalAmount, totalTax, totalDiscount, finalAmount,
      req.body.payment_terms || null, req.body.delivery_address || null,
      req.body.contact_person || null, req.body.contact_phone || null,
      req.body.description || null, req.body.attachments || null, req.body.notes || null,
      req.user.id
    );
    
    const orderId = result.lastInsertRowid;
    
    // 插入订单明细
    const insertItem = db.prepare(`
      INSERT INTO purchase_order_items (
        order_id, item_no, product_name, product_code, specification, unit,
        quantity, unit_price, amount, tax_rate, tax_amount, discount_rate, discount_amount, final_amount, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const item of items) {
      insertItem.run(
        orderId, item.item_no, item.product_name, item.product_code || null,
        item.specification || null, item.unit || null,
        item.quantity, item.unit_price, item.amount,
        item.tax_rate || 0, item.tax_amount, item.discount_rate || 0, item.discount_amount, item.final_amount,
        item.notes || null
      );
    }
    
    const newOrder = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(orderId);
    
    res.status(201).json({ success: true, data: newOrder, message: '采购订单创建成功' });
  })
);

/**
 * @route   PUT /api/purchase-orders/:id
 * @desc    更新采购订单
 */
router.put('/:id',
  permissionMiddleware('purchase_orders', 'update'),
  validateId('id'),
  validate(orderSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();
    
    const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
    if (!order) {
      throw ErrorTypes.NotFound('采购订单');
    }
    
    if (order.status !== 'draft') {
      throw ErrorTypes.BadRequest('只有草稿状态的订单才能修改');
    }
    
    // 更新主表
    const updates = [];
    const values = [];
    const allowedFields = ['expected_date', 'order_type', 'payment_terms', 'delivery_address', 
                           'contact_person', 'contact_phone', 'description', 'attachments', 'notes'];
    
    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    
    // 更新明细
    if (req.body.items && req.body.items.length > 0) {
      // 重新计算金额
      let totalAmount = 0;
      let totalTax = 0;
      let totalDiscount = 0;
      
      const items = req.body.items.map((item, index) => {
        const amount = item.quantity * item.unit_price;
        const taxAmount = amount * (item.tax_rate || 0) / 100;
        const discountAmount = amount * (item.discount_rate || 0) / 100;
        const finalAmount = amount + taxAmount - discountAmount;
        
        totalAmount += amount;
        totalTax += taxAmount;
        totalDiscount += discountAmount;
        
        return {
          ...item,
          item_no: item.item_no || index + 1,
          amount,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          final_amount: finalAmount
        };
      });
      
      const finalAmount = totalAmount + totalTax - totalDiscount;
      
      // 删除原明细
      db.prepare('DELETE FROM purchase_order_items WHERE order_id = ?').run(id);
      
      // 插入新明细
      const insertItem = db.prepare(`
        INSERT INTO purchase_order_items (
          order_id, item_no, product_name, product_code, specification, unit,
          quantity, unit_price, amount, tax_rate, tax_amount, discount_rate, discount_amount, final_amount, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const item of items) {
        insertItem.run(
          id, item.item_no, item.product_name, item.product_code || null,
          item.specification || null, item.unit || null,
          item.quantity, item.unit_price, item.amount,
          item.tax_rate || 0, item.tax_amount, item.discount_rate || 0, item.discount_amount, item.final_amount,
          item.notes || null
        );
      }
      
      // 更新订单金额
      db.prepare(`
        UPDATE purchase_orders 
        SET total_amount = ?, tax_amount = ?, discount_amount = ?, final_amount = ?
        WHERE id = ?
      `).run(totalAmount, totalTax, totalDiscount, finalAmount, id);
    }
    
    res.json({ success: true, message: '采购订单更新成功' });
  })
);

/**
 * @route   POST /api/purchase-orders/:id/confirm
 * @desc    确认采购订单
 */
router.post('/:id/confirm',
  permissionMiddleware('purchase_orders', 'update'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!order) {
      throw ErrorTypes.NotFound('采购订单');
    }
    
    if (order.status !== 'draft' && order.status !== 'pending') {
      throw ErrorTypes.BadRequest('当前状态无法确认');
    }
    
    db.prepare(`
      UPDATE purchase_orders 
      SET status = 'confirmed', confirmed_by = ?, confirmed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user.id, req.params.id);
    
    res.json({ success: true, message: '采购订单已确认' });
  })
);

/**
 * @route   POST /api/purchase-orders/:id/cancel
 * @desc    取消采购订单
 */
router.post('/:id/cancel',
  permissionMiddleware('purchase_orders', 'update'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!order) {
      throw ErrorTypes.NotFound('采购订单');
    }
    
    if (order.status === 'received' || order.status === 'cancelled') {
      throw ErrorTypes.BadRequest('当前状态无法取消');
    }
    
    db.prepare('UPDATE purchase_orders SET status = ? WHERE id = ?').run('cancelled', req.params.id);
    
    res.json({ success: true, message: '采购订单已取消' });
  })
);

/**
 * @route   DELETE /api/purchase-orders/:id
 * @desc    删除采购订单
 */
router.delete('/:id',
  permissionMiddleware('purchase_orders', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    
    const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!order) {
      throw ErrorTypes.NotFound('采购订单');
    }
    
    if (order.status !== 'draft' && order.status !== 'cancelled') {
      throw ErrorTypes.BadRequest('只有草稿或已取消的订单才能删除');
    }
    
    // 删除明细
    db.prepare('DELETE FROM purchase_order_items WHERE order_id = ?').run(req.params.id);
    // 删除主表
    db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(req.params.id);
    
    res.json({ success: true, message: '采购订单已删除' });
  })
);

module.exports = router;