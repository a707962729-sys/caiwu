const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const Joi = require('joi');
const dayjs = require('dayjs');

router.use(authMiddleware);

const movementSchemas = {
  create: Joi.object({
    movement_type: Joi.string().valid(
      'purchase_in', 'purchase_return', 'sales_out', 'sales_return',
      'transfer_in', 'transfer_out', 'adjustment_in', 'adjustment_out',
      'production_in', 'production_out', 'other_in', 'other_out'
    ).required(),
    warehouse_id: Joi.number().integer().positive().required(),
    product_id: Joi.number().integer().positive().required(),
    batch_no: Joi.string().max(50).allow(''),
    quantity: Joi.number().positive().required(),
    unit_cost: Joi.number().min(0).default(0),
    movement_date: Joi.alternatives().try(Joi.date().iso(), Joi.string()).required(),
    related_type: Joi.string().max(50).allow(''),
    related_id: Joi.number().integer().positive().allow(null),
    related_no: Joi.string().max(50).allow(''),
    from_warehouse_id: Joi.number().integer().positive().allow(null),
    to_warehouse_id: Joi.number().integer().positive().allow(null),
    reason: Joi.string().allow(''),
    notes: Joi.string().allow('')
  }),
  transfer: Joi.object({
    from_warehouse_id: Joi.number().integer().positive().required(),
    to_warehouse_id: Joi.number().integer().positive().required(),
    product_id: Joi.number().integer().positive().required(),
    batch_no: Joi.string().max(50).allow(''),
    quantity: Joi.number().positive().required(),
    movement_date: Joi.alternatives().try(Joi.date().iso(), Joi.string()).required(),
    reason: Joi.string().allow(''),
    notes: Joi.string().allow('')
  }).custom((value, helpers) => {
    if (value.from_warehouse_id === value.to_warehouse_id) {
      return helpers.error('any.invalid', { message: '调出仓库和调入仓库不能相同' });
    }
    return value;
  }),
  adjust: Joi.object({
    warehouse_id: Joi.number().integer().positive().required(),
    product_id: Joi.number().integer().positive().required(),
    batch_no: Joi.string().max(50).allow(''),
    actual_quantity: Joi.number().min(0).required(),
    adjust_reason: Joi.string().required(),
    movement_date: Joi.alternatives().try(Joi.date().iso(), Joi.string()).required(),
    notes: Joi.string().allow('')
  }),
  confirm: Joi.object({
    action: Joi.string().valid('confirm', 'cancel').required()
  })
};

/**
 * 生成库存变动单号
 */
