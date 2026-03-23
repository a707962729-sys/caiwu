import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'
import { authApi } from '@/api'
import { TokenManager, RememberMeManager, PasswordCrypto, clearAuthCompletely } from '@/utils/auth'

export const useUserStore = defineStore('user', () => {
  // State
  const token = ref<string>('')
  const user = ref<User | null>(null)
  const permissions = ref<string[]>([])
  const isLoading = ref(false)
  
  // Getters
  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const userRole = computed(() => user.value?.role || 'employee')
  const userName = computed(() => user.value?.real_name || user.value?.username || '用户')
  const hasPermission = computed(() => (permission: string) => {
    return permissions.value.includes(permission) || userRole.value === 'boss'
  })

  // Actions
  
  /**
   * 初始化 - 检查已登录状态
   */
  async function init() {
    // 从 localStorage 恢复 token
    const savedToken = TokenManager.getToken()
    if (savedToken && !TokenManager.isTokenExpired()) {
      token.value = savedToken
      // 尝试获取用户信息
      await fetchUserInfo()
    }
  }
  
  /**
   * 登录
   */
  async function login(username: string, password: string, rememberMe: boolean = false) {
    isLoading.value = true
    try {
      // 直接发送原始密码（依赖 HTTPS 安全传输）
      const response = await authApi.login({ 
        username, 
        password 
      })
      
      // API 返回 { success: true, data: { user, token } }
      const result = response.data || response
      
      // 保存 token
      token.value = result.token
      user.value = result.user
      TokenManager.setToken(result.token, result.expiresIn || 86400)
      
      // 处理记住用户名（不再保存密码）
      if (rememberMe) {
        RememberMeManager.saveUsername(username)
      } else {
        RememberMeManager.clear()
      }
      
      // 提取权限
      if (result.user?.permissions) {
        permissions.value = result.user.permissions
      }
      
      return result
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * 退出登录
   */
  async function logout(clearRemembered: boolean = false) {
    try {
      await authApi.logout()
    } catch {
      // ignore
    } finally {
      // 清除状态
      token.value = ''
      user.value = null
      permissions.value = []
      
      // 清除存储
      if (clearRemembered) {
        clearAuthCompletely()
      } else {
        TokenManager.clearTokens()
      }
    }
  }
  
  /**
   * 获取用户信息
   */
  async function fetchUserInfo() {
    if (!token.value) return null
    try {
      const userInfo = await authApi.getMe()
      user.value = userInfo
      if (userInfo.permissions) {
        permissions.value = userInfo.permissions
      }
      return userInfo
    } catch {
      // Token 无效，清除登录状态
      logout()
      return null
    }
  }
  
  /**
   * 更新密码
   */
  async function updatePassword(oldPassword: string, newPassword: string) {
    // 加密旧密码和新密码
    const encryptedOldPassword = PasswordCrypto.encryptForTransmission(oldPassword)
    const encryptedNewPassword = PasswordCrypto.encryptForTransmission(newPassword)
    
    await authApi.updatePassword({ 
      oldPassword: encryptedOldPassword, 
      newPassword: encryptedNewPassword 
    })
    
    // 不再需要更新保存的密码（已移除密码保存功能）
  }
  
  /**
   * 设置 Token
   */
  function setToken(newToken: string, expiresIn?: number) {
    token.value = newToken
    TokenManager.setToken(newToken, expiresIn)
  }
  
  /**
   * 设置用户
   */
  function setUser(newUser: User) {
    user.value = newUser
    if (newUser.permissions) {
      permissions.value = newUser.permissions
    }
  }
  
  /**
   * 检查是否已登录且 Token 有效
   */
  function checkAuth(): boolean {
    if (!token.value) return false
    
    // 检查 Token 是否过期
    if (TokenManager.isTokenExpired()) {
      logout()
      return false
    }
    
    return true
  }
  
  /**
   * 获取记住的用户名（用于登录页面自动填充）
   */
  function getRememberedUsername(): string | null {
    return RememberMeManager.getUsername()
  }
  
  /**
   * 检查是否有记住的用户名
   */
  function hasRememberedUser(): boolean {
    return RememberMeManager.isRemembered()
  }
  
  // 兼容旧接口
  function getRememberedUser(): { username: string; password: string } | null {
    const username = RememberMeManager.getUsername()
    if (!username) return null
    return { username, password: '' }
  }
  
  return {
    // State
    token,
    user,
    permissions,
    isLoading,
    // Getters
    isLoggedIn,
    userRole,
    userName,
    hasPermission,
    // Actions
    init,
    login,
    logout,
    fetchUserInfo,
    updatePassword,
    setToken,
    setUser,
    checkAuth,
    getRememberedUsername,
    hasRememberedUser,
    getRememberedUser // 兼容旧接口
  }
}, {
  persist: {
    key: 'caiwu-user',
    storage: localStorage,
    paths: ['token', 'user', 'permissions']
  }
})