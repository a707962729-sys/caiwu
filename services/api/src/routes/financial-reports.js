const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { ErrorTypes, asyncHandler } = require('../middleware/error');
const { validate } = require('../middleware/validation');
const Joi = require('joi');

router.use(authMiddleware);

const reportSchema = Joi.object({
  period_year: Joi.number().integer().min(2000).max(2100).required(),
  period_month: Joi.number().integer().min(1).max(12).required(),
  period_end_month: Joi.number().integer().min(1).max(12).when('report_type', {
    is: 'balance_sheet',
    then: Joi.optional(),
    otherwise: Joi.forbidden()
  })
});

// 科目类型映射
const subjectTypeNames = {
  asset: '资产',
  liability: '负债',
  equity: '所有者权益',
  income: '收入',
  expense: '费用'
};

/**
 * 获取科目余额
 */
function getSubjectBalance(db, companyId, subjectId, periodYear, periodMonth) {
  const result = db.prepare(`
    SELECT 
      COALESCE(SUM(ve.debit_amount), 0) as total_debit,
      COALESCE(SUM(ve.credit_amount), 0) as total_credit
    FROM voucher_entries ve
    JOIN vouchers v ON ve.voucher_id = v.id
    WHERE ve.subject_id = ? AND v.company_id = ? AND v.status = 'posted'
      AND (v.period_year < ? OR (v.period_year = ? AND v.period_month <= ?))
  `).get(subjectId, companyId, periodYear, periodYear, periodMonth);

  return result;
}

/**
 * 获取科目本期发生额
 */
function getSubjectPeriodAmount(db, companyId, subjectId, periodYear, periodMonth) {
  const result = db.prepare(`
    SELECT 
      COALESCE(SUM(ve.debit_amount), 0) as period_debit,
      COALESCE(SUM(ve.credit_amount), 0) as period_credit
    FROM voucher_entries ve
    JOIN vouchers v ON ve.voucher_id = v.id
    WHERE ve.subject_id = ? AND v.company_id = ? AND v.status = 'posted'
      AND v.period_year = ? AND v.period_month = ?
  `).get(subjectId, companyId, periodYear, periodMonth);

  return result;
}

/**
 * 计算科目余额（考虑余额方向）
 */
function calculateBalance(subject, totalDebit, totalCredit) {
  if (subject.direction === 'debit') {
    return totalDebit - totalCredit;
  } else {
    return totalCredit - totalDebit;
  }
}

/**
 * @route   GET /api/financial-reports/trial-balance
 * @desc    试算平衡表
 */
router.get('/trial-balance',
  permissionMiddleware('financial-reports', 'read'),
  validate(reportSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { period_year, period_month } = req.query;
    const companyId = req.user.companyId;

    // 获取所有科目
    const subjects = db.prepare(`
      SELECT * FROM accounting_subjects
      WHERE company_id = ? AND is_enabled = 1
      ORDER BY subject_code ASC
    `).all(companyId);

    const reportData = [];
    let totalOpeningDebit = 0;
    let totalOpeningCredit = 0;
    let totalPeriodDebit = 0;
    let totalPeriodCredit = 0;
    let totalEndingDebit = 0;
    let totalEndingCredit = 0;

    for (const subject of subjects) {
      // 获取期初余额（上月末）
      const openingBalance = getSubjectBalance(db, companyId, subject.id, period_year, period_month - 1);
      const openingAmount = calculateBalance(subject, openingBalance.total_debit, openingBalance.total_credit);

      // 获取本期发生额
      const periodAmount = getSubjectPeriodAmount(db, companyId, subject.id, period_year, period_month);

      // 计算期末余额
      const endingDebit = openingBalance.total_debit + periodAmount.period_debit;
      const endingCredit = openingBalance.total_credit + periodAmount.period_credit;
      const endingAmount = calculateBalance(subject, endingDebit, endingCredit);

      // 根据科目方向设置借贷方向
      let openingDebit = 0, openingCredit = 0;
      let endingDebitVal = 0, endingCreditVal = 0;

      if (subject.direction === 'debit') {
        if (openingAmount >= 0) {
          openingDebit = openingAmount;
        } else {
          openingCredit = Math.abs(openingAmount);
        }
        if (endingAmount >= 0) {
          endingDebitVal = endingAmount;
        } else {
          endingCreditVal = Math.abs(endingAmount);
        }
      } else {
        if (openingAmount >= 0) {
          openingCredit = openingAmount;
        } else {
          openingDebit = Math.abs(openingAmount);
        }
        if (endingAmount >= 0) {
          endingCreditVal = endingAmount;
        } else {
          endingDebitVal = Math.abs(endingAmount);
        }
      }

      reportData.push({
        subject_id: subject.id,
        subject_code: subject.subject_code,
        subject_name: subject.subject_name,
        subject_type: subject.subject_type,
        direction: subject.direction,
        opening_debit: openingDebit,
        opening_credit: openingCredit,
        period_debit: periodAmount.period_debit,
        period_credit: periodAmount.period_credit,
        ending_debit: endingDebitVal,
        ending_credit: endingCreditVal
      });

      totalOpeningDebit += openingDebit;
      totalOpeningCredit += openingCredit;
      totalPeriodDebit += periodAmount.period_debit;
      totalPeriodCredit += periodAmount.period_credit;
      totalEndingDebit += endingDebitVal;
      totalEndingCredit += endingCreditVal;
    }

    res.json({
      success: true,
      data: {
        period: { year: period_year, month: period_month },
        items: reportData,
        totals: {
          opening_debit: totalOpeningDebit,
          opening_credit: totalOpeningCredit,
          period_debit: totalPeriodDebit,
          period_credit: totalPeriodCredit,
          ending_debit: totalEndingDebit,
          ending_credit: totalEndingCredit
        },
        is_balanced: Math.abs(totalPeriodDebit - totalPeriodCredit) < 0.01
      }
    });
  })
);

