import request from './request'
import type { PaginatedResponse } from '@/types'

// 工资状态
export type SalaryStatus = 'pending' | 'calculated' | 'paid' | 'cancelled'

// 工资记录参数
export interface SalaryListParams {
  page?: number
  pageSize?: number
  employee_id?: number
  employee_name?: string
  month?: string
  status?: SalaryStatus | ''
}

// 工资记录
export interface SalaryRecord {
  id: number
  employee_id: number
  employee_name: string
  department: string
  position: string
  month: string
  base_salary: number
  overtime_pay: number
  bonus: number
  deduction: number
  social_security: number
  housing_fund: number
  personal_income_tax: number
  net_salary: number
  status: SalaryStatus
  paid_at?: string
  created_at?: string
}

// 工资计算预览
export interface SalaryPreview {
  employee_id: number
  employee_name: string
  month: string
  base_salary: number
  overtime_pay: number
  late_deduction: number
  absent_deduction: number
  bonus: number
  social_security: number
  housing_fund: number
  personal_income_tax: number
  net_salary: number
}

// 批量生成参数
export interface AutoGenerateParams {
  month: string
  department?: string
}

// 批量生成结果
export interface AutoGenerateResult {
  success: number
  failed: number
  records: SalaryRecord[]
  errors?: Array<{ employee_id: number; message: string }>
}

// 工资 API
export const salaryApi = {
  // 获取工资列表
  getList(params: SalaryListParams): Promise<PaginatedResponse<SalaryRecord>> {
    return request.get('/salaries', { params })
  },

  // 获取工资详情
  getDetail(id: number): Promise<SalaryRecord> {
    return request.get(`/salaries/${id}`)
  },

  // 预览工资计算
  calculatePreview(employeeId: number, month: string): Promise<SalaryPreview> {
    return request.get(`/salaries/calculate/${employeeId}`, { params: { month } })
  },

  // 批量自动生成工资
  autoGenerate(data: AutoGenerateParams): Promise<AutoGenerateResult> {
    return request.post('/salaries/auto-generate', data)
  },

  // 标记工资已支付
  markPaid(id: number): Promise<void> {
    return request.put(`/salaries/${id}/paid`)
  }
}
