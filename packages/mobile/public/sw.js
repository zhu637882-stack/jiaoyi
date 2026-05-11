// 零钱宝 Service Worker - 离线缓存支持
const CACHE_NAME = 'lqb-cache-v1'
const STATIC_CACHE = 'lqb-static-v1'
const API_CACHE = 'lqb-api-v1'

// 预缓存的核心资源
const PRECACHE_URLS = [
  '/',
  '/m',
  '/m/login',
]

// ============ 安装阶段 ============
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// ============ 激活阶段 - 清理旧缓存 ============
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, API_CACHE]
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => !currentCaches.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  )
})

// ============ 请求拦截 ============
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 只处理同源请求
  if (url.origin !== location.origin) return

  // 非 GET 请求不做任何缓存处理，直接透传
  if (request.method !== 'GET') return

  // API 请求: Network First + Cache Fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE))
    return
  }

  // HTML 页面导航: Network First
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithCache(request, STATIC_CACHE))
    return
  }

  // 静态资源 (JS/CSS/图片/字体): Cache First
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE))
    return
  }
})

// ============ 缓存策略 ============

// Cache First — 优先缓存，缓存没有再走网络
async function cacheFirstWithNetwork(request, cacheName) {
  if (request.method !== 'GET') {
    return fetch(request)
  }

  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // 离线且无缓存，返回基础离线响应
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
  }
}

// Network First — 优先网络，失败用缓存
async function networkFirstWithCache(request, cacheName) {
  if (request.method !== 'GET') {
    return fetch(request)
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached

    // 导航请求回退到首页缓存（SPA）
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/')
      if (fallback) return fallback
    }

    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
  }
}

// ============ 工具函数 ============
function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp)(\?.*)?$/.test(pathname)
}
