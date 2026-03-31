/**
 * 内部 OCR 路由（免认证，仅限 localhost）
 */
const express = require('express');
const router = express.Router();
const baiduOcr = require('../services/baidu-ocr');
const { asyncHandler } = require('../middleware/error');

router.post('/ocr',
  asyncHandler(async (req, res) => {
    const { image } = req.body;
    if (!image) {
      return res.json({ success: false, error: '缺少图片' });
    }
    let base64Image = image.replace(/^data:image\/\w+;base64,/, '');
    const invoiceData = await baiduOcr.recognizeVatInvoice(base64Image);
    if (!invoiceData || !invoiceData.success) {
      return res.json({ success: false, error: invoiceData?.error || 'OCR识别失败' });
    }
    return res.json({ success: true, data: invoiceData });
  })
);

module.exports = router;
