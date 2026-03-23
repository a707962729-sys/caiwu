import request from './request'
import type { PaginatedResponse, ApiResponse } from '@/types'

export interface Product {
  id: number
  code: string
  name: string
  category: string
  specification?: string
  unit: string
  cost_price: number
  selling_price: number
  stock: number
  min_stock?: number
  max_stock?: number
  barcode?: string
  description?: string
  status: number
  created_at: string
  updated_at: string
}

export interface ProductCreateParams {
  code: string
  name: string
  category: string
  specification?: string
  unit: string
  cost_price: number
  selling_price: number
  stock?: number
  min_stock?: number
  max_stock?: number
  barcode?: string
  description?: string
}

export interface ProductListParams {
  page?: number
  pageSize?: number
  category?: string
  search?: string
  status?: number
}

export const productApi = {
  // 获取商品列表
  getList(params: ProductListParams): Promise<PaginatedResponse<Product>> {
    return request.get('/products', { params })
  },

  // 获取商品详情
  getDetail(id: number): Promise<Product> {
    return request.get(`/products/${id}`)
  },

  // 创建商品
  create(data: ProductCreateParams): Promise<Product> {
    return request.post('/products', data)
  },

  // 更新商品
  update(id: number, data: Partial<ProductCreateParams>): Promise<Product> {
    return request.put(`/products/${id}`, data)
  },

  // 删除商品
  delete(id: number): Promise<void> {
    return request.delete(`/products/${id}`)
  },

  // 导出商品
  export(params: ProductListParams): Promise<Blob> {
    return request.get('/products/export', {
      params,
      responseType: 'blob'
    })
  }
}

// 商品分类 API
export const categoryApi = {
  // 获取商品分类列表
  getList(): Promise<Array<{ id: number; name: string; code?: string }>> {
    return request.get('/dict', { params: { type: 'product_category' } })
  }
}