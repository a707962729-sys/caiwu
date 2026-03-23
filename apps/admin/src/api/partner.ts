import request from './request'
import type { PaginatedResponse } from '@/types'

// 往来单位类型
export type PartnerType = 'customer' | 'supplier' | 'both'

// 往来单位状态
export type PartnerStatus = 'active' | 'inactive'

// 往来单位实体
export interface Partner {
  id: number
  name: string
  type: PartnerType
  contact_person: string
  phone: string
  balance: number
  status: PartnerStatus
  remark: string
  created_at: string
  updated_at: string
}

// 创建参数
export interface PartnerCreateParams {
  name: string
  type: PartnerType
  contact_person?: string
  phone?: string
  balance?: number
  status?: PartnerStatus
  remark?: string
}

// 列表查询参数
export interface PartnerListParams {
  page?: number
  pageSize?: number
  type?: PartnerType | ''
  status?: PartnerStatus | ''
  search?: string
}

// API 方法
export const partnerApi = {
  // 获取列表
  getList(params: PartnerListParams): Promise<PaginatedResponse<Partner>> {
    return request.get('/partners', { params })
  },

  // 获取详情
  getDetail(id: number): Promise<Partner> {
    return request.get(`/partners/${id}`)
  },

  // 创建
  create(data: PartnerCreateParams): Promise<Partner> {
    return request.post('/partners', data)
  },

  // 更新
  update(id: number, data: Partial<PartnerCreateParams>): Promise<Partner> {
    return request.put(`/partners/${id}`, data)
  },

  // 删除
  delete(id: number): Promise<void> {
    return request.delete(`/partners/${id}`)
  }
}

// 类型标签映射
export const getPartnerTypeLabel = (type: PartnerType): string => {
  const map: Record<PartnerType, string> = {
    customer: '客户',
    supplier: '供应商',
    both: '客户&供应商'
  }
  return map[type] || type
}

// 状态标签映射
export const getPartnerStatusLabel = (status: PartnerStatus): string => {
  const map: Record<PartnerStatus, string> = {
    active: '正常',
    inactive: '停用'
  }
  return map[status] || status
}