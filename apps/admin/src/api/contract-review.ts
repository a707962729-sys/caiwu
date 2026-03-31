import request from './request'
import type { PaginatedResponse } from '@/types'

// 审核结果
export interface ContractReviewResult {
  review_id: number
  overall_risk_level: 'low' | 'medium' | 'high'
  risk_score: number
  contract_type: string
  contract_type_confidence: number
  party_a_risk_level: string
  party_b_risk_level: string
  party_a_risk_factors: string[]
  party_b_risk_factors: string[]
  risk_findings: RiskFinding[]
  review_suggestions: ReviewSuggestion[]
  ai_model: string
  ai_tokens_used: number
  reviewed_at?: string
  created_at: string
}

export interface RiskFinding {
  item: string
  detail: string
  risk_level: 'low' | 'medium' | 'high'
}

export interface ReviewSuggestion {
  priority: number
  category: string
  suggestion: string
  reason: string
}

// 审核历史
export interface ContractReviewHistory extends ContractReviewResult {
  history: Array<{
    id: number
    action: string
    operator_name: string
    changes?: any
    created_at: string
  }>
}

// 风险规则
export interface RiskRule {
  id: number
  rule_name: string
  rule_type: 'party_risk' | 'contract_risk' | 'amount_risk'
  condition: any
  risk_level: 'low' | 'medium' | 'high'
  suggestion_template: string
  enabled: number
  priority: number
  created_at: string
}

// Partner 风险档案
export interface PartnerRiskProfile {
  partner_id: number
  partner_name: string
  risk_level: string
  risk_reason?: string
  credit_score?: number
  stats: {
    total_contract_amount: number
    contract_count: number
    receivable: number
    payable: number
  }
  recent_reviews: Array<{
    party_a_risk_level: string
    party_b_risk_level: string
    created_at: string
  }>
}

// 批量审核结果
export interface BatchReviewResult {
  contract_id: number
  success: boolean
  review_id?: number
  overall_risk_level?: string
  risk_score?: number
  error?: string
}

// 合同审核 API
export const contractReviewApi = {
  // 触发合同审核
  review(contractId: number, contractText?: string): Promise<ContractReviewResult> {
    return request.post(`/contracts/${contractId}/review`, { contract_text: contractText })
  },

  // 获取合同审核结果
  getReviewResult(contractId: number): Promise<ContractReviewResult | null> {
    return request.get(`/contracts/${contractId}/review`)
  },

  // 获取合同审核历史
  getReviewHistory(contractId: number): Promise<ContractReviewHistory[]> {
    return request.get(`/contracts/${contractId}/reviews`)
  },

  // 分析合同（不上传，仅分析）
  analyze(contractId: number, contractText?: string): Promise<ContractReviewResult> {
    return request.post(`/contracts/${contractId}/analyze`, { contract_text: contractText })
  },

  // 人工复审
  manualReview(reviewId: number, data: {
    overall_risk_level: string
    risk_findings: RiskFinding[]
    review_suggestions: ReviewSuggestion[]
    notes?: string
  }): Promise<void> {
    return request.put(`/reviews/${reviewId}/manual`, data)
  },

  // 批量审核
  batchReview(contractIds: number[]): Promise<{
    total: number
    succeeded: number
    failed: number
    results: BatchReviewResult[]
  }> {
    return request.post('/contracts/batch-review', { contract_ids: contractIds })
  },

  // 获取风险规则列表
  getRiskRules(params?: {
    rule_type?: string
    enabled?: number
  }): Promise<RiskRule[]> {
    return request.get('/risk-rules', { params })
  },

  // 创建风险规则
  createRiskRule(data: {
    rule_name: string
    rule_type: 'party_risk' | 'contract_risk' | 'amount_risk'
    condition: any
    risk_level: 'low' | 'medium' | 'high'
    suggestion_template?: string
    enabled?: number
    priority?: number
  }): Promise<{ id: number }> {
    return request.post('/risk-rules', data)
  },

  // 更新风险规则
  updateRiskRule(id: number, data: Partial<{
    rule_name: string
    rule_type: string
    condition: any
    risk_level: string
    suggestion_template: string
    enabled: number
    priority: number
  }>): Promise<void> {
    return request.put(`/risk-rules/${id}`, data)
  },

  // 删除风险规则
  deleteRiskRule(id: number): Promise<void> {
    return request.delete(`/risk-rules/${id}`)
  },

  // 获取 Partner 风险档案
  getPartnerRisk(partnerId: number): Promise<PartnerRiskProfile> {
    return request.get(`/partners/${partnerId}/risk`)
  },

  // 更新 Partner 风险等级
  updatePartnerRisk(partnerId: number, data: {
    risk_level?: string
    risk_reason?: string
    credit_score?: number
  }): Promise<void> {
    return request.put(`/partners/${partnerId}/risk`, data)
  },

  // 上传合同文件（PDF/Word）并提取文本
  uploadContractFile(contractId: number, file: File): Promise<{
    filename: string
    text: string
    pages?: number
  }> {
    const formData = new FormData()
    formData.append('file', file)
    return request.post(`/contracts/${contractId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}

// 辅助函数
export const getRiskLevelLabel = (level: string): string => {
  const map: Record<string, string> = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
    unknown: '未知'
  }
  return map[level] || level
}

export const getRiskLevelTagType = (level: string): string => {
  const map: Record<string, string> = {
    low: 'success',
    medium: 'warning',
    high: 'danger',
    unknown: 'info'
  }
  return map[level] || 'info'
}

export const getRiskScoreColor = (score: number): string => {
  if (score <= 30) return '#07c160'
  if (score <= 60) return '#f59e0b'
  return '#ef4444'
}

export const getSuggestionCategoryLabel = (category: string): string => {
  const map: Record<string, string> = {
    payment: '付款条款',
    term: '合同期限',
    liability: '违约责任',
    other: '其他'
  }
  return map[category] || category
}
