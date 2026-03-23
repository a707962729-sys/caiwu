import request from './request'
import type { ApiResponse } from '@/types'

// 字典项类型
export type DictType = 
  | 'system_config'     // 系统配置
  | 'product_category' // 商品分类
  | 'customer_type'    // 客户类型
  | 'supplier_type'    // 供应商类型
  | 'payment_method'   // 支付方式
  | 'expense_category' // 支出分类
  | 'income_category'  // 收入分类

// 字典项接口
export interface DictItem {
  id: number
  type: DictType
  code: string
  name: string
  value?: string
  sort: number
  status: number
  parent_id?: number
  remark?: string
  created_at: string
  updated_at: string
}

// 字典创建参数
export interface DictCreateParams {
  type: DictType
  code: string
  name: string
  value?: string
  sort?: number
  status?: number
  parent_id?: number
  remark?: string
}

// 字典更新参数
export interface DictUpdateParams {
  code?: string
  name?: string
  value?: string
  sort?: number
  status?: number
  parent_id?: number
  remark?: string
}

// 字典列表参数
export interface DictListParams {
  type?: DictType
  search?: string
  status?: number
}

// 公司信息接口
export interface CompanyInfo {
  id: number
  name: string
  short_name?: string
  tax_number?: string
  address?: string
  phone?: string
  email?: string
  bank_name?: string
  bank_account?: string
  logo?: string
  invoice_header?: string
  remark?: string
}

// 公司信息更新参数
export interface CompanyUpdateParams {
  name?: string
  short_name?: string
  tax_number?: string
  address?: string
  phone?: string
  email?: string
  bank_name?: string
  bank_account?: string
  logo?: string
  invoice_header?: string
  remark?: string
}

// 系统配置接口
export interface SystemConfig {
  id: number
  key: string
  value: string
  name: string
  description?: string
  type: 'string' | 'number' | 'boolean' | 'json'
  group: string
  sort: number
}

// 系统配置更新参数
export interface SystemConfigUpdateParams {
  value: string
}

export const dictApi = {
  // 获取字典列表
  getList(params: DictListParams): Promise<DictItem[]> {
    return request.get('/dict', { params })
  },

  // 获取字典详情
  getDetail(id: number): Promise<DictItem> {
    return request.get(`/dict/${id}`)
  },

  // 创建字典项
  create(data: DictCreateParams): Promise<DictItem> {
    return request.post('/dict', data)
  },

  // 更新字典项
  update(id: number, data: DictUpdateParams): Promise<DictItem> {
    return request.put(`/dict/${id}`, data)
  },

  // 删除字典项
  delete(id: number): Promise<void> {
    return request.delete(`/dict/${id}`)
  }
}

// 公司信息 API
export const companyApi = {
  // 获取公司信息
  getInfo(): Promise<CompanyInfo> {
    return request.get('/company/current')
  },

  // 更新公司信息
  update(data: CompanyUpdateParams): Promise<CompanyInfo> {
    return request.put('/company/current', data)
  }
}

// 系统配置 API
export const configApi = {
  // 获取配置列表
  getList(group?: string): Promise<SystemConfig[]> {
    return request.get('/config', { params: { group } })
  },

  // 更新配置
  update(key: string, value: string): Promise<SystemConfig> {
    return request.put(`/config/${key}`, { value })
  },

  // 批量更新配置
  batchUpdate(configs: Array<{ key: string; value: string }>): Promise<void> {
    return request.put('/config/batch', { configs })
  }
}