/**
 * @route   GET /api/financial-reports/balance-sheet
 * @desc    资产负债表
 */
router.get('/balance-sheet',
  permissionMiddleware('financial-reports', 'read'),
  validate(reportSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { period_year, period_month } = req.query;
    const companyId = req.user.companyId;

    // 获取资产类科目
    const assetSubjects = db.prepare(`
      SELECT * FROM accounting_subjects
      WHERE company_id = ? AND subject_type = 'asset' AND is_enabled = 1
      ORDER BY subject_code ASC
    `).all(companyId);

    // 获取负债类科目
    const liabilitySubjects = db.prepare(`
      SELECT * FROM accounting_subjects
      WHERE company_id = ? AND subject_type = 'liability' AND is_enabled = 1
      ORDER BY subject_code ASC
    `).all(companyId);

    // 获取所有者权益类科目
    const equitySubjects = db.prepare(`
      SELECT * FROM accounting_subjects
      WHERE company_id = ? AND subject_type = 'equity' AND is_enabled = 1
      ORDER BY subject_code ASC
    `).all(companyId);

    // 计算资产
    const assets = [];
    let totalAssets = 0;

    for (const subject of assetSubjects) {
      const balance = getSubjectBalance(db, companyId, subject.id, period_year, period_month);
      const amount = calculateBalance(subject, balance.total_debit, balance.total_credit);

      assets.push({
        subject_code: subject.subject_code,
        subject_name: subject.subject_name,
        amount: amount >= 0 ? amount : 0
      });

      if (subject.is_leaf) {
        totalAssets += amount >= 0 ? amount : 0;
      }
    }

    // 计算负债
    const liabilities = [];
    let totalLiabilities = 0;

    for (const subject of liabilitySubjects) {
      const balance = getSubjectBalance(db, companyId, subject.id, period_year, period_month);
      const amount = calculateBalance(subject, balance.total_debit, balance.total_credit);

      liabilities.push({
        subject_code: subject.subject_code,
        subject_name: subject.subject_name,
        amount: amount >= 0 ? amount : 0
      });

      if (subject.is_leaf) {
        totalLiabilities += amount >= 0 ? amount : 0;
      }
    }

    // 计算所有者权益
    const equities = [];
    let totalEquities = 0;

    for (const subject of equitySubjects) {
      const balance = getSubjectBalance(db, companyId, subject.id, period_year, period_month);
      const amount = calculateBalance(subject, balance.total_debit, balance.total_credit);

      equities.push({
        subject_code: subject.subject_code,
        subject_name: subject.subject_name,
        amount: amount >= 0 ? amount : 0
      });

      if (subject.is_leaf) {
        totalEquities += amount >= 0 ? amount : 0;
      }
    }

    res.json({
      success: true,
      data: {
        period: { year: period_year, month: period_month },
        assets: {
          items: assets,
          total: totalAssets
        },
        liabilities: {
          items: liabilities,
          total: totalLiabilities
        },
        equities: {
          items: equities,
          total: totalEquities
        },
        total_liabilities_and_equities: totalLiabilities + totalEquities,
        is_balanced: Math.abs(totalAssets - (totalLiabilities + totalEquities)) < 0.01
      }
    });
  })
);

