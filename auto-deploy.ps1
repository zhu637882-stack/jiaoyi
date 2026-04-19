# 药赚赚自动部署服务
# 保存到 C:\yuebao\auto-deploy.ps1

$ErrorActionPreference = "Continue"
$logFile = "C:\yuebao\deploy.log"

function Write-Log {
    param([string]$message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $message" | Out-File -FilePath $logFile -Append -Encoding UTF8
    Write-Host "$timestamp - $message"
}

Write-Log "自动部署服务已启动"
Write-Log "监控仓库: https://github.com/zhu637882-stack/jiaoyi"

while ($true) {
    try {
        Set-Location C:\yuebao
        
        # 获取本地版本
        $localCommit = git rev-parse HEAD 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Log "Git 命令失败，跳过本次检查"
            Start-Sleep -Seconds 60
            continue
        }
        
        # 获取远程版本
        $remoteOutput = git ls-remote origin main 2>$null
        if ($remoteOutput -match '^([a-f0-9]+)') {
            $remoteCommit = $matches[1]
        } else {
            Write-Log "无法获取远程版本"
            Start-Sleep -Seconds 60
            continue
        }
        
        # 比较版本
        if ($localCommit -ne $remoteCommit) {
            Write-Log "检测到更新: $localCommit -> $remoteCommit"
            
            # 拉取代码
            Write-Log "正在拉取最新代码..."
            git pull origin main 2>&1 | Out-File -FilePath $logFile -Append -Encoding UTF8
            
            if ($LASTEXITCODE -eq 0) {
                Write-Log "代码拉取成功"
                
                # 安装依赖
                Write-Log "正在安装依赖..."
                pnpm install 2>&1 | Out-File -FilePath $logFile -Append -Encoding UTF8
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Log "依赖安装成功"
                    
                    # 构建项目
                    Write-Log "正在构建项目..."
                    pnpm run build 2>&1 | Out-File -FilePath $logFile -Append -Encoding UTF8
                    
                    if ($LASTEXITCODE -eq 0) {
                        Write-Log "项目构建成功"
                        
                        # 重启服务
                        Write-Log "正在重启服务..."
                        Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
                        Start-Sleep -Seconds 2
                        
                        # 启动后端服务
                        Set-Location C:\yuebao\packages\server
                        Start-Process -FilePath "npm" -ArgumentList "run", "start" -WindowStyle Hidden -WorkingDirectory "C:\yuebao\packages\server"
                        
                        Write-Log "服务已重启，部署完成！"
                        Write-Log "访问地址: http://103.43.188.127"
                    } else {
                        Write-Log "❌ 项目构建失败"
                    }
                } else {
                    Write-Log "❌ 依赖安装失败"
                }
            } else {
                Write-Log "❌ 代码拉取失败"
            }
        }
    }
    catch {
        Write-Log "错误: $($_.Exception.Message)"
    }
    
    # 每分钟检查一次
    Start-Sleep -Seconds 60
}
