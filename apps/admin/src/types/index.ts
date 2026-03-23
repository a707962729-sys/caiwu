export interface User {
  id: number
  username: string
  real_name: string
  email?: string
  phone?: string
  avatar?: string
  role: 'boss' | 'accountant' | 'employee'
  department?: string
  position?: string
  permissions?: string[]
  status: number
  created_at: string
  updated_at: string
}

export interface LoginResult {
  token: string
  expiresIn: number
  user: User
}

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface PaginatedResponse<T = any> {
  list: T[]
  total: number
  page: number
  pageSize: number
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
  description?: string
  counterparty?: string
  account_from?: string
  account_to?: string
  invoice_id?: number
  contract_id?: number
  order_id?: number
}

export interface TransactionListParams {
  page?: number
  pageSize?: number
  type?: 'income' | 'expense' | 'transfer' | ''
  category?: string
  status?: string
  startDate?: string
  endDate?: string
  search?: string
}

export interface TransactionStats {
  total_income: number
  total_expense: number
  net_profit: number
  by_category: Array<{ category: string; amount: number; type: string }>
}

// 客户相关类型
export type CustomerType = 'individual' | 'company' | 'government' | 'other'
export type CustomerStatus = 'potential' | 'active' | 'inactive' | 'lost'
export type CustomerSource = 'website' | 'referral' | 'advertisement' | 'exhibition' | 'cold_call' | 'other'

export interface Customer {
  id: number
  name: string
  type: CustomerType
  status: CustomerStatus
  source?: CustomerSource
  industry?: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  province?: string
  city?: string
  district?: string
  website?: string
  remark?: string
  owner_id?: number
  owner_name?: string
  credit_level?: 'A' | 'B' | 'C' | 'D'
  total_amount?: number
  deal_count?: number
  last_contact_date?: string
  next_follow_date?: string
  created_at: string
  updated_at: string
}

export interface Contact {
  id: number
  customer_id: number
  name: string
  position?: string
  department?: string
  phone?: string
  mobile?: string
  email?: string
  wechat?: string
  qq?: string
  is_primary: boolean
  remark?: string
  created_at: string
  updated_at: string
}

export interface FollowRecord {
  id: number
  customer_id: number
  contact_id?: number
  contact_name?: string
  type: 'visit' | 'call' | 'email' | 'wechat' | 'other'
  content: string
  next_action?: string
  next_date?: string
  attachment?: string
  creator_id: number
  creator_name?: string
  created_at: string
  updated_at: string
}

export interface CustomerListParams {
  page?: number
  pageSize?: number
  search?: string
  type?: CustomerType | ''
  status?: CustomerStatus | ''
  source?: CustomerSource | ''
  industry?: string
  startDate?: string
  endDate?: string
  owner_id?: number
}

export interface CustomerCreateParams {
  name: string
  type: CustomerType
  status?: CustomerStatus
  source?: CustomerSource
  industry?: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  province?: string
  city?: string
  district?: string
  website?: string
  remark?: string
  owner_id?: number
  credit_level?: 'A' | 'B' | 'C' | 'D'
  next_follow_date?: string
}