/**
 * @route   GET /api/financial-reports/profit-loss
 * @desc    利润表（支持 startDate/endDate 或 period_year/period_month）
 */
router.get('/profit-loss',
  permissionMiddleware('financial-reports', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { startDate, endDate, period_year, period_month } = req.query;
    const companyId = req.user.companyId;

    let year, month;
    if (startDate && endDate) {
      const start = new Date(startDate);
      year = start.getFullYear();
      month = start.getMonth() + 1;
    } else {
      year = parseInt(period_year) || new Date().getFullYear();
      month = parseInt(period_month) || new Date().getMonth() + 1;
    }

    // 检查会计科目表是否存在
    let hasAccountingSchema = true;
    try {
      db.prepare('SELECT 1 FROM accounting_subjects LIMIT 1').get();
    } catch (e) {
      hasAccountingSchema = false;
    }

    if (!hasAccountingSchema) {
      // 返回模拟数据（与前端 fallback 一致）
      const trend = [];
      const daysInMonth = new Date(year, month, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        trend.push({
          date: dateStr,
          income: 0,
          expense: 0
        });
      }
      return res.json({
        success: true,
        code: 200,
        data: {
          totalIncome: 0,
          totalExpense: 0,
          netProfit: 0,
          incomeByCategory: [],
          expenseByCategory: [],
          trend,
          _notice: '会计科目表未初始化，使用空数据'
        }
      });
    }

    // 获取收入类科目
    const incomeSubjects = db.prepare(`
      SELECT * FROM accounting_subjects
      WHERE company_id = ? AND subject_type = 'income' AND is_enabled = 1
      ORDER BY subject_code ASC
    `).all(companyId);

    // 获取费用类科目
    const expenseSubjects = db.prepare(`
      SELECT * FROM accounting_subjects
      WHERE company_id = ? AND subject_type = 'expense' AND is_enabled = 1
      ORDER BY subject_code ASC
    `).all(companyId);

    // 计算期间内每天的收入/支出（用于趋势图）
    const trend = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      let dailyIncome = 0;
      let dailyExpense = 0;

      for (const subject of incomeSubjects) {
        const result = db.prepare(`
          SELECT COALESCE(SUM(ve.credit_amount - ve.debit_amount), 0) as amount
          FROM voucher_entries ve
          JOIN vouchers v ON ve.voucher_id = v.id
          WHERE ve.subject_id = ? AND v.company_id = ? AND v.status = 'posted'
            AND v.period_year = ? AND v.period_month = ? AND v.period_day = ?
        `).get(subject.id, companyId, year, month, d);
        dailyIncome += Math.max(0, result.amount);
      }

      for (const subject of expenseSubjects) {
        const result = db.prepare(`
          SELECT COALESCE(SUM(ve.debit_amount - ve.credit_amount), 0) as amount
          FROM voucher_entries ve
          JOIN vouchers v ON ve.voucher_id = v.id
          WHERE ve.subject_id = ? AND v.company_id = ? AND v.status = 'posted'
            AND v.period_year = ? AND v.period_month = ? AND v.period_day = ?
        `).get(subject.id, companyId, year, month, d);
        dailyExpense += Math.max(0, result.amount);
      }

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      trend.push({ date: dateStr, income: dailyIncome, expense: dailyExpense });
    }

    const totalIncome = trend.reduce((s, t) => s + t.income, 0);
    const totalExpense = trend.reduce((s, t) => s + t.expense, 0);

    const incomeByCategory = incomeSubjects.map(s => {
      const amount = db.prepare(`
        SELECT COALESCE(SUM(ve.credit_amount - ve.debit_amount), 0) as amount
        FROM voucher_entries ve JOIN vouchers v ON ve.voucher_id = v.id
        WHERE ve.subject_id = ? AND v.company_id = ? AND v.status = 'posted'
          AND v.period_year = ? AND v.period_month = ?
      `).get(s.id, companyId, year, month);
      const amt = Math.max(0, amount.amount);
      return { category: s.subject_name, amount: amt, percentage: totalIncome > 0 ? Math.round(amt / totalIncome * 100) : 0 };
    }).filter(i => i.amount > 0);

    const expenseByCategory = expenseSubjects.map(s => {
      const amount = db.prepare(`
        SELECT COALESCE(SUM(ve.debit_amount - ve.credit_amount), 0) as amount
        FROM voucher_entries ve JOIN vouchers v ON ve.voucher_id = v.id
        WHERE ve.subject_id = ? AND v.company_id = ? AND v.status = 'posted'
          AND v.period_year = ? AND v.period_month = ?
      `).get(s.id, companyId, year, month);
      const amt = Math.max(0, amount.amount);
      return { category: s.subject_name, amount: amt, percentage: totalExpense > 0 ? Math.round(amt / totalExpense * 100) : 0 };
    }).filter(i => i.amount > 0);

    res.json({
      success: true,
      code: 200,
      data: {
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense,
        incomeByCategory,
        expenseByCategory,
        trend
      }
    });
  })
);

