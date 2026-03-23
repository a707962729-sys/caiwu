import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { message } from 'antd'
import { API_CONFIG } from '@/config/api'
import { useAuthStore } from '@/stores/authStore'

// 创建 axios 实例
const request: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers
})

// 请求拦截器
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { token } = useAuthStore.getState()
    
    // 添加 token
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
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
      message.error(data.message || '请求失败')
      return Promise.reject(new Error(data.message || '请求失败'))
    }
    
    // 后端返回格式: { success: true, data: {...} }
    // 自动提取 data.data 返回实际数据
    if (data.success === true && data.data !== undefined) {
      return data.data
    }
    
    // 兼容其他格式
    return data
  },
  (error) => {
    const { response } = error
    
    if (response) {
      const { status, data } = response
      
      switch (status) {
        case 401:
          // 未授权，清除登录状态，跳转登录页
          useAuthStore.getState().logout()
          message.error('登录已过期，请重新登录')
          // 跳转登录页
          window.location.href = '/login'
          break
        case 403:
          message.error('没有权限访问')
          break
        case 404:
          message.error('请求的资源不存在')
          break
        case 500:
          message.error('服务器错误，请稍后重试')
          break
        default:
          message.error(data?.message || `请求错误 (${status})`)
      }
    } else if (error.message.includes('timeout')) {
      message.error('请求超时，请检查网络')
    } else if (error.message.includes('Network')) {
      message.error('网络错误，请检查网络连接')
    } else {
      message.error(error.message || '未知错误')
    }
    
    return Promise.reject(error)
  }
)

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
  }
}

export default request