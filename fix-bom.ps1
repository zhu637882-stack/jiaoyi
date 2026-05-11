$content = [System.IO.File]::ReadAllText("D:\nginx\conf\nginx.conf")
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("D:\nginx\conf\nginx.conf", $content, $utf8NoBom)
Write-Host "BOM removed"