/**
 * @route   GET /api/financial-reports/income-statement
 * @desc    利润表
 */
router.get('/income-statement',
  permissionMiddleware('financial-reports', 'read'),
  validate(reportSchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { period_year, period_month } = req.query;
    const companyId = req.user.companyId;

    // 获取收入类科目
    const incomeSubjects = db.prepare(`
      SELECT * FROM accounting_subjects
      WHERE company_id = ? AND subject_type = 'income' AND is_enabled = 1
      ORDER BY subject_code ASC
    `).all(companyId);

    // 获取费用类科目
    const expenseSubjects = db.prepare(`
      SELECT * FROM accounting_subjects
      WHERE company_id = ? AND subject_type = 'expense' AND is_enabled = 1
      ORDER BY subject_code ASC
    `).all(companyId);

    // 计算收入（本期）
    const incomes = [];
    let totalIncome = 0;

    for (const subject of incomeSubjects) {
      const periodAmount = getSubjectPeriodAmount(db, companyId, subject.id, period_year, period_month);
      // 收入类科目贷方表示收入
      const amount = periodAmount.period_credit - periodAmount.period_debit;

      incomes.push({
        subject_code: subject.subject_code,
        subject_name: subject.subject_name,
        amount: amount >= 0 ? amount : 0
      });

      if (subject.is_leaf) {
        totalIncome += amount >= 0 ? amount : 0;
      }
    }

    // 计算费用（本期）
    const expenses = [];
    let totalExpense = 0;

    for (const subject of expenseSubjects) {
      const periodAmount = getSubjectPeriodAmount(db, companyId, subject.id, period_year, period_month);
      // 费用类科目借方表示费用
      const amount = periodAmount.period_debit - periodAmount.period_credit;

      expenses.push({
        subject_code: subject.subject_code,
        subject_name: subject.subject_name,
        amount: amount >= 0 ? amount : 0
      });

      if (subject.is_leaf) {
        totalExpense += amount >= 0 ? amount : 0;
      }
    }

    // 计算利润
    const grossProfit = totalIncome - totalExpense;
    const netProfit = grossProfit; // 简化处理，实际需要考虑所得税等

    res.json({
      success: true,
      data: {
        period: { year: period_year, month: period_month },
        incomes: {
          items: incomes,
          total: totalIncome
        },
        expenses: {
          items: expenses,
          total: totalExpense
        },
        gross_profit: grossProfit,
        net_profit: netProfit
      }
    });
  })
);

/**
 * @route   GET /api/financial-reports/general-ledger
 * @desc    总分类账
 */
