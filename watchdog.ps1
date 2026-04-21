# watchdog.ps1 - 后端服务自检脚本
$logFile = "D:\wwwroot\jiaoyi\watchdog.log"
$serviceName = "backend"
$healthUrl = "http://localhost:3000/api/"
$checkInterval = 60
$failCount = 0
$maxFails = 3
$nssmPath = "C:\ProgramData\chocolatey\lib\NSSM\tools\nssm.exe"

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts $msg" | Out-File -Append -FilePath $logFile
}

Write-Log "Watchdog started"

while ($true) {
    $status = (& $nssmPath status $serviceName) 2>$null
    
    if ($status -ne "SERVICE_RUNNING") {
        Write-Log "Service status: $status - Restarting..."
        & $nssmPath restart $serviceName
        Start-Sleep -Seconds 10
        Write-Log "Service restarted"
        $failCount = 0
    } else {
        # HTTP健康检查
        try {
            $response = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 5 -UseBasicParsing
            $failCount = 0
        } catch {
            $ex = $_.Exception
            if ($ex -is [System.Net.WebException] -and $ex.Response) {
                # HTTP错误（如404, 500）说明服务在运行，只是路径不存在
                $failCount = 0
            } else {
                # 连接失败/超时说明服务可能挂了
                $failCount++
                Write-Log "Health check error: $($ex.Message), fail count: $failCount"
            }
        }
        
        if ($failCount -ge $maxFails) {
            Write-Log "Health check failed $maxFails times - Restarting service..."
            & $nssmPath restart $serviceName
            Start-Sleep -Seconds 10
            Write-Log "Service restarted after health check failures"
            $failCount = 0
        }
    }
    
    Start-Sleep -Seconds $checkInterval
}
