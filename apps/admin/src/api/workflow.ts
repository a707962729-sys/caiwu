import request from './request'
import type { PaginatedResponse } from '@/types'

// ============== 审批状态/结果 ==============

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type ApprovalResult = 'approved' | 'rejected' | 'withdrawn'

// ============== 流程定义相关类型 ==============

export type WorkflowType = 'leave' | 'expense' | 'purchase' | 'payment'
export type WorkflowStatus = 'active' | 'inactive'
export type NodeType = 'start' | 'approval' | 'condition' | 'end'
export type ApproverType = 'user' | 'role' | 'dept_leader' | 'supervisor'
export type ConditionOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains'

// 流程节点
export interface WorkflowNode {
  id: string
  type: NodeType
  name: string
  order: number
  approverType?: ApproverType
  approverIds?: number[]
  approverRoleIds?: number[]
  conditions?: NodeCondition[]
  nextNodeId?: string
  branches?: {
    condition: string
    nodeId: string
  }[]
}

// 节点条件
export interface NodeCondition {
  field: string
  operator: ConditionOperator
  value: string | number
}

// 流程定义
export interface WorkflowDefinition {
  id: number
  name: string
  type: WorkflowType
  description?: string
  status: WorkflowStatus
  nodes: WorkflowNode[]
  created_at: string
  updated_at: string
}

export interface WorkflowDefinitionCreateParams {
  name: string
  type: WorkflowType
  description?: string
  status?: WorkflowStatus
  nodes: WorkflowNode[]
}

export interface WorkflowDefinitionUpdateParams {
  name?: string
  type?: WorkflowType
  description?: string
  status?: WorkflowStatus
  nodes?: WorkflowNode[]
}

export interface WorkflowDefinitionListParams {
  page?: number
  pageSize?: number
  type?: WorkflowType
  status?: WorkflowStatus
  search?: string
}

// ============== 审批任务相关类型 ==============

export interface ApprovalTask {
  id: number
  instance_id: number
  workflow_name: string
  workflow_type: string
  title: string
  initiator_id: number
  initiator_name: string
  approver_id: number
  approver_name: string
  status: ApprovalStatus
  result?: ApprovalResult
  comment?: string
  created_at: string
  processed_at?: string
  business_id?: number
  business_type?: string
  business_no?: string
}

export interface WorkflowInstance {
  id: number
  workflow_name: string
  workflow_type: string
  title: string
  initiator_id: number
  initiator_name: string
  status: ApprovalStatus
  result?: ApprovalResult
  business_id?: number
  business_type?: string
  business_no?: string
  created_at: string
  completed_at?: string
  steps: ApprovalStep[]
}

export interface ApprovalStep {
  id: number
  step_no: number
  step_name: string
  approver_id: number
  approver_name: string
  status: ApprovalStatus
  result?: ApprovalResult
  comment?: string
  processed_at?: string
  created_at: string
}

// 任务状态
export type TaskStatus = 'pending' | 'approved' | 'rejected'

export const TaskStatusLabels: Record<TaskStatus, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回'
}

export const TaskStatusTypes: Record<TaskStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger'
}

export const WorkflowTypes: Record<string, string> = {
  leave: '请假审批',
  expense: '报销审批',
  purchase: '采购审批',
  payment: '付款审批'
}

// 待办任务
export interface WorkflowTask {
  id: number
  workflow_name: string
  workflow_type: string
  initiator_id: number
  initiator_name: string
  department?: string
  status: TaskStatus
  form_data?: Record<string, any>
  created_at: string
  updated_at?: string
}

export interface TaskListParams {
  page?: number
  pageSize?: number
  search?: string
  status?: TaskStatus | ''
  workflow_type?: string
}

export interface ApprovalParams {
  comment?: string
}

export interface BatchApprovalParams {
  task_ids: number[]
  action: 'approve' | 'reject'
  comment?: string
}

export interface BatchApprovalResult {
  success: number
  failed: number
  errors?: Array<{ task_id: number; error: string }>
}

// 历史记录列表参数
export interface HistoryListParams {
  page?: number
  pageSize?: number
  search?: string
  status?: ApprovalStatus | ''
  workflow_type?: string
  start_date?: string
  end_date?: string
  initiator_id?: number
  approver_id?: number
}

// 流程实例列表参数
export interface InstanceListParams {
  page?: number
  pageSize?: number
  search?: string
  status?: ApprovalStatus | ''
  workflow_type?: string
  start_date?: string
  end_date?: string
  initiator_id?: number
}

// ============== 选项配置 ==============

export const workflowTypeOptions: { value: WorkflowType; label: string }[] = [
  { value: 'leave', label: '请假审批' },
  { value: 'expense', label: '报销审批' },
  { value: 'purchase', label: '采购审批' },
  { value: 'payment', label: '付款审批' }
]

export const workflowStatusOptions: { value: WorkflowStatus; label: string }[] = [
  { value: 'active', label: '启用' },
  { value: 'inactive', label: '停用' }
]