router.get('/general-ledger',
  permissionMiddleware('financial-reports', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { period_year, period_month, subject_id, subject_code } = req.query;
    const companyId = req.user.companyId;

    // 查询条件
    let subjectCondition = '';
    const params = [companyId];

    if (subject_id) {
      subjectCondition = 'AND s.id = ?';
      params.push(parseInt(subject_id));
    } else if (subject_code) {
      subjectCondition = 'AND s.subject_code LIKE ?';
      params.push(`${subject_code}%`);
    }

    // 获取科目
    const subjects = db.prepare(`
      SELECT s.* FROM accounting_subjects s
      WHERE s.company_id = ? AND s.is_enabled = 1 AND s.is_leaf = 1 ${subjectCondition}
      ORDER BY s.subject_code ASC
    `).all(...params);

    // 批量获取所有科目的凭证分录（修复 N+1 查询）
    const subjectIds = subjects.map(s => s.id);
    let allEntries = [];

    if (subjectIds.length > 0) {
      const subjectPlaceholders = subjectIds.map(() => '?').join(',');
      let entriesQuery = `
        SELECT 
          ve.*, v.voucher_no, v.voucher_date, v.description as voucher_description
        FROM voucher_entries ve
        JOIN vouchers v ON ve.voucher_id = v.id
        WHERE ve.subject_id IN (${subjectPlaceholders}) AND v.company_id = ? AND v.status = 'posted'
          ${period_year ? 'AND v.period_year = ?' : ''}
          ${period_month ? 'AND v.period_month = ?' : ''}
        ORDER BY v.voucher_date ASC, v.id ASC
      `;
      const entriesParams = [...subjectIds, companyId,
        ...(period_year ? [parseInt(period_year)] : []),
        ...(period_month ? [parseInt(period_month)] : [])
      ];
      allEntries = db.prepare(entriesQuery).all(...entriesParams);
    }

    // 按科目分组
    const entriesBySubject = new Map();
    for (const entry of allEntries) {
      if (!entriesBySubject.has(entry.subject_id)) {
        entriesBySubject.set(entry.subject_id, []);
      }
      entriesBySubject.get(entry.subject_id).push(entry);
    }

    const subjectMap = new Map(subjects.map(s => [s.id, s]));
    const ledgerData = [];

    for (const subject of subjects) {
      const entries = entriesBySubject.get(subject.id) || [];

      if (entries.length === 0) continue;

      // 计算余额
      let balance = 0;
      const entriesWithBalance = entries.map(entry => {
        if (subject.direction === 'debit') {
          balance += entry.debit_amount - entry.credit_amount;
        } else {
          balance += entry.credit_amount - entry.debit_amount;
        }
        return {
          ...entry,
          balance
        };
      });

      ledgerData.push({
        subject_id: subject.id,
        subject_code: subject.subject_code,
        subject_name: subject.subject_name,
        direction: subject.direction,
        entries: entriesWithBalance,
        total_debit: entries.reduce((sum, e) => sum + e.debit_amount, 0),
        total_credit: entries.reduce((sum, e) => sum + e.credit_amount, 0),
        final_balance: balance
      });
    }

    res.json({
      success: true,
      data: {
        period: { year: period_year, month: period_month },
        ledgers: ledgerData
      }
    });
  })
);

/**
 * @route   GET /api/financial-reports/detail-ledger
 * @desc    明细分类账
 */
router.get('/detail-ledger',
  permissionMiddleware('financial-reports', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { subject_id, period_year, period_month } = req.query;
    const companyId = req.user.companyId;

    if (!subject_id) {
      throw ErrorTypes.BadRequest('科目ID不能为空');
    }

    // 验证科目
    const subject = db.prepare('SELECT * FROM accounting_subjects WHERE id = ? AND company_id = ?').get(parseInt(subject_id), companyId);
    if (!subject) {
      throw ErrorTypes.NotFound('科目');
    }

    // 获取期初余额
    const openingBalance = getSubjectBalance(db, companyId, parseInt(subject_id), period_year || new Date().getFullYear(), (period_month || 1) - 1);
    let openingAmount = calculateBalance(subject, openingBalance.total_debit, openingBalance.total_credit);

    // 获取分录明细
    let periodCondition = '';
    const params = [parseInt(subject_id), companyId];

    if (period_year) {
      periodCondition = 'AND v.period_year = ?';
      params.push(parseInt(period_year));
      if (period_month) {
        periodCondition += ' AND v.period_month = ?';
        params.push(parseInt(period_month));
      }
    }

    const entries = db.prepare(`
      SELECT 
        ve.*, v.voucher_no, v.voucher_date, v.description as voucher_description
      FROM voucher_entries ve
      JOIN vouchers v ON ve.voucher_id = v.id
      WHERE ve.subject_id = ? AND v.company_id = ? AND v.status = 'posted'
        ${periodCondition}
      ORDER BY v.voucher_date ASC, v.id ASC, ve.entry_no ASC
    `).all(...params);

    // 计算余额
    let balance = openingAmount;
    const entriesWithBalance = entries.map(entry => {
      if (subject.direction === 'debit') {
        balance += entry.debit_amount - entry.credit_amount;
      } else {
        balance += entry.credit_amount - entry.debit_amount;
      }
      return {
        ...entry,
        balance
      };
    });

    res.json({
      success: true,
      data: {
        subject: {
          id: subject.id,
          code: subject.subject_code,
          name: subject.subject_name,
          direction: subject.direction
        },
        period: { year: period_year, month: period_month },
        opening_balance: openingAmount,
        entries: entriesWithBalance,
        total_debit: entries.reduce((sum, e) => sum + e.debit_amount, 0),
        total_credit: entries.reduce((sum, e) => sum + e.credit_amount, 0),
        ending_balance: balance
      }
    });
  })
);

