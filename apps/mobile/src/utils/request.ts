import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { useUserStore } from '@/stores/user'
import { showToast, showNotify } from 'vant'
import { API_CONFIG } from '@/config/api'
import { TokenManager } from '@/utils/auth'

// 是否正在刷新 Token
let isRefreshing = false
// 等待刷新的请求队列
let requestQueue: Array<((token: string) => void) | null> = []

// 创建 axios 实例
const request: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers
})

// 请求拦截器
request.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const userStore = useUserStore()
    
    // 添加 token
    if (userStore.token && config.headers) {
      config.headers.Authorization = `Bearer ${userStore.token}`
    }
    
    // 检查是否需要刷新 Token
    if (TokenManager.shouldRefreshToken() && !isRefreshing) {
      isRefreshing = true
      try {
        // 这里可以调用刷新 Token 的 API
        // const newToken = await authApi.refreshToken()
        // userStore.setToken(newToken.token)
        // TokenManager.setToken(newToken.token)
        // 处理队列中的请求
        requestQueue.forEach(cb => cb?.(userStore.token))
        requestQueue = []
      } catch {
        // 刷新失败，清除登录状态
        userStore.logout()
      } finally {
        isRefreshing = false
      }
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse) => {
    const { data } = response
    
    // 如果是文件下载，直接返回
    if (response.config.responseType === 'blob') {
      return response
    }
    
    // 业务逻辑错误
    if (data.success === false) {
      const errorMsg = data.message || '请求失败'
      showToast(errorMsg)
      return Promise.reject(new Error(errorMsg))
    }
    
    // 后端返回格式: { success: true, data: {...} }
    // 自动提取 data.data 返回实际数据
    if (data.success === true && data.data !== undefined) {
      const innerData = data.data
      // 处理分页格式：{ list, pagination } -> { list, total, page, pageSize }
      if (innerData && typeof innerData === 'object' && 'list' in innerData && 'pagination' in innerData) {
        const { list, pagination } = innerData
        return {
          list,
          total: pagination.total || 0,
          page: pagination.page || 1,
          pageSize: pagination.pageSize || 20
        }
      }
      return innerData
    }
    
    // 兼容其他格式
    return data
  },
  async (error) => {
    const { response, config } = error
    
    if (response) {
      const { status, data } = response
      
      switch (status) {
        case 401:
          // 未授权，尝试刷新 Token
          if (!isRefreshing && TokenManager.getRefreshToken()) {
            isRefreshing = true
            try {
              // 这里可以调用刷新 Token 的 API
              // const newToken = await authApi.refreshToken()
              // 重试原请求
              // config.headers.Authorization = `Bearer ${newToken.token}`
              // return request(config)
            } catch {
              // 刷新失败
              handleUnauthorized()
            } finally {
              isRefreshing = false
            }
          } else {
            handleUnauthorized()
          }
          break
        case 403:
          showNotify({ type: 'danger', message: '没有权限访问' })
          break
        case 404:
          showToast('请求的资源不存在')
          break
        case 422:
          // 表单验证错误
          const errors = data?.errors
          if (errors && typeof errors === 'object') {
            const firstError = Object.values(errors)[0]
            showToast(Array.isArray(firstError) ? firstError[0] : String(firstError))
          } else {
            showToast(data?.message || '数据验证失败')
          }
          break
        case 429:
          showToast('请求过于频繁，请稍后重试')
          break
        case 500:
          showToast('服务器错误，请稍后重试')
          break
        case 502:
        case 503:
        case 504:
          showToast('服务暂时不可用，请稍后重试')
          break
        default:
          showToast(data?.message || `请求错误 (${status})`)
      }
    } else if (error.message.includes('timeout')) {
      showToast('请求超时，请检查网络')
    } else if (error.message.includes('Network')) {
      showToast('网络错误，请检查网络连接')
    } else if (error.code === 'ERR_CANCELED') {
      // 请求被取消，静默处理
      console.log('Request canceled')
    } else {
      showToast(error.message || '未知错误')
    }
    
    return Promise.reject(error)
  }
)

/**
 * 处理未授权情况
 */
function handleUnauthorized() {
  const userStore = useUserStore()
  userStore.logout()
  showToast('登录已过期，请重新登录')
  // 跳转登录页
  window.location.href = '/login'
}

/**
 * 重试请求
 */
async function retryRequest<T>(
  requestFn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await requestFn()
  } catch (error: any) {
    // 只在网络错误或 5xx 错误时重试
    const shouldRetry = 
      !error.response || 
      (error.response.status >= 500 && error.response.status < 600)
    
    if (retries > 0 && shouldRetry) {
      await new Promise(resolve => setTimeout(resolve, delay))
      return retryRequest(requestFn, retries - 1, delay * 2)
    }
    
    throw error
  }
}

// 封装请求方法
export const http = {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return request.get(url, config)
  },
  
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return request.post(url, data, config)
  },
  
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return request.put(url, data, config)
  },
  
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return request.delete(url, config)
  },
  
  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return request.patch(url, data, config)
  },
  
  upload<T = unknown>(url: string, file: File, onProgress?: (percent: number) => void): Promise<T> {
    const formData = new FormData()
    formData.append('file', file)
    
    return request.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      }
    })
  },
  
  /**
   * 带重试的请求
   */
  getWithRetry<T = unknown>(
    url: string, 
    config?: AxiosRequestConfig, 
    retries: number = 3
  ): Promise<T> {
    return retryRequest(() => request.get(url, config), retries)
  },
  
  postWithRetry<T = unknown>(
    url: string, 
    data?: unknown, 
    config?: AxiosRequestConfig, 
    retries: number = 3
  ): Promise<T> {
    return retryRequest(() => request.post(url, data, config), retries)
  }
}

export default request