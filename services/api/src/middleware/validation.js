const Joi = require('joi');
const { ErrorTypes } = require('./error');

/**
 * 验证中间件工厂
 */
function validate(schema, property = 'body') {
  return (req, res, next) => {
    const data = req[property];

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));
      return next(ErrorTypes.ValidationError(details));
    }

    // 将验证后的值替换原始值
    req[property] = value;
    next();
  };
}

/**
 * 验证参数ID中间件
 */
function validateId(paramName = 'id') {
  return (req, res, next) => {
    const id = parseInt(req.params[paramName]);

    if (isNaN(id) || id <= 0) {
      return next(ErrorTypes.BadRequest(`无效的${paramName}`));
    }

    req.params[paramName] = id;
    next();
  };
}

/**
 * 分页验证schema
 */
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(1000).default(20),
  sortBy: Joi.string().max(50),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().max(100).allow(''),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')),
  status: Joi.string().allow('') // 允许空字符串
});

/**
 * 日期范围验证schema
 */
const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required()
});

/**
 * 用户相关验证
 */
const userSchemas = {
  create: Joi.object({
    username: Joi.string().alphanum().min(3).max(50).required(),
    password: Joi.string().min(6).max(100).required(),
    real_name: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().allow(''),
    phone: Joi.string().max(20).allow(''),
    role: Joi.string().valid('boss', 'accountant', 'employee').required(),
    company_id: Joi.number().integer().positive().allow(null),
    department: Joi.string().max(100).allow(''),
    position: Joi.string().max(100).allow('')
  }),

  update: Joi.object({
    real_name: Joi.string().min(2).max(50).optional(),
    email: Joi.string().email().allow('').optional(),
    phone: Joi.string().max(20).allow('').optional(),
    department: Joi.string().max(100).allow('').optional(),
    position: Joi.string().max(100).allow('').optional(),
    status: Joi.string().valid('active', 'inactive', 'suspended').optional().allow(''),
    role: Joi.string().valid('boss', 'accountant', 'employee').optional()
  }).min(1), // 至少需要一个字段

  login: Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
  }),

  changePassword: Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).max(100).required()
  })
};

/**
 * 合同相关验证
 */
const contractSchemas = {
  create: Joi.object({
    contract_no: Joi.string().max(50).allow('', null), // 可选，后端自动生成
    name: Joi.string().max(200).required(),
    partner_id: Joi.number().integer().positive().allow(null), // 可选，允许创建合同时暂不关联合作伙伴
    contract_type: Joi.string().max(50),
    type: Joi.string().max(50), // 兼容前端 type 字段
    amount: Joi.number().min(0).required(),
    currency: Joi.string().max(10).default('CNY'),
    start_date: Joi.date().iso().allow(null),
    end_date: Joi.date().iso().allow(null),
    sign_date: Joi.date().iso().allow(null),
    responsible_user_id: Joi.number().integer().positive().allow(null),
    payment_terms: Joi.string().allow(''),
    terms_and_conditions: Joi.string().allow(''),
    notes: Joi.string().allow('')
  }).custom((obj, helpers) => {
    // 字段标准化：type → contract_type
    if (!obj.contract_type && obj.type) {
      obj.contract_type = obj.type;
    }
    return obj;
  }),

  update: Joi.object({
    name: Joi.string().max(200),
    partner_id: Joi.number().integer().positive(),
    contract_type: Joi.string().max(50),
    type: Joi.string().max(50),
    amount: Joi.number().min(0),
    currency: Joi.string().max(10),
    start_date: Joi.date().iso().allow(null),
    end_date: Joi.date().iso().allow(null),
    sign_date: Joi.date().iso().allow(null),
    responsible_user_id: Joi.number().integer().positive().allow(null),
    status: Joi.string().valid('draft', 'pending', 'active', 'completed', 'terminated', 'expired'),
    payment_terms: Joi.string().allow(''),
    terms_and_conditions: Joi.string().allow(''),
    notes: Joi.string().allow('')
  }).custom((obj, helpers) => {
    if (!obj.contract_type && obj.type) {
      obj.contract_type = obj.type;
    }
    return obj;
  })
};

