const OPENID_STORAGE_KEY = 'wechat_openid'

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
 * 从URL参数中提取openId（OAuth回调后）
 * 提取后自动存储到localStorage并清除URL中的openId参数
 */
export function extractOpenIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const openId = params.get('openId')
  if (openId) {
    setStoredOpenId(openId)
    // 清除URL中的openId参数，保持URL干净
    const url = new URL(window.location.href)
    url.searchParams.delete('openId')
    window.history.replaceState({}, '', url.toString())
  }
  return openId
}

/**
 * 发起微信OAuth授权（重定向到后端授权接口）
 */
export function redirectToWechatAuth(): void {
  const currentUrl = window.location.href
  window.location.href = `/api/wechat/oauth/authorize?redirectUrl=${encodeURIComponent(currentUrl)}`
}

/**
 * 确保在微信浏览器中有openId
 * 按优先级检查：URL参数 → localStorage
 * 如果都没有则返回null，需要发起OAuth授权
 */
export function ensureWechatOpenId(): string | null {
  // 1. 先检查URL参数（OAuth回调后携带openId）
  const fromUrl = extractOpenIdFromUrl()
  if (fromUrl) return fromUrl

  // 2. 检查localStorage
  const stored = getStoredOpenId()
  if (stored) return stored

  // 3. 无openId，需要授权
  return null
}
