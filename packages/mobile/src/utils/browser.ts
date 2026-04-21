// 检测是否在微信浏览器内
export function isWechatBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /micromessenger/i.test(navigator.userAgent)
}

// 检测是否移动端
export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}
