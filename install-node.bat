@echo off
chcp 65001 >nul
echo ========================================
echo    安装 Node.js 18 (LTS)
echo ========================================
echo.

:: 下载 Node.js 安装包
echo [1/3] 下载 Node.js 18...
powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.20.4/node-v18.20.4-x64.msi' -OutFile '%TEMP%\node-v18.20.4-x64.msi'"

:: 安装 Node.js
echo [2/3] 安装 Node.js...
msiexec /i "%TEMP%\node-v18.20.4-x64.msi" /qn /norestart

:: 等待安装完成
timeout /t 10 /nobreak >nul

:: 验证安装
echo [3/3] 验证安装...
node --version
npm --version

echo.
echo ========================================
echo    Node.js 安装完成！
echo ========================================
pause