function generateMovementNo(db, companyId, movementType) {
  const date = dayjs().format('YYYYMMDD');
  const prefix = movementType.substring(0, 3).toUpperCase();
  
  // 查询今天已有的同类型单号
  const todayStart = dayjs().startOf('day').format('YYYY-MM-DD');
  const todayEnd = dayjs().endOf('day').format('YYYY-MM-DD');
  
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM stock_movements 
    WHERE company_id = ? AND movement_type = ? AND movement_date >= ? AND movement_date <= ?
  `).get(companyId, movementType, todayStart, todayEnd);
  
  const seq = (result.count + 1).toString().padStart(4, '0');
  return `${prefix}${date}${seq}`;
}

/**
 * @route   GET /api/inventory
 * @desc    获取库存列表（汇总）
 */
router.get('/',
  permissionMiddleware('inventory', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, warehouse_id, category, lowStock, sortBy = 'updated_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;

    let whereClause = 'WHERE p.company_id = ?';
    const params = [companyId];

    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.sku LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (warehouse_id) {
      whereClause += ' AND i.warehouse_id = ?';
      params.push(warehouse_id);
    }

    if (category) {
      whereClause += ' AND p.category = ?';
      params.push(category);
    }

    if (lowStock === 'true') {
      whereClause += ' AND i.qty <= p.min_stock AND p.min_stock > 0';
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total 
      FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      ${whereClause}
    `).get(...params);

    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'product_name', 'sku', 'category', 'quantity', 'available_quantity', 'updated_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'updated_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const offset = (page - 1) * pageSize;
    const inventory = db.prepare(`
      SELECT i.*, p.name as product_name, p.sku, p.sku, p.category, 
             p.unit, p.spec, p.sale_price, p.cost_price, p.min_stock, p.max_stock,
             w.name as warehouse_name, w.name
      FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      ${whereClause}
      ORDER BY ${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: inventory,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/inventory/summary
 * @desc    获取库存汇总统计
 */
router.get('/summary',
  permissionMiddleware('inventory', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { warehouse_id } = req.query;

    let whereClause = 'WHERE company_id = ?';
    const params = [companyId];

    if (warehouse_id) {
      whereClause += ' AND warehouse_id = ?';
      params.push(warehouse_id);
    }

    const summary = db.prepare(`
      SELECT 
        COUNT(DISTINCT product_id) as product_count,
        COUNT(*) as sku_count,
        SUM(quantity) as total_quantity,
        SUM(total_value) as total_value,
        SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) as out_of_stock_count,
        SUM(CASE WHEN quantity <= (SELECT min_stock FROM products WHERE id = inventory.product_id) 
                  AND quantity > 0 THEN 1 ELSE 0 END) as low_stock_count
      FROM inventory
      ${whereClause}
    `).get(...params);

    res.json({ success: true, data: summary });
  })
);

/**
 * @route   GET /api/inventory/movements
 * @desc    获取库存变动记录
 */
router.get('/movements',
  permissionMiddleware('inventory', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, warehouse_id, product_id, movement_type, 
            startDate, endDate, status, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;

    let whereClause = 'WHERE sm.company_id = ?';
    const params = [companyId];

    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.sku LIKE ? OR sm.movement_no LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (warehouse_id) {
      whereClause += ' AND sm.warehouse_id = ?';
      params.push(warehouse_id);
    }

    if (product_id) {
      whereClause += ' AND sm.product_id = ?';
      params.push(product_id);
    }

    if (movement_type) {
      whereClause += ' AND sm.movement_type = ?';
      params.push(movement_type);
    }

    if (startDate) {
      whereClause += ' AND sm.movement_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND sm.movement_date <= ?';
      params.push(endDate);
    }

    if (status) {
      whereClause += ' AND sm.status = ?';
      params.push(status);
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM stock_movements sm ${whereClause}
    `).get(...params);

    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'movement_no', 'movement_type', 'movement_date', 'quantity', 'status', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const offset = (page - 1) * pageSize;
    const movements = db.prepare(`
      SELECT sm.*, p.name as product_name, p.sku, p.unit,
             w.name as warehouse_name, w.name,
             fw.name as from_warehouse_name,
             tw.name as to_warehouse_name,
             u.real_name as operator_name,
             v.real_name as verifier_name
      FROM stock_movements sm
      LEFT JOIN products p ON sm.product_id = p.id
      LEFT JOIN warehouses w ON sm.warehouse_id = w.id
      LEFT JOIN warehouses fw ON sm.from_warehouse_id = fw.id
      LEFT JOIN warehouses tw ON sm.to_warehouse_id = tw.id
      LEFT JOIN users u ON sm.operator_id = u.id
      LEFT JOIN users v ON sm.verified_by = v.id
      ${whereClause}
      ORDER BY ${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: movements,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/inventory/movements/:id
 * @desc    获取库存变动详情
 */
router.get('/movements/:id',
  permissionMiddleware('inventory', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const movement = db.prepare(`
      SELECT sm.*, p.name as product_name, p.sku, p.unit, p.spec,
             w.name as warehouse_name, w.name,
             fw.name as from_warehouse_name,
             tw.name as to_warehouse_name,
             u.real_name as operator_name,
             v.real_name as verifier_name,
             c.real_name as creator_name
      FROM stock_movements sm
      LEFT JOIN products p ON sm.product_id = p.id
      LEFT JOIN warehouses w ON sm.warehouse_id = w.id
      LEFT JOIN warehouses fw ON sm.from_warehouse_id = fw.id
      LEFT JOIN warehouses tw ON sm.to_warehouse_id = tw.id
      LEFT JOIN users u ON sm.operator_id = u.id
      LEFT JOIN users v ON sm.verified_by = v.id
      LEFT JOIN users c ON sm.created_by = c.id
      WHERE sm.id = ? AND sm.company_id = ?
    `).get(req.params.id, req.user.companyId);

    if (!movement) {
      throw ErrorTypes.NotFound('库存变动记录');
    }

    res.json({ success: true, data: movement });
  })
);

/**
 * @route   POST /api/inventory/movements
 * @desc    创建库存变动
 */
router.post('/movements',
  permissionMiddleware('inventory', 'create'),
  validate(movementSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 验证仓库
    const warehouse = db.prepare('SELECT id, status FROM warehouses WHERE id = ? AND company_id = ?')
      .get(req.body.warehouse_id, companyId);
    if (!warehouse) {
      throw ErrorTypes.NotFound('仓库');
    }
    if (warehouse.status !== 'active') {
      throw ErrorTypes.BadRequest('该仓库当前不可用');
    }

    // 验证产品
    const product = db.prepare('SELECT id, status, unit, cost_price FROM products WHERE id = ? AND company_id = ?')
      .get(req.body.product_id, companyId);
    if (!product) {
      throw ErrorTypes.NotFound('产品');
    }
    if (product.status !== 'active') {
      throw ErrorTypes.BadRequest('该产品当前不可用');
    }

    // 检查出库库存是否足够
    const isOutbound = ['sales_out', 'purchase_return', 'transfer_out', 'adjustment_out', 'production_out', 'other_out'].includes(req.body.movement_type);
    
    if (isOutbound) {
      const currentStock = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as total FROM inventory 
        WHERE warehouse_id = ? AND product_id = ?
      `).get(req.body.warehouse_id, req.body.product_id);

      if (currentStock.total < req.body.quantity) {
        throw ErrorTypes.BadRequest(`库存不足，当前库存: ${currentStock.total}`);
      }
    }

    // 生成单号
    const movementNo = generateMovementNo(db, companyId, req.body.movement_type);

    // 处理日期
    const movementDate = typeof req.body.movement_date === 'string' 
      ? req.body.movement_date 
      : dayjs(req.body.movement_date).format('YYYY-MM-DD');

    const unitCost = req.body.unit_cost || product.cost_price || 0;
    const totalCost = req.body.quantity * unitCost;

    // 获取变动前库存
    const beforeStock = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total FROM inventory 
      WHERE warehouse_id = ? AND product_id = ?
    `).get(req.body.warehouse_id, req.body.product_id);

    const beforeQuantity = beforeStock.total;
    const quantity = isOutbound ? -req.body.quantity : req.body.quantity;
    const afterQuantity = beforeQuantity + quantity;

    // 创建变动记录
    const result = db.prepare(`
      INSERT INTO stock_movements (
        company_id, movement_no, movement_type, warehouse_id, product_id, batch_no,
        quantity, before_quantity, after_quantity, unit_cost, total_cost, movement_date,
        related_type, related_id, related_no, from_warehouse_id, to_warehouse_id,
        reason, operator_id, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      companyId, movementNo, req.body.movement_type, req.body.warehouse_id, req.body.product_id,
      req.body.batch_no || null, quantity, beforeQuantity, afterQuantity, unitCost, totalCost, movementDate,
      req.body.related_type || null, req.body.related_id || null, req.body.related_no || null,
      req.body.from_warehouse_id || null, req.body.to_warehouse_id || null,
      req.body.reason || null, req.user.id, req.body.notes || null, req.user.id
    );

    const newMovement = db.prepare('SELECT * FROM stock_movements WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: newMovement, message: '库存变动创建成功' });
  })
);

