import request from './request'
import type { PaginatedResponse } from '@/types'

// 应收状态
export type ReceivableStatus = 'pending' | 'partial' | 'paid' | 'overdue'

// 应收账款
export interface Receivable {
  id: number
  receivable_no: string
  customer_id: number
  customer_name: string
  order_id?: number
  order_no?: string
  total_amount: number
  received_amount: number
  unreceived_amount: number
  due_date: string
  status: ReceivableStatus
  remark?: string
  creator_id: number
  creator_name?: string
  created_at: string
  updated_at: string
  // 收款记录
  records?: ReceivableRecord[]
}

// 收款记录
export interface ReceivableRecord {
  id: number
  receivable_id: number
  amount: number
  payment_method: string
  payment_date: string
  account_no?: string
  voucher_no?: string
  remark?: string
  creator_id: number
  creator_name?: string
  created_at: string
}

// 应收列表参数
export interface ReceivableListParams {
  page?: number
  pageSize?: number
  search?: string
  customer_id?: number
  status?: ReceivableStatus | ''
  start_date?: string
  end_date?: string
  overdue?: boolean
}

// 创建应收参数
export interface ReceivableCreateParams {
  customer_id: number
  order_id?: number
  total_amount: number
  due_date: string
  remark?: string
}

// 更新应收参数
export interface ReceivableUpdateParams extends Partial<ReceivableCreateParams> {
  id: number
}

// 收款参数
export interface ReceivableReceiveParams {
  amount: number
  payment_method: 'bank_transfer' | 'cash' | 'wechat' | 'alipay' | 'check' | 'other'
  payment_date: string
  account_no?: string
  voucher_no?: string
  remark?: string
}

// 账龄分析
export interface ReceivableAgingAnalysis {
  total_amount: number
  received_amount: number
  unreceived_amount: number
  overdue_amount: number
  by_period: Array<{
    period: string
    label: string
    amount: number
    count: number
  }>
  by_customer: Array<{
    customer_id: number
    customer_name: string
    total_amount: number
    received_amount: number
    unreceived_amount: number
    overdue_days: number
  }>
}

// 应收账款 API
export const receivableApi = {
  // 获取应收列表
  getList(params: ReceivableListParams): Promise<PaginatedResponse<Receivable>> {
    return request.get('/receivables', { params })
  },

  // 获取应收详情
  getDetail(id: number): Promise<Receivable> {
    return request.get(`/receivables/${id}`)
  },

  // 创建应收
  create(data: ReceivableCreateParams): Promise<Receivable> {
    return request.post('/receivables', data)
  },

  // 更新应收
  update(id: number, data: Partial<ReceivableCreateParams>): Promise<Receivable> {
    return request.put(`/receivables/${id}`, data)
  },

  // 删除应收
  delete(id: number): Promise<void> {
    return request.delete(`/receivables/${id}`)
  },

  // 收款
  receive(id: number, data: ReceivableReceiveParams): Promise<Receivable> {
    return request.post(`/receivables/${id}/receive`, data)
  },

  // 获取账龄分析
  getAging(): Promise<ReceivableAgingAnalysis> {
    return request.get('/receivables/aging')
  },

  // 导出
  export(params: ReceivableListParams): Promise<Blob> {
    return request.get('/receivables/export', { params, responseType: 'blob' })
  }
}

// 状态标签映射
export const getReceivableStatusLabel = (status: ReceivableStatus): string => {
  const map: Record<ReceivableStatus, string> = {
    pending: '待收款',
    partial: '部分收款',
    paid: '已收清',
    overdue: '已逾期'
  }
  return map[status] || status
}

// 状态类型映射（用于 el-tag）
export const getReceivableStatusType = (status: ReceivableStatus): 'success' | 'warning' | 'info' | 'danger' | 'primary' => {
  const map: Record<ReceivableStatus, 'success' | 'warning' | 'info' | 'danger' | 'primary'> = {
    pending: 'warning',
    partial: 'primary',
    paid: 'success',
    overdue: 'danger'
  }
  return map[status] || 'info'
}

// 支付方式标签映射
export const getReceivablePaymentMethodLabel = (method: string): string => {
  const map: Record<string, string> = {
    bank_transfer: '银行转账',
    cash: '现金',
    wechat: '微信',
    alipay: '支付宝',
    check: '支票',
    other: '其他'
  }
  return map[method] || method
}