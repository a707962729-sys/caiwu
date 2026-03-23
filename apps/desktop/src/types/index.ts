// 用户相关类型
export interface User {
  id: number
  username: string
  real_name: string
  role: 'boss' | 'accountant' | 'employee'
  email: string
  phone?: string
  department?: string
  position?: string
  avatar?: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResult {
  user: User
  token: string
}

// 分页相关类型
export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginationResult<T> {
  list: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

// 通用响应类型
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
  details?: unknown[]
}

// 交易相关类型
export interface Transaction {
  id: number
  transaction_no: string
  transaction_type: 'income' | 'expense' | 'transfer'
  category: string
  subcategory?: string
  amount: number
  currency: string
  transaction_date: string
  description: string
  counterparty?: string
  account_from?: string
  account_to?: string
  invoice_id?: number
  contract_id?: number
  order_id?: number
  status: 'pending' | 'completed' | 'cancelled'
  user_id: number
  user?: User
  created_at: string
  updated_at: string
}

export interface TransactionCreateParams {
  transaction_type: 'income' | 'expense' | 'transfer'
  category: string
  subcategory?: string
  amount: number
  currency?: string
  transaction_date: string
  description: string
  counterparty?: string
  account_from?: string
  account_to?: string
  invoice_id?: number
  contract_id?: number
  order_id?: number
}

export interface TransactionListParams extends PaginationParams {
  search?: string
  type?: string
  category?: string
  status?: string
  startDate?: string
  endDate?: string
}

// 合同相关类型
export interface Contract {
  id: number
  contract_no: string
  title: string
  partner_id: number
  partner?: Partner
  contract_type: 'sales' | 'purchase' | 'service' | 'other'
  amount: number
  currency: string
  start_date: string
  end_date: string
  sign_date?: string
  status: 'draft' | 'pending' | 'active' | 'completed' | 'terminated'
  description: string
  attachments?: string[]
  user_id: number
  user?: User
  created_at: string
  updated_at: string
}

export interface ContractCreateParams {
  title: string
  partner_id: number
  contract_type: 'sales' | 'purchase' | 'service' | 'other'
  amount: number
  currency?: string
  start_date: string
  end_date: string
  sign_date?: string
  description: string
  attachments?: string[]
}

export interface ContractListParams extends PaginationParams {
  search?: string
  type?: string
  status?: string
  partner_id?: number
}

// 订单相关类型
export interface Order {
  id: number
  order_no: string
  partner_id: number
  partner?: Partner
  order_type: 'sales' | 'purchase'
  amount: number
  currency: string
  order_date: string
  delivery_date?: string
  status: 'draft' | 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled'
  description: string
  items?: OrderItem[]
  contract_id?: number
  user_id: number
  user?: User
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id?: number
  product_name: string
  specification?: string
  quantity: number
  unit?: string
  price: number
  amount: number
}

export interface OrderCreateParams {
  partner_id: number
  order_type: 'sales' | 'purchase'
  amount: number
  currency?: string
  order_date: string
  delivery_date?: string
  description: string
  items?: OrderItem[]
  contract_id?: number
}

export interface OrderListParams extends PaginationParams {
  search?: string
  type?: string
  status?: string
  partner_id?: number
}

// 报销相关类型
export interface Reimbursement {
  id: number
  reimbursement_no: string
  title: string
  reimbursement_type: string
  amount: number
  currency: string
  application_date: string
  expense_date: string
  description: string
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'paid'
  reject_reason?: string
  items: ReimbursementItem[]
  user_id: number
  user?: User
  created_at: string
  updated_at: string
}

export interface ReimbursementItem {
  id?: number
  item_date: string
  category: string
  description: string
  amount: number
  invoice_id?: number
  invoice_url?: string
}

export interface ReimbursementCreateParams {
  title: string
  reimbursement_type: string
  amount: number
  currency?: string
  application_date: string
  expense_date: string
  description: string
  items: ReimbursementItem[]
}

export interface ReimbursementListParams extends PaginationParams {
  search?: string
  status?: string
  startDate?: string
  endDate?: string
}

// 票据相关类型
export interface Invoice {
  id: number
  invoice_type: string
  invoice_no: string
  invoice_code: string
  direction: 'in' | 'out'
  partner_id?: number
  partner?: Partner
  issue_date: string
  amount_before_tax: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  currency: string
  status: 'pending' | 'verified' | 'used'
  image_url?: string
  ocr_data?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface InvoiceCreateParams {
  invoice_type: string
  invoice_no: string
  invoice_code: string
  direction: 'in' | 'out'
  partner_id?: number
  issue_date: string
  amount_before_tax: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  currency?: string
  image_url?: string
  ocr_data?: Record<string, unknown>
}

export interface InvoiceListParams extends PaginationParams {
  direction?: 'in' | 'out'
  status?: string
  search?: string
}

// 客户/供应商相关类型
export interface Partner {
  id: number
  name: string
  type: 'customer' | 'supplier' | 'both'
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  tax_id?: string
  credit_limit?: number
  credit_period?: number
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface PartnerCreateParams {
  name: string
  type: 'customer' | 'supplier' | 'both'
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  tax_id?: string
  credit_limit?: number
  credit_period?: number
}

export interface PartnerListParams extends PaginationParams {
  type?: 'customer' | 'supplier' | 'both'
  status?: 'active' | 'inactive'
  search?: string
}

// 应收应付相关类型
export interface ReceivablePayable {
  id: number
  type: 'receivable' | 'payable'
  partner_id: number
  partner?: Partner
  amount: number
  currency: string
  due_date: string
  paid_amount: number
  remaining_amount: number
  status: 'pending' | 'partial' | 'paid' | 'overdue'
  transaction_id?: number
  contract_id?: number
  order_id?: number
  invoice_id?: number
  description: string
  created_at: string
  updated_at: string
}

// 仪表盘相关类型
export interface DashboardOverview {
  income: number
  expense: number
  profit: number
  receivables: number
  payables: number
  pending_reimbursements: number
  pending_invoices: number
  todos: TodoItem[]
}

export interface TodoItem {
  id: number
  type: 'reimbursement' | 'invoice' | 'contract' | 'order'
  title: string
  description: string
  status: string
  priority: 'high' | 'medium' | 'low'
  created_at: string
}

// 文件上传相关类型
export interface UploadResult {
  url: string
  filename: string
  size: number
  mimetype: string
}

// AI识别结果类型
export interface OcrResult {
  invoice_type?: string
  invoice_no?: string
  invoice_code?: string
  issue_date?: string
  amount_before_tax?: number
  tax_rate?: number
  tax_amount?: number
  total_amount?: number
  seller_name?: string
  seller_tax_id?: string
  buyer_name?: string
  buyer_tax_id?: string
  items?: Array<{
    name: string
    specification?: string
    unit?: string
    quantity?: number
    price?: number
    amount?: number
    tax_rate?: number
    tax_amount?: number
  }>
  confidence?: number
}