/**
 * 合同审核路由
 * POST /api/contracts/:id/review - 触发审核
 * GET /api/contracts/:id/review - 获取审核结果
 * GET /api/contracts/:id/reviews - 获取审核历史
 * POST /api/contracts/:id/analyze - 分析合同（上传文件/文本）
 * PUT /api/reviews/:id/manual - 人工复审
 * POST /api/contracts/batch-review - 批量审核
 * GET/POST/PUT/DELETE /api/risk-rules - 风险规则管理
 * GET/PUT /api/partners/:id/risk - Partner 风险档案
 */
const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate, validateId } = require('../middleware/validation');
const contractReviewAI = require('../services/contract-review-ai');
const Joi = require('joi');
const logger = console;

router.use(authMiddleware);

// ============ 合同审核 ============

/**
 * @route   POST /api/contracts/:id/review
 * @desc    触发合同审核
 */
router.post('/contracts/:id/review',
  permissionMiddleware('contracts', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const contractId = req.params.id;
    const companyId = req.user.companyId;
    const { contract_text } = req.body;

    // 获取合同
    const contract = db.prepare(
      'SELECT * FROM contracts WHERE id = ? AND company_id = ?'
    ).get(contractId, companyId);

    if (!contract) {
      throw ErrorTypes.NotFound('合同');
    }

    // 获取关联的 Partner 信息
    let partnerRisks = { partyA: null, partyB: null };
    if (contract.party_a_partner_id) {
      const partnerA = db.prepare('SELECT risk_level FROM partners WHERE id = ?').get(contract.party_a_partner_id);
      partnerRisks.partyA = partnerA?.risk_level || 'low';
    }
    if (contract.party_b_partner_id) {
      const partnerB = db.prepare('SELECT risk_level FROM partners WHERE id = ?').get(contract.party_b_partner_id);
      partnerRisks.partyB = partnerB?.risk_level || 'low';
    }

    // 确定合同文本
    let textToAnalyze = contract_text;
    if (!textToAnalyze) {
      // 优先使用合同正文，否则用备注
      textToAnalyze = contract.terms_and_conditions || contract.notes || '';
    }

    if (!textToAnalyze || textToAnalyze.trim().length < 50) {
      throw ErrorTypes.BadRequest('合同文本内容不足，无法进行 AI 审核');
    }

    // 调用 AI 分析
    const aiResult = await contractReviewAI.analyze(textToAnalyze, { partnerRisks });

    // 保存审核结果
    const reviewResult = db.prepare(`
      INSERT INTO contract_reviews (
        contract_id, party_a_risk_level, party_b_risk_level,
        party_a_risk_factors, party_b_risk_factors,
        contract_type, contract_type_confidence,
        overall_risk_level, risk_score,
        risk_findings, review_suggestions,
        ai_model, ai_tokens_used,
        review_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', datetime('now'))
    `).run(
      contractId,
      aiResult.data.party_a_risk_level,
      aiResult.data.party_b_risk_level,
      JSON.stringify(aiResult.data.party_a_risk_factors),
      JSON.stringify(aiResult.data.party_b_risk_factors),
      aiResult.data.contract_type,
      aiResult.data.contract_type_confidence,
      aiResult.data.overall_risk_level,
      aiResult.data.overall_risk_score,
      JSON.stringify(aiResult.data.risk_findings),
      JSON.stringify(aiResult.data.review_suggestions),
      aiResult.data.ai_model,
      aiResult.data.ai_tokens_used
    );

    const reviewId = reviewResult.lastInsertRowid;

    // 记录审核历史
    db.prepare(`
      INSERT INTO contract_review_history (review_id, action, operator_id)
      VALUES (?, 'ai_completed', ?)
    `).run(reviewId, req.user.id);

    // 更新合同表
    db.prepare(`
      UPDATE contracts SET 
        review_id = ?,
        is_ai_reviewed = 1,
        contract_category = ?
      WHERE id = ?
    `).run(reviewId, aiResult.data.contract_type, contractId);

    res.json({
      success: true,
      data: {
        review_id: reviewId,
        overall_risk_level: aiResult.data.overall_risk_level,
        risk_score: aiResult.data.overall_risk_score,
        contract_type: aiResult.data.contract_type,
        contract_type_confidence: aiResult.data.contract_type_confidence,
        party_a_risk_level: aiResult.data.party_a_risk_level,
        party_b_risk_level: aiResult.data.party_b_risk_level,
        risk_findings: aiResult.data.risk_findings,
        review_suggestions: aiResult.data.review_suggestions,
        ai_model: aiResult.data.ai_model,
        ai_tokens_used: aiResult.data.ai_tokens_used
      }
    });
  })
);

