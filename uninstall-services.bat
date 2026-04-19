@echo off
chcp 65001 >nul
echo ==========================================
echo    卸载零钱保 Windows 服务
echo ==========================================
echo.

echo [1/3] 停止服务...
nssm stop Lingqianbao-Backend >nul 2>&1
nssm stop Lingqianbao-Frontend >nul 2>&1
nssm stop Lingqianbao-Proxy >nul 2>&1
echo        服务已停止

echo.
echo [2/3] 删除服务...
nssm remove Lingqianbao-Backend confirm >nul 2>&1
nssm remove Lingqianbao-Frontend confirm >nul 2>&1
nssm remove Lingqianbao-Proxy confirm >nul 2>&1
echo        服务已删除

echo.
echo [3/3] 清理进程...
taskkill /F /IM node.exe >nul 2>&1
echo        进程已清理

echo.
echo ==========================================
echo    服务卸载完成!
echo ==========================================
echo.
pause
