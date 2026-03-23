import request from './request'
import type { PaginatedResponse } from '@/types'

// 订单状态
export type SalesOrderStatus = 'draft' | 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled'

// 订单明细
export interface SalesOrderItem {
  id: number
  order_id: number
  product_id: number
  product_name: string
  product_code?: string
  specification?: string
  unit: string
  quantity: number
  unit_price: number
  discount_rate?: number
  discount_amount?: number
  tax_rate?: number
  tax_amount?: number
  subtotal: number
  remark?: string
  created_at: string
  updated_at: string
}

// 销售订单
export interface SalesOrder {
  id: number
  order_no: string
  customer_id: number
  customer_name: string
  contact_person?: string
  contact_phone?: string
  shipping_address?: string
  order_date: string
  total_amount: number
  discount_amount: number
  tax_amount: number
  final_amount: number
  paid_amount: number
  unpaid_amount: number
  status: SalesOrderStatus
  payment_method?: string
  payment_status: 'unpaid' | 'partial' | 'paid'
  delivery_method?: string
  delivery_date?: string
  tracking_no?: string
  remark?: string
  creator_id: number
  creator_name?: string
  auditor_id?: number
  auditor_name?: string
  audit_time?: string
  audit_remark?: string
  items: SalesOrderItem[]
  created_at: string
  updated_at: string
}

// 订单列表参数
export interface SalesOrderListParams {
  page?: number
  pageSize?: number
  search?: string
  customer_id?: number
  status?: SalesOrderStatus | ''
  payment_status?: 'unpaid' | 'partial' | 'paid' | ''
  start_date?: string
  end_date?: string
}

// 创建/更新订单明细参数
export interface SalesOrderItemParams {
  product_id: number
  quantity: number
  unit_price: number
  discount_rate?: number
  discount_amount?: number
  tax_rate?: number
  remark?: string
}

// 创建订单参数
export interface SalesOrderCreateParams {
  customer_id: number
  contact_person?: string
  contact_phone?: string
  shipping_address?: string
  order_date: string
  discount_amount?: number
  payment_method?: string
  delivery_method?: string
  delivery_date?: string
  remark?: string
  items: SalesOrderItemParams[]
}

// 更新订单参数
export interface SalesOrderUpdateParams extends Partial<SalesOrderCreateParams> {
  id: number
}

// 订单统计
export interface SalesOrderStats {
  total_orders: number
  total_amount: number
  pending_orders: number
  completed_orders: number
  by_status: Array<{ status: string; count: number; amount: number }>
}

// 销售订单 API
export const salesOrderApi = {
  // 获取订单列表
  getList(params: SalesOrderListParams): Promise<PaginatedResponse<SalesOrder>> {
    return request.get('/sales-orders', { params })
  },

  // 获取订单详情
  getDetail(id: number): Promise<SalesOrder> {
    return request.get(`/sales-orders/${id}`)
  },

  // 创建订单
  create(data: SalesOrderCreateParams): Promise<SalesOrder> {
    return request.post('/sales-orders', data)
  },

  // 更新订单
  update(id: number, data: Partial<SalesOrderCreateParams>): Promise<SalesOrder> {
    return request.put(`/sales-orders/${id}`, data)
  },

  // 删除订单（仅草稿状态可删除）
  delete(id: number): Promise<void> {
    return request.delete(`/sales-orders/${id}`)
  },

  // 确认订单（审核通过）
  confirm(id: number, remark?: string): Promise<SalesOrder> {
    return request.post(`/sales-orders/${id}/confirm`, { remark })
  },

  // 发货
  ship(id: number, data: { delivery_date?: string; tracking_no?: string; remark?: string }): Promise<SalesOrder> {
    return request.post(`/sales-orders/${id}/ship`, data)
  },

  // 取消订单
  cancel(id: number, reason: string): Promise<SalesOrder> {
    return request.post(`/sales-orders/${id}/cancel`, { reason })
  },

  // 获取订单统计
  getStats(): Promise<SalesOrderStats> {
    return request.get('/sales-orders/stats')
  },

  // 导出订单
  export(params: SalesOrderListParams): Promise<Blob> {
    return request.get('/sales-orders/export', { params, responseType: 'blob' })
  },

  // 获取可销售商品列表
  getProducts(params?: { search?: string }): Promise<Array<{
    id: number
    name: string
    code?: string
    specification?: string
    unit: string
    selling_price: number
    stock: number
  }>> {
    return request.get('/products', { params })
  }
}

// 状态标签映射
export const getSalesOrderStatusLabel = (status: SalesOrderStatus): string => {
  const map: Record<SalesOrderStatus, string> = {
    draft: '草稿',
    pending: '待审核',
    confirmed: '已确认',
    shipping: '发货中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status
}

// 状态类型映射（用于 el-tag）
export const getSalesOrderStatusType = (status: SalesOrderStatus): 'success' | 'warning' | 'info' | 'danger' | 'primary' => {
  const map: Record<SalesOrderStatus, 'success' | 'warning' | 'info' | 'danger' | 'primary'> = {
    draft: 'info',
    pending: 'warning',
    confirmed: 'primary',
    shipping: 'primary',
    completed: 'success',
    cancelled: 'danger'
  }
  return map[status] || 'info'
}

// 支付状态标签映射
export const getPaymentStatusLabel = (status: 'unpaid' | 'partial' | 'paid'): string => {
  const map: Record<'unpaid' | 'partial' | 'paid', string> = {
    unpaid: '未付款',
    partial: '部分付款',
    paid: '已付款'
  }
  return map[status] || status
}

// 支付状态类型映射
export const getPaymentStatusType = (status: 'unpaid' | 'partial' | 'paid'): 'success' | 'warning' | 'info' | 'danger' | 'primary' => {
  const map: Record<'unpaid' | 'partial' | 'paid', 'success' | 'warning' | 'info' | 'danger' | 'primary'> = {
    unpaid: 'danger',
    partial: 'warning',
    paid: 'success'
  }
  return map[status] || 'info'
}