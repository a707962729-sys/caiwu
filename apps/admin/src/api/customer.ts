import request from './request'
import type { PaginatedResponse, ApiResponse } from '@/types'

// 客户类型
export type CustomerType = 'individual' | 'company' | 'government' | 'other'
// 客户状态
export type CustomerStatus = 'potential' | 'active' | 'inactive' | 'lost'
// 客户来源
export type CustomerSource = 'website' | 'referral' | 'advertisement' | 'exhibition' | 'cold_call' | 'other'

// 客户信息
export interface Customer {
  id: number
  name: string
  type: CustomerType
  status: CustomerStatus
  source?: CustomerSource
  industry?: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  province?: string
  city?: string
  district?: string
  website?: string
  remark?: string
  owner_id?: number
  owner_name?: string
  credit_level?: 'A' | 'B' | 'C' | 'D'
  total_amount?: number
  deal_count?: number
  last_contact_date?: string
  next_follow_date?: string
  created_at: string
  updated_at: string
}

// 联系人信息
export interface Contact {
  id: number
  customer_id: number
  name: string
  position?: string
  department?: string
  phone?: string
  mobile?: string
  email?: string
  wechat?: string
  qq?: string
  is_primary: boolean
  remark?: string
  created_at: string
  updated_at: string
}

// 跟进记录
export interface FollowRecord {
  id: number
  customer_id: number
  contact_id?: number
  contact_name?: string
  type: 'visit' | 'call' | 'email' | 'wechat' | 'other'
  content: string
  next_action?: string
  next_date?: string
  attachment?: string
  creator_id: number
  creator_name?: string
  created_at: string
  updated_at: string
}

// 客户列表参数
export interface CustomerListParams {
  page?: number
  pageSize?: number
  search?: string
  type?: CustomerType | ''
  status?: CustomerStatus | ''
  source?: CustomerSource | ''
  industry?: string
  startDate?: string
  endDate?: string
  owner_id?: number
}

// 创建客户参数
export interface CustomerCreateParams {
  name: string
  type: CustomerType
  status?: CustomerStatus
  source?: CustomerSource
  industry?: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  province?: string
  city?: string
  district?: string
  website?: string
  remark?: string
  owner_id?: number
  credit_level?: 'A' | 'B' | 'C' | 'D'
  next_follow_date?: string
}

// 更新客户参数
export interface CustomerUpdateParams extends Partial<CustomerCreateParams> {}

// 联系人列表参数
export interface ContactListParams {
  customer_id?: number
  page?: number
  pageSize?: number
}

// 创建联系人参数
export interface ContactCreateParams {
  customer_id: number
  name: string
  position?: string
  department?: string
  phone?: string
  mobile?: string
  email?: string
  wechat?: string
  qq?: string
  is_primary?: boolean
  remark?: string
}

// 跟进记录列表参数
export interface FollowRecordListParams {
  customer_id?: number
  page?: number
  pageSize?: number
  type?: FollowRecord['type'] | ''
}

// 创建跟进记录参数
export interface FollowRecordCreateParams {
  customer_id: number
  contact_id?: number
  type: FollowRecord['type']
  content: string
  next_action?: string
  next_date?: string
  attachment?: string
}

// 客户 API
export const customerApi = {
  // 获取客户列表
  getList(params: CustomerListParams): Promise<PaginatedResponse<Customer>> {
    return request.get('/customers', { params })
  },

  // 获取客户详情
  getDetail(id: number): Promise<Customer> {
    return request.get(`/customers/${id}`)
  },

  // 创建客户
  create(data: CustomerCreateParams): Promise<Customer> {
    return request.post('/customers', data)
  },

  // 更新客户
  update(id: number, data: CustomerUpdateParams): Promise<Customer> {
    return request.put(`/customers/${id}`, data)
  },

  // 删除客户
  delete(id: number): Promise<void> {
    return request.delete(`/customers/${id}`)
  },

  // 批量删除客户
  batchDelete(ids: number[]): Promise<void> {
    return request.post('/customers/batch-delete', { ids })
  },

  // 获取客户统计
  getStats(): Promise<{
    total: number
    by_status: Array<{ status: string; count: number }>
    by_type: Array<{ type: string; count: number }>
    by_source: Array<{ source: string; count: number }>
    recent: Array<Customer>
  }> {
    return request.get('/customers/stats')
  },

  // 导出客户
  export(params: CustomerListParams): Promise<Blob> {
    return request.get('/customers/export', { params, responseType: 'blob' })
  }
}

// 联系人 API
export const contactApi = {
  // 获取联系人列表
  getList(params: ContactListParams): Promise<PaginatedResponse<Contact>> {
    return request.get('/contacts', { params })
  },

  // 获取联系人详情
  getDetail(id: number): Promise<Contact> {
    return request.get(`/contacts/${id}`)
  },

  // 创建联系人
  create(data: ContactCreateParams): Promise<Contact> {
    return request.post('/contacts', data)
  },

  // 更新联系人
  update(id: number, data: Partial<ContactCreateParams>): Promise<Contact> {
    return request.put(`/contacts/${id}`, data)
  },

  // 删除联系人
  delete(id: number): Promise<void> {
    return request.delete(`/contacts/${id}`)
  },

  // 设为主要联系人
  setPrimary(id: number): Promise<void> {
    return request.put(`/contacts/${id}/primary`)
  }
}

// 跟进记录 API
export const followRecordApi = {
  // 获取跟进记录列表
  getList(params: FollowRecordListParams): Promise<PaginatedResponse<FollowRecord>> {
    return request.get('/follow-records', { params })
  },

  // 获取跟进记录详情
  getDetail(id: number): Promise<FollowRecord> {
    return request.get(`/follow-records/${id}`)
  },

  // 创建跟进记录
  create(data: FollowRecordCreateParams): Promise<FollowRecord> {
    return request.post('/follow-records', data)
  },

  // 更新跟进记录
  update(id: number, data: Partial<FollowRecordCreateParams>): Promise<FollowRecord> {
    return request.put(`/follow-records/${id}`, data)
  },

  // 删除跟进记录
  delete(id: number): Promise<void> {
    return request.delete(`/follow-records/${id}`)
  }
}

// 辅助函数
export const getCustomerTypeLabel = (type: CustomerType): string => {
  const map: Record<CustomerType, string> = {
    individual: '个人',
    company: '企业',
    government: '政府',
    other: '其他'
  }
  return map[type] || type
}

export const getCustomerStatusLabel = (status: CustomerStatus): string => {
  const map: Record<CustomerStatus, string> = {
    potential: '潜在客户',
    active: '活跃客户',
    inactive: '不活跃',
    lost: '已流失'
  }
  return map[status] || status
}

export const getCustomerSourceLabel = (source: CustomerSource): string => {
  const map: Record<CustomerSource, string> = {
    website: '官网',
    referral: '转介绍',
    advertisement: '广告',
    exhibition: '展会',
    cold_call: '电话营销',
    other: '其他'
  }
  return map[source] || source
}

export const getFollowTypeLabel = (type: FollowRecord['type']): string => {
  const map: Record<string, string> = {
    visit: '上门拜访',
    call: '电话沟通',
    email: '邮件联系',
    wechat: '微信沟通',
    other: '其他方式'
  }
  return map[type] || type
}