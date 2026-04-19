import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { message } from 'antd'

// 错误码映射表
const errorMessages: Record<string, string> = {
  'INSUFFICIENT_BALANCE': '余额不足',
  'DRUG_NOT_FOUND': '药品不存在',
  'ORDER_NOT_FOUND': '订单不存在',
  'INVALID_STATUS': '订单状态不允许此操作',
  'INSUFFICIENT_HOLDINGS': '持仓数量不足',
  'UNAUTHORIZED': '请先登录',
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
      config.headers['X-Request-Id'] = crypto.randomUUID()
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 处理错误和 Token 刷新
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data
  },
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
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      } else {
        localStorage.removeItem('access_token')
        window.location.href = '/login'
      }
    }

    // 统一错误处理（非401情况）
    const errorCode = error.response?.data?.code
    const errorMessage = error.response?.data?.message
    const translatedMessage = errorCode && errorMessages[errorCode]
      ? errorMessages[errorCode]
      : errorMessage || '请求失败，请稍后重试'
    message.error(translatedMessage)

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

// 认证相关 API
export const authApi = {
  login: (username: string, password: string) =>
    http.post('/auth/login', { username, password }),
  
  register: (data: { username: string; password: string; realName?: string; phone?: string }) =>
    http.post('/auth/register', data),
  
  logout: () =>
    http.post('/auth/logout'),
  
  getProfile: () =>
    http.get('/auth/profile'),
}

// 用户相关 API
export const userApi = {
  getMe: () =>
    http.get('/users/me'),

  updateMe: (data: { realName?: string; phone?: string }) =>
    http.put('/users/me', data),
}

// 管理员相关 API
export const adminApi = {
  // 获取所有用户列表（管理员）
  getUsers: () =>
    http.get('/users'),
}

// 药品相关 API
export const drugApi = {
  getDrugs: (params?: { status?: string; keyword?: string; page?: number; pageSize?: number }) =>
    http.get('/drugs', { params }),
  
  getDrugById: (id: string) =>
    http.get(`/drugs/${id}`),
  
  getDrugStatistics: () =>
    http.get('/drugs/statistics'),
  
  getDrugHistory: (id: string) =>
    http.get(`/drugs/${id}/history`),
  
  createDrug: (data: any) =>
    http.post('/drugs', data),
  
  updateDrug: (id: string, data: any) =>
    http.put(`/drugs/${id}`, data),
  
  updateDrugStatus: (id: string, data: { status: string; reason?: string }) =>
    http.put(`/drugs/${id}/status`, data),
  
  deleteDrug: (id: string) =>
    http.delete(`/drugs/${id}`),
}

// 行情相关 API
export const marketApi = {
  // 获取市场总览（兼容旧接口 getMarketData）
  getMarketData: () =>
    http.get('/market/overview'),
  
  // 获取单药品行情详情（兼容旧接口 getDrugPrice）
  getDrugPrice: (drugId: string) =>
    http.get(`/market/drug/${drugId}`),
  
  // 获取K线数据（兼容旧接口 getPriceHistory）
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

  // 生成行情快照（管理员）
  createSnapshot: (data: { drugId: string; snapshotDate?: string }) =>
    http.post('/market/snapshot', data),
}

// 认购相关 API
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

  // 管理员获取全部认购列表
  getAdminSubscriptions: (params?: any) =>
    http.get('/subscriptions/admin/list', { params }),

  // 管理员获取认购统计
  getAdminSubscriptionStats: () =>
    http.get('/subscriptions/admin/stats'),

  // 客户申请退回认购
  requestReturn: (id: string) =>
    http.post(`/subscriptions/${id}/return`),

  // 管理员核准退回
  approveReturn: (id: string) =>
    http.put(`/subscriptions/admin/${id}/approve-return`),

  // 管理员驳回退回
  rejectReturn: (id: string, reason: string) =>
    http.put(`/subscriptions/admin/${id}/reject-return`, { reason }),
}

// 账户相关 API
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
  
  // 管理员接口
  adminGetOverview: () =>
    http.get('/account/admin/overview'),
  adminGetBalances: (params?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'ASC' | 'DESC' }) =>
    http.get('/account/admin/balances', { params }),
  getAuditLogs: (params?: { action?: string; page?: number; pageSize?: number }) =>
    http.get('/account/admin/audit-logs', { params }),

  // 管理员出金管理
  adminGetWithdrawOrders: (params?: { status?: string; page?: number; limit?: number }) =>
    http.get('/account/admin/withdraw-orders', { params }),
  adminApproveWithdraw: (id: string, bankTransactionNo?: string) =>
    http.post(`/account/admin/withdraw-orders/${id}/approve`, { bankTransactionNo }),
  adminRejectWithdraw: (id: string, rejectReason: string) =>
    http.post(`/account/admin/withdraw-orders/${id}/reject`, { rejectReason }),
}

