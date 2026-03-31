import request from './request'
import type { PaginatedResponse } from '@/types'

// ============== 报销状态 ==============
export type ReimbursementStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled'

// 报销类型
export type ReimbursementType = 'business' | 'travel' | 'communication' | 'other'

// 报销单
export interface ReimbursementItem {
  id?: number
  item_date?: string
  category?: string
  description?: string
  amount: number
  currency?: string
  invoice_no?: string
  notes?: string
}

export interface Reimbursement {
  id: number
  reimbursement_no: string
  user_id: number
  applicant_name?: string
  title: string
  reimbursement_type?: ReimbursementType
  amount: number
  currency?: string
  status: ReimbursementStatus
  application_date?: string
  expense_date?: string
  description?: string
  notes?: string
  approved_by?: number
  approver_name?: string
  approved_at?: string
  reject_reason?: string
  paid_by?: number
  payer_name?: string
  paid_at?: string
  items?: ReimbursementItem[]
  created_at: string
  updated_at: string
}

// 列表参数
export interface ReimbursementListParams {
  page?: number
  pageSize?: number
  search?: string
  status?: ReimbursementStatus | ''
  userId?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// 创建参数
export interface ReimbursementCreateParams {
  reimbursement_no?: string
  title: string
  reimbursement_type?: ReimbursementType
  amount: number
  currency?: string
  application_date?: string
  expense_date?: string
  description?: string
  notes?: string
  items?: ReimbursementItem[]
}

// 更新参数
export interface ReimbursementUpdateParams extends Partial<ReimbursementCreateParams> {}

// 审批参数
export interface ReimbursementApproveParams {
  action: 'approve' | 'reject'
  reject_reason?: string
}

// ============== 状态/类型辅助 ==============

export const ReimbursementStatusLabels: Record<ReimbursementStatus, string> = {
  draft: '草稿',
  pending: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
  paid: '已支付',
  cancelled: '已撤销'
}

export const ReimbursementStatusTagTypes: Record<ReimbursementStatus, string> = {
  draft: 'info',
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  paid: 'primary',
  cancelled: 'info'
}

export const ReimbursementTypeLabels: Record<ReimbursementType, string> = {
  business: '业务招待',
  travel: '差旅报销',
  communication: '通讯报销',
  other: '其他'
}

// ============== API ==============

export const reimbursementApi = {
  // 获取报销列表
  getList(params: ReimbursementListParams): Promise<PaginatedResponse<Reimbursement>> {
    return request.get('/reimbursements', { params })
  },

  // 获取报销详情
  getDetail(id: number): Promise<Reimbursement> {
    return request.get(`/reimbursements/${id}`)
  },

  // 创建报销单
  create(data: ReimbursementCreateParams): Promise<Reimbursement> {
    return request.post('/reimbursements', data)
  },

  // 更新报销单
  update(id: number, data: ReimbursementUpdateParams): Promise<Reimbursement> {
    return request.put(`/reimbursements/${id}`, data)
  },

  // 删除报销单
  delete(id: number): Promise<void> {
    return request.delete(`/reimbursements/${id}`)
  },

  // 提交审批
  submit(id: number): Promise<void> {
    return request.post(`/reimbursements/${id}/submit`)
  },

  // 审批（通过/拒绝）
  approve(id: number, params: ReimbursementApproveParams): Promise<void> {
    return request.post(`/reimbursements/${id}/approve`, params)
  },

  // 支付
  pay(id: number): Promise<void> {
    return request.post(`/reimbursements/${id}/pay`)
  }
}
