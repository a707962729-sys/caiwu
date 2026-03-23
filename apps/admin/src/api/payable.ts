import request from './request'
import type { PaginatedResponse } from '@/types'

// 应付账款状态
export type PayableStatus = 'pending' | 'partial' | 'paid' | 'overdue'

// 应付账款信息
export interface Payable {
  id: number
  supplier_id: number
  supplier_name: string
  invoice_no?: string
  amount: number
  paid_amount: number
  unpaid_amount: number
  due_date: string
  status: PayableStatus
  description?: string
  created_at: string
  updated_at: string
}

// 付款记录
export interface PaymentRecord {
  id: number
  payable_id: number
  amount: number
  payment_date: string
  payment_method: string
  account?: string
  remark?: string
  operator_id: number
  operator_name?: string
  created_at: string
}

// 应付账款列表参数
export interface PayableListParams {
  page?: number
  pageSize?: number
  supplier_id?: number
  status?: PayableStatus | ''
  startDate?: string
  endDate?: string
  search?: string
}

// 创建应付账款参数
export interface PayableCreateParams {
  supplier_id: number
  invoice_no?: string
  amount: number
  due_date: string
  description?: string
}

// 更新应付账款参数
export interface PayableUpdateParams {
  supplier_id?: number
  invoice_no?: string
  amount?: number
  due_date?: string
  description?: string
}

// 付款参数
export interface PaymentParams {
  amount: number
  payment_date: string
  payment_method: string
  account?: string
  remark?: string
}

// 账龄分析
export interface AgingAnalysis {
  total: number
  not_due: number
  overdue_0_30: number
  overdue_30_60: number
  overdue_60_90: number
  overdue_90_plus: number
  by_supplier: Array<{
    supplier_id: number
    supplier_name: string
    total: number
    not_due: number
    overdue_0_30: number
    overdue_30_60: number
    overdue_60_90: number
    overdue_90_plus: number
  }>
}

// 应付账款 API
export const payableApi = {
  // 获取列表
  getList(params: PayableListParams): Promise<PaginatedResponse<Payable>> {
    return request.get('/payables', { params })
  },

  // 获取详情
  getDetail(id: number): Promise<Payable> {
    return request.get(`/payables/${id}`)
  },

  // 创建
  create(data: PayableCreateParams): Promise<Payable> {
    return request.post('/payables', data)
  },

  // 更新
  update(id: number, data: PayableUpdateParams): Promise<Payable> {
    return request.put(`/payables/${id}`, data)
  },

  // 删除
  delete(id: number): Promise<void> {
    return request.delete(`/payables/${id}`)
  },

  // 付款
  pay(id: number, data: PaymentParams): Promise<PaymentRecord> {
    return request.post(`/payables/${id}/pay`, data)
  },

  // 获取付款记录
  getPaymentRecords(id: number): Promise<PaymentRecord[]> {
    return request.get(`/payables/${id}/payments`)
  },

  // 账龄分析
  getAgingAnalysis(params?: { supplier_id?: number }): Promise<AgingAnalysis> {
    return request.get('/payables/aging', { params })
  }
}

// 辅助函数
export const getPayableStatusLabel = (status: PayableStatus): string => {
  const map: Record<PayableStatus, string> = {
    pending: '待付款',
    partial: '部分付款',
    paid: '已付款',
    overdue: '已逾期'
  }
  return map[status] || status
}

export const getPayableStatusType = (status: PayableStatus): 'warning' | 'primary' | 'success' | 'danger' => {
  const map: Record<PayableStatus, 'warning' | 'primary' | 'success' | 'danger'> = {
    pending: 'warning',
    partial: 'primary',
    paid: 'success',
    overdue: 'danger'
  }
  return map[status] || 'warning'
}

export const getPaymentMethodLabel = (method: string): string => {
  const map: Record<string, string> = {
    bank: '银行转账',
    cash: '现金',
    check: '支票',
    alipay: '支付宝',
    wechat: '微信',
    other: '其他'
  }
  return map[method] || method
}

export const formatAmount = (amount: number): string => {
  return amount.toLocaleString('zh-CN', {
    style: 'currency',
    currency: 'CNY'
  })
}