@echo off
echo ==========================================
echo    Enable Windows SSH Service
echo ==========================================
echo.

echo [1/4] Installing OpenSSH Server...
dism /online /add-capability /capabilityname:OpenSSH.Server~~~~0.0.1.0
echo    OpenSSH installed
echo.

echo [2/4] Starting SSH service...
net start sshd
echo    SSH service started
echo.

echo [3/4] Setting auto-start...
sc config sshd start= auto
echo    Auto-start configured
echo.

echo [4/4] Configuring firewall...
netsh advfirewall firewall add rule name="OpenSSH Server" dir=in action=allow protocol=tcp localport=22
echo    Firewall rule added
echo.

echo ==========================================
echo    SSH Service Enabled!
echo ==========================================
echo.
echo Connect with: ssh Administrator@103.43.188.127
echo Password: jasonmaz
echo.
pause
