/**
 * AI Tools - 工具定义
 * 参考 OpenAI Function Calling 格式
 */

const invoiceOCR = {
  type: 'function',
  function: {
    name: 'invoice_ocr',
    description: '识别发票图片，提取发票信息（抬头、金额、日期、税号等）。当用户发送发票图片、票据照片、或提到"识别发票"、"扫描发票"、"发票OCR"时使用。',
    parameters: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          description: '发票图片的 Base64 编码（不含 data:image/... 前缀），或图片URL'
        },
        auto_entry: {
          type: 'boolean',
          description: '是否自动入账，默认为 false'
        }
      },
      required: ['image']
    }
  }
};

const contractReview = {
  type: 'function',
  function: {
    name: 'contract_review',
    description: '对合同进行 AI 风险审核，识别风险点并给出建议。当用户提到"审核合同"、"合同风险"、"合同分析"、"审查合同"时使用。',
    parameters: {
      type: 'object',
      properties: {
        contract_id: {
          type: 'integer',
          description: '合同ID'
        },
        contract_text: {
          type: 'string',
          description: '合同文本内容（当没有合同ID时使用）'
        }
      },
      required: ['contract_id']
    }
  }
};

const employeeOnboard = {
  type: 'function',
  function: {
    name: 'employee_onboard',
    description: '办理新员工入职，自动创建员工档案。当用户提到"员工入职"、"新员工报到"、"添加员工"、"招聘入职"时使用。',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '员工姓名'
        },
        id_card: {
          type: 'string',
          description: '身份证号'
        },
        phone: {
          type: 'string',
          description: '手机号'
        },
        email: {
          type: 'string',
          description: '邮箱'
        },
        position: {
          type: 'string',
          description: '职位'
        },
        department: {
          type: 'string',
          description: '部门'
        },
        hire_date: {
          type: 'string',
          description: '入职日期，格式 YYYY-MM-DD'
        },
        base_salary: {
          type: 'number',
          description: '基本工资'
        },
        contract_id: {
          type: 'integer',
          description: '关联的合同ID（可选）'
        }
      },
      required: ['name']
    }
  }
};

const salaryStats = {
  type: 'function',
  function: {
    name: 'salary_stats',
    description: '查询工资统计数据，包括月度工资汇总、部门统计等。当用户提到"工资统计"、"工资报表"、"发工资"、"工资明细"、"薪资"时使用。',
    parameters: {
      type: 'object',
      properties: {
        year: {
          type: 'integer',
          description: '年份，如 2026'
        },
        month: {
          type: 'integer',
          description: '月份，1-12'
        },
        employee_id: {
          type: 'integer',
          description: '员工ID（可选，不填则返回全部员工）'
        }
      }
    }
  }
};

// 工具列表
const tools = [invoiceOCR, contractReview, employeeOnboard, salaryStats];

// 工具名称到 ID 的映射
const toolMap = {
  invoice_ocr: 'invoice_ocr',
  contract_review: 'contract_review',
  employee_onboard: 'employee_onboard',
  salary_stats: 'salary_stats'
};

module.exports = { tools, toolMap };
