import request from './request'
import type { PaginatedResponse, User } from '@/types'

// 用户角色
export type UserRole = 'boss' | 'accountant' | 'employee'

// 用户状态
export type UserStatus = 0 | 1 // 0: 禁用, 1: 启用

// 用户列表参数
export interface UserListParams {
  page?: number
  pageSize?: number
  search?: string
  role?: UserRole | ''
  status?: UserStatus | ''
  department?: string
}

// 创建用户参数
export interface UserCreateParams {
  username: string
  real_name: string
  email?: string
  phone?: string
  role: UserRole
  department?: string
  position?: string
  status?: UserStatus
  password?: string
}

// 更新用户参数
export interface UserUpdateParams extends Partial<UserCreateParams> {}

// 重置密码参数
export interface ResetPasswordParams {
  newPassword: string
}

// 角色 API
export interface Role {
  id: string
  name: string
  label: string
  description?: string
  permissions: string[]
}

// 部门
export interface Department {
  id: string
  name: string
  parentId?: string
}

// 用户 API
export const userApi = {
  // 获取用户列表
  getList(params: UserListParams): Promise<PaginatedResponse<User>> {
    return request.get('/users', { params })
  },

  // 获取用户详情
  getDetail(id: number): Promise<User> {
    return request.get(`/users/${id}`)
  },

  // 创建用户
  create(data: UserCreateParams): Promise<User> {
    return request.post('/users', data)
  },

  // 更新用户
  update(id: number, data: UserUpdateParams): Promise<User> {
    return request.put(`/users/${id}`, data)
  },

  // 删除用户
  delete(id: number): Promise<void> {
    return request.delete(`/users/${id}`)
  },

  // 重置密码
  resetPassword(id: number, data: ResetPasswordParams): Promise<void> {
    return request.put(`/users/${id}/password`, data)
  },

  // 分配角色
  assignRole(id: number, role: UserRole): Promise<void> {
    return request.put(`/users/${id}/role`, { role })
  },

  // 获取角色列表
  getRoles(): Promise<Role[]> {
    return request.get('/roles')
  },

  // 获取部门列表
  getDepartments(): Promise<Department[]> {
    return request.get('/departments')
  },

  // 获取用户统计
  getStats(): Promise<{
    total: number
    active: number
    inactive: number
    by_role: Array<{ role: string; count: number }>
    by_department: Array<{ department: string; count: number }>
  }> {
    return request.get('/users/stats')
  }
}

// 辅助函数
export const getUserRoleLabel = (role: UserRole): string => {
  const map: Record<UserRole, string> = {
    boss: '老板',
    accountant: '会计',
    employee: '员工'
  }
  return map[role] || role
}

export const getUserStatusLabel = (status: UserStatus): string => {
  return status === 1 ? '启用' : '禁用'
}

export const getUserRoleTagType = (role: UserRole): string => {
  const map: Record<UserRole, string> = {
    boss: 'danger',
    accountant: 'warning',
    employee: ''
  }
  return map[role] || ''
}