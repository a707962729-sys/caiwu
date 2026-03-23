const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

router.use(authMiddleware);

/**
 * @route   GET /api/roles
 * @desc    获取角色列表
 */
router.get('/',
  asyncHandler(async (req, res) => {
    // 系统内置角色
    const roles = [
      { id: 'boss', name: '老板', description: '拥有所有权限', level: 1 },
      { id: 'accountant', name: '会计', description: '财务相关权限', level: 2 },
      { id: 'employee', name: '员工', description: '基础查看权限', level: 3 }
    ];
    
    res.json({ success: true, data: roles });
  })
);

module.exports = router;