/**
 * @route   GET /api/contracts/:id/review
 * @desc    获取合同最新审核结果
 */
router.get('/contracts/:id/review',
  permissionMiddleware('contracts', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const contractId = req.params.id;
    const companyId = req.user.companyId;

    // 验证合同属于当前公司
    const contract = db.prepare(
      'SELECT id FROM contracts WHERE id = ? AND company_id = ?'
    ).get(contractId, companyId);

    if (!contract) {
      throw ErrorTypes.NotFound('合同');
    }

    // 获取最新审核结果
    const review = db.prepare(`
      SELECT * FROM contract_reviews 
      WHERE contract_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(contractId);

    if (!review) {
      return res.json({
        success: true,
        data: null,
        message: '该合同尚未进行 AI 审核'
      });
    }

    // 格式化输出
    res.json({
      success: true,
      data: {
        review_id: review.id,
        overall_risk_level: review.overall_risk_level,
        risk_score: review.risk_score,
        contract_type: review.contract_type,
        contract_type_confidence: review.contract_type_confidence,
        party_a_risk_level: review.party_a_risk_level,
        party_b_risk_level: review.party_b_risk_level,
        party_a_risk_factors: JSON.parse(review.party_a_risk_factors || '[]'),
        party_b_risk_factors: JSON.parse(review.party_b_risk_factors || '[]'),
        risk_findings: JSON.parse(review.risk_findings || '[]'),
        review_suggestions: JSON.parse(review.review_suggestions || '[]'),
        ai_model: review.ai_model,
        ai_tokens_used: review.ai_tokens_used,
        review_status: review.review_status,
        reviewed_at: review.reviewed_at || review.created_at,
        created_at: review.created_at
      }
    });
  })
);

/**
 * @route   GET /api/contracts/:id/reviews
 * @desc    获取合同所有审核历史
 */
router.get('/contracts/:id/reviews',
  permissionMiddleware('contracts', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const contractId = req.params.id;
    const companyId = req.user.companyId;

    // 验证合同
    const contract = db.prepare(
      'SELECT id FROM contracts WHERE id = ? AND company_id = ?'
    ).get(contractId, companyId);

    if (!contract) {
      throw ErrorTypes.NotFound('合同');
    }

    // 获取所有审核记录
    const reviews = db.prepare(`
      SELECT r.*, u.real_name as reviewer_name
      FROM contract_reviews r
      LEFT JOIN users u ON r.reviewer_id = u.id
      WHERE r.contract_id = ?
      ORDER BY r.created_at DESC
    `).all(contractId);

    // 获取历史记录
    const reviewsWithHistory = reviews.map(review => {
      const history = db.prepare(`
        SELECT h.*, u.real_name as operator_name
        FROM contract_review_history h
        LEFT JOIN users u ON h.operator_id = u.id
        WHERE h.review_id = ?
        ORDER BY h.created_at ASC
      `).all(review.id);

      return {
        ...review,
        party_a_risk_factors: JSON.parse(review.party_a_risk_factors || '[]'),
        party_b_risk_factors: JSON.parse(review.party_b_risk_factors || '[]'),
        risk_findings: JSON.parse(review.risk_findings || '[]'),
        review_suggestions: JSON.parse(review.review_suggestions || '[]'),
        history
      };
    });

    res.json({
      success: true,
      data: reviewsWithHistory
    });
  })
);

/**
 * @route   POST /api/contracts/:id/analyze
 * @desc    分析合同（支持上传文件或文本）
 */
router.post('/contracts/:id/analyze',
  permissionMiddleware('contracts', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const contractId = req.params.id;
    const companyId = req.user.companyId;
    const { contract_text } = req.body;

    // 获取合同
    const contract = db.prepare(
      'SELECT * FROM contracts WHERE id = ? AND company_id = ?'
    ).get(contractId, companyId);

    if (!contract) {
      throw ErrorTypes.NotFound('合同');
    }

    // 确定合同文本
    let textToAnalyze = contract_text;
    if (!textToAnalyze) {
      textToAnalyze = contract.terms_and_conditions || contract.notes || '';
    }

    if (!textToAnalyze || textToAnalyze.trim().length < 50) {
      throw ErrorTypes.BadRequest('合同文本内容不足，无法进行分析');
    }

    // 获取 Partner 风险
    let partnerRisks = { partyA: null, partyB: null };
    if (contract.party_a_partner_id) {
      const partnerA = db.prepare('SELECT risk_level FROM partners WHERE id = ?').get(contract.party_a_partner_id);
      partnerRisks.partyA = partnerA?.risk_level || 'low';
    }
    if (contract.party_b_partner_id) {
      const partnerB = db.prepare('SELECT risk_level FROM partners WHERE id = ?').get(contract.party_b_partner_id);
      partnerRisks.partyB = partnerB?.risk_level || 'low';
    }

    // 调用 AI 分析（不保存，仅返回分析结果）
    const aiResult = await contractReviewAI.analyze(textToAnalyze, { partnerRisks });

    res.json({
      success: true,
      data: {
        review_id: null, // 分析不保存
        overall_risk_level: aiResult.data.overall_risk_level,
        risk_score: aiResult.data.overall_risk_score,
        contract_type: aiResult.data.contract_type,
        contract_type_confidence: aiResult.data.contract_type_confidence,
        party_a_risk_level: aiResult.data.party_a_risk_level,
        party_b_risk_level: aiResult.data.party_b_risk_level,
        party_a_risk_factors: aiResult.data.party_a_risk_factors,
        party_b_risk_factors: aiResult.data.party_b_risk_factors,
        risk_findings: aiResult.data.risk_findings,
        review_suggestions: aiResult.data.review_suggestions,
        ai_model: aiResult.data.ai_model,
        ai_tokens_used: aiResult.data.ai_tokens_used
      }
    });
  })
);

/**
 * @route   PUT /api/reviews/:reviewId/manual
 * @desc    人工复审
 */
router.put('/reviews/:reviewId/manual',
  permissionMiddleware('contracts', 'update'),
  validateId('reviewId'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { reviewId } = req.params;
    const { overall_risk_level, risk_findings, review_suggestions, notes } = req.body;

    // 获取审核记录
    const review = db.prepare('SELECT * FROM contract_reviews WHERE id = ?').get(reviewId);

    if (!review) {
      throw ErrorTypes.NotFound('审核记录');
    }

    // 验证合同属于当前公司
    const contract = db.prepare(
      'SELECT id FROM contracts WHERE id = ? AND company_id = ?'
    ).get(review.contract_id, req.user.companyId);

    if (!contract) {
      throw ErrorTypes.NotFound('合同');
    }

    // 更新审核记录
    db.prepare(`
      UPDATE contract_reviews SET
        overall_risk_level = ?,
        risk_findings = ?,
        review_suggestions = ?,
        reviewer_id = ?,
        reviewed_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      overall_risk_level,
      JSON.stringify(risk_findings || []),
      JSON.stringify(review_suggestions || []),
      req.user.id,
      reviewId
    );

    // 记录历史
    db.prepare(`
      INSERT INTO contract_review_history (review_id, action, operator_id, changes)
      VALUES (?, 'manual_reviewed', ?, ?)
    `).run(reviewId, req.user.id, JSON.stringify({
      overall_risk_level,
      notes,
      modified_by: req.user.real_name || req.user.username
    }));

    res.json({
      success: true,
      message: '人工复审完成'
    });
  })
);

