const http = require('http');
const net = require('net');
const url = require('url');

const PORT = 80;
const BACKEND_PORT = 3000;
const FRONTEND_PORT = 5173;

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  // API 和认证请求 -> 后端
  if (req.url.startsWith('/api/') || req.url.startsWith('/auth/')) {
    proxyHttp(req, res, '127.0.0.1', BACKEND_PORT);
    return;
  }

  // Socket.IO 请求 -> 后端
  if (req.url.startsWith('/socket.io/')) {
    proxyHttp(req, res, '127.0.0.1', BACKEND_PORT);
    return;
  }

  // 其他请求 -> 前端
  proxyHttp(req, res, '127.0.0.1', FRONTEND_PORT);
});

// HTTP 代理函数
function proxyHttp(req, res, hostname, port) {
  // 清除 WebSocket 升级相关的头，避免后端返回 426 Upgrade Required
  const { upgrade, connection, ...cleanHeaders } = req.headers;
  
  const options = {
    hostname: hostname,
    port: port,
    path: req.url,
    method: req.method,
    headers: {
      ...cleanHeaders,
      host: `${hostname}:${port}`,
      connection: 'close',
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[ERROR] HTTP 代理错误: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Proxy Error');
    }
  });

  req.pipe(proxyReq);
}

// 处理 WebSocket 升级
server.on('upgrade', (req, socket, head) => {
  console.log(`${new Date().toISOString()} - WebSocket 升级: ${req.url}`);

  // Socket.IO WebSocket -> 后端
  if (req.url.startsWith('/socket.io/')) {
    proxyWebSocket(req, socket, head, '127.0.0.1', BACKEND_PORT);
    return;
  }

  // 前端 WebSocket (Vite HMR) -> 前端
  proxyWebSocket(req, socket, head, '127.0.0.1', FRONTEND_PORT);
});

// WebSocket 代理函数
function proxyWebSocket(req, socket, head, hostname, port) {
  // 添加 socket 错误处理
  socket.on('error', (err) => {
    console.error(`[ERROR] 客户端 Socket 错误: ${err.message}`);
  });

  const options = {
    hostname: hostname,
    port: port,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${hostname}:${port}`
    }
  };

  const proxyReq = http.request(options);

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    console.log(`[INFO] WebSocket 升级成功: ${req.url}`);

    proxySocket.on('error', (err) => {
      console.error(`[ERROR] 后端 proxySocket 错误: ${err.message}`);
    });

    // 写入 101 Switching Protocols 响应
    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      ''
    ];

    // 复制 Sec-WebSocket-Accept 头
    if (proxyRes.headers['sec-websocket-accept']) {
      headers.splice(3, 0, `Sec-WebSocket-Accept: ${proxyRes.headers['sec-websocket-accept']}`);
    }

    socket.write(headers.join('\r\n') + '\r\n');

    // 建立双向管道
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);

    // 写入初始数据
    if (proxyHead && proxyHead.length) {
      proxySocket.write(proxyHead);
    }
  });

  proxyReq.on('error', (err) => {
    console.error(`[ERROR] WebSocket 代理错误: ${err.message}`);
    socket.end();
  });

  proxyReq.on('response', (res) => {
    // 如果不是升级响应，说明后端不支持 WebSocket
    if (res.statusCode !== 101) {
      console.error(`[ERROR] 后端返回非 101 状态码: ${res.statusCode}`);
      socket.end();
    }
  });

  proxyReq.end();
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 反向代理服务已启动`);
  console.log(`🌐 端口: ${PORT}`);
  console.log(`📍 API/Auth/Socket.IO -> 127.0.0.1:${BACKEND_PORT}`);
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
