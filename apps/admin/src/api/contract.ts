import request from './request'
import type { PaginatedResponse } from '@/types'

// 合同状态
export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated'

// 合同类型
export type ContractType = 'sales' | 'purchase' | 'service' | 'other'

// 合同信息
export interface Contract {
  id: number
  contract_no: string
  name: string
  type: ContractType
  party_type: 'customer' | 'supplier'
  party_id: number
  party_name: string
  amount: number
  status: ContractStatus
  sign_date?: string
  start_date: string
  end_date: string
  content?: string
  remark?: string
  attachment?: string
  creator_id?: number
  creator_name?: string
  created_at: string
  updated_at: string
}

// 合同列表参数
export interface ContractListParams {
  page?: number
  pageSize?: number
  search?: string
  status?: ContractStatus | ''
  type?: ContractType | ''
  party_type?: 'customer' | 'supplier' | ''
  startDate?: string
  endDate?: string
}

// 创建合同参数
export interface ContractCreateParams {
  name: string
  type: ContractType
  party_type: 'customer' | 'supplier'
  party_id: number
  amount: number
  status?: ContractStatus
  sign_date?: string
  start_date: string
  end_date: string
  content?: string
  remark?: string
  attachment?: string
}

// 更新合同参数
export interface ContractUpdateParams extends Partial<ContractCreateParams> {}

// 合同 API
export const contractApi = {
  // 获取合同列表
  getList(params: ContractListParams): Promise<PaginatedResponse<Contract>> {
    return request.get('/contracts', { params })
  },

  // 获取合同详情
  getDetail(id: number): Promise<Contract> {
    return request.get(`/contracts/${id}`)
  },

  // 创建合同
  create(data: ContractCreateParams): Promise<Contract> {
    return request.post('/contracts', data)
  },

  // 更新合同
  update(id: number, data: ContractUpdateParams): Promise<Contract> {
    return request.put(`/contracts/${id}`, data)
  },

  // 删除合同
  delete(id: number): Promise<void> {
    return request.delete(`/contracts/${id}`)
  },

  // 获取合同统计
  getStats(): Promise<{
    total: number
    by_status: Array<{ status: string; count: number }>
    by_type: Array<{ type: string; count: number }>
    total_amount: number
  }> {
    return request.get('/contracts/stats')
  },

  // 导出合同
  export(params: ContractListParams): Promise<Blob> {
    return request.get('/contracts/export', { params, responseType: 'blob' })
  }
}

// 辅助函数
export const getContractStatusLabel = (status: ContractStatus): string => {
  const map: Record<ContractStatus, string> = {
    draft: '草稿',
    active: '生效中',
    expired: '已过期',
    terminated: '已终止'
  }
  return map[status] || status
}

export const getContractTypeLabel = (type: ContractType): string => {
  const map: Record<ContractType, string> = {
    sales: '销售合同',
    purchase: '采购合同',
    service: '服务合同',
    other: '其他合同'
  }
  return map[type] || type
}

export const getContractStatusTagType = (status: ContractStatus): string => {
  const map: Record<ContractStatus, string> = {
    draft: 'info',
    active: 'success',
    expired: 'warning',
    terminated: 'danger'
  }
  return map[status] || 'info'
}

export const getContractTypeTagType = (type: ContractType): string => {
  const map: Record<ContractType, string> = {
    sales: 'primary',
    purchase: 'success',
    service: 'warning',
    other: 'info'
  }
  return map[type] || 'info'
}