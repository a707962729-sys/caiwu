/**
 * 合同文件上传路由
 * 支持 PDF/Word 文件上传并提取文本内容
 * 支持劳动合同智能识别（提取员工信息和自动创建员工档案）
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validateId } = require('../middleware/validation');

// 动态导入 pdf-parse 和 mammoth
let pdfParse;
let mammoth;

// 初始化模块
async function initModules() {
  if (!pdfParse) {
    try {
      pdfParse = require('pdf-parse');
    } catch (e) {
      console.warn('pdf-parse not available:', e.message);
    }
  }
  if (!mammoth) {
    try {
      mammoth = require('mammoth');
    } catch (e) {
      console.warn('mammoth not available:', e.message);
    }
  }
}

router.use(authMiddleware);

// 上传目录
const uploadDir = path.join(__dirname, '../../uploads/contracts');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * @route   POST /api/contracts/:id/upload
 * @desc    上传合同文件（PDF/Word）并提取文本
 */
router.post('/contracts/:id/upload',
  permissionMiddleware('contracts', 'update'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    await initModules();
    
    const db = getDatabaseCompat();
    const contractId = req.params.id;
    const companyId = req.user.companyId;

    // 验证合同
    const contract = db.prepare(
      'SELECT * FROM contracts WHERE id = ? AND company_id = ?'
    ).get(contractId, companyId);

    if (!contract) {
      throw ErrorTypes.NotFound('合同');
    }

    // 检查是否有文件
    if (!req.files || !req.files.file) {
      throw ErrorTypes.BadRequest('请选择要上传的文件');
    }

    const file = req.files.file;
    
    // 验证文件类型
    const allowedTypes = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'doc'
    };

    const fileExt = allowedTypes[file.mimetype];
    if (!fileExt) {
      throw ErrorTypes.BadRequest('仅支持 PDF 和 Word 文档（.pdf, .docx, .doc）');
    }

    // 生成文件名
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `contract_${contractId}_${timestamp}_${originalName}`;
    const filePath = path.join(uploadDir, fileName);

    // 保存文件
    await file.mv(filePath);

    // 提取文本
    let text = '';
    let pages = 0;

    try {
      if (fileExt === 'pdf') {
        const result = await extractTextFromPDF(filePath);
        text = result.text;
        pages = result.pages;
      } else if (fileExt === 'docx' || fileExt === 'doc') {
        const result = await extractTextFromWord(filePath);
        text = result.text;
      }

      // 清理文本
      text = cleanText(text);

      // 如果提取的文本为空
      if (!text || text.trim().length < 50) {
        fs.unlinkSync(filePath);
        throw ErrorTypes.BadRequest('无法从文件中提取足够的文本内容');
      }

      // 更新合同记录
      db.prepare(`
        UPDATE contracts SET
          attachment = ?,
          terms_and_conditions = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(fileName, text, contractId);

      // 智能识别：尝试从文本中提取员工信息并自动创建员工档案
      let employeeInfo = null;
      try {
        employeeInfo = await extractEmployeeInfo(text);
        if (employeeInfo && employeeInfo.name) {
          // 检查员工是否已存在
          const existingEmployee = db.prepare(
            'SELECT id FROM employees WHERE name = ? AND company_id = ? LIMIT 1'
          ).get(employeeInfo.name, companyId);

          if (!existingEmployee) {
            // 自动创建员工档案
            const entryDate = employeeInfo.entry_date || new Date().toISOString().split('T')[0];
            const result = db.prepare(`
              INSERT INTO employees (company_id, name, hire_date, contract_id, status, created_at)
              VALUES (?, ?, ?, ?, 'probation', datetime('now'))
            `).run(companyId, employeeInfo.name, entryDate, contractId);

            employeeInfo.created = true;
            employeeInfo.employee_id = result.lastInsertRowid;
          } else {
            employeeInfo.already_exists = true;
            employeeInfo.employee_id = existingEmployee.id;
          }
        }
      } catch (err) {
        console.warn('员工信息提取失败:', err.message);
      }

      // 记录操作日志
      db.prepare(`
        INSERT INTO contract_review_history (
          contract_id, action, operator_id, changes, created_at
        ) VALUES (?, 'file_uploaded', ?, ?, datetime('now'))
      `).run(
        contractId,
        req.user.id,
        JSON.stringify({
          filename: fileName,
          original_name: originalName,
          file_size: file.size,
          pages: pages,
          text_length: text.length,
          uploaded_by: req.user.real_name || req.user.username
        })
      );

      res.json({
        success: true,
        data: {
          filename: fileName,
          original_name: originalName,
          text: text.substring(0, 5000), // 返回前5000字符
          full_text: text,
          pages: pages,
          text_length: text.length,
          employee_info: employeeInfo
        },
        message: employeeInfo?.created ? '文件上传成功，已自动创建员工档案' : '文件上传并提取成功'
      });

    } catch (err) {
      // 清理文件
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw err;
    }
  })
);

/**
 * 从 PDF 提取文本
 */
async function extractTextFromPDF(filePath) {
  if (!pdfParse) {
    await initModules();
  }
  
  if (!pdfParse) {
    throw new Error('PDF 解析模块不可用');
  }

  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  
  return {
    text: data.text || '',
    pages: data.numpages || 0
  };
}

/**
 * 从 Word 文档提取文本
 */
async function extractTextFromWord(filePath) {
  if (!mammoth) {
    await initModules();
  }
  
  if (!mammoth) {
    throw new Error('Word 解析模块不可用');
  }

  const result = await mammoth.extractRawText({ path: filePath });
  
  return {
    text: result.value || ''
  };
}

/**
 * 清理提取的文本
 */
function cleanText(text) {
  if (!text) return '';
  
  return text
    // 移除多余的空白字符
    .replace(/\s+/g, ' ')
    // 移除特殊控制字符
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // 保留中文、英文、数字、常用标点
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s.,;:!?()（）《》【】""''、。，；！？""''：：—–…\-_=+*/%<>[\]{}@#$^&|~`'"\\]/g, '')
    // 规范化标点
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[（（]/g, '(')
    .replace(/[））]/g, ')')
    // 移除首尾空白
    .trim();
}

/**
 * 从合同文本中智能提取员工信息
 * 使用 AI 服务或正则表达式提取
 */
async function extractEmployeeInfo(text) {
  if (!text || text.length < 20) return null;

  try {
    // 调用 AI 服务
    const aiResponse = await fetch('http://localhost:3001/api/ai/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.substring(0, 8000), // 限制文本长度
        prompt: `从劳动合同中提取员工基本信息，返回JSON格式：
{
  "name": "员工姓名（必填）",
  "entry_date": "入职日期，格式YYYY-MM-DD（必填）",
  "position": "职位（可选）",
  "id_card": "身份证号（可选）"
}
只返回JSON，不要其他内容。如果无法提取某字段则留空。`
      })
    });

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      let result = aiData.data || aiData.result || aiData.response || aiData.text;
      
      // 解析 JSON
      if (typeof result === 'string') {
        // 尝试从文本中提取 JSON
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        }
      }

      if (result && result.name) {
        return {
          name: result.name.trim(),
          entry_date: result.entry_date || null,
          position: result.position || null,
          id_card: result.id_card || null,
          source: 'ai'
        };
      }
    }
  } catch (err) {
    console.warn('AI 提取失败，使用正则表达式:', err.message);
  }

  // 备用：使用正则表达式提取
  return extractByRegex(text);
}

