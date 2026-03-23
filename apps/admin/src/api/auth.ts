import request from './request'
import type { User, LoginResult } from '@/types'

export interface LoginParams {
  username: string
  password: string
}

export interface UpdatePasswordParams {
  oldPassword: string
  newPassword: string
}

export const authApi = {
  /**
   * 登录
   */
  login(params: LoginParams): Promise<LoginResult> {
    return request.post('/auth/login', params)
  },

  /**
   * 退出登录
   */
  logout(): Promise<void> {
    return request.post('/auth/logout')
  },

  /**
   * 获取当前用户信息
   */
  getMe(): Promise<User> {
    return request.get('/auth/me')
  },

  /**
   * 修改密码
   */
  updatePassword(params: UpdatePasswordParams): Promise<void> {
    return request.put('/auth/password', params)
  }
}