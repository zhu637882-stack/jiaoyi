const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');

const PORT = 80;
const ROOT_DIR = __dirname;
const DEFAULT_FRONTEND_PORT = 5173;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

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
  // 先检查默认端口
  if (await checkPort(DEFAULT_FRONTEND_PORT)) {
    return DEFAULT_FRONTEND_PORT;
  }
  // 检查 5174-5180 范围
  for (let port = 5174; port <= 5180; port++) {
    if (await checkPort(port)) {
      console.log(`[INFO] 前端服务运行在端口 ${port}`);
      return port;
    }
  }
  return DEFAULT_FRONTEND_PORT; // 返回默认，让跳转失败时显示错误
}

const server = http.createServer(async (req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // 处理域名访问，重定向到前端
  const host = req.headers.host || '';
  
  // 如果访问的是根路径，返回跳转页面
  if (req.url === '/' || req.url === '/index.html') {
    const frontendPort = await findFrontendPort();
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>零钱保 - 药品垫资交易平台</title>
    <meta http-equiv="refresh" content="0;url=http://103.43.188.127:${frontendPort}">
    <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f2f5; }
        .loading { text-align: center; }
        .loading h1 { color: #1890ff; }
        .loading p { color: #666; }
    </style>
</head>
<body>
    <div class="loading">
        <h1>零钱保</h1>
        <p>正在跳转到交易平台...</p>
        <p>如果没有自动跳转，请 <a href="http://103.43.188.127:${frontendPort}">点击这里</a></p>
    </div>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }
  
  // 其他静态文件
  let filePath = path.join(ROOT_DIR, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://0.0.0.0:${PORT}/`);
  console.log(`📁 Serving files from: ${ROOT_DIR}`);
  console.log(`🌐 Access URLs:`);
  console.log(`   - http://localhost`);
  console.log(`   - http://www.mufend.com`);
  console.log(`   - http://mufenda.com`);
});
