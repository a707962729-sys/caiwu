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
   * 初始化 - 检查自动登录
   */
  async function init() {
    const savedToken = TokenManager.getToken()
    if (savedToken && !TokenManager.isTokenExpired()) {
      token.value = savedToken
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
      
      // API 返回 { success: true, data: { user, token } }，拦截器已解包 data
      const result = response as any
      
      // 保存 token
      token.value = result.token
      user.value = result.user
      TokenManager.setToken(result.token, result.expiresIn || 86400)
      
      // 处理记住密码
      if (rememberMe) {
        RememberMeManager.saveRememberedUser(username, password)
      } else {
        RememberMeManager.clearRememberedUser()
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
   * 自动登录（使用记住的凭据）
   */
  async function autoLogin(): Promise<boolean> {
    const rememberedUser = RememberMeManager.getRememberedUser()
    if (!rememberedUser) return false
    
    try {
      const encryptedPassword = PasswordCrypto.encryptForTransmission(rememberedUser.password)
      
      const result = await authApi.login({
        username: rememberedUser.username,
        password: encryptedPassword
      })
      
      token.value = result.token
      user.value = result.user
      TokenManager.setToken(result.token, result.expiresIn)
      
      if (result.user.permissions) {
        permissions.value = result.user.permissions
      }
      
      return true
    } catch (error) {
      console.error('Auto login failed:', error)
      return false
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
      logout()
      return null
    }
  }
  
  /**
   * 更新密码
   */
  async function updatePassword(oldPassword: string, newPassword: string) {
    const encryptedOldPassword = PasswordCrypto.encryptForTransmission(oldPassword)
    const encryptedNewPassword = PasswordCrypto.encryptForTransmission(newPassword)
    
    await authApi.updatePassword({ 
      oldPassword: encryptedOldPassword, 
      newPassword: encryptedNewPassword 
    })
    
    // 如果有记住密码，更新保存的密码
    const rememberedUser = RememberMeManager.getRememberedUser()
    if (rememberedUser && rememberedUser.username === user.value?.username) {
      RememberMeManager.saveRememberedUser(rememberedUser.username, newPassword)
    }
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
    
    if (TokenManager.isTokenExpired()) {
      logout()
      return false
    }
    
    return true
  }
  
  /**
   * 获取记住的用户信息（用于登录页面自动填充）
   */
  function getRememberedUser() {
    return RememberMeManager.getRememberedUser()
  }
  
  /**
   * 检查是否有记住的用户
   */
  function hasRememberedUser() {
    return RememberMeManager.hasRememberedUser()
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
    autoLogin,
    logout,
    fetchUserInfo,
    updatePassword,
    setToken,
    setUser,
    checkAuth,
    getRememberedUser,
    hasRememberedUser
  }
}, {
  persist: {
    key: 'caiwu-admin-user',
    storage: localStorage,
    paths: ['token', 'user', 'permissions']
  }
})