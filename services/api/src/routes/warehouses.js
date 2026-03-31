const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const Joi = require('joi');

router.use(authMiddleware);

const warehouseSchemas = {
  create: Joi.object({
    warehouse_code: Joi.string().max(50).allow('', null),
    name: Joi.string().max(100).required(),
    warehouse_type: Joi.string().valid('normal', 'cold', 'hazardous', 'bonded', 'other').default('normal'),
    address: Joi.string().allow(''),
    manager_id: Joi.number().integer().positive().allow(null),
    contact_person: Joi.string().max(50).allow(''),
    contact_phone: Joi.string().max(30).allow(''),
    area: Joi.number().min(0).allow(null),
    capacity: Joi.number().min(0).allow(null),
    notes: Joi.string().allow('')
  }),
  update: Joi.object({
    warehouse_code: Joi.string().max(50).allow('', null),
    name: Joi.string().max(100),
    warehouse_type: Joi.string().valid('normal', 'cold', 'hazardous', 'bonded', 'other'),
    address: Joi.string().allow(''),
    manager_id: Joi.number().integer().positive().allow(null),
    contact_person: Joi.string().max(50).allow(''),
    contact_phone: Joi.string().max(30).allow(''),
    area: Joi.number().min(0).allow(null),
    capacity: Joi.number().min(0).allow(null),
    status: Joi.string().valid('active', 'inactive', 'maintenance'),
    notes: Joi.string().allow('')
  })
};

/**
 * @route   GET /api/warehouses
 * @desc    获取仓库列表
 */
router.get('/',
  permissionMiddleware('warehouses', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, status, warehouse_type, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;

    let whereClause = 'WHERE company_id = ?';
    const params = [companyId];

    if (search) {
      whereClause += ' AND (name LIKE ? OR warehouse_code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (warehouse_type) {
      whereClause += ' AND warehouse_type = ?';
      params.push(warehouse_type);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM warehouses ${whereClause}`).get(...params);

    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'warehouse_code', 'name', 'warehouse_type', 'status', 'capacity', 'created_at', 'updated_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const offset = (page - 1) * pageSize;
    const warehouses = db.prepare(`
      SELECT w.*, u.real_name as manager_name
      FROM warehouses w
      LEFT JOIN users u ON w.manager_id = u.id
      ${whereClause}
      ORDER BY ${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: warehouses,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/warehouses/all
 * @desc    获取所有活跃仓库（下拉选择用）
 */
router.get('/all',
  permissionMiddleware('warehouses', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const warehouses = db.prepare(`
      SELECT id, name, warehouse_code, warehouse_type, status
      FROM warehouses w
      WHERE w.company_id = ? AND w.status = 'active'
      ORDER BY name
    `).all(companyId);

    res.json({ success: true, data: warehouses });
  })
);

/**
 * @route   GET /api/warehouses/:id
 * @desc    获取仓库详情
 */
router.get('/:id',
  permissionMiddleware('warehouses', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const warehouse = db.prepare(`
      SELECT w.*, u.real_name as manager_name
      FROM warehouses w
      LEFT JOIN users u ON w.manager_id = u.id
      WHERE w.id = ? AND w.company_id = ?
    `).get(req.params.id, req.user.companyId);

    if (!warehouse) {
      throw ErrorTypes.NotFound('仓库');
    }

    // 获取库存统计
    const stats = db.prepare(`
      SELECT 
        COUNT(DISTINCT product_id) as product_count,
        SUM(quantity) as total_quantity,
        SUM(total_value) as total_value
      FROM inventory
      WHERE warehouse_id = ?
    `).get(req.params.id);

    // 获取最近库存变动
    const recentMovements = db.prepare(`
      SELECT sm.*, p.name as product_name, p.product_code
      FROM stock_movements sm
      LEFT JOIN products p ON sm.product_id = p.id
      WHERE sm.warehouse_id = ?
      ORDER BY sm.created_at DESC
      LIMIT 10
    `).all(req.params.id);

    res.json({
      success: true,
      data: {
        ...warehouse,
        stats: stats || { product_count: 0, total_quantity: 0, total_value: 0 },
        recentMovements
      }
    });
  })
);

/**
 * @route   POST /api/warehouses
 * @desc    创建仓库
 */
router.post('/',
  permissionMiddleware('warehouses', 'create'),
  validate(warehouseSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 检查名称是否重复
    const existing = db.prepare('SELECT id FROM warehouses WHERE company_id = ? AND name = ?').get(companyId, req.body.name);
    if (existing) {
      throw ErrorTypes.DuplicateEntry('仓库名称');
    }

    // 如果提供了仓库编码，检查是否重复
    if (req.body.warehouse_code) {
      const existingCode = db.prepare('SELECT id FROM warehouses WHERE company_id = ? AND warehouse_code = ?').get(companyId, req.body.warehouse_code);
      if (existingCode) {
        throw ErrorTypes.DuplicateEntry('仓库编码');
      }
    }

    const result = db.prepare(`
      INSERT INTO warehouses (
        company_id, warehouse_code, name, warehouse_type, address, manager_id,
        contact_person, contact_phone, area, capacity, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, req.body.warehouse_code || null, req.body.name, req.body.warehouse_type,
      req.body.address || null, req.body.manager_id || null, req.body.contact_person || null,
      req.body.contact_phone || null, req.body.area || null, req.body.capacity || null,
      req.body.notes || null, req.user.id
    );

    const newWarehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: newWarehouse, message: '仓库创建成功' });
  })
);

/**
 * @route   PUT /api/warehouses/:id
 * @desc    更新仓库
 */
router.put('/:id',
  permissionMiddleware('warehouses', 'update'),
  validateId('id'),
  validate(warehouseSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();

    const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
    if (!warehouse) {
      throw ErrorTypes.NotFound('仓库');
    }

    const updates = [];
    const values = [];
    const allowedFields = ['warehouse_code', 'name', 'warehouse_type', 'address', 'manager_id', 
                           'contact_person', 'contact_phone', 'area', 'capacity', 'status', 'notes'];

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      throw ErrorTypes.BadRequest('没有要更新的数据');
    }

    values.push(id);
    db.prepare(`UPDATE warehouses SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ success: true, message: '仓库更新成功' });
  })
);

