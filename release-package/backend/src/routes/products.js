const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId, paginationSchema } = require('../middleware/validation');
const Joi = require('joi');

router.use(authMiddleware);

const productSchemas = {
  create: Joi.object({
    sku: Joi.string().max(50).required(),
    name: Joi.string().max(200).required(),
    category: Joi.string().max(100).allow('', null),
    spec: Joi.string().max(200).allow('', null),
    unit: Joi.string().max(20).allow('', null),
    cost_price: Joi.number().min(0).default(0),
    sale_price: Joi.number().min(0).default(0),
    min_stock: Joi.number().min(0).default(0),
    max_stock: Joi.number().min(0).default(0)
  }),
  update: Joi.object({
    sku: Joi.string().max(50),
    name: Joi.string().max(200),
    category: Joi.string().max(100).allow('', null),
    spec: Joi.string().max(200).allow('', null),
    unit: Joi.string().max(20).allow('', null),
    cost_price: Joi.number().min(0),
    sale_price: Joi.number().min(0),
    min_stock: Joi.number().min(0),
    max_stock: Joi.number().min(0),
    status: Joi.string().valid('active', 'inactive')
  })
};

/**
 * @route   GET /api/products
 * @desc    获取产品列表
 */
router.get('/',
  permissionMiddleware('products', 'read'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, search, category, status, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId;

    let whereClause = 'WHERE company_id = ?';
    const params = [companyId];

    if (search) {
      whereClause += ' AND (name LIKE ? OR sku LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM products ${whereClause}`).get(...params);

    // SQL注入防护：白名单验证排序字段
    const allowedSortFields = ['id', 'sku', 'name', 'category', 'status', 'cost_price', 'sale_price', 'min_stock', 'max_stock', 'created_at', 'updated_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const offset = (page - 1) * pageSize;
    const products = db.prepare(`
      SELECT p.*,
        (SELECT SUM(qty) FROM inventory WHERE product_id = p.id) as total_stock,
        (SELECT COUNT(*) FROM inventory WHERE product_id = p.id) as warehouse_count
      FROM products p
      ${whereClause}
      ORDER BY ${sortField} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: products,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });
  })
);

/**
 * @route   GET /api/products/all
 * @desc    获取所有活跃产品（下拉选择用）
 */
router.get('/all',
  permissionMiddleware('products', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const products = db.prepare(`
      SELECT id, name, sku, category, unit, spec, sale_price, cost_price
      FROM products
      WHERE company_id = ? AND status = 'active'
      ORDER BY name
    `).all(companyId);

    res.json({ success: true, data: products });
  })
);

/**
 * @route   GET /api/products/:id
 * @desc    获取产品详情
 */
router.get('/:id',
  permissionMiddleware('products', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const product = db.prepare(`
      SELECT p.*,
        (SELECT SUM(qty) FROM inventory WHERE product_id = p.id) as total_stock,
        (SELECT SUM(locked_qty) FROM inventory WHERE product_id = p.id) as available_stock
      FROM products p
      WHERE p.id = ? AND p.company_id = ?
    `).get(req.params.id, req.user.companyId);

    if (!product) {
      throw ErrorTypes.NotFound('产品');
    }

    // 获取各仓库库存
    const warehouseStock = db.prepare(`
      SELECT i.*, w.name as warehouse_name, w.warehouse_code
      FROM inventory i
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      WHERE i.product_id = ? AND i.company_id = ?
      ORDER BY w.name
    `).all(req.params.id, req.user.companyId);

    // 获取最近库存变动
    const recentMovements = db.prepare(`
      SELECT sm.*, w.name as warehouse_name
      FROM stock_movements sm
      LEFT JOIN warehouses w ON sm.warehouse_id = w.id
      WHERE sm.product_id = ?
      ORDER BY sm.created_at DESC
      LIMIT 10
    `).all(req.params.id);

    res.json({
      success: true,
      data: {
        ...product,
        warehouseStock,
        recentMovements
      }
    });
  })
);

/**
 * @route   POST /api/products
 * @desc    创建产品
 */
router.post('/',
  permissionMiddleware('products', 'create'),
  validate(productSchemas.create),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    // 检查名称是否重复
    const existing = db.prepare('SELECT id FROM products WHERE company_id = ? AND name = ?').get(companyId, req.body.name);
    if (existing) {
      throw ErrorTypes.DuplicateEntry('产品名称');
    }

    // 如果提供了产品编码，检查是否重复
    if (req.body.sku) {
      const existingCode = db.prepare('SELECT id FROM products WHERE company_id = ? AND sku = ?').get(companyId, req.body.sku);
      if (existingCode) {
        throw ErrorTypes.DuplicateEntry('产品编码');
      }
    }

    const result = db.prepare(`
      INSERT INTO products (
        company_id, sku, name, category, spec, unit,
        cost_price, sale_price, min_stock, max_stock, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, req.body.sku, req.body.name,
      req.body.category || null, req.body.spec || null, req.body.unit || null,
      req.body.cost_price || 0, req.body.sale_price || 0, 
      req.body.min_stock || 0, req.body.max_stock || 0,
      req.body.status || 'active'
    );

    const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: newProduct, message: '产品创建成功' });
  })
);

