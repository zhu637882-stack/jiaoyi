// 带错误重试机制的 API 封装
import { message } from 'antd'
import * as api from './api'

// 重试配置
interface RetryConfig {
  retries?: number
  delay?: number
  shouldRetry?: (error: any) => boolean
}

// 默认重试配置
const defaultRetryConfig: RetryConfig = {
  retries: 3,
  delay: 1000,
  shouldRetry: (error: any) => {
    // 网络错误或5xx服务器错误时重试
    const status = error?.response?.status
    return !status || status >= 500 || error.message?.includes('Network Error')
  },
}

// 带重试的请求包装器
export const withRetry = async <T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> => {
  const { retries = 3, delay = 1000, shouldRetry } = { ...defaultRetryConfig, ...config }
  
  let lastError: any
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      // 最后一次尝试，直接抛出错误
      if (i === retries - 1) {
        throw error
      }
      
      // 判断是否值得重试
      if (shouldRetry && !shouldRetry(error)) {
        throw error
      }
      
      // 延迟后重试（指数退避）
      const waitTime = delay * Math.pow(2, i)
      console.log(`[API Retry] 第${i + 1}次重试，等待${waitTime}ms...`)
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }
  }
  
  throw lastError
}

// 带重试和错误提示的 API 调用
export const apiCall = async <T>(
  fn: () => Promise<T>,
  options: {
    successMessage?: string
    errorMessage?: string
    showError?: boolean
    retryConfig?: RetryConfig
  } = {}
): Promise<T | null> => {
  const { successMessage, errorMessage, showError = true, retryConfig } = options
  
  try {
    const result = await withRetry(fn, retryConfig)
    if (successMessage) {
      message.success(successMessage)
    }
    return result
  } catch (error: any) {
    if (showError) {
      const msg = errorMessage || error?.response?.data?.message || error?.message || '操作失败'
      message.error(msg)
    }
    console.error('[API Error]', error)
    return null
  }
}

// 导出原始 API（保持兼容性）
export { api }
