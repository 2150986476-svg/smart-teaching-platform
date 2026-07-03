import axios from 'axios'
import { getToken } from '@/utils/auth'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// 请求拦截器 - 携带 Token
request.interceptors.request.use(
  config => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  response => {
    return response.data
  },
  error => {
    const { response } = error
    if (response) {
      const { status, data } = response
      switch (status) {
        case 401:
          // Token 过期或无效，清除登录状态
          ElMessage.error(data.message || '登录已过期，请重新登录')
          // 清除 token 并跳转登录页
          import('@/utils/auth').then(({ removeToken }) => {
            removeToken()
            window.location.href = '/login'
          })
          break
        case 403:
          ElMessage.error(data.message || '权限不足')
          break
        default:
          ElMessage.error(data.message || '请求失败')
      }
    } else {
      ElMessage.error('网络连接异常')
    }
    return Promise.reject(error)
  }
)

export default request
