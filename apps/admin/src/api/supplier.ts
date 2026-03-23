import request from './request'
import type { PaginatedResponse, ApiResponse } from '@/types'

export interface Supplier {
  id: number
  name: string
  type: string
  contact_person: string
  phone: string
  address: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface SupplierCreateParams {
  name: string
  type: string
  contact_person: string
  phone: string
  address: string
  status?: 'active' | 'inactive'
}

export interface SupplierListParams {
  page?: number
  pageSize?: number
  type?: string
  status?: 'active' | 'inactive' | ''
  search?: string
}

export const supplierApi = {
  // 获取列表
  getList(params: SupplierListParams): Promise<PaginatedResponse<Supplier>> {
    return request.get('/suppliers', { params })
  },

  // 获取详情
  getDetail(id: number): Promise<Supplier> {
    return request.get(`/suppliers/${id}`)
  },

  // 创建
  create(data: SupplierCreateParams): Promise<Supplier> {
    return request.post('/suppliers', data)
  },

  // 更新
  update(id: number, data: Partial<SupplierCreateParams>): Promise<Supplier> {
    return request.put(`/suppliers/${id}`, data)
  },

  // 删除
  delete(id: number): Promise<void> {
    return request.delete(`/suppliers/${id}`)
  },

  // 获取供应商类型列表
  getTypes(): Promise<Array<{ name: string; label: string }>> {
    return request.get('/suppliers/types')
  }
}