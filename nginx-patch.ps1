$conf = Get-Content "D:\nginx\conf\nginx.conf" -Raw -Encoding UTF8

# socket.io 的 WebSocket 升级块 (插入到 location / 之前)
$socketBlock = @'

    # Socket.IO WebSocket 代理
    location /socket.io/ {
        proxy_pass http://backend_pc;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

'@

# 在 "location / {" 之前插入
$conf = $conf -replace '(\s+location\s+/\s+\{)', ($socketBlock + "`r`n`$1")
Set-Content "D:\nginx\conf\nginx.conf" -Value $conf -Encoding UTF8 -NoNewline

Write-Host "nginx conf patched with socket.io WebSocket support"