/**
 * @route   GET /api/financial-reports/summary
 * @desc    财务概况摘要
 */
router.get('/summary',
  permissionMiddleware('financial-reports', 'read'),
  asyncHandler(async (req, res) => {
    const db = getDatabaseCompat();
    const { period_year, period_month } = req.query;
    const companyId = req.user.companyId;

    const year = period_year ? parseInt(period_year) : new Date().getFullYear();
    const month = period_month ? parseInt(period_month) : new Date().getMonth() + 1;

    // 凭证统计
    const voucherStats = db.prepare(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'posted' THEN 1 ELSE 0 END) as posted_count,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count
      FROM vouchers
      WHERE company_id = ? AND period_year = ? AND period_month = ?
    `).get(companyId, year, month);

    // 科目统计
    const subjectStats = db.prepare(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) as enabled_count
      FROM accounting_subjects
      WHERE company_id = ?
    `).get(companyId);

    // 计算总资产
    const assetSubjects = db.prepare(`
      SELECT id, direction FROM accounting_subjects
      WHERE company_id = ? AND subject_type = 'asset' AND is_leaf = 1 AND is_enabled = 1
    `).all(companyId);

    let totalAssets = 0;
    for (const subject of assetSubjects) {
      const balance = getSubjectBalance(db, companyId, subject.id, year, month);
      const amount = calculateBalance(subject, balance.total_debit, balance.total_credit);
      totalAssets += amount >= 0 ? amount : 0;
    }

    // 计算总负债
    const liabilitySubjects = db.prepare(`
      SELECT id, direction FROM accounting_subjects
      WHERE company_id = ? AND subject_type = 'liability' AND is_leaf = 1 AND is_enabled = 1
    `).all(companyId);

    let totalLiabilities = 0;
    for (const subject of liabilitySubjects) {
      const balance = getSubjectBalance(db, companyId, subject.id, year, month);
      const amount = calculateBalance(subject, balance.total_debit, balance.total_credit);
      totalLiabilities += amount >= 0 ? amount : 0;
    }

    // 计算本期收入
    const incomeSubjects = db.prepare(`
      SELECT id FROM accounting_subjects
      WHERE company_id = ? AND subject_type = 'income' AND is_leaf = 1 AND is_enabled = 1
    `).all(companyId);

    let totalIncome = 0;
    for (const subject of incomeSubjects) {
      const periodAmount = getSubjectPeriodAmount(db, companyId, subject.id, year, month);
      const amount = periodAmount.period_credit - periodAmount.period_debit;
      totalIncome += amount >= 0 ? amount : 0;
    }

    // 计算本期费用
    const expenseSubjects = db.prepare(`
      SELECT id FROM accounting_subjects
      WHERE company_id = ? AND subject_type = 'expense' AND is_leaf = 1 AND is_enabled = 1
    `).all(companyId);

    let totalExpense = 0;
    for (const subject of expenseSubjects) {
      const periodAmount = getSubjectPeriodAmount(db, companyId, subject.id, year, month);
      const amount = periodAmount.period_debit - periodAmount.period_credit;
      totalExpense += amount >= 0 ? amount : 0;
    }

    res.json({
      success: true,
      data: {
        period: { year, month },
        voucher_stats: voucherStats,
        subject_stats: subjectStats,
        financial_summary: {
          total_assets: totalAssets,
          total_liabilities: totalLiabilities,
          owner_equity: totalAssets - totalLiabilities,
          period_income: totalIncome,
          period_expense: totalExpense,
          period_profit: totalIncome - totalExpense
        }
      }
    });
  })
);

module.exports = router;