/**
 * @route   PUT /api/products/:id
 * @desc    更新产品
 */
router.put('/:id',
  permissionMiddleware('products', 'update'),
  validateId('id'),
  validate(productSchemas.update),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabaseCompat();

    const product = db.prepare('SELECT * FROM products WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
    if (!product) {
      throw ErrorTypes.NotFound('产品');
    }

    const updates = [];
    const values = [];
    const allowedFields = ['sku', 'name', 'category', 'spec', 
                           'unit', 'cost_price', 'sale_price', 'min_stock', 
                           'max_stock', 'status'];

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        if (key === 'is_serialized' || key === 'is_batch_managed') {
          updates.push(`${key} = ?`);
          values.push(value ? 1 : 0);
        } else {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }
    }

    if (updates.length === 0) {
      throw ErrorTypes.BadRequest('没有要更新的数据');
    }

    values.push(id);
    db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ success: true, message: '产品更新成功' });
  })
);

/**
 * @route   DELETE /api/products/:id
 * @desc    删除产品
 */
router.delete('/:id',
  permissionMiddleware('products', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const product = db.prepare('SELECT * FROM products WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!product) {
      throw ErrorTypes.NotFound('产品');
    }

    // 检查是否有库存
    const inventory = db.prepare('SELECT COUNT(*) as count FROM inventory WHERE product_id = ?').get(req.params.id);
    if (inventory.count > 0) {
      throw ErrorTypes.BadRequest('该产品存在库存，无法删除');
    }

    // 检查是否有库存变动记录
    const movements = db.prepare('SELECT COUNT(*) as count FROM stock_movements WHERE product_id = ?').get(req.params.id);
    if (movements.count > 0) {
      throw ErrorTypes.BadRequest('该产品存在库存变动记录，无法删除');
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: '产品已删除' });
  })
);

/**
 * @route   GET /api/products/:id/inventory
 * @desc    获取产品在各仓库的库存
 */
router.get('/:id/inventory',
  permissionMiddleware('products', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const product = db.prepare('SELECT id FROM products WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!product) {
      throw ErrorTypes.NotFound('产品');
    }

    const inventory = db.prepare(`
      SELECT i.*, w.name as warehouse_name, w.warehouse_code, w.warehouse_type
      FROM inventory i
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      WHERE i.product_id = ?
      ORDER BY w.name
    `).all(req.params.id);

    res.json({ success: true, data: inventory });
  })
);

/**
 * @route   GET /api/products/:id/movements
 * @desc    获取产品库存变动记录
 */
