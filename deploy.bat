@echo off
chcp 65001 >nul
echo ==========================================
echo        药赚赚一键部署脚本
echo ==========================================

cd C:\yuebao

echo [1/4] 拉取代码...
git pull origin main

echo [2/4] 安装依赖...
call pnpm install

echo [3/4] 构建项目...
call pnpm run build

echo [4/4] 重启服务...
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak >nul
cd packages\server
start /B npm run start

echo ==========================================
echo 部署完成！
echo 访问: http://103.43.188.127
echo ==========================================
pause