/**
 * @route   POST /api/inventory/movements/:id/confirm
 * @desc    确认/取消库存变动
 */
router.post('/movements/:id/confirm',
  permissionMiddleware('inventory', 'update'),
  validateId('id'),
  validate(movementSchemas.confirm),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const { action } = req.body;

    const movement = db.prepare('SELECT * FROM stock_movements WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
    if (!movement) {
      throw ErrorTypes.NotFound('库存变动记录');
    }

    if (movement.status !== 'pending') {
      throw ErrorTypes.BadRequest('该变动记录已处理，无法重复操作');
    }

    if (action === 'confirm') {
      // 确认变动，更新库存
      db.prepare('BEGIN').run();
      
      try {
        // 更新或创建库存记录
        const existingInventory = db.prepare(`
          SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ? AND (batch_no = ? OR batch_no IS NULL)
        `).get(movement.warehouse_id, movement.product_id, movement.batch_no);

        if (existingInventory) {
          const newQty = existingInventory.quantity + movement.quantity;
          const newAvailableQty = existingInventory.available_quantity + movement.quantity;
          const newValue = newQty * movement.unit_cost;

          db.prepare(`
            UPDATE inventory 
            SET quantity = ?, available_quantity = ?, total_value = ?, last_movement_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(newQty, newAvailableQty, newValue, existingInventory.id);
        } else {
          if (movement.quantity < 0) {
            throw ErrorTypes.BadRequest('库存不足，无法创建负库存记录');
          }

          db.prepare(`
            INSERT INTO inventory (
              company_id, warehouse_id, product_id, quantity, available_quantity,
              batch_no, cost_price, total_value, last_movement_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(
            req.user.companyId, movement.warehouse_id, movement.product_id,
            movement.quantity, movement.quantity, movement.batch_no || null,
            movement.unit_cost, movement.total_cost
          );
        }

        // 更新变动状态
        db.prepare(`
          UPDATE stock_movements SET status = 'confirmed', verified_by = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(req.user.id, id);

        db.prepare('COMMIT').run();
      } catch (err) {
        db.prepare('ROLLBACK').run();
        throw err;
      }

      res.json({ success: true, message: '库存变动已确认' });
    } else {
      // 取消变动
      db.prepare(`UPDATE stock_movements SET status = 'cancelled' WHERE id = ?`).run(id);
      res.json({ success: true, message: '库存变动已取消' });
    }
  })
);

/**
 * @route   POST /api/inventory/transfer
 * @desc    库存调拨
 */
router.post('/transfer',
  permissionMiddleware('inventory', 'create'),
  validate(movementSchemas.transfer),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 验证仓库
    const fromWarehouse = db.prepare('SELECT id, status, name FROM warehouses WHERE id = ? AND company_id = ?')
      .get(req.body.from_warehouse_id, companyId);
    if (!fromWarehouse) {
      throw ErrorTypes.NotFound('调出仓库');
    }
    if (fromWarehouse.status !== 'active') {
      throw ErrorTypes.BadRequest('调出仓库当前不可用');
    }

    const toWarehouse = db.prepare('SELECT id, status, name FROM warehouses WHERE id = ? AND company_id = ?')
      .get(req.body.to_warehouse_id, companyId);
    if (!toWarehouse) {
      throw ErrorTypes.NotFound('调入仓库');
    }
    if (toWarehouse.status !== 'active') {
      throw ErrorTypes.BadRequest('调入仓库当前不可用');
    }

    // 验证产品
    const product = db.prepare('SELECT id, status, unit, cost_price FROM products WHERE id = ? AND company_id = ?')
      .get(req.body.product_id, companyId);
    if (!product) {
      throw ErrorTypes.NotFound('产品');
    }

    // 检查库存是否足够
    const currentStock = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total FROM inventory 
      WHERE warehouse_id = ? AND product_id = ?
    `).get(req.body.from_warehouse_id, req.body.product_id);

    if (currentStock.total < req.body.quantity) {
      throw ErrorTypes.BadRequest(`调出仓库库存不足，当前库存: ${currentStock.total}`);
    }

    const movementDate = typeof req.body.movement_date === 'string' 
      ? req.body.movement_date 
      : dayjs(req.body.movement_date).format('YYYY-MM-DD');

    db.prepare('BEGIN').run();

    try {
      const unitCost = product.cost_price || 0;
      const totalCost = req.body.quantity * unitCost;

      // 创建调出记录
      const outNo = generateMovementNo(db, companyId, 'transfer_out');
      const beforeQtyOut = currentStock.total;

      db.prepare(`
        INSERT INTO stock_movements (
          company_id, movement_no, movement_type, warehouse_id, product_id, batch_no,
          quantity, before_quantity, after_quantity, unit_cost, total_cost, movement_date,
          from_warehouse_id, to_warehouse_id, reason, operator_id, status, notes, created_by
        ) VALUES (?, ?, 'transfer_out', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)
      `).run(
        companyId, outNo, req.body.from_warehouse_id, req.body.product_id, req.body.batch_no || null,
        -req.body.quantity, beforeQtyOut, beforeQtyOut - req.body.quantity, unitCost, totalCost, movementDate,
        req.body.from_warehouse_id, req.body.to_warehouse_id, req.body.reason || null, 
        req.user.id, req.body.notes || null, req.user.id
      );

      // 创建调入记录
      const inNo = generateMovementNo(db, companyId, 'transfer_in');
      const beforeQtyIn = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as total FROM inventory 
        WHERE warehouse_id = ? AND product_id = ?
      `).get(req.body.to_warehouse_id, req.body.product_id).total;

      db.prepare(`
        INSERT INTO stock_movements (
          company_id, movement_no, movement_type, warehouse_id, product_id, batch_no,
          quantity, before_quantity, after_quantity, unit_cost, total_cost, movement_date,
          from_warehouse_id, to_warehouse_id, reason, operator_id, status, notes, created_by
        ) VALUES (?, ?, 'transfer_in', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)
      `).run(
        companyId, inNo, req.body.to_warehouse_id, req.body.product_id, req.body.batch_no || null,
        req.body.quantity, beforeQtyIn, beforeQtyIn + req.body.quantity, unitCost, totalCost, movementDate,
        req.body.from_warehouse_id, req.body.to_warehouse_id, req.body.reason || null,
        req.user.id, req.body.notes || null, req.user.id
      );

      // 更新调出仓库库存
      const outInventory = db.prepare(`
        SELECT id, quantity FROM inventory WHERE warehouse_id = ? AND product_id = ? LIMIT 1
      `).get(req.body.from_warehouse_id, req.body.product_id);

      if (outInventory) {
        const newQty = outInventory.quantity - req.body.quantity;
        db.prepare(`
          UPDATE inventory SET quantity = ?, available_quantity = ?, last_movement_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(newQty, newQty, outInventory.id);
      }

      // 更新调入仓库库存
      const inInventory = db.prepare(`
        SELECT id, quantity FROM inventory WHERE warehouse_id = ? AND product_id = ? LIMIT 1
      `).get(req.body.to_warehouse_id, req.body.product_id);

      if (inInventory) {
        const newQty = inInventory.quantity + req.body.quantity;
        db.prepare(`
          UPDATE inventory SET quantity = ?, available_quantity = ?, total_value = ? * ?, last_movement_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(newQty, newQty, newQty, unitCost, inInventory.id);
      } else {
        db.prepare(`
          INSERT INTO inventory (
            company_id, warehouse_id, product_id, quantity, available_quantity,
            batch_no, cost_price, total_value, last_movement_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          companyId, req.body.to_warehouse_id, req.body.product_id,
          req.body.quantity, req.body.quantity, req.body.batch_no || null,
          unitCost, req.body.quantity * unitCost
        );
      }

      db.prepare('COMMIT').run();
    } catch (err) {
      db.prepare('ROLLBACK').run();
      throw err;
    }

    res.json({ success: true, message: '库存调拨成功' });
  })
);

/**
 * @route   POST /api/inventory/adjust
 * @desc    库存盘点调整
 */
router.post('/adjust',
  permissionMiddleware('inventory', 'create'),
  validate(movementSchemas.adjust),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 验证仓库
    const warehouse = db.prepare('SELECT id, status FROM warehouses WHERE id = ? AND company_id = ?')
      .get(req.body.warehouse_id, companyId);
    if (!warehouse) {
      throw ErrorTypes.NotFound('仓库');
    }

    // 验证产品
    const product = db.prepare('SELECT id, status, cost_price FROM products WHERE id = ? AND company_id = ?')
      .get(req.body.product_id, companyId);
    if (!product) {
      throw ErrorTypes.NotFound('产品');
    }

    const movementDate = typeof req.body.movement_date === 'string' 
      ? req.body.movement_date 
      : dayjs(req.body.movement_date).format('YYYY-MM-DD');

    // 获取当前库存
    const currentStock = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total FROM inventory 
      WHERE warehouse_id = ? AND product_id = ?
    `).get(req.body.warehouse_id, req.body.product_id);

    const beforeQuantity = currentStock.total;
    const actualQuantity = req.body.actual_quantity;
    const diff = actualQuantity - beforeQuantity;

    if (diff === 0) {
      return res.json({ success: true, message: '库存数量一致，无需调整' });
    }

    const movementType = diff > 0 ? 'adjustment_in' : 'adjustment_out';
    const quantity = Math.abs(diff);
    const unitCost = product.cost_price || 0;
    const totalCost = quantity * unitCost;

    db.prepare('BEGIN').run();

    try {
      // 创建调整记录
      const movementNo = generateMovementNo(db, companyId, movementType);

      db.prepare(`
        INSERT INTO stock_movements (
          company_id, movement_no, movement_type, warehouse_id, product_id, batch_no,
          quantity, before_quantity, after_quantity, unit_cost, total_cost, movement_date,
          reason, operator_id, status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)
      `).run(
        companyId, movementNo, movementType, req.body.warehouse_id, req.body.product_id,
        req.body.batch_no || null, diff > 0 ? quantity : -quantity, beforeQuantity, actualQuantity,
        unitCost, totalCost, movementDate, req.body.adjust_reason,
        req.user.id, req.body.notes || null, req.user.id
      );

      // 更新库存
      const existingInventory = db.prepare(`
        SELECT id FROM inventory WHERE warehouse_id = ? AND product_id = ? LIMIT 1
      `).get(req.body.warehouse_id, req.body.product_id);

      if (existingInventory) {
        db.prepare(`
          UPDATE inventory SET quantity = ?, available_quantity = ?, total_value = ? * ?, last_movement_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(actualQuantity, actualQuantity, actualQuantity, unitCost, existingInventory.id);
      } else if (actualQuantity > 0) {
        db.prepare(`
          INSERT INTO inventory (
            company_id, warehouse_id, product_id, quantity, available_quantity,
            batch_no, cost_price, total_value, last_movement_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          companyId, req.body.warehouse_id, req.body.product_id,
          actualQuantity, actualQuantity, req.body.batch_no || null,
          unitCost, actualQuantity * unitCost
        );
      }

      db.prepare('COMMIT').run();
    } catch (err) {
      db.prepare('ROLLBACK').run();
      throw err;
    }

    res.json({ 
      success: true, 
      message: `库存调整成功，${diff > 0 ? '盘盈' : '盘亏'} ${quantity}`, 
      data: { beforeQuantity, actualQuantity, diff }
    });
  })
);

/**
 * @route   GET /api/inventory/low-stock
 * @desc    获取低库存预警列表
 */
router.get('/low-stock',
  permissionMiddleware('inventory', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const lowStock = db.prepare(`
      SELECT i.*, p.name as product_name, p.sku, p.unit, p.min_stock,
             w.name as warehouse_name, w.name
      FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      WHERE p.company_id = ? AND i.qty <= p.min_stock AND p.min_stock > 0
      ORDER BY i.qty ASC
    `).all(companyId);

    res.json({ success: true, data: lowStock });
  })
);

module.exports = router;