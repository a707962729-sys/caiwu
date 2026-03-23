import CryptoJS from 'crypto-js'

/**
 * Token 管理类
 */
export class TokenManager {
  private static TOKEN_KEY = 'caiwu_token'
  private static USER_KEY = 'caiwu_user'
  private static EXPIRES_KEY = 'caiwu_token_expires'

  /**
   * 保存 Token
   */
  static setToken(token: string, expiresIn: number = 86400) {
    localStorage.setItem(this.TOKEN_KEY, token)
    localStorage.setItem(this.EXPIRES_KEY, String(Date.now() + expiresIn * 1000))
  }

  /**
   * 获取 Token
   */
  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY)
  }

  /**
   * 检查 Token 是否有效
   */
  static isTokenValid(): boolean {
    const token = this.getToken()
    if (!token) return false

    const expires = localStorage.getItem(this.EXPIRES_KEY)
    if (!expires) return false

    return Date.now() < parseInt(expires)
  }

  /**
   * 检查 Token 是否过期
   */
  static isTokenExpired(): boolean {
    return !this.isTokenValid()
  }

  /**
   * 获取剩余有效时间（秒）
   */
  static getRemainingTime(): number {
    const expires = localStorage.getItem(this.EXPIRES_KEY)
    if (!expires) return 0
    return Math.max(0, Math.floor((parseInt(expires) - Date.now()) / 1000))
  }

  /**
   * 清除 Token
   */
  static clearToken() {
    localStorage.removeItem(this.TOKEN_KEY)
    localStorage.removeItem(this.EXPIRES_KEY)
    localStorage.removeItem(this.USER_KEY)
  }

  /**
   * 清除所有 Token（别名）
   */
  static clearTokens() {
    this.clearToken()
    localStorage.removeItem('caiwu_refresh_token')
  }

  /**
   * 检查是否需要刷新 Token（剩余时间小于 5 分钟）
   */
  static shouldRefreshToken(): boolean {
    const remaining = this.getRemainingTime()
    return remaining > 0 && remaining < 300 // 5 分钟内过期
  }

  /**
   * 获取 Refresh Token
   */
  static getRefreshToken(): string | null {
    return localStorage.getItem('caiwu_refresh_token')
  }

  /**
   * 设置 Refresh Token
   */
  static setRefreshToken(token: string) {
    localStorage.setItem('caiwu_refresh_token', token)
  }
}

/**
 * 密码工具类
 * 注意：前端只进行 MD5 哈希用于传输安全，真正的密码验证在服务端进行
 */
export class PasswordCrypto {
  /**
   * MD5 加密（用于传输）
   */
  static md5(password: string): string {
    return CryptoJS.MD5(password).toString()
  }

  /**
   * 加密用于传输（MD5 哈希）
   */
  static encryptForTransmission(password: string): string {
    return this.md5(password)
  }
}

/**
 * 记住用户名管理
 * 注意：只记住用户名，不保存密码（安全考虑）
 */
export class RememberMeManager {
  private static USERNAME_KEY = 'caiwu_remember_username'
  private static CHECK_KEY = 'caiwu_remember_checked'

  /**
   * 保存记住的用户名
   */
  static saveUsername(username: string) {
    localStorage.setItem(this.USERNAME_KEY, username)
    localStorage.setItem(this.CHECK_KEY, 'true')
  }

  /**
   * 获取记住的用户名
   */
  static getUsername(): string | null {
    const checked = localStorage.getItem(this.CHECK_KEY)
    if (checked !== 'true') return null

    return localStorage.getItem(this.USERNAME_KEY)
  }

  /**
   * 清除记住的用户名
   */
  static clear() {
    localStorage.removeItem(this.USERNAME_KEY)
    localStorage.setItem(this.CHECK_KEY, 'false')
  }

  /**
   * 是否记住用户名
   */
  static isRemembered(): boolean {
    return localStorage.getItem(this.CHECK_KEY) === 'true'
  }

  // 兼容旧接口（返回包含空密码的对象）
  static get(): { username: string; password: string } | null {
    const username = this.getUsername()
    if (!username) return null
    return { username, password: '' }
  }

  static getRememberedUser(): { username: string; password: string } | null {
    return this.get()
  }

  static hasRememberedUser(): boolean {
    return this.isRemembered()
  }

  // 兼容旧接口（忽略密码参数）
  static save(username: string, _password?: string) {
    this.saveUsername(username)
  }

  static saveRememberedUser(username: string, _password?: string) {
    this.saveUsername(username)
  }

  static clearRememberedUser() {
    this.clear()
  }
}

/**
 * 完全清除认证信息
 */
export function clearAuthCompletely() {
  TokenManager.clearToken()
  RememberMeManager.clear()
  localStorage.clear()
  sessionStorage.clear()
}