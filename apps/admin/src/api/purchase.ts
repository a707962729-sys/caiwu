import request from './request'
import type { PaginatedResponse, ApiResponse } from '@/types'

// 采购订单状态
export type PurchaseOrderStatus = 'draft' | 'pending' | 'confirmed' | 'received' | 'cancelled'

// 采购订单
export interface PurchaseOrder {
  id: number
  order_no: string
  supplier_id: number
  supplier_name: string
  total_amount: number
  status: PurchaseOrderStatus
  order_date: string
  expected_date?: string
  remarks?: string
  auditor?: string
  audit_time?: string
  audit_remark?: string
  creator?: string
  created_at: string
  updated_at: string
  details?: PurchaseOrderDetail[]
}

// 采购订单明细
export interface PurchaseOrderDetail {
  id?: number
  order_id?: number
  product_id: number
  product_name: string
  product_code?: string
  unit: string
  quantity: number
  price: number
  amount: number
  received_quantity?: number
  remarks?: string
}

// 创建订单参数
export interface PurchaseOrderCreateParams {
  supplier_id: number
  order_date: string
  expected_date?: string
  remarks?: string
  details: Array<{
    product_id: number
    quantity: number
    price: number
    remarks?: string
  }>
}

// 更新订单参数
export interface PurchaseOrderUpdateParams {
  supplier_id?: number
  order_date?: string
  expected_date?: string
  remarks?: string
  details?: Array<{
    product_id: number
    quantity: number
    price: number
    remarks?: string
  }>
}

// 订单列表查询参数
export interface PurchaseOrderListParams {
  page?: number
  pageSize?: number
  supplier_id?: number
  status?: PurchaseOrderStatus | ''
  start_date?: string
  end_date?: string
  search?: string
}

// 入库参数
export interface ReceiveParams {
  details: Array<{
    detail_id: number
    received_quantity: number
  }>
  warehouse_id: number
}

// 审核参数
export interface AuditParams {
  approved: boolean
  remark?: string
}

// 订单统计
export interface PurchaseOrderStats {
  total_count: number
  total_amount: number
  pending_count: number
  confirmed_count: number
  received_count: number
}

export const purchaseApi = {
  // 获取订单列表
  getList(params: PurchaseOrderListParams): Promise<PaginatedResponse<PurchaseOrder> & { stats?: PurchaseOrderStats }> {
    return request.get('/purchase-orders', { params })
  },

  // 获取订单详情
  getDetail(id: number): Promise<PurchaseOrder> {
    return request.get(`/purchase-orders/${id}`)
  },

  // 创建订单
  create(data: PurchaseOrderCreateParams): Promise<PurchaseOrder> {
    return request.post('/purchase-orders', data)
  },

  // 更新订单
  update(id: number, data: PurchaseOrderUpdateParams): Promise<PurchaseOrder> {
    return request.put(`/purchase-orders/${id}`, data)
  },

  // 删除订单
  delete(id: number): Promise<void> {
    return request.delete(`/purchase-orders/${id}`)
  },

  // 确认订单（提交审核）
  confirm(id: number): Promise<PurchaseOrder> {
    return request.post(`/purchase-orders/${id}/confirm`)
  },

  // 审核订单
  audit(id: number, data: AuditParams): Promise<PurchaseOrder> {
    return request.post(`/purchase-orders/${id}/audit`, data)
  },

  // 入库
  receive(id: number, data: ReceiveParams): Promise<PurchaseOrder> {
    return request.post(`/purchase-orders/${id}/receive`, data)
  },

  // 取消订单
  cancel(id: number): Promise<PurchaseOrder> {
    return request.post(`/purchase-orders/${id}/cancel`)
  },

  // 导出
  export(params: PurchaseOrderListParams): Promise<Blob> {
    return request.get('/purchase-orders/export', {
      params,
      responseType: 'blob'
    })
  }
}