/**
 * @route   DELETE /api/warehouses/:id
 * @desc    删除仓库
 */
router.delete('/:id',
  permissionMiddleware('warehouses', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!warehouse) {
      throw ErrorTypes.NotFound('仓库');
    }

    // 检查是否有库存
    const inventory = db.prepare('SELECT COUNT(*) as count FROM inventory WHERE warehouse_id = ?').get(req.params.id);
    if (inventory.count > 0) {
      throw ErrorTypes.BadRequest('该仓库存在库存，无法删除');
    }

    // 检查是否有库存变动记录
    const movements = db.prepare('SELECT COUNT(*) as count FROM stock_movements WHERE warehouse_id = ?').get(req.params.id);
    if (movements.count > 0) {
      throw ErrorTypes.BadRequest('该仓库存在库存变动记录，无法删除');
    }

    db.prepare('DELETE FROM warehouses WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: '仓库已删除' });
  })
);

/**
 * @route   GET /api/warehouses/:id/inventory
 * @desc    获取仓库库存列表
 */
router.get('/:id/inventory',
  permissionMiddleware('warehouses', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, category, lowStock } = req.query;

    const warehouse = db.prepare('SELECT id FROM warehouses WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!warehouse) {
      throw ErrorTypes.NotFound('仓库');
    }

    let whereClause = 'WHERE i.warehouse_id = ?';
    const params = [req.params.id];

    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.product_code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      whereClause += ' AND p.category = ?';
      params.push(category);
    }

    if (lowStock === 'true') {
      whereClause += ' AND i.quantity <= p.min_stock';
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total 
      FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      ${whereClause}
    `).get(...params);

    const offset = (page - 1) * pageSize;
    const inventory = db.prepare(`
      SELECT i.*, p.name as product_name, p.product_code, p.category, p.unit, p.specification,
             p.min_stock, p.max_stock, p.sale_price
      FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      ${whereClause}
      ORDER BY i.updated_at DESC
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
 * @route   GET /api/warehouses/:id/movements
 * @desc    获取仓库库存变动记录
 */
router.get('/:id/movements',
  permissionMiddleware('warehouses', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, movement_type, startDate, endDate } = req.query;

    const warehouse = db.prepare('SELECT id FROM warehouses WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!warehouse) {
      throw ErrorTypes.NotFound('仓库');
    }

    let whereClause = 'WHERE sm.warehouse_id = ?';
    const params = [req.params.id];

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

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM stock_movements sm ${whereClause}
    `).get(...params);

    const offset = (page - 1) * pageSize;
    const movements = db.prepare(`
      SELECT sm.*, p.name as product_name, p.product_code,
             u.real_name as operator_name
      FROM stock_movements sm
      LEFT JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.operator_id = u.id
      ${whereClause}
      ORDER BY sm.created_at DESC
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

module.exports = router;