export const approverTypeOptions: { value: ApproverType; label: string }[] = [
  { value: 'user', label: '指定用户' },
  { value: 'role', label: '指定角色' },
  { value: 'dept_leader', label: '部门负责人' },
  { value: 'supervisor', label: '直属上级' }
]

export const conditionOperatorOptions: { value: ConditionOperator; label: string }[] = [
  { value: 'eq', label: '等于' },
  { value: 'ne', label: '不等于' },
  { value: 'gt', label: '大于' },
  { value: 'lt', label: '小于' },
  { value: 'gte', label: '大于等于' },
  { value: 'lte', label: '小于等于' },
  { value: 'contains', label: '包含' }
]

// ============== 工具函数 ==============

export const getWorkflowTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    leave: '请假审批',
    expense: '报销审批',
    purchase: '采购审批',
    payment: '付款审批',
    contract: '合同审批',
    overtime: '加班申请',
    travel: '出差申请',
    purchase_order: '采购订单',
    sales_order: '销售订单'
  }
  return labels[type] || type
}

export const getApprovalStatusLabel = (status: ApprovalStatus): string => {
  const labels: Record<ApprovalStatus, string> = {
    pending: '待审批',
    approved: '已通过',
    rejected: '已拒绝',
    cancelled: '已撤销'
  }
  return labels[status] || status
}

export const getApprovalStatusType = (status: ApprovalStatus): 'warning' | 'success' | 'danger' | 'info' => {
  const types: Record<ApprovalStatus, 'warning' | 'success' | 'danger' | 'info'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    cancelled: 'info'
  }
  return types[status] || 'info'
}

export const getApprovalResultLabel = (result?: ApprovalResult): string => {
  if (!result) return '-'
  const labels: Record<ApprovalResult, string> = {
    approved: '通过',
    rejected: '拒绝',
    withdrawn: '撤回'
  }
  return labels[result] || result
}

export const getApprovalResultType = (result?: ApprovalResult): 'success' | 'danger' | 'info' => {
  if (!result) return 'info'
  const types: Record<ApprovalResult, 'success' | 'danger' | 'info'> = {
    approved: 'success',
    rejected: 'danger',
    withdrawn: 'info'
  }
  return types[result] || 'info'
}

// ============== API ==============

// 流程定义 API
export const workflowDefinitionApi = {
  getList(params: WorkflowDefinitionListParams): Promise<PaginatedResponse<WorkflowDefinition>> {
    return request.get('/workflows/definitions', { params })
  },

  getDetail(id: number): Promise<WorkflowDefinition> {
    return request.get(`/workflows/definitions/${id}`)
  },

  create(data: WorkflowDefinitionCreateParams): Promise<WorkflowDefinition> {
    return request.post('/workflows/definitions', data)
  },

  update(id: number, data: WorkflowDefinitionUpdateParams): Promise<WorkflowDefinition> {
    return request.put(`/workflows/definitions/${id}`, data)
  },

  delete(id: number): Promise<void> {
    return request.delete(`/workflows/definitions/${id}`)
  },

  toggleStatus(id: number): Promise<WorkflowDefinition> {
    return request.put(`/workflows/definitions/${id}/toggle-status`)
  }
}

// 待办任务 API
export const workflowTaskApi = {
  getPendingList(params: TaskListParams): Promise<PaginatedResponse<WorkflowTask>> {
    return request.get('/workflows/tasks/pending', { params })
  },

  getDetail(id: number): Promise<WorkflowTask> {
    return request.get(`/workflows/tasks/${id}`)
  },

  approve(id: number, params: ApprovalParams): Promise<void> {
    return request.post(`/workflows/tasks/${id}/approve`, params)
  },

  reject(id: number, params: ApprovalParams): Promise<void> {
    return request.post(`/workflows/tasks/${id}/reject`, params)
  },

  batchApprove(params: BatchApprovalParams): Promise<BatchApprovalResult> {
    return request.post('/workflows/tasks/batch-approve', params)
  },

  batchReject(params: BatchApprovalParams): Promise<BatchApprovalResult> {
    return request.post('/workflows/tasks/batch-reject', params)
  }
}

// 发起流程参数
export interface WorkflowInstanceCreateParams {
  definition_id: number
  title?: string
  business_type?: string
  business_id?: number
  business_no?: string
  form_data?: Record<string, any>
}

// 流程实例 API
export const workflowApi = {
  getHistory(params: HistoryListParams): Promise<PaginatedResponse<ApprovalTask>> {
    return request.get('/workflows/tasks/history', { params })
  },

  getInstances(params: InstanceListParams): Promise<PaginatedResponse<WorkflowInstance>> {
    return request.get('/workflows/instances', { params })
  },

  getInstanceDetail(id: number): Promise<WorkflowInstance> {
    return request.get(`/workflows/instances/${id}`)
  },

  // 发起流程
  createInstance(data: WorkflowInstanceCreateParams): Promise<{ id: number }> {
    return request.post('/workflows/instances', data)
  }
}