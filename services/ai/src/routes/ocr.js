/**
 * OCR 票据识别路由
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../utils/logger');
const AIProviderFactory = require('../providers');

// 配置文件上传
const upload = multer({
  dest: path.join(__dirname, '../../uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

/**
 * 验证 JWT 中间件
 */
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌', code: 'NO_TOKEN' });
  }
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '令牌无效或已过期', code: 'INVALID_TOKEN' });
  }
}

/**
 * POST /api/ocr/recognize - 票据识别
 */
router.post('/recognize', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传图片文件' });
    }
    
    const provider = AIProviderFactory.getProvider(config.ai.provider);
    
    // 读取图片并转为 base64
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;
    
    // 调用 AI 进行 OCR
    const prompt = `请识别这张票据图片中的信息，返回以下 JSON 格式：

{
  "type": "发票类型（增值税发票/出租车票/火车票/餐饮发票/其他）",
  "amount": "金额（数字）",
  "date": "日期（YYYY-MM-DD）",
  "seller": "销售方名称",
  "buyer": "购买方名称（如有）",
  "items": [
    {
      "name": "商品/服务名称",
      "quantity": "数量",
      "price": "单价",
      "amount": "金额"
    }
  ],
  "taxAmount": "税额",
  "invoiceNumber": "发票号码",
  "confidence": 0.95
}

请仔细识别图片中的文字，尽可能准确地提取信息。如果某些字段无法识别，设为 null。`;

    const response = await provider.chat({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', data: base64Image, mimeType }
          ]
        }
      ]
    });
    
    // 解析结果
    let result;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      logger.error('OCR Parse Error:', e);
      result = { raw: response.content };
    }
    
    // 清理上传的文件
    fs.unlinkSync(req.file.path);
    
    // 记录日志
    logger.info('OCR Recognize', {
      userId: req.user.id,
      filename: req.file.originalname,
      success: !!result
    });
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (err) {
    logger.error('OCR Error:', err);
    
    // 清理文件
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: err.message || 'OCR 识别失败' });
  }
});

/**
 * POST /api/ocr/batch - 批量识别
 */
router.post('/batch', authMiddleware, upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '请上传图片文件' });
    }
    
    const results = [];
    
    for (const file of req.files) {
      // 简化处理，实际应并发处理
      results.push({
        filename: file.originalname,
        status: 'pending'
      });
      
      // 清理文件
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }
    
    res.json({
      success: true,
      data: { results, total: results.length }
    });
    
  } catch (err) {
    logger.error('OCR Batch Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;