/**
 * @route   POST /api/contracts/batch-review
 * @desc    批量审核
 */
router.post('/contracts/batch-review',
  permissionMiddleware('contracts', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { contract_ids } = req.body;
    const companyId = req.user.companyId;

    if (!Array.isArray(contract_ids) || contract_ids.length === 0) {
      throw ErrorTypes.BadRequest('请提供合同 ID 列表');
    }

    if (contract_ids.length > 20) {
      throw ErrorTypes.BadRequest('单次批量审核最多支持 20 个合同');
    }

    const results = [];

    for (const contractId of contract_ids) {
      try {
        const contract = db.prepare(
          'SELECT * FROM contracts WHERE id = ? AND company_id = ?'
        ).get(contractId, companyId);

        if (!contract) {
          results.push({ contract_id: contractId, success: false, error: '合同不存在' });
          continue;
        }

        const textToAnalyze = contract.terms_and_conditions || contract.notes || '';
        if (!textToAnalyze || textToAnalyze.trim().length < 50) {
          results.push({ contract_id: contractId, success: false, error: '合同文本不足' });
          continue;
        }

        // 获取 Partner 风险
        let partnerRisks = { partyA: null, partyB: null };
        if (contract.party_a_partner_id) {
          const partnerA = db.prepare('SELECT risk_level FROM partners WHERE id = ?').get(contract.party_a_partner_id);
          partnerRisks.partyA = partnerA?.risk_level || 'low';
        }
        if (contract.party_b_partner_id) {
          const partnerB = db.prepare('SELECT risk_level FROM partners WHERE id = ?').get(contract.party_b_partner_id);
          partnerRisks.partyB = partnerB?.risk_level || 'low';
        }

        const aiResult = await contractReviewAI.analyze(textToAnalyze, { partnerRisks });

        // 保存
        const reviewResult = db.prepare(`
          INSERT INTO contract_reviews (
            contract_id, party_a_risk_level, party_b_risk_level,
            party_a_risk_factors, party_b_risk_factors,
            contract_type, contract_type_confidence,
            overall_risk_level, risk_score,
            risk_findings, review_suggestions,
            ai_model, ai_tokens_used,
            review_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
        `).run(
          contractId,
          aiResult.data.party_a_risk_level,
          aiResult.data.party_b_risk_level,
          JSON.stringify(aiResult.data.party_a_risk_factors),
          JSON.stringify(aiResult.data.party_b_risk_factors),
          aiResult.data.contract_type,
          aiResult.data.contract_type_confidence,
          aiResult.data.overall_risk_level,
          aiResult.data.overall_risk_score,
          JSON.stringify(aiResult.data.risk_findings),
          JSON.stringify(aiResult.data.review_suggestions),
          aiResult.data.ai_model,
          aiResult.data.ai_tokens_used
        );

        const reviewId = reviewResult.lastInsertRowid;

        db.prepare(`
          UPDATE contracts SET review_id = ?, is_ai_reviewed = 1, contract_category = ?
          WHERE id = ?
        `).run(reviewId, aiResult.data.contract_type, contractId);

        results.push({
          contract_id: contractId,
          success: true,
          review_id: reviewId,
          overall_risk_level: aiResult.data.overall_risk_level,
          risk_score: aiResult.data.overall_risk_score
        });

      } catch (err) {
        console.error('Batch review error:', err);
        results.push({ contract_id: contractId, success: false, error: err.message });
      }
    }

    res.json({
      success: true,
      data: {
        total: contract_ids.length,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      }
    });
  })
);