/**
 * 使用正则表达式从文本中提取员工信息
 */
function extractByRegex(text) {
  // 提取姓名（常见模式）
  const namePatterns = [
    /(?:甲方|员工|劳动者|聘用人|雇员)[：:]\s*([^\s，,，。.。\n]{2,10})/,
    /(?:姓名|name)[：:]\s*([^\s，,，。.。\n]{2,10})/,
    /([\u4e00-\u9fa5]{2,4})(?:有限公司|集团|股份)?[^\u4e00-\u9fa5]*?(?:员工|劳动者|聘用人)/
  ];

  let name = null;
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      name = match[1];
      break;
    }
  }

  // 提取入职日期
  const datePatterns = [
    /(?:入职|开始|合同生效)[^\d]{0,5}(?:日期|日)?[：:]\s*(\d{4}[年\-/]\d{1,2}[月\-/]\d{1,2}[日]?)/,
    /(?:合同期限|合同期间)[：:][^\n]*?(\d{4}[年\-/]\d{1,2}[月\-/]\d{1,2}[日]?)/,
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/
  ];

  let entryDate = null;
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[3]) {
        entryDate = `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
      } else {
        entryDate = match[1].replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '');
      }
      break;
    }
  }

  if (!name && !entryDate) return null;

  return {
    name: name,
    entry_date: entryDate,
    source: 'regex'
  };
}

/**
 * @route   GET /api/contracts/:id/file
 * @desc    获取合同文件信息
 */
router.get('/contracts/:id/file',
  permissionMiddleware('contracts', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const contractId = req.params.id;
    const companyId = req.user.companyId;

    const contract = db.prepare(
      'SELECT id, name, attachment, terms_and_conditions FROM contracts WHERE id = ? AND company_id = ?'
    ).get(contractId, companyId);

    if (!contract) {
      throw ErrorTypes.NotFound('合同');
    }

    const filePath = contract.attachment ? path.join(uploadDir, contract.attachment) : null;
    
    res.json({
      success: true,
      data: {
        filename: contract.attachment,
        has_file: fs.existsSync(filePath),
        text_preview: contract.terms_and_conditions?.substring(0, 500) || null,
        text_length: contract.terms_and_conditions?.length || 0
      }
    });
  })
);

/**
 * @route   GET /api/contracts/:id/file/download
 * @desc    下载合同文件
 */
router.get('/contracts/:id/file/download',
  permissionMiddleware('contracts', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const contractId = req.params.id;
    const companyId = req.user.companyId;

    const contract = db.prepare(
      'SELECT id, name, attachment FROM contracts WHERE id = ? AND company_id = ?'
    ).get(contractId, companyId);

    if (!contract) {
      throw ErrorTypes.NotFound('合同');
    }

    if (!contract.attachment) {
      throw ErrorTypes.NotFound('合同文件');
    }

    const filePath = path.join(uploadDir, contract.attachment);
    
    if (!fs.existsSync(filePath)) {
      throw ErrorTypes.NotFound('合同文件不存在');
    }

    res.download(filePath, contract.attachment);
  })
);

module.exports = router;
