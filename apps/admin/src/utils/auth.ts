import CryptoJS from 'crypto-js'

// 加密密钥（生产环境应从环境变量获取）
const SECRET_KEY = 'caiwu-secret-key-2026'

/**
 * Token 管理类
 */
export class TokenManager {
  private static TOKEN_KEY = 'caiwu_admin_token'
  private static USER_KEY = 'caiwu_admin_user'
  private static EXPIRES_KEY = 'caiwu_admin_token_expires'

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
   * 检查 Token 是否过期
   */
  static isTokenExpired(): boolean {
    const expires = localStorage.getItem(this.EXPIRES_KEY)
    if (!expires) return true
    return Date.now() >= parseInt(expires)
  }

  /**
   * 检查 Token 是否有效
   */
  static isTokenValid(): boolean {
    const token = this.getToken()
    if (!token) return false
    return !this.isTokenExpired()
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
   * 别名，清除所有 tokens
   */
  static clearTokens() {
    this.clearToken()
  }
}

/**
 * 密码加密工具
 */
export class PasswordCrypto {
  /**
   * MD5 加密
   */
  static md5(password: string): string {
    return CryptoJS.MD5(password).toString()
  }

  /**
   * AES 加密
   */
  static encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, SECRET_KEY).toString()
  }

  /**
   * AES 解密
   */
  static decrypt(encrypted: string): string {
    const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY)
    return bytes.toString(CryptoJS.enc.Utf8)
  }

  /**
   * 加密密码（用于传输）
   */
  static encryptForTransmission(password: string): string {
    return this.md5(password)
  }

  /**
   * 加密密码（用于本地存储）
   */
  static encryptPassword(password: string): string {
    return this.encrypt(password)
  }

  /**
   * 解密密码（从本地存储读取）
   */
  static decryptPassword(encrypted: string): string {
    try {
      return this.decrypt(encrypted)
    } catch {
      return ''
    }
  }
}

/**
 * 记住密码管理
 */
export class RememberMeManager {
  private static USERNAME_KEY = 'caiwu_admin_remember_username'
  private static PASSWORD_KEY = 'caiwu_admin_remember_password'
  private static CHECK_KEY = 'caiwu_admin_remember_checked'

  /**
   * 保存记住密码
   */
  static saveRememberedUser(username: string, password: string) {
    localStorage.setItem(this.USERNAME_KEY, username)
    localStorage.setItem(this.PASSWORD_KEY, PasswordCrypto.encryptPassword(password))
    localStorage.setItem(this.CHECK_KEY, 'true')
  }

  /**
   * 获取记住的账号信息
   */
  static getRememberedUser(): { username: string; password: string } | null {
    const checked = localStorage.getItem(this.CHECK_KEY)
    if (checked !== 'true') return null

    const username = localStorage.getItem(this.USERNAME_KEY)
    const encryptedPassword = localStorage.getItem(this.PASSWORD_KEY)

    if (!username || !encryptedPassword) return null

    return {
      username,
      password: PasswordCrypto.decryptPassword(encryptedPassword)
    }
  }

  /**
   * 清除记住密码
   */
  static clearRememberedUser() {
    localStorage.removeItem(this.USERNAME_KEY)
    localStorage.removeItem(this.PASSWORD_KEY)
    localStorage.setItem(this.CHECK_KEY, 'false')
  }

  /**
   * 是否有记住的用户
   */
  static hasRememberedUser(): boolean {
    return localStorage.getItem(this.CHECK_KEY) === 'true'
  }
}

/**
 * 清除所有认证信息
 */
export function clearAuthCompletely() {
  TokenManager.clearToken()
  RememberMeManager.clearRememberedUser()
  localStorage.removeItem('caiwu_auto_login')
}