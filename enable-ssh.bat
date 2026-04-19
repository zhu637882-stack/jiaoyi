@echo off
chcp 65001 >nul
echo ==========================================
echo    开启 Windows SSH 服务
echo ==========================================
echo.

echo [1/4] 安装 OpenSSH 服务器...
dism /online /add-capability /capabilityname:OpenSSH.Server~~~~0.0.1.0
echo        OpenSSH 安装完成

echo.
echo [2/4] 启动 SSH 服务...
net start sshd
echo        SSH 服务已启动

echo.
echo [3/4] 设置 SSH 服务自动启动...
sc config sshd start= auto
echo        SSH 服务已设置为自动启动

echo.
echo [4/4] 配置防火墙...
netsh advfirewall firewall add rule name="OpenSSH Server" dir=in action=allow protocol=tcp localport=22
echo        防火墙规则已添加

echo.
echo ==========================================
echo    SSH 服务配置完成!
echo ==========================================
echo.
echo SSH 服务已启用，可以通过以下方式连接:
echo   ssh Administrator@103.43.188.127
echo.
echo 密码: jasonmaz
echo.
pause
