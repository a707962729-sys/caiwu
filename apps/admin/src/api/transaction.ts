import request from './request'
import type { PaginatedResponse, ApiResponse } from '@/types'

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

export const transactionApi = {
  // 获取列表
  getList(params: TransactionListParams): Promise<PaginatedResponse<Transaction> & { summary?: TransactionStats }> {
    return request.get('/transactions', { params })
  },

  // 获取详情
  getDetail(id: number): Promise<Transaction> {
    return request.get(`/transactions/${id}`)
  },

  // 创建
  create(data: TransactionCreateParams): Promise<Transaction> {
    return request.post('/transactions', data)
  },

  // 更新
  update(id: number, data: Partial<TransactionCreateParams>): Promise<Transaction> {
    return request.put(`/transactions/${id}`, data)
  },

  // 删除
  delete(id: number): Promise<void> {
    return request.delete(`/transactions/${id}`)
  },

  // 获取统计数据
  getStats(params?: { startDate?: string; endDate?: string }): Promise<TransactionStats> {
    return request.get('/transactions/stats', { params })
  },

  // 导出
  export(params: TransactionListParams): Promise<Blob> {
    return request.get('/transactions/export', { 
      params, 
      responseType: 'blob' 
    })
  },

  // 获取分类列表
  getCategories(): Promise<Array<{ name: string; type: string; icon?: string }>> {
    return request.get('/transactions/categories')
  }
}