// ============ 风险规则管理 ============

const riskRuleSchema = Joi.object({
  rule_name: Joi.string().max(100).required(),
  rule_type: Joi.string().valid('party_risk', 'contract_risk', 'amount_risk').required(),
  condition: Joi.object().required(),
  risk_level: Joi.string().valid('low', 'medium', 'high').required(),
  suggestion_template: Joi.string().allow(''),
  enabled: Joi.number().valid(0, 1).default(1),
  priority: Joi.number().integer().default(0)
});

/**
 * @route   GET /api/risk-rules
 * @desc    获取风险规则列表
 */
router.get('/risk-rules',
  permissionMiddleware('contracts', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { rule_type, enabled } = req.query;

    let whereClause = '';
    const params = [];

    if (rule_type) {
      whereClause += ' WHERE rule_type = ?';
      params.push(rule_type);
    }

    if (enabled !== undefined) {
      whereClause += whereClause ? ' AND enabled = ?' : ' WHERE enabled = ?';
      params.push(enabled);
    }

    const rules = db.prepare(`
      SELECT * FROM risk_rules ${whereClause}
      ORDER BY priority DESC, created_at DESC
    `).all(...params);

    res.json({
      success: true,
      data: rules.map(r => ({
        ...r,
        condition: JSON.parse(r.condition || '{}')
      }))
    });
  })
);

/**
 * @route   POST /api/risk-rules
 * @desc    创建风险规则
 */