router.get('/:id/movements',
  permissionMiddleware('products', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, movement_type, warehouse_id } = req.query;

    const product = db.prepare('SELECT id FROM products WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
    if (!product) {
      throw ErrorTypes.NotFound('产品');
    }

    let whereClause = 'WHERE sm.product_id = ?';
    const params = [req.params.id];

    if (movement_type) {
      whereClause += ' AND sm.movement_type = ?';
      params.push(movement_type);
    }

    if (warehouse_id) {
      whereClause += ' AND sm.warehouse_id = ?';
      params.push(warehouse_id);
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM stock_movements sm ${whereClause}
    `).get(...params);

    const offset = (page - 1) * pageSize;
    const movements = db.prepare(`
      SELECT sm.*, w.name as warehouse_name, u.real_name as operator_name
      FROM stock_movements sm
      LEFT JOIN warehouses w ON sm.warehouse_id = w.id
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

/**
 * @route   GET /api/products/categories/list
 * @desc    获取产品分类列表
 */
router.get('/categories/list',
  permissionMiddleware('products', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const categories = db.prepare(`
      SELECT DISTINCT category as name, COUNT(*) as count
      FROM products
      WHERE company_id = ? AND category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY category
    `).all(companyId);

    res.json({ success: true, data: categories });
  })
);

/**
 * @route   GET /api/products/:id/prices
 * @desc    获取产品价格表
 */
router.get('/:id/prices',
  permissionMiddleware('products', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;

    const product = db.prepare('SELECT id, name, sale_price FROM products WHERE id = ? AND company_id = ?').get(req.params.id, companyId);
    if (!product) {
      throw ErrorTypes.NotFound('产品');
    }

    const prices = db.prepare(`
      SELECT * FROM price_lists
      WHERE product_id = ? AND company_id = ? AND status = 'active'
      ORDER BY customer_level, min_qty
    `).all(req.params.id, companyId);

    res.json({ success: true, data: { product, prices } });
  })
);

/**
 * @route   POST /api/products/:id/prices
 * @desc    添加产品价格
 */
router.post('/:id/prices',
  permissionMiddleware('products', 'update'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    const { customer_level = 'default', price, min_qty = 1, start_date, end_date } = req.body;

    if (!price || price <= 0) {
      throw ErrorTypes.BadRequest('价格必须大于0');
    }

    const product = db.prepare('SELECT id FROM products WHERE id = ? AND company_id = ?').get(req.params.id, companyId);
    if (!product) {
      throw ErrorTypes.NotFound('产品');
    }

    // 检查是否已存在相同等级和数量的价格
    const existing = db.prepare(`
      SELECT id FROM price_lists
      WHERE product_id = ? AND company_id = ? AND customer_level = ? AND min_qty = ? AND status = 'active'
    `).get(req.params.id, companyId, customer_level, min_qty);

    if (existing) {
      // 更新现有价格
      db.prepare(`UPDATE price_lists SET price = ?, start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(price, start_date || null, end_date || null, existing.id);
      res.json({ success: true, message: '价格更新成功' });
    } else {
      // 创建新价格
      const result = db.prepare(`
        INSERT INTO price_lists (company_id, product_id, customer_level, price, min_qty, start_date, end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(companyId, req.params.id, customer_level, price, min_qty, start_date || null, end_date || null);
      res.status(201).json({ success: true, data: { id: result.lastInsertRowid }, message: '价格添加成功' });
    }
  })
);

/**
 * @route   DELETE /api/products/:id/prices/:priceId
 * @desc    删除产品价格
 */
router.delete('/:id/prices/:priceId',
  permissionMiddleware('products', 'update'),
  validateId('id'),
  validateId('priceId'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();

    const price = db.prepare('SELECT id FROM price_lists WHERE id = ? AND product_id = ? AND company_id = ?').get(req.params.priceId, req.params.id, req.user.companyId);
    if (!price) {
      throw ErrorTypes.NotFound('价格');
    }

    db.prepare('UPDATE price_lists SET status = ? WHERE id = ?').run('inactive', req.params.priceId);
    res.json({ success: true, message: '价格已删除' });
  })
);

/**
 * @route   GET /api/products/price-by-customer
 * @desc    根据客户等级获取产品价格
 */
router.get('/price-by-customer',
  permissionMiddleware('products', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { product_id, customer_level = 'default', qty = 1 } = req.query;

    if (!product_id) {
      throw ErrorTypes.BadRequest('缺少产品ID');
    }

    // 查找符合条件的价格（数量 >= qty）
    const price = db.prepare(`
      SELECT * FROM price_lists
      WHERE product_id = ? AND company_id = ? AND customer_level = ?
        AND min_qty <= ? AND status = 'active'
        AND (start_date IS NULL OR start_date <= date('now'))
        AND (end_date IS NULL OR end_date >= date('now'))
      ORDER BY min_qty DESC
      LIMIT 1
    `).get(product_id, req.user.companyId, customer_level, qty);

    // 如果没有找到等级价格，返回产品默认售价
    const product = db.prepare('SELECT id, name, sale_price FROM products WHERE id = ? AND company_id = ?').get(product_id, req.user.companyId);

    res.json({
      success: true,
      data: {
        price: price ? price.price : product?.sale_price || 0,
        priceSource: price ? 'price_list' : 'default',
        priceInfo: price || null
      }
    });
  })
);

module.exports = router;