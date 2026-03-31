import request from './request'
import type { PaginatedResponse } from '@/types'

// 员工角色
export type EmployeeRole = 'boss' | 'accountant' | 'employee'

// 员工状态
export type EmployeeStatus = 0 | 1 | 'active' | 'inactive'

// 合同类型
export type ContractType = '正式' | '临时' | '实习' | '外包'

// 员工列表参数
export interface EmployeeListParams {
  page?: number
  pageSize?: number
  search?: string
  role?: EmployeeRole | ''
  status?: EmployeeStatus | ''
  department?: string
}

// 创建员工参数
export interface EmployeeCreateParams {
  name: string
  id_card?: string
  phone?: string
  email?: string
  role?: EmployeeRole
  department?: string
  position?: string
  salary?: number
  contract_type?: ContractType
  contract_start?: string
  contract_end?: string
  bank_account?: string
  bank_name?: string
  emergency_contact?: string
  emergency_phone?: string
  status?: EmployeeStatus
}

// 更新员工参数
export interface EmployeeUpdateParams extends Partial<EmployeeCreateParams> {}

// 员工数据
export interface Employee {
  id: number
  name: string
  id_card?: string
  phone?: string
  email?: string
  role?: EmployeeRole
  department?: string
  position?: string
  salary?: number
  contract_type?: ContractType
  contract_start?: string
  contract_end?: string
  bank_account?: string
  bank_name?: string
  emergency_contact?: string
  emergency_phone?: string
  status?: EmployeeStatus
  created_at?: string
  updated_at?: string
}

// 入职录入参数
export interface OnboardParams {
  name: string
  id_card: string
  phone?: string
  contract_file?: string
  auto_fields?: Partial<EmployeeCreateParams>
}

// 员工 API
export const employeeApi = {
  // 获取员工列表
  getList(params: EmployeeListParams): Promise<PaginatedResponse<Employee>> {
    return request.get('/employees', { params })
  },

  // 获取员工详情
  getDetail(id: number): Promise<Employee> {
    return request.get(`/employees/${id}`)
  },

  // 创建员工
  create(data: EmployeeCreateParams): Promise<Employee> {
    return request.post('/employees', data)
  },

  // 更新员工
  update(id: number, data: EmployeeUpdateParams): Promise<Employee> {
    return request.put(`/employees/${id}`, data)
  },

  // 删除员工
  delete(id: number): Promise<void> {
    return request.delete(`/employees/${id}`)
  },

  // 入职自动录入
  onboard(data: OnboardParams): Promise<Employee> {
    return request.post('/employees/onboard', data)
  },

  // 获取员工统计
  getStats(): Promise<{
    total: number
    active: number
    inactive: number
    by_department: Array<{ department: string; count: number }>
  }> {
    return request.get('/employees/stats')
  }
}

// 辅助函数
export const getEmployeeRoleLabel = (role?: EmployeeRole): string => {
  const map: Record<EmployeeRole, string> = {
    boss: '老板',
    accountant: '会计',
    employee: '员工'
  }
  return role ? map[role] || role : '-'
}

export const getEmployeeStatusLabel = (status?: EmployeeStatus): string => {
  if (status === 1 || status === 'active') return '在职'
  if (status === 0 || status === 'inactive') return '离职'
  return '-'
}

export const getEmployeeRoleTagType = (role?: EmployeeRole): string => {
  const map: Record<EmployeeRole, string> = {
    boss: 'danger',
    accountant: 'warning',
    employee: ''
  }
  return role ? map[role] || '' : ''
}
