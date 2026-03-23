import request from './request'
import type { PaginatedResponse, ApiResponse } from '@/types'

// 库存项
export interface InventoryItem {
  id: number
  product_id: number
  product_name: string
  product_sku?: string
  warehouse_id: number
  warehouse_name: string
  quantity: number
  safety_stock: number // 安全库存
  unit: string
  cost_price: number // 成本价
  total_cost: number // 总成本
  created_at: string
  updated_at: string
}

// 仓库
export interface Warehouse {
  id: number
  name: string
  code?: string
  address?: string
  manager?: string
  phone?: string
  status: number
  created_at: string
  updated_at: string
}

// 库存变动记录
export interface InventoryLog {
  id: number
  inventory_id: number
  product_name: string
  product_sku?: string
  warehouse_name: string
  type: 'stock_in' | 'stock_out' | 'transfer_in' | 'transfer_out' | 'adjust'
  quantity: number
  before_quantity: number
  after_quantity: number
  unit: string
  cost_price: number
  total_amount: number
  reason?: string
  related_warehouse?: string // 调拨相关仓库
  operator: string
  created_at: string
}

// 入库参数
export interface StockInParams {
  product_id: number
  warehouse_id: number
  quantity: number
  cost_price: number
  reason?: string
}

// 出库参数
export interface StockOutParams {
  product_id: number
  warehouse_id: number
  quantity: number
  reason?: string
}

// 调拨参数
export interface TransferParams {
  product_id: number
  from_warehouse_id: number
  to_warehouse_id: number
  quantity: number
  reason?: string
}

// 库存列表查询参数
export interface InventoryListParams {
  page?: number
  pageSize?: number
  warehouse_id?: number
  product_name?: string
  low_stock?: boolean // 只显示低库存
}

// 库存变动记录查询参数
export interface InventoryLogParams {
  page?: number
  pageSize?: number
  inventory_id?: number
  type?: 'stock_in' | 'stock_out' | 'transfer_in' | 'transfer_out' | 'adjust' | ''
  warehouse_id?: number
  start_date?: string
  end_date?: string
}

// 库存统计
export interface InventoryStats {
  total_products: number // 商品种类数
  total_quantity: number // 总库存数量
  total_value: number // 总库存价值
  low_stock_count: number // 低库存商品数
  out_of_stock_count: number // 缺货商品数
}

export const inventoryApi = {
  // 获取库存列表
  getList(params: InventoryListParams): Promise<PaginatedResponse<InventoryItem> & { stats?: InventoryStats }> {
    return request.get('/inventory', { params })
  },

  // 获取库存详情
  getDetail(id: number): Promise<InventoryItem> {
    return request.get(`/inventory/${id}`)
  },

  // 入库
  stockIn(data: StockInParams): Promise<InventoryLog> {
    return request.post('/inventory/stock-in', data)
  },

  // 出库
  stockOut(data: StockOutParams): Promise<InventoryLog> {
    return request.post('/inventory/stock-out', data)
  },

  // 调拨
  transfer(data: TransferParams): Promise<{ inLog: InventoryLog; outLog: InventoryLog }> {
    return request.post('/inventory/transfer', data)
  },

  // 获取仓库列表
  getWarehouses(): Promise<Warehouse[]> {
    return request.get('/warehouses')
  },

  // 获取库存变动记录
  getLogs(params: InventoryLogParams): Promise<PaginatedResponse<InventoryLog>> {
    return request.get('/inventory/logs', { params })
  },

  // 获取商品列表（用于选择）
  getProducts(params?: { search?: string }): Promise<Array<{ id: number; name: string; sku?: string; unit: string }>> {
    return request.get('/products', { params })
  },

  // 更新安全库存
  updateSafetyStock(id: number, safety_stock: number): Promise<InventoryItem> {
    return request.put(`/inventory/${id}/safety-stock`, { safety_stock })
  }
}