// 持仓相关 API（已废弃，使用 subscriptionApi 替代）
export const portfolioApi = {
  // 获取账户余额和统计
  getPortfolio: () =>
    http.get('/account/balance'),
  
  // 获取当前持仓摘要 -> 映射到认购摘要
  getPositions: () =>
    subscriptionApi.getActiveSubscriptionSummary(),
}

// 销售相关 API
export const salesApi = {
  // 创建销售记录
  createSales: (data: {
    drugId: string
    saleDate: string
    quantity: number
    actualSellingPrice: number
    terminal: string
  }) => http.post('/sales', data),

  // 更新销售记录
  updateSales: (id: string, data: Partial<{
    quantity: number
    actualSellingPrice: number
    terminal: string
  }>) => http.put(`/sales/${id}`, data),

  // 删除销售记录
  deleteSales: (id: string) => http.delete(`/sales/${id}`),

  // 获取销售记录列表
  getSales: (params?: {
    drugId?: string
    startDate?: string
    endDate?: string
    page?: number
    pageSize?: number
  }) => http.get('/sales', { params }),

  // 获取某日某药品的销售汇总
  getDailySummary: (drugId: string, date: string) =>
    http.get('/sales/daily-summary', { params: { drugId, date } }),
}

// 支付相关 API
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
}

// 清算相关 API
export const settlementApi = {
  // 执行日清日结清算（管理员）
  executeSettlement: (data: { drugId: string; settlementDate: string }) =>
    http.post('/settlements/execute', data),

  // 获取清算预览（管理员）
  getSettlementPreview: (drugId: string, date: string) =>
    http.get('/settlements/preview', { params: { drugId, date } }),

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

  // 获取清算汇总统计（管理员）
  getSettlementSummary: () => http.get('/settlements/summary/all'),

  // 获取我的清算记录（垫资方视角）
  getMySettlements: (params?: { page?: number; pageSize?: number }) =>
    http.get('/settlements/my/list', { params }),

  // 获取我的清算统计（垫资方视角）
  getMySettlementStats: () => http.get('/settlements/my/stats'),
}

// 收益相关 API
export const yieldApi = {
  // 管理员：生成日收益记录
  generateDailyYields: (yieldDate?: string) =>
    http.post('/yield/generate', { yieldDate }),

  // 管理员：获取待填写补贴金列表
  getPendingSubsidyList: (params?: { yieldDate?: string; drugId?: string; page?: number; pageSize?: number; includeFilled?: string }) =>
    http.get('/yield/pending-subsidy', { params }),

  // 管理员：财务填写补贴金
  fillSubsidy: (data: { yieldDate: string; items: { orderId: string; subsidy: number }[] }) =>
    http.post('/yield/subsidy', data),

  // 管理员：获取某药品收益曲线
  getDrugYieldCurve: (drugId: string, params?: { startDate?: string; endDate?: string }) =>
    http.get(`/yield/drug/${drugId}/curve`, { params }),

  // 客户：获取我的收益曲线
  getMyYieldCurve: (params?: { drugId?: string; startDate?: string; endDate?: string }) =>
    http.get('/yield/my/curve', { params }),

  // 客户：获取我的收益汇总
  getMyYieldSummary: () =>
    http.get('/yield/my/summary'),
}

// 系统消息相关 API
export const systemMessageApi = {
  getPublished: (params?: { page?: number; pageSize?: number }) => 
    http.get('/system-messages', { params }),
  adminGetList: (params?: { status?: string; page?: number; pageSize?: number }) => 
    http.get('/system-messages/admin/list', { params }),
  adminCreate: (data: { title: string; content: string; type?: string }) => 
    http.post('/system-messages/admin', data),
  adminUpdate: (id: string, data: any) => 
    http.put(`/system-messages/admin/${id}`, data),
  adminDelete: (id: string) => 
    http.delete(`/system-messages/admin/${id}`),
  adminPublish: (id: string) => 
    http.patch(`/system-messages/admin/${id}/publish`),
}

// 创建 silentHttp 实例（不自动弹出错误提示）
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
    // 为 POST/PUT/DELETE 请求自动添加幂等键
    if (['post', 'put', 'delete'].includes(config.method?.toLowerCase() || '')) {
      config.headers['X-Request-Id'] = crypto.randomUUID()
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// silentHttp 响应拦截器 - 只处理 Token 刷新，不弹出错误提示
silentApi.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data
  },
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
          return silentApi(originalRequest)
        } catch (refreshError) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      } else {
        localStorage.removeItem('access_token')
        window.location.href = '/login'
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
