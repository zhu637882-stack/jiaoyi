const http = require('http');
const net = require('net');
const url = require('url');

const PORT = 80;
const DEFAULT_FRONTEND_PORT = 5173;
const BACKEND_PORT = 3000;

// 检测端口是否可用
function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

// 查找前端服务实际端口
async function findFrontendPort() {
  if (await checkPort(DEFAULT_FRONTEND_PORT)) {
    return DEFAULT_FRONTEND_PORT;
  }
  for (let port = 5174; port <= 5180; port++) {
    if (await checkPort(port)) {
      console.log(`[INFO] 前端服务运行在端口 ${port}`);
      return port;
    }
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  // WebSocket 升级请求处理 (检查 upgrade 头部，不区分大小写)
  const upgradeHeader = req.headers.upgrade || req.headers.Upgrade;
  if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
    console.log(`[INFO] WebSocket upgrade request: ${req.url}`);
    // 检查是否是后端 WebSocket 路径
    if (req.url.startsWith('/ws/') || req.url.startsWith('/ws?')) {
      console.log(`[INFO] Proxying WebSocket to backend: ${req.url}`);
      proxyWebSocket(req, res, '103.43.188.127', BACKEND_PORT);
      return;
    }
    // 前端 WebSocket (Vite HMR)
    console.log(`[INFO] Proxying WebSocket to frontend: ${req.url}`);
    const frontendPort = await findFrontendPort();
    if (frontendPort) {
      proxyWebSocket(req, res, '127.0.0.1', frontendPort);
    }
    return;
  }

  // API请求代理到后端
  if (req.url.startsWith('/api/') || req.url.startsWith('/auth/')) {
    const options = {
      hostname: '103.43.188.127',
      port: BACKEND_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `103.43.188.127:${BACKEND_PORT}`
      }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`[ERROR] 后端代理失败: ${err.message}`);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: '后端服务不可用' }));
    });

    req.pipe(proxyReq);
    return;
  }

  // WebSocket polling 请求代理到后端 (socket.io fallback)
  if (req.url.startsWith('/ws/') || req.url.startsWith('/ws?')) {
    const options = {
      hostname: '103.43.188.127',
      port: BACKEND_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `103.43.188.127:${BACKEND_PORT}`
      }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`[ERROR] 后端代理失败: ${err.message}`);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: '后端服务不可用' }));
    });

    req.pipe(proxyReq);
    return;
  }

  // 其他请求代理到前端
  const frontendPort = await findFrontendPort();

  if (!frontendPort) {
    res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><title>服务启动中</title></head>
      <body style="text-align:center;padding:50px;font-family:Arial;">
        <h1>⏳ 服务启动中</h1>
        <p>前端服务正在启动，请稍后再试...</p>
        <p>预计等待时间：10-30秒</p>
      </body>
      </html>
    `);
    return;
  }

  // 反向代理到前端服务
  const options = {
    hostname: '127.0.0.1',
    port: frontendPort,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `localhost:${frontendPort}`
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[ERROR] 代理请求失败: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><title>服务错误</title></head>
      <body style="text-align:center;padding:50px;font-family:Arial;">
        <h1>❌ 服务暂时不可用</h1>
        <p>前端服务连接失败，请检查服务是否运行</p>
        <p>错误: ${err.message}</p>
      </body>
      </html>
    `);
  });

  req.pipe(proxyReq);
});

// WebSocket 代理函数
function proxyWebSocket(req, res, hostname, port) {
  req.url = req.url || '/';

  const options = {
    hostname: hostname,
    port: port,
    path: req.url,
    method: req.method,
    headers: req.headers
  };

  const proxyReq = http.request(options);

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxySocket.pipe(res.socket);
    res.socket.pipe(proxySocket);

    if (proxyHead && proxyHead.length) {
      proxySocket.write(proxyHead);
    }
  });

  proxyReq.on('error', (err) => {
    console.error(`[ERROR] WebSocket 代理失败: ${err.message}`);
    res.end();
  });

  req.pipe(proxyReq);
}

