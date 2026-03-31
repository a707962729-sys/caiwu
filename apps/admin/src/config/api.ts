// API 端点配置
export const API_ENDPOINTS = {
  // 认证
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    me: '/auth/me',
    refresh: '/auth/refresh',
    password: '/auth/password'
  },
  
  // 用户
  users: {
    list: '/users',
    detail: (id: number) => `/users/${id}`,
    create: '/users',
    update: (id: number) => `/users/${id}`,
    delete: (id: number) => `/users/${id}`,
    resetPassword: (id: number) => `/users/${id}/reset-password`
  },
  
  // 交易
  transactions: {
    list: '/transactions',
    stats: '/transactions/stats',
    detail: (id: number) => `/transactions/${id}`,
    create: '/transactions',
    update: (id: number) => `/transactions/${id}`,
    delete: (id: number) => `/transactions/${id}`
  },
  
  // 合同
  contracts: {
    list: '/contracts',
    detail: (id: number) => `/contracts/${id}`,
    create: '/contracts',
    update: (id: number) => `/contracts/${id}`,
    delete: (id: number) => `/contracts/${id}`
  },
  
  // 订单
  orders: {
    list: '/orders',
    detail: (id: number) => `/orders/${id}`,
    create: '/orders',
    update: (id: number) => `/orders/${id}`,
    delete: (id: number) => `/orders/${id}`
  },
  
  // 报销
  reimbursements: {
    list: '/reimbursements',
    detail: (id: number) => `/reimbursements/${id}`,
    create: '/reimbursements',
    update: (id: number) => `/reimbursements/${id}`,
    delete: (id: number) => `/reimbursements/${id}`,
    submit: (id: number) => `/reimbursements/${id}/submit`,
    approve: (id: number) => `/reimbursements/${id}/approve`,
    pay: (id: number) => `/reimbursements/${id}/pay`
  },
  
  // 票据
  invoices: {
    list: '/invoices',
    stats: '/invoices/stats',
    detail: (id: number) => `/invoices/${id}`,
    create: '/invoices',
    update: (id: number) => `/invoices/${id}`,
    delete: (id: number) => `/invoices/${id}`,
    verify: (id: number) => `/invoices/${id}/verify`
  },
  
  // 客户/供应商
  partners: {
    list: '/partners',
    detail: (id: number) => `/partners/${id}`,
    create: '/partners',
    update: (id: number) => `/partners/${id}`,
    delete: (id: number) => `/partners/${id}`
  },
  
  // 应收应付
  receivablesPayables: {
    list: '/receivables-payables',
    receivables: '/receivables-payables/receivables',
    payables: '/receivables-payables/payables',
    detail: (id: number) => `/receivables-payables/${id}`,
    create: '/receivables-payables',
    update: (id: number) => `/receivables-payables/${id}`,
    delete: (id: number) => `/receivables-payables/${id}`
  },
  
  // 仪表盘
  dashboard: {
    overview: '/dashboard/overview',
    cashflow: '/dashboard/cashflow',
    category: '/dashboard/category',
    receivables: '/dashboard/receivables',
    payables: '/dashboard/payables',
    tax: '/dashboard/tax'
  },
  
  // 财务报表
  reports: {
    profitLoss: '/financial-reports/profit-loss',
    balance: '/financial-reports/balance-sheet',
    cashflow: '/financial-reports/cashflow'
  },
  
  // 文件上传
  upload: {
    image: '/upload/image',
    file: '/upload/file'
  }
}