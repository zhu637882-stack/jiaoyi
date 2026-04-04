import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

// 创建 axios 实例
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器 - 添加 JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
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

// 垫资交易相关 API
export const fundingApi = {
  // 创建垫资订单
  createFundingOrder: (data: { drugId: string; quantity: number }) =>
    http.post('/funding/orders', data),

  // 获取我的垫资订单列表
  getFundingOrders: (params?: { status?: string; page?: number; pageSize?: number }) =>
    http.get('/funding/orders', { params }),

  // 获取订单详情
  getFundingOrder: (id: string) =>
    http.get(`/funding/orders/${id}`),

  // 获取当前持仓摘要
  getActiveFunding: () =>
    http.get('/funding/orders/active/summary'),

  // 获取某药品的垫资排队队列
  getFundingQueue: (drugId: string) =>
    http.get(`/funding/queue/${drugId}`),

  // 获取个人垫资统计
  getFundingStatistics: () =>
    http.get('/funding/statistics'),

  // 获取某药品的我的持仓订单
  getDrugHoldings: (drugId: string) =>
    http.get(`/funding/holdings/${drugId}`),
}

// 交易相关 API（兼容旧接口）
export const tradeApi = {
  createOrder: (data: any) =>
    http.post('/funding/orders', data),

  getOrders: () =>
    http.get('/funding/orders'),

  getOrderById: (id: string) =>
    http.get(`/funding/orders/${id}`),
}

// 账户相关 API
export const accountApi = {
  getBalance: () =>
    http.get('/account/balance'),
  
  recharge: (amount: number, description?: string) =>
    http.post('/account/recharge', { amount, description }),
  
  withdraw: (amount: number, description?: string) =>
    http.post('/account/withdraw', { amount, description }),
  
  getTransactions: (params?: { type?: string; page?: number; pageSize?: number }) =>
    http.get('/account/transactions', { params }),
  
  getStats: () =>
    http.get('/account/stats'),
}

// 持仓相关 API
export const portfolioApi = {
  // 获取账户余额和统计
  getPortfolio: () =>
    http.get('/account/balance'),
  
  // 获取当前持仓摘要
  getPositions: () =>
    http.get('/funding/orders/active/summary'),
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
    http.get(`/payment/alipay/query/${outTradeNo}`),

  // 查询微信支付订单状态
  queryWechatOrder: (outTradeNo: string) =>
    http.get(`/payment/wechat/query/${outTradeNo}`),
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

export default api