// 处理 WebSocket 升级事件
server.on('upgrade', async (req, socket, head) => {
  console.log(`${new Date().toISOString()} - WebSocket 升级: ${req.url}`);

  // 添加 socket 错误处理
  socket.on('error', (err) => {
    console.error(`[ERROR] Socket 错误: ${err.message}`);
  });

  // 后端 WebSocket (/ws/* 或 /ws?*)
  if (req.url.startsWith('/ws/') || req.url.startsWith('/ws?')) {
    console.log(`[INFO] 代理 WebSocket 到后端: ${req.url}`);
    const proxyReq = http.request({
      hostname: '103.43.188.127',
      port: BACKEND_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `103.43.188.127:${BACKEND_PORT}`,
        'Upgrade': 'websocket',
        'Connection': 'Upgrade'
      }
    });

    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      console.log(`[INFO] WebSocket 升级成功: ${req.url}`);
      proxySocket.on('error', (err) => {
        console.error(`[ERROR] 后端 proxySocket 错误: ${err.message}`);
      });
      
      // 复制响应头
      let headers = `HTTP/1.1 101 Switching Protocols\r\n`;
      headers += `Upgrade: ${proxyRes.headers.upgrade || 'websocket'}\r\n`;
      headers += `Connection: ${proxyRes.headers.connection || 'Upgrade'}\r\n`;
      
      // 复制其他重要头
      if (proxyRes.headers['sec-websocket-accept']) {
        headers += `Sec-WebSocket-Accept: ${proxyRes.headers['sec-websocket-accept']}\r\n`;
      }
      if (proxyRes.headers['sec-websocket-protocol']) {
        headers += `Sec-WebSocket-Protocol: ${proxyRes.headers['sec-websocket-protocol']}\r\n`;
      }
      
      headers += `\r\n`;
      
      socket.write(headers);
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
      if (proxyHead && proxyHead.length) proxySocket.write(proxyHead);
    });

    proxyReq.on('error', (err) => {
      console.error(`[ERROR] WebSocket 代理到后端失败: ${err.message}`);
      socket.end();
    });

    proxyReq.end();
    return;
  }

  // 前端 WebSocket (Vite HMR)
  const frontendPort = await findFrontendPort();
  if (frontendPort) {
    const proxyReq = http.request({
      hostname: '127.0.0.1',
      port: frontendPort,
      path: req.url,
      method: req.method,
      headers: req.headers
    });

    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      proxySocket.on('error', (err) => {
        console.error(`[ERROR] 前端 proxySocket 错误: ${err.message}`);
      });
      
      // 复制响应头
      let headers = `HTTP/1.1 101 Switching Protocols\r\n`;
      headers += `Upgrade: ${proxyRes.headers.upgrade || 'websocket'}\r\n`;
      headers += `Connection: ${proxyRes.headers.connection || 'Upgrade'}\r\n`;
      
      if (proxyRes.headers['sec-websocket-accept']) {
        headers += `Sec-WebSocket-Accept: ${proxyRes.headers['sec-websocket-accept']}\r\n`;
      }
      if (proxyRes.headers['sec-websocket-protocol']) {
        headers += `Sec-WebSocket-Protocol: ${proxyRes.headers['sec-websocket-protocol']}\r\n`;
      }
      
      headers += `\r\n`;
      
      socket.write(headers);
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
      if (proxyHead && proxyHead.length) proxySocket.write(proxyHead);
    });

    proxyReq.on('error', (err) => {
      console.error(`[ERROR] WebSocket 代理到前端失败: ${err.message}`);
      socket.end();
    });

    proxyReq.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 反向代理服务已启动`);
  console.log(`🌐 访问地址:`);
  console.log(`   - http://localhost`);
  console.log(`   - http://www.mufend.com`);
  console.log(`   - http://mufenda.com`);
  console.log(`📍 将自动代理到前端服务 (5173-5180端口)`);
  console.log(`🔌 WebSocket 代理已启用 (/ws/* -> 后端)`);
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