/**
 * 订单相关验证
 */
const orderSchemas = {
  create: Joi.object({
    order_no: Joi.string().max(50),
    name: Joi.string().max(200),
    customer_name: Joi.string().max(200), // 兼容前端 customer_name 字段
    contract_id: Joi.number().integer().positive().allow(null),
    type: Joi.string().max(50),
    order_type: Joi.string().max(50),
    partner_id: Joi.number().integer().positive().allow(null),
    customer_id: Joi.number().integer().positive().allow(null),
    amount: Joi.number().min(0),
    tax_amount: Joi.number().min(0).default(0),
    currency: Joi.string().max(10).default('CNY'),
    start_date: Joi.date().iso().allow(null),
    end_date: Joi.date().iso().allow(null),
    responsible_user_id: Joi.number().integer().positive().allow(null),
    description: Joi.string().allow(''),
    notes: Joi.string().allow('')
  }).custom((obj, helpers) => {
    // 字段标准化：customer_name → name
    if (!obj.name && obj.customer_name) {
      obj.name = obj.customer_name;
    }
    // type → order_type
    if (!obj.order_type && obj.type) {
      obj.order_type = obj.type;
    }
    if (!obj.name) {
      return helpers.error('any.required', { message: '"name" is required' });
    }
    return obj;
  }),

  update: Joi.object({
    name: Joi.string().max(200),
    customer_name: Joi.string().max(200),
    contract_id: Joi.number().integer().positive().allow(null),
    type: Joi.string().max(50),
    order_type: Joi.string().max(50),
    partner_id: Joi.number().integer().positive().allow(null),
    total_amount: Joi.number().min(0),
    tax_amount: Joi.number().min(0),
    currency: Joi.string().max(10),
    start_date: Joi.date().iso().allow(null),
    end_date: Joi.date().iso().allow(null),
    responsible_user_id: Joi.number().integer().positive().allow(null),
    status: Joi.string().valid('draft', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'),
    progress: Joi.number().min(0).max(100),
    description: Joi.string().allow(''),
    notes: Joi.string().allow('')
  }).custom((obj, helpers) => {
    if (!obj.order_type && obj.type) {
      obj.order_type = obj.type;
    }
    return obj;
  })
};

/**
 * 记账相关验证
 */
const transactionSchemas = {
  create: Joi.object({
    transaction_no: Joi.string().max(50).allow('', null), // 可选,后端自动生成
    transaction_date: Joi.alternatives().try(Joi.date().iso(), Joi.string()).required(),
    transaction_type: Joi.string().valid('income', 'expense', 'transfer').required(),
    category: Joi.string().max(50).required(),
    sub_category: Joi.string().max(50).allow(''),
    amount: Joi.number().positive().required(),
    currency: Joi.string().max(10).default('CNY'),
    exchange_rate: Joi.number().positive().default(1),
    account_from: Joi.string().max(100).allow(''),
    account_to: Joi.string().max(100).allow(''),
    partner_id: Joi.number().integer().positive().allow(null),
    contract_id: Joi.number().integer().positive().allow(null),
    order_id: Joi.number().integer().positive().allow(null),
    invoice_id: Joi.number().integer().positive().allow(null),
    reimbursement_id: Joi.number().integer().positive().allow(null),
    description: Joi.string().allow(''),
    voucher_no: Joi.string().max(50).allow(''),
    notes: Joi.string().allow('')
  }),

  update: Joi.object({
    transaction_date: Joi.date().iso(),
    transaction_type: Joi.string().valid('income', 'expense', 'transfer'),
    category: Joi.string().max(50),
    sub_category: Joi.string().max(50).allow(''),
    amount: Joi.number().positive(),
    currency: Joi.string().max(10),
    exchange_rate: Joi.number().positive(),
    account_from: Joi.string().max(100).allow(''),
    account_to: Joi.string().max(100).allow(''),
    partner_id: Joi.number().integer().positive().allow(null),
    contract_id: Joi.number().integer().positive().allow(null),
    order_id: Joi.number().integer().positive().allow(null),
    invoice_id: Joi.number().integer().positive().allow(null),
    reimbursement_id: Joi.number().integer().positive().allow(null),
    description: Joi.string().allow(''),
    voucher_no: Joi.string().max(50).allow(''),
    status: Joi.string().valid('draft', 'pending', 'confirmed', 'reversed'),
    notes: Joi.string().allow('')
  })
};

/**
 * 报销相关验证
 */
const reimbursementSchemas = {
  create: Joi.object({
    reimbursement_no: Joi.string().max(50),
    title: Joi.string().max(200),
    description: Joi.string().allow(''), // 兼容前端 description 字段
    reimbursement_type: Joi.string().max(50),
    type: Joi.string().max(50),
    amount: Joi.number().min(0).required(),
    currency: Joi.string().max(10).default('CNY'),
    application_date: Joi.date().iso().allow(null),
    expense_date: Joi.date().iso().allow(null),
    notes: Joi.string().allow(''),
    items: Joi.array().items(Joi.object({
      item_date: Joi.date().iso().allow(null),
      category: Joi.string().max(50),
      description: Joi.string().allow(''),
      amount: Joi.number().min(0).required(),
      currency: Joi.string().max(10).default('CNY'),
      invoice_no: Joi.string().max(50).allow(''),
      notes: Joi.string().allow('')
    }))
  }).custom((obj, helpers) => {
    // 字段标准化：description → title; type → reimbursement_type
    if (!obj.title && obj.description) {
      obj.title = obj.description;
    }
    if (!obj.reimbursement_type && obj.type) {
      obj.reimbursement_type = obj.type;
    }
    if (!obj.title) {
      return helpers.error('any.required', { message: '"title" is required' });
    }
    return obj;
  }),

  update: Joi.object({
    title: Joi.string().max(200),
    description: Joi.string().allow(''),
    reimbursement_type: Joi.string().max(50),
    type: Joi.string().max(50),
    amount: Joi.number().min(0),
    currency: Joi.string().max(10),
    application_date: Joi.date().iso(),
    expense_date: Joi.date().iso().allow(null),
    notes: Joi.string().allow('')
  }).custom((obj, helpers) => {
    if (!obj.reimbursement_type && obj.type) {
      obj.reimbursement_type = obj.type;
    }
    return obj;
  }),

  approve: Joi.object({
    action: Joi.string().valid('approve', 'reject').required(),
    reject_reason: Joi.string().when('action', {
      is: 'reject',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    })
  })
};

/**
 * 票据相关验证
 */
const invoiceSchemas = {
  create: Joi.object({
    // 兼容前端字段名(全部 optional,由 custom 验证器做最终校验)
    invoice_type: Joi.string().max(50),
    type: Joi.string().max(50),
    invoice_no: Joi.string().max(50),
    invoice_number: Joi.string().max(50), // 兼容前端 invoice_number 字段
    invoice_code: Joi.string().max(50).allow('', null),
    direction: Joi.string().valid('in', 'out'),
    type_dir: Joi.string().max(20),
    partner_id: Joi.number().integer().positive().allow(null),
    contract_id: Joi.number().integer().positive().allow(null),
    order_id: Joi.number().integer().positive().allow(null),
    issue_date: Joi.date().iso(),
    invoice_date: Joi.date().iso(),
    amount_before_tax: Joi.number().min(0),
    amount: Joi.number().min(0),
    tax_rate: Joi.number().min(0).max(100).default(0),
    tax_amount: Joi.number().min(0).default(0),
    total_amount: Joi.number().min(0),
    currency: Joi.string().max(10).default('CNY'),
    description: Joi.string().allow('', null),
    notes: Joi.string().allow('', null)
  }).custom((obj, helpers) => {
    // 字段标准化:前端字段 → 后端字段
    // invoice_number → invoice_no
    if (!obj.invoice_no && obj.invoice_number) {
      obj.invoice_no = obj.invoice_number;
    }
    const type = obj.invoice_type || obj.type;
    const issueDate = obj.issue_date ?? obj.invoice_date;
    if (!issueDate) {
      obj.issue_date = new Date().toISOString().slice(0, 10);
    }
    const totalAmount = obj.total_amount ?? obj.amount;
    const amtBeforeTax = obj.amount_before_tax ?? (totalAmount ? Math.round(totalAmount / 1.06 * 100) / 100 : 0);
    const taxAmt = obj.tax_amount ?? (totalAmount ? Math.round(totalAmount - amtBeforeTax, 2) : 0);
    const direction = obj.direction || obj.type_dir || (obj.type === 'income' ? 'out' : obj.type === 'expense' ? 'in' : 'out');

    if (!obj.invoice_no) return helpers.error('any.required', { message: '"invoice_no" is required' });
    if (!type) return helpers.error('any.required', { message: '"invoice_type" is required' });
    if (totalAmount === undefined || totalAmount === null) return helpers.error('any.required', { message: '"total_amount" is required' });

    // 统一转 ISO 日期字符串
    const issueDateStr = typeof obj.issue_date === 'string' ? obj.issue_date : obj.issue_date.toISOString().slice(0, 10);
    const taxRate = obj.tax_rate ?? (type?.startsWith('vat') ? 6 : 0);

    obj._std = { invoice_no: obj.invoice_no, invoice_type: type, issue_date: issueDateStr, total_amount: totalAmount, amount_before_tax: amtBeforeTax, tax_amount: taxAmt, direction, tax_rate: taxRate };
    return obj;
  }),

  update: Joi.object({
    invoice_no: Joi.string().max(50).allow('', null),  // 不允许修改但可接收
    invoice_type: Joi.string().max(50),
    type: Joi.string().max(50),
    invoice_code: Joi.string().max(50).allow('', null),
    partner_id: Joi.number().integer().positive().allow(null),
    contract_id: Joi.number().integer().positive().allow(null),
    order_id: Joi.number().integer().positive().allow(null),
    issue_date: Joi.any(),
    invoice_date: Joi.any(),
    amount_before_tax: Joi.number().min(0),
    amount: Joi.number().min(0),
    tax_rate: Joi.number().min(0).max(100),
    tax_amount: Joi.number().min(0),
    total_amount: Joi.number().min(0),
    currency: Joi.string().max(10),
    status: Joi.string().valid('pending', 'pending_review', 'verified', 'paid', 'cancelled', 'void'),
    description: Joi.string().allow('', null),
    notes: Joi.string().allow('', null)
  }).custom((obj, helpers) => {
    if (obj.type && !obj.invoice_type) obj.invoice_type = obj.type;
    if (obj.invoice_date && !obj.issue_date) obj.issue_date = obj.invoice_date;
    if (obj.amount !== undefined && obj.total_amount === undefined) obj.total_amount = obj.amount;
    return obj;
  })
};

/**
 * 报价单相关验证
 */
const quotationSchemas = {
  create: Joi.object({
    quotation_no: Joi.string().max(50).allow('', null),
    customer_id: Joi.number().integer().positive().required(),
    title: Joi.string().max(200).allow(''),
    amount: Joi.number().min(0).default(0),
    tax_amount: Joi.number().min(0).default(0),
    currency: Joi.string().max(10).default('CNY'),
    valid_until: Joi.date().iso().allow(null),
    terms: Joi.string().allow(''),
    notes: Joi.string().allow(''),
    items: Joi.array().items(Joi.object({
      product_name: Joi.string().max(200).required(),
      product_code: Joi.string().max(50).allow(''),
      specification: Joi.string().max(200).allow(''),
      unit: Joi.string().max(20).allow(''),
      qty: Joi.number().min(0).default(1),
      price: Joi.number().min(0).default(0),
      tax_rate: Joi.number().min(0).max(100).default(0),
      notes: Joi.string().allow('')
    }))
  }),

  update: Joi.object({
    customer_id: Joi.number().integer().positive(),
    title: Joi.string().max(200).allow(''),
    amount: Joi.number().min(0),
    tax_amount: Joi.number().min(0),
    currency: Joi.string().max(10),
    valid_until: Joi.date().iso().allow(null),
    status: Joi.string().valid('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'),
    terms: Joi.string().allow(''),
    notes: Joi.string().allow('')
  })
};

/**
 * 发货单相关验证
 */
const deliverySchemas = {
  create: Joi.object({
    delivery_no: Joi.string().max(50).allow('', null),
    order_id: Joi.number().integer().positive().allow(null),
    quotation_id: Joi.number().integer().positive().allow(null),
    customer_id: Joi.number().integer().positive().allow(null),
    delivery_date: Joi.date().iso().allow(null),
    logistics_company: Joi.string().max(100).allow(''),
    logistics_no: Joi.string().max(100).allow(''),
    recipient_name: Joi.string().max(50).allow(''),
    recipient_phone: Joi.string().max(30).allow(''),
    recipient_address: Joi.string().allow(''),
    notes: Joi.string().allow(''),
    items: Joi.array().items(Joi.object({
      product_name: Joi.string().max(200).required(),
      product_code: Joi.string().max(50).allow(''),
      specification: Joi.string().max(200).allow(''),
      unit: Joi.string().max(20).allow(''),
      qty: Joi.number().min(0).default(1),
      notes: Joi.string().allow('')
    }))
  }),

  update: Joi.object({
    order_id: Joi.number().integer().positive().allow(null),
    quotation_id: Joi.number().integer().positive().allow(null),
    customer_id: Joi.number().integer().positive().allow(null),
    delivery_date: Joi.date().iso().allow(null),
    logistics_company: Joi.string().max(100).allow(''),
    logistics_no: Joi.string().max(100).allow(''),
    recipient_name: Joi.string().max(50).allow(''),
    recipient_phone: Joi.string().max(30).allow(''),
    recipient_address: Joi.string().allow(''),
    status: Joi.string().valid('pending', 'shipped', 'delivered', 'cancelled'),
    notes: Joi.string().allow('')
  })
};

/**
 * 收款记录相关验证
 */
const receiptSchemas = {
  create: Joi.object({
    receipt_no: Joi.string().max(50).allow('', null),
    order_id: Joi.number().integer().positive().allow(null),
    quotation_id: Joi.number().integer().positive().allow(null),
    customer_id: Joi.number().integer().positive().allow(null),
    amount: Joi.number().min(0).required(),
    payment_method: Joi.string().max(50).allow(''),
    bank_account: Joi.string().max(100).allow(''),
    receipt_date: Joi.date().iso().required(),
    voucher_no: Joi.string().max(50).allow(''),
    voucher_image: Joi.string().max(255).allow(''),
    notes: Joi.string().allow('')
  }),

  update: Joi.object({
    order_id: Joi.number().integer().positive().allow(null),
    quotation_id: Joi.number().integer().positive().allow(null),
    customer_id: Joi.number().integer().positive().allow(null),
    amount: Joi.number().min(0),
    payment_method: Joi.string().max(50).allow(''),
    bank_account: Joi.string().max(100).allow(''),
    receipt_date: Joi.date().iso(),
    voucher_no: Joi.string().max(50).allow(''),
    voucher_image: Joi.string().max(255).allow(''),
    status: Joi.string().valid('pending', 'confirmed', 'cancelled'),
    notes: Joi.string().allow('')
  })
};

/**
 * 会计科目相关验证
 */
const subjectSchemas = {
  create: Joi.object({
    subject_code: Joi.string().max(50).required(),
    subject_name: Joi.string().max(100).required(),
    subject_type: Joi.string().valid('asset', 'liability', 'equity', 'income', 'expense').required(),
    subject_category: Joi.string().max(50).allow(''),
    parent_id: Joi.number().integer().positive().allow(null),
    level: Joi.number().integer().min(1).max(4).default(1),
    direction: Joi.string().valid('debit', 'credit').default('debit'),
    is_leaf: Joi.boolean().default(true),
    is_enabled: Joi.boolean().default(true),
    description: Joi.string().allow('')
  }),

  update: Joi.object({
    subject_name: Joi.string().max(100),
    subject_type: Joi.string().valid('asset', 'liability', 'equity', 'income', 'expense'),
    subject_category: Joi.string().max(50).allow(''),
    parent_id: Joi.number().integer().positive().allow(null),
    level: Joi.number().integer().min(1).max(4),
    direction: Joi.string().valid('debit', 'credit'),
    is_leaf: Joi.boolean(),
    is_enabled: Joi.boolean(),
    description: Joi.string().allow('')
  })
};

/**
 * 凭证相关验证
 */
const voucherSchemas = {
  create: Joi.object({
    voucher_no: Joi.string().max(50).allow('', null),
    voucher_date: Joi.date().iso().required(),
    voucher_type: Joi.string().valid('general', 'receipt', 'payment', 'transfer').default('general'),
    description: Joi.string().allow(''),
    reference_no: Joi.string().max(100).allow(''),
    reference_type: Joi.string().max(50).allow(''),
    reference_id: Joi.number().integer().positive().allow(null),
    notes: Joi.string().allow(''),
    entries: Joi.array().min(2).items(Joi.object({
      subject_id: Joi.number().integer().positive().required(),
      subject_code: Joi.string().max(50).allow(''),
      subject_name: Joi.string().max(100).allow(''),
      description: Joi.string().allow(''),
      debit_amount: Joi.number().min(0).default(0),
      credit_amount: Joi.number().min(0).default(0),
      currency: Joi.string().max(10).default('CNY'),
      exchange_rate: Joi.number().positive().default(1),
      original_amount: Joi.number().allow(null),
      quantity: Joi.number().allow(null),
      unit_price: Joi.number().allow(null),
      partner_id: Joi.number().integer().positive().allow(null),
      partner_name: Joi.string().max(100).allow(''),
      project: Joi.string().max(100).allow(''),
      department: Joi.string().max(100).allow(''),
      settlement_no: Joi.string().max(50).allow(''),
      invoice_no: Joi.string().max(50).allow(''),
      notes: Joi.string().allow('')
    })).required()
  }),

  update: Joi.object({
    voucher_date: Joi.date().iso(),
    voucher_type: Joi.string().valid('general', 'receipt', 'payment', 'transfer'),
    description: Joi.string().allow(''),
    reference_no: Joi.string().max(100).allow(''),
    reference_type: Joi.string().max(50).allow(''),
    reference_id: Joi.number().integer().positive().allow(null),
    notes: Joi.string().allow(''),
    entries: Joi.array().min(2).items(Joi.object({
      id: Joi.number().integer().positive().allow(null),
      subject_id: Joi.number().integer().positive().required(),
      subject_code: Joi.string().max(50).allow(''),
      subject_name: Joi.string().max(100).allow(''),
      description: Joi.string().allow(''),
      debit_amount: Joi.number().min(0).default(0),
      credit_amount: Joi.number().min(0).default(0),
      currency: Joi.string().max(10).default('CNY'),
      exchange_rate: Joi.number().positive().default(1),
      original_amount: Joi.number().allow(null),
      quantity: Joi.number().allow(null),
      unit_price: Joi.number().allow(null),
      partner_id: Joi.number().integer().positive().allow(null),
      partner_name: Joi.string().max(100).allow(''),
      project: Joi.string().max(100).allow(''),
      department: Joi.string().max(100).allow(''),
      settlement_no: Joi.string().max(50).allow(''),
      invoice_no: Joi.string().max(50).allow(''),
      notes: Joi.string().allow('')
    }))
  })
};

/**
 * 财务报表相关验证
 */
const reportSchemas = {
  query: Joi.object({
    period_year: Joi.number().integer().min(2000).max(2100).required(),
    period_month: Joi.number().integer().min(1).max(12).required()
  })
};

module.exports = {
  validate,
  validateId,
  paginationSchema,
  dateRangeSchema,
  userSchemas,
  contractSchemas,
  orderSchemas,
  transactionSchemas,
  reimbursementSchemas,
  invoiceSchemas,
  quotationSchemas,
  deliverySchemas,
  receiptSchemas,
  subjectSchemas,
  voucherSchemas,
  reportSchemas
};