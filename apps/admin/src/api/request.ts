import axios from 'axios'
import { TokenManager } from '@/utils/auth'
import { ElMessage } from 'element-plus'

// 创建 axios 实例
const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const token = TokenManager.getToken()
    if (token) {
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
  (response) => {
    const data = response.data
    // 如果返回的是 { success: true, data: {...} } 格式，提取 data 字段
    if (data && typeof data === 'object' && data.success === true && 'data' in data) {
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
    return data
  },
  (error) => {
    const { response } = error
    
    if (response) {
      switch (response.status) {
        case 401:
          ElMessage.error('登录已过期，请重新登录')
          TokenManager.clearToken()
          window.location.href = '/login'
          break
        case 403:
          ElMessage.error('没有权限访问')
          break
        case 404:
          ElMessage.error('请求资源不存在')
          break
        case 500:
          ElMessage.error('服务器错误')
          break
        default:
          ElMessage.error(response.data?.message || '请求失败')
      }
    } else {
      ElMessage.error('网络错误，请检查网络连接')
    }
    
    return Promise.reject(error)
  }
)

export default request