router.post('/risk-rules',
  permissionMiddleware('contracts', 'update'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { error, value } = riskRuleSchema.validate(req.body);

    if (error) {
      throw ErrorTypes.BadRequest(error.details[0].message);
    }

    const result = db.prepare(`
      INSERT INTO risk_rules (rule_name, rule_type, condition, risk_level, suggestion_template, enabled, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      value.rule_name,
      value.rule_type,
      JSON.stringify(value.condition),
      value.risk_level,
      value.suggestion_template || '',
      value.enabled,
      value.priority
    );

    res.status(201).json({
      success: true,
      data: { id: result.lastInsertRowid },
      message: '风险规则创建成功'
    });
  })
);

/**
 * @route   PUT /api/risk-rules/:id
 * @desc    更新风险规则
 */
router.put('/risk-rules/:id',
  permissionMiddleware('contracts', 'update'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { id } = req.params;

    const rule = db.prepare('SELECT * FROM risk_rules WHERE id = ?').get(id);
    if (!rule) {
      throw ErrorTypes.NotFound('风险规则');
    }

    const updates = [];
    const values = [];

    const allowedFields = ['rule_name', 'rule_type', 'condition', 'risk_level', 'suggestion_template', 'enabled', 'priority'];

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        if (key === 'condition') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }

    if (updates.length === 0) {
      throw ErrorTypes.BadRequest('没有要更新的数据');
    }

    values.push(id);
    db.prepare(`UPDATE risk_rules SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({
      success: true,
      message: '风险规则更新成功'
    });
  })
);

/**
 * @route   DELETE /api/risk-rules/:id
 * @desc    删除风险规则
 */
router.delete('/risk-rules/:id',
  permissionMiddleware('contracts', 'delete'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { id } = req.params;

    const rule = db.prepare('SELECT * FROM risk_rules WHERE id = ?').get(id);
    if (!rule) {
      throw ErrorTypes.NotFound('风险规则');
    }

    db.prepare('DELETE FROM risk_rules WHERE id = ?').run(id);

    res.json({
      success: true,
      message: '风险规则已删除'
    });
  })
);

// ============ Partner 风险管理 ============

/**
 * @route   GET /api/partners/:id/risk
 * @desc    获取 Partner 风险档案
 */
router.get('/partners/:id/risk',
  permissionMiddleware('partners', 'read'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const companyId = req.user.companyId;

    const partner = db.prepare(
      'SELECT * FROM partners WHERE id = ? AND company_id = ?'
    ).get(id, companyId);

    if (!partner) {
      throw ErrorTypes.NotFound('合作方');
    }

    // 获取统计
    const stats = db.prepare(`
      SELECT 
        (SELECT SUM(amount) FROM contracts WHERE partner_id = ? AND company_id = ?) as total_contract_amount,
        (SELECT COUNT(*) FROM contracts WHERE partner_id = ? AND company_id = ?) as contract_count,
        (SELECT SUM(receivable) FROM partners WHERE id = ?) as receivable,
        (SELECT SUM(payable) FROM partners WHERE id = ?) as payable
    `).get(id, companyId, id, companyId, id, id);

    // 获取历史审核中该 Partner 的风险记录
    const partnerContracts = db.prepare(`
      SELECT cr.party_a_risk_level, cr.party_b_risk_level, cr.created_at
      FROM contract_reviews cr
      JOIN contracts c ON cr.contract_id = c.id
      WHERE (c.party_a_partner_id = ? OR c.party_b_partner_id = ?)
      AND c.company_id = ?
      ORDER BY cr.created_at DESC
      LIMIT 10
    `).all(id, id, companyId);

    res.json({
      success: true,
      data: {
        partner_id: id,
        partner_name: partner.name,
        risk_level: partner.risk_level || 'low',
        risk_reason: partner.risk_reason,
        credit_score: partner.credit_score,
        stats,
        recent_reviews: partnerContracts
      }
    });
  })
);

/**
 * @route   PUT /api/partners/:id/risk
 * @desc    更新 Partner 风险等级
 */
router.put('/partners/:id/risk',
  permissionMiddleware('partners', 'update'),
  validateId('id'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const companyId = req.user.companyId;
    const { risk_level, risk_reason, credit_score } = req.body;

    const partner = db.prepare(
      'SELECT * FROM partners WHERE id = ? AND company_id = ?'
    ).get(id, companyId);

    if (!partner) {
      throw ErrorTypes.NotFound('合作方');
    }

    const updates = [];
    const values = [];

    if (risk_level !== undefined) {
      updates.push('risk_level = ?');
      values.push(risk_level);
    }
    if (risk_reason !== undefined) {
      updates.push('risk_reason = ?');
      values.push(risk_reason);
    }
    if (credit_score !== undefined) {
      updates.push('credit_score = ?');
      values.push(credit_score);
    }

    if (updates.length === 0) {
      throw ErrorTypes.BadRequest('没有要更新的数据');
    }

    values.push(id);
    db.prepare(`UPDATE partners SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({
      success: true,
      message: '风险等级更新成功'
    });
  })
);

module.exports = router;
