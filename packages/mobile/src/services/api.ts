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

// 请求拦截器 - 添加 JWT Token 和幂等键
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // 为 POST/PUT/DELETE 请求自动添加幂等键
    if (['post', 'put', 'delete'].includes(config.method?.toLowerCase() || '')) {
      config.headers['X-Request-Id'] = generateUUID()
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器 - 处理错误和 Token 刷新
api.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  async (error) => {
    const originalRequest = error.config

    // Token 过期，尝试刷新
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

    // 统一错误处理（非401情况）
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

// ========== 认证相关 API ==========
export const authApi = {
  login: (username: string, password: string) =>
    http.post('/auth/login', { username, password }),

  register: (data: { username: string; password: string; realName?: string; phone?: string; agreedToAgreement?: boolean; invitationCode?: string }) =>
    http.post('/auth/register', data),

  logout: () =>
    http.post('/auth/logout'),

  getProfile: () =>
    http.get('/auth/profile'),

  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    http.post('/auth/change-password', data),
}

// ========== 用户相关 API ==========
export const userApi = {
  getMe: () =>
    http.get('/users/me'),

  updateMe: (data: { realName?: string; phone?: string }) =>
    http.put('/users/me', data),
}

// ========== 管理员相关 API ==========
export const adminApi = {
  // 获取所有用户列表（管理员）
  getUsers: () =>
    http.get('/users'),

  // 审核用户
  reviewUser: (userId: string, data: { status: string; remark?: string }) =>
    http.post(`/users/${userId}/review`, data),

  // 管理员编辑用户
  updateUser: (userId: string, data: { realName?: string; phone?: string; role?: string }) =>
    http.put(`/users/${userId}`, data),

  // 管理员删除用户
  deleteUser: (userId: string) =>
    http.delete(`/users/${userId}`),
}

// ========== 药品相关 API ==========
export const drugApi = {
  getDrugs: (params?: { status?: string; keyword?: string; page?: number; pageSize?: number }) =>
    http.get('/drugs', { params }),

  getDrugById: (id: string) =>
    http.get(`/drugs/${id}`),

  getDrugStatistics: () =>
    http.get('/drugs/statistics'),

  getDrugHistory: (id: string) =>
    http.get(`/drugs/${id}/history`),
}

// ========== 行情相关 API ==========
export const marketApi = {
  // 获取市场总览（兼容旧接口）
  getMarketData: () =>
    http.get('/market/overview'),

  // 获取单药品行情详情（兼容旧接口）
  getDrugPrice: (drugId: string) =>
    http.get(`/market/drug/${drugId}`),

  // 获取K线数据（兼容旧接口）
  getPriceHistory: (drugId: string, params?: { period?: string }) =>
    http.get(`/market/drug/${drugId}/kline`, { params }),

  // 获取市场总览
  getMarketOverview: () =>
    http.get('/market/overview'),

  // 获取单药品行情详情
  getDrugMarket: (drugId: string) =>
    http.get(`/market/drug/${drugId}`),

  // 获取K线数据
  getDrugKLine: (drugId: string, period?: string) =>
    http.get(`/market/drug/${drugId}/kline`, { params: { period } }),

  // 获取垫资深度数据
  getDrugDepth: (drugId: string) =>
    http.get(`/market/drug/${drugId}/depth`),

  // 获取热门药品排行
  getHotList: (limit?: number) =>
    http.get('/market/hot-list', { params: { limit } }),

  // 获取平台全局统计
  getMarketStats: () =>
    http.get('/market/stats'),
}

// ========== 认购相关 API ==========
export const subscriptionApi = {
  // 创建认购
  createSubscription: (data: { drugId: string; quantity: number }) =>
    http.post('/subscriptions', data),

  // 取消认购（仅CONFIRMED状态可取消）
  cancelSubscription: (id: string) =>
    http.delete(`/subscriptions/${id}`),

  // 获取我的认购列表
  getMySubscriptions: (params?: { status?: string; page?: number; limit?: number }) =>
    http.get('/subscriptions', { params }),

  // 获取认购详情
  getSubscriptionDetail: (id: string) =>
    http.get(`/subscriptions/${id}`),

  // 获取当前认购摘要
  getActiveSubscriptionSummary: () =>
    http.get('/subscriptions/active/summary'),

  // 客户申请退回认购
  requestReturn: (id: string) =>
    http.post(`/subscriptions/${id}/return`),

  // 导出交易记录 CSV（返回 Blob）
  exportCsv: async (): Promise<Blob> => {
    const token = localStorage.getItem('access_token')
    const res = await fetch('/api/subscriptions/export?format=csv', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error('导出失败')
    return res.blob()
  },
}

// ========== 账户相关 API ==========
export const accountApi = {
  getBalance: () =>
    http.get('/account/balance'),

  recharge: (amount: number, description?: string) =>
    http.post('/account/recharge', { amount, description }),

  withdraw: (amount: number, description?: string, password?: string, bankInfo?: string) =>
    http.post('/account/withdraw', { amount, description, password, bankInfo }),

  getMyWithdrawOrders: (params?: { page?: number; limit?: number }) =>
    http.get('/account/withdraw/orders', { params }),

  getTransactions: (params?: { type?: string; page?: number; pageSize?: number }) =>
    http.get('/account/transactions', { params }),

  getStats: () =>
    http.get('/account/stats'),
}

// ========== 持仓相关 API（已废弃，使用 subscriptionApi 替代） ==========
export const portfolioApi = {
  // 获取账户余额和统计
  getPortfolio: () =>
    http.get('/account/balance'),

  // 获取当前持仓摘要 -> 映射到认购摘要
  getPositions: () =>
    subscriptionApi.getActiveSubscriptionSummary(),
}

// ========== 支付相关 API ==========
export const paymentApi = {
  // 创建支付宝订单
  createAlipayOrder: (amount: number) =>
    http.post('/payment/alipay/create', { amount }),

  // 创建微信支付订单
  createWechatOrder: (amount: number) =>
    http.post('/payment/wechat/create', { amount }),

  // 查询支付宝订单状态
  queryAlipayOrder: (outTradeNo: string) =>
    http.get(`/payment/alipay/query/${outTradeNo}`, { timeout: 30000 }),

  // 查询微信支付订单状态
  queryWechatOrder: (outTradeNo: string) =>
    http.get(`/payment/wechat/query/${outTradeNo}`, { timeout: 30000 }),

  // Mock模式确认支付（测试环境）
  confirmMockPayment: (outTradeNo: string) =>
    http.post(`/payment/mock/confirm/${outTradeNo}`),

  // 认购直付：创建支付订单（携带认购信息）
  createSubscriptionPayment: (data: { drugId: string; quantity: number; channel: 'alipay' | 'wechat' }) =>
    http.post('/payment/subscribe/create', data),

  // H5支付（移动浏览器）
  createWechatH5Order: (amount: number) =>
    http.post('/payment/wechat/h5', { amount }),

  // JSAPI支付（微信浏览器内）
  createWechatJsapiOrder: (amount: number, openId?: string) =>
    http.post('/payment/wechat/jsapi', { amount, openId: openId || '' }),

  // 认购H5支付
  createSubscriptionH5Payment: (data: { drugId: string; quantity: number }) =>
    http.post('/payment/subscribe/h5', data),

  // 认购JSAPI支付
  createSubscriptionJsapiPayment: (data: { drugId: string; quantity: number; openId?: string }) =>
    http.post('/payment/subscribe/jsapi', data),
}

// ========== 微信OAuth相关 API ==========
export const wechatApi = {
  // 获取微信openId（需JWT认证）
  getOpenId: () =>
    http.get('/wechat/oauth/openid'),
}

// ========== 清算相关 API ==========
export const settlementApi = {
  // 获取清算记录列表
  getSettlements: (params?: {
    drugId?: string
    startDate?: string
    endDate?: string
    page?: number
    pageSize?: number
  }) => http.get('/settlements', { params }),

  // 获取清算详情
  getSettlementDetail: (id: string) => http.get(`/settlements/${id}`),

  // 获取我的清算记录（垫资方视角）
  getMySettlements: (params?: { page?: number; pageSize?: number }) =>
    http.get('/settlements/my/list', { params }),

  // 获取我的清算统计（垫资方视角）
  getMySettlementStats: () => http.get('/settlements/my/stats'),
}

// ========== 收益相关 API ==========
export const yieldApi = {
  // 客户：获取我的收益曲线
  getMyYieldCurve: (params?: { drugId?: string; startDate?: string; endDate?: string }) =>
    http.get('/yield/my/curve', { params }),

  // 客户：获取我的收益汇总
  getMyYieldSummary: () =>
    http.get('/yield/my/summary'),
}

// ========== 系统消息相关 API ==========
export const systemMessageApi = {
  // 前台：获取已发布消息
  getPublished: (params?: { page?: number; pageSize?: number }) =>
    http.get('/system-messages', { params }),
  // 管理员：创建消息
  adminCreate: (data: { title: string; content: string; type?: string }) =>
    http.post('/system-messages/admin', data),
  // 管理员：发布消息
  adminPublish: (id: string) =>
    http.patch(`/system-messages/admin/${id}/publish`),
}

// ========== 体验金相关 API ==========
export const trialBonusApi = {
  getStatus: () =>
    http.get('/trial-bonus/status'),
}

// ========== 邀请相关 API ==========
export const invitationApi = {
  getMyCode: () =>
    http.get('/invitation/my-code'),
  getStats: () =>
    http.get('/invitation/stats'),
  getRecords: () =>
    http.get('/invitation/records'),
  validate: (code: string) =>
    http.post('/invitation/validate', { code }),
}

// ========== 创建 silentHttp 实例（不自动弹出错误提示） ==========
const silentApi: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// silentHttp 请求拦截器 - 只添加 JWT Token
silentApi.interceptors.request.use(
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

// silentHttp 响应拦截器 - 只处理 Token 刷新，不弹出错误提示
silentApi.interceptors.response.use(
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
          return silentApi(originalRequest)
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

    return Promise.reject(error)
  }
)

// silentHttp 方法封装
export const silentHttp = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    silentApi.get(url, config),
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    silentApi.post(url, data, config),
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    silentApi.put(url, data, config),
  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    silentApi.delete(url, config),
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    silentApi.patch(url, data, config),
}

export default api
