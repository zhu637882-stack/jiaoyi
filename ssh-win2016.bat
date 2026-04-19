@echo off
echo Installing OpenSSH for Windows Server 2016...

REM Download OpenSSH from GitHub
curl -L -o C:\openssh.zip https://github.com/PowerShell/Win32-OpenSSH/releases/download/v9.5.0.0p1-Beta/OpenSSH-Win64.zip

REM Extract using PowerShell
powershell -Command "Expand-Archive -Path C:\openssh.zip -DestinationPath C:\OpenSSH -Force"

REM Install
cd C:\OpenSSH\OpenSSH-Win64
powershell -ExecutionPolicy Bypass -File install-sshd.ps1

REM Start and configure service
net start sshd
sc config sshd start= auto

REM Firewall rule
netsh advfirewall firewall add rule name="OpenSSH" dir=in action=allow protocol=tcp localport=22

echo OpenSSH installation complete!
pause
