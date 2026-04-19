dism /online /add-capability /capabilityname:OpenSSH.Server~~~~0.0.1.0
net start sshd
sc config sshd start= auto
netsh advfirewall firewall add rule name="OpenSSH" dir=in action=allow protocol=tcp localport=22
pause
