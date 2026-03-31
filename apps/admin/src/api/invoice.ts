import request from './request'
import type { PaginatedResponse } from '@/types'

// 票据类型
export type InvoiceType = 'vat_invoice' | 'receipt' | 'check' | 'other'

// 票据状态
export type InvoiceStatus = 'pending' | 'pending_review' | 'verified' | 'paid' | 'cancelled'

// 票据信息（前端格式）
export interface Invoice {
  id: number
  invoice_no: string
  invoice_code?: string
  type: InvoiceType
  invoice_type?: string
  amount: number
  amount_before_tax?: number
  tax_amount?: number
  invoice_date: string
  status: InvoiceStatus
  issuer?: string
  payer?: string
  seller_name?: string
  buyer_name?: string
  description?: string
  attachment?: string
  created_by?: number
  creator_name?: string
  created_at: string
  updated_at: string
}

// 后端返回的发票格式
interface BackendInvoice {
  id: number
  invoice_no: string
  invoice_code?: string
  invoice_type: string
  total_amount: number
  amount_before_tax?: number
  tax_amount?: number
  issue_date: string
  status: string
  seller_name?: string
  buyer_name?: string
  description?: string
  partner_name?: string
  created_by?: number
  created_at: string
  updated_at: string
}

// 票据列表参数
export interface InvoiceListParams {
  page?: number
  pageSize?: number
  search?: string
  type?: InvoiceType | ''
  status?: InvoiceStatus | ''
  startDate?: string
  endDate?: string
  minAmount?: number
  maxAmount?: number
}

// 创建票据参数
export interface InvoiceCreateParams {
  invoice_no: string
  type: InvoiceType
  amount: number
  invoice_date: string
  status?: InvoiceStatus
  issuer?: string
  payer?: string
  description?: string
  attachment?: string
}

// 更新票据参数
export type InvoiceUpdateParams = Partial<InvoiceCreateParams>

// 字段映射：后端 -> 前端
function mapInvoiceFromBackend(backend: BackendInvoice): Invoice {
  return {
    id: backend.id,
    invoice_no: backend.invoice_no,
    invoice_code: backend.invoice_code,
    type: mapInvoiceType(backend.invoice_type),
    invoice_type: backend.invoice_type,
    amount: backend.total_amount,
    amount_before_tax: backend.amount_before_tax,
    tax_amount: backend.tax_amount,
    invoice_date: backend.issue_date,
    status: mapInvoiceStatus(backend.status),
    issuer: backend.seller_name || backend.buyer_name,  // 显示卖方或买方
    payer: backend.buyer_name || backend.seller_name,     // 显示买方或卖方
    seller_name: backend.seller_name,
    buyer_name: backend.buyer_name,
    description: backend.description,
    created_by: backend.created_by,
    created_at: backend.created_at,
    updated_at: backend.updated_at
  }
}

// 后端发票类型 -> 前端类型
function mapInvoiceType(type: string): InvoiceType {
  const map: Record<string, InvoiceType> = {
    '增值税专用发票': 'vat_invoice',
    '增值税普通发票': 'vat_invoice',
    '电子发票(普通发票)': 'vat_invoice',
    '电子发票(增值税专用发票)': 'vat_invoice',
    '收据': 'receipt',
    '支票': 'check'
  }
  return map[type] || 'other'
}

// 后端状态 -> 前端状态
function mapInvoiceStatus(status: string): InvoiceStatus {
  const map: Record<string, InvoiceStatus> = {
    'pending': 'pending',
    'pending_review': 'pending_review',
    'verified': 'verified',
    'paid': 'paid',
    'cancelled': 'cancelled'
  }
  return map[status] || 'pending'
}

// 票据 API
export const invoiceApi = {
  // 获取票据列表
  async getList(params: InvoiceListParams): Promise<PaginatedResponse<Invoice>> {
    const result = await request.get('/invoices', { params })
    // 转换字段
    if (result && result.list) {
      result.list = result.list.map(mapInvoiceFromBackend)
    }
    return result
  },

  // 获取票据详情
  async getDetail(id: number): Promise<Invoice> {
    const result = await request.get(`/invoices/${id}`)
    return mapInvoiceFromBackend(result)
  },

  // 创建票据
  // 字段映射：前端 -> 后端
  toBackend(data: any): any {
    return {
      invoice_no: data.invoice_no,
      invoice_type: data.type,
      amount_before_tax: data.amount,
      issue_date: data.invoice_date,
      status: data.status,
      seller_name: data.issuer,
      buyer_name: data.payer,
      description: data.description,
      attachment: data.attachment
    }
  },

  create(data: InvoiceCreateParams): Promise<Invoice> {
    return request.post('/invoices', this.toBackend(data))
  },

  // 更新票据
  update(id: number, data: InvoiceUpdateParams): Promise<Invoice> {
    return request.put(`/invoices/${id}`, this.toBackend(data))
  },

  // 删除票据
  delete(id: number): Promise<void> {
    return request.delete(`/invoices/${id}`)
  },

  // 批量删除票据
  batchDelete(ids: number[]): Promise<void> {
    return request.post('/invoices/batch-delete', { ids })
  },

  // 获取票据统计
  getStats(): Promise<{
    total: number
    total_amount: number
    by_type: Array<{ type: string; count: number; amount: number }>
    by_status: Array<{ status: string; count: number; amount: number }>
  }> {
    return request.get('/invoices/stats')
  },

  // 导出票据
  export(params: InvoiceListParams): Promise<Blob> {
    return request.get('/invoices/export', { params, responseType: 'blob' })
  },

  // 审核发票
  verify(id: number, data?: { status?: string; remark?: string }): Promise<void> {
    return request.post(`/invoices/${id}/verify`, data || {})
  }
}

// 辅助函数
export const getInvoiceTypeLabel = (type: InvoiceType | string): string => {
  // 如果是后端返回的中文类型，直接返回
  const chineseTypes = ['增值税专用发票', '增值税普通发票', '电子发票(普通发票)', '电子发票(增值税专用发票)', '收据', '支票']
  if (chineseTypes.includes(type)) {
    return type
  }
  const map: Record<InvoiceType, string> = {
    vat_invoice: '增值税发票',
    receipt: '收据',
    check: '支票',
    other: '其他'
  }
  return map[type as InvoiceType] || type
}

export const getInvoiceStatusLabel = (status: InvoiceStatus | string): string => {
  const map: Record<string, string> = {
    pending: '待处理',
    pending_review: '待审核',
    verified: '已审核',
    paid: '已支付',
    cancelled: '已作废'
  }
  return map[status] || status
}

export const getInvoiceTypeTagType = (type: InvoiceType | string): 'primary' | 'success' | 'warning' | 'info' | 'danger' | undefined => {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    vat_invoice: 'primary',
    '增值税专用发票': 'primary',
    '增值税普通发票': 'primary',
    '电子发票(普通发票)': 'primary',
    receipt: 'success',
    '收据': 'success',
    check: 'warning',
    '支票': 'warning',
    other: 'info'
  }
  return map[type]
}

export const getInvoiceStatusTagType = (status: InvoiceStatus | string): 'primary' | 'success' | 'warning' | 'info' | 'danger' | undefined => {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    pending: 'info',
    pending_review: 'warning',
    verified: 'success',
    paid: 'primary',
    cancelled: 'danger'
  }
  return map[status]
}