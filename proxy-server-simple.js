const http = require('http');
const httpProxy = require('http-proxy');

const PORT = 80;
const BACKEND_PORT = 3000;
const FRONTEND_PORT = 5173;

// 创建代理服务器
const proxy = httpProxy.createProxyServer({
  ws: true,
  changeOrigin: true,
});

// 错误处理
proxy.on('error', (err, req, res) => {
  console.error(`[ERROR] 代理错误: ${err.message}`);
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Proxy Error');
  }
});

// WebSocket 错误处理
proxy.on('error', (err, req, socket) => {
  console.error(`[ERROR] WebSocket 代理错误: ${err.message}`);
  if (socket) {
    socket.end();
  }
});

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  // API 和认证请求 -> 后端
  if (req.url.startsWith('/api/') || req.url.startsWith('/auth/')) {
    proxy.web(req, res, {
      target: `http://127.0.0.1:${BACKEND_PORT}`,
    });
    return;
  }

  // Socket.IO 请求 -> 后端
  if (req.url.startsWith('/socket.io/')) {
    proxy.web(req, res, {
      target: `http://127.0.0.1:${BACKEND_PORT}`,
    });
    return;
  }

  // 其他请求 -> 前端
  proxy.web(req, res, {
    target: `http://127.0.0.1:${FRONTEND_PORT}`,
  });
});

// 处理 WebSocket 升级
server.on('upgrade', (req, socket, head) => {
  console.log(`${new Date().toISOString()} - WebSocket 升级: ${req.url}`);

  // Socket.IO WebSocket
  if (req.url.startsWith('/socket.io/')) {
    proxy.ws(req, socket, head, {
      target: `ws://127.0.0.1:${BACKEND_PORT}`,
    });
    return;
  }

  // 前端 WebSocket (Vite HMR)
  proxy.ws(req, socket, head, {
    target: `ws://127.0.0.1:${FRONTEND_PORT}`,
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 反向代理服务已启动`);
  console.log(`🌐 端口: ${PORT}`);
  console.log(`📍 API/Auth -> 127.0.0.1:${BACKEND_PORT}`);
  console.log(`📍 WebSocket -> 127.0.0.1:${BACKEND_PORT}`);
  console.log(`📍 其他 -> 127.0.0.1:${FRONTEND_PORT}`);
});

server.on('error', (err) => {
  console.error(`[ERROR] 服务器错误: ${err.message}`);
  if (err.code === 'EACCES') {
    console.error('权限不足，请以管理员身份运行');
  }
  if (err.code === 'EADDRINUSE') {
    console.error('端口80已被占用');
  }
});
