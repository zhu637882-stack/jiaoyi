const OPENID_STORAGE_KEY = 'wechat_openid'
const WECHAT_OAUTH_ATTEMPT_KEY = 'wechat_oauth_attempt'

/**
 * 获取存储的openId
 */
export function getStoredOpenId(): string | null {
  return localStorage.getItem(OPENID_STORAGE_KEY)
}

/**
 * 存储openId
 */
export function setStoredOpenId(openId: string): void {
  localStorage.setItem(OPENID_STORAGE_KEY, openId)
}

/**
 * 清除存储的openId
 */
export function clearStoredOpenId(): void {
  localStorage.removeItem(OPENID_STORAGE_KEY)
}

/**
 * 从URL参数中提取wechatError（OAuth回调失败时后端附带）
 * 提取后自动清除URL中的参数，防止无限循环
 * @returns 错误信息字符串，如果没有错误则返回null
 */
export function extractWechatErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const wechatError = params.get('wechatError')
  if (wechatError) {
    // 记录OAuth已失败过，防止无限循环
    localStorage.setItem(WECHAT_OAUTH_ATTEMPT_KEY, Date.now().toString())
    // 清除URL中的错误参数
    const url = new URL(window.location.href)
    url.searchParams.delete('wechatError')
    window.history.replaceState({}, '', url.toString())

    const errorMessages: Record<string, string> = {
      'oauth_failed': '微信授权失败，请稍后重试',
      'config_missing': '微信支付配置异常，请联系客服',
      'invalid_code': '微信授权码无效，请重新授权',
      'api_error': '微信接口调用失败，请稍后重试',
    }
    return errorMessages[wechatError] || `微信授权失败(${wechatError})`
  }
  return null
}

/**
 * 从URL参数中提取openId（OAuth回调后）
 * 提取后自动存储到localStorage并清除URL中的openId参数
 */
export function extractOpenIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const openId = params.get('openId')
  if (openId) {
    setStoredOpenId(openId)
    // OAuth成功，清除失败记录
    localStorage.removeItem(WECHAT_OAUTH_ATTEMPT_KEY)
    // 清除URL中的openId参数，保持URL干净
    const url = new URL(window.location.href)
    url.searchParams.delete('openId')
    window.history.replaceState({}, '', url.toString())
  }
  return openId
}

/**
 * 检查是否刚刚OAuth授权失败过（防止无限循环重试）
 * 5分钟内的失败记录视为有效
 */
export function hasRecentOAuthFailure(): boolean {
  const attemptTime = localStorage.getItem(WECHAT_OAUTH_ATTEMPT_KEY)
  if (!attemptTime) return false
  const elapsed = Date.now() - parseInt(attemptTime, 10)
  // 5分钟内的失败记录有效
  if (elapsed < 5 * 60 * 1000) return true
  // 超过5分钟则清除，允许重试
  localStorage.removeItem(WECHAT_OAUTH_ATTEMPT_KEY)
  return false
}

/**
 * 清除OAuth失败记录，允许重新发起授权
 */
export function clearOAuthFailure(): void {
  localStorage.removeItem(WECHAT_OAUTH_ATTEMPT_KEY)
}

/**
 * 发起微信OAuth授权（重定向到后端授权接口）
 */
export function redirectToWechatAuth(): void {
  // 如果5分钟内已经失败过，不再重定向，避免无限循环
  if (hasRecentOAuthFailure()) {
    console.warn('[wechat-auth] OAuth recently failed, skipping redirect to prevent infinite loop')
    return
  }
  const currentUrl = window.location.href
  window.location.href = `/api/wechat/oauth/authorize?redirectUrl=${encodeURIComponent(currentUrl)}`
}

/**
 * 确保在微信浏览器中有openId
 * 按优先级检查：URL错误参数 → URL参数 → localStorage
 * 如果都没有则返回null，需要发起OAuth授权
 */
export function ensureWechatOpenId(): string | null {
  // 0. 先检查是否有OAuth错误参数
  const wechatError = extractWechatErrorFromUrl()
  if (wechatError) {
    console.error('[wechat-auth] OAuth error from URL:', wechatError)
    return null
  }

  // 1. 先检查URL参数（OAuth回调后携带openId）
  const fromUrl = extractOpenIdFromUrl()
  if (fromUrl) return fromUrl

  // 2. 检查localStorage
  const stored = getStoredOpenId()
  if (stored) return stored

  // 3. 无openId，需要授权
  return null
}
