const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

router.use(authMiddleware);

/**
 * @route   GET /api/departments
 * @desc    获取部门列表
 */
router.get('/',
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const companyId = req.user.companyId;
    
    const departments = db.prepare(`
      SELECT id, name, parent_id, level, status
      FROM departments
      WHERE company_id = ? AND status = 'active'
      ORDER BY id
    `).all(companyId);
    
    res.json({ success: true, data: departments || [] });
  })
);

module.exports = router;