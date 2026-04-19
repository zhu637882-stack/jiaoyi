import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { Toast } from 'antd-mobile'

// 错误码映射表
const errorMessages: Record<string, string> = {
  'INSUFFICIENT_BALANCE': '余额不足',
  'DRUG_NOT_FOUND': '药品不存在',
  'ORDER_NOT_FOUND': '订单不存在',
  'INVALID_STATUS': '订单状态不允许此操作',
  'INSUFFICIENT_HOLDINGS': '持仓数量不足',
  'UNAUTHORIZED': '请先登录',
}

// 兼容非安全上下文（HTTP）的 UUID 生成
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// 创建 axios 实例
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    if (['post', 'put', 'delete'].includes(config.method?.toLowerCase() || '')) {
      config.headers['X-Request-Id'] = generateUUID()
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器
api.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const response = await axios.post('/api/auth/refresh', { refresh_token: refreshToken })
          const { access_token } = response.data
          localStorage.setItem('access_token', access_token)
          originalRequest.headers['Authorization'] = `Bearer ${access_token}`
          return api(originalRequest)
        } catch (refreshError) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/m/login'
          return Promise.reject(refreshError)
        }
      } else {
        localStorage.removeItem('access_token')
        window.location.href = '/m/login'
      }
    }

    const errorCode = error.response?.data?.code
    const errorMessage = error.response?.data?.message
    const translatedMessage = errorCode && errorMessages[errorCode]
      ? errorMessages[errorCode]
      : errorMessage || '请求失败，请稍后重试'
    Toast.show({ content: translatedMessage, icon: 'fail' })

    return Promise.reject(error)
  }
)

// API 方法封装
export const http = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    api.get(url, config),
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    api.post(url, data, config),
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    api.put(url, data, config),
  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    api.delete(url, config),
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    api.patch(url, data, config),
}

// 认证 API
export const authApi = {
  login: (username: string, password: string) =>
    http.post('/auth/login', { username, password }),
  register: (data: { username: string; password: string; realName?: string; phone?: string }) =>
    http.post('/auth/register', data),
  logout: () => http.post('/auth/logout'),
  getProfile: () => http.get('/auth/profile'),
}

// 用户 API
export const userApi = {
  getMe: () => http.get('/users/me'),
  updateMe: (data: { realName?: string; phone?: string }) => http.put('/users/me', data),
}

// 药品 API
export const drugApi = {
  getDrugs: (params?: { status?: string; keyword?: string; page?: number; pageSize?: number }) =>
    http.get('/drugs', { params }),
  getDrugById: (id: string) => http.get(`/drugs/${id}`),
  getDrugStatistics: () => http.get('/drugs/statistics'),
}

// 行情 API
export const marketApi = {
  getMarketOverview: () => http.get('/market/overview'),
  getDrugMarket: (drugId: string) => http.get(`/market/drug/${drugId}`),
  getDrugKLine: (drugId: string, period?: string) =>
    http.get(`/market/drug/${drugId}/kline`, { params: { period } }),
  getDrugDepth: (drugId: string) => http.get(`/market/drug/${drugId}/depth`),
  getHotList: (limit?: number) => http.get('/market/hot-list', { params: { limit } }),
  getMarketStats: () => http.get('/market/stats'),
}

// 认购 API
export const subscriptionApi = {
  createSubscription: (data: { drugId: string; quantity: number }) =>
    http.post('/subscriptions', data),
  cancelSubscription: (id: string) => http.delete(`/subscriptions/${id}`),
  getMySubscriptions: (params?: { status?: string; page?: number; limit?: number }) =>
    http.get('/subscriptions', { params }),
  getSubscriptionDetail: (id: string) => http.get(`/subscriptions/${id}`),
  getActiveSubscriptionSummary: () => http.get('/subscriptions/active/summary'),
  requestReturn: (id: string) => http.post(`/subscriptions/${id}/return`),
}

// 账户 API
export const accountApi = {
  getBalance: () => http.get('/account/balance'),
  recharge: (amount: number, description?: string) =>
    http.post('/account/recharge', { amount, description }),
  withdraw: (amount: number, description?: string, password?: string, bankInfo?: string) =>
    http.post('/account/withdraw', { amount, description, password, bankInfo }),
  getMyWithdrawOrders: (params?: { page?: number; limit?: number }) =>
    http.get('/account/withdraw/orders', { params }),
  getTransactions: (params?: { type?: string; page?: number; pageSize?: number }) =>
    http.get('/account/transactions', { params }),
  getStats: () => http.get('/account/stats'),
}

// 支付 API
export const paymentApi = {
  createAlipayOrder: (amount: number) =>
    http.post('/payment/alipay/create', { amount }),
  createWechatOrder: (amount: number) =>
    http.post('/payment/wechat/create', { amount }),
  queryAlipayOrder: (outTradeNo: string) =>
    http.get(`/payment/alipay/query/${outTradeNo}`, { timeout: 30000 }),
  queryWechatOrder: (outTradeNo: string) =>
    http.get(`/payment/wechat/query/${outTradeNo}`, { timeout: 30000 }),
  createSubscriptionPayment: (data: { drugId: string; quantity: number; channel: 'alipay' | 'wechat' }) =>
    http.post('/payment/subscribe/create', data),
}

// 清算 API
export const settlementApi = {
  getMySettlements: (params?: { page?: number; pageSize?: number }) =>
    http.get('/settlements/my/list', { params }),
  getMySettlementStats: () => http.get('/settlements/my/stats'),
}

// 收益 API
export const yieldApi = {
  getMyYieldCurve: (params?: { drugId?: string; startDate?: string; endDate?: string }) =>
    http.get('/yield/my/curve', { params }),
  getMyYieldSummary: () => http.get('/yield/my/summary'),
}

// 系统消息 API
export const systemMessageApi = {
  getPublished: (params?: { page?: number; pageSize?: number }) =>
    http.get('/system-messages', { params }),
}

export default api
