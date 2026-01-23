# 刷新 Social Token 脚本（使用 Desktop API）

param(
    [string]$RefreshToken = ""
)

if (-not $RefreshToken) {
    Write-Host "用法: .\refresh-social-token.ps1 -RefreshToken 'aor...'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "示例:" -ForegroundColor Cyan
    Write-Host '  .\refresh-social-token.ps1 -RefreshToken "aorAAAAAGnn..."' -ForegroundColor Gray
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Social Token 刷新脚本 (Desktop API)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Desktop API 端点
$endpoint = "https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken"

Write-Host "[1/3] 准备刷新请求..." -ForegroundColor Yellow
Write-Host "  Endpoint: $endpoint" -ForegroundColor Gray
Write-Host "  Refresh Token (前50字符): $($RefreshToken.Substring(0, [Math]::Min(50, $RefreshToken.Length)))..." -ForegroundColor Gray
Write-Host ""

# 构建请求体
$body = @{
    refreshToken = $RefreshToken
} | ConvertTo-Json

try {
    Write-Host "[2/3] 发送刷新请求..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod -Uri $endpoint -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
    
    Write-Host "[3/3] 刷新成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  新 Token 信息" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Access Token (前50字符):" -ForegroundColor Cyan
    Write-Host "  $($response.accessToken.Substring(0, [Math]::Min(50, $response.accessToken.Length)))..." -ForegroundColor White
    Write-Host ""
    
    Write-Host "Refresh Token (前50字符):" -ForegroundColor Cyan
    Write-Host "  $($response.refreshToken.Substring(0, [Math]::Min(50, $response.refreshToken.Length)))..." -ForegroundColor White
    Write-Host ""
    
    Write-Host "过期时间:" -ForegroundColor Cyan
    Write-Host "  $($response.expiresAt)" -ForegroundColor White
    Write-Host ""
    
    # 构建导入用的 JSON
    $importData = @{
        refreshToken = $response.refreshToken
        provider = "Google"
        machineId = ""
        accessToken = $response.accessToken
    }
    
    # 保存到文件
    $outputFile = "social-token-refreshed.json"
    @($importData) | ConvertTo-Json -Depth 10 | Out-File $outputFile -Encoding UTF8
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  已保存到文件" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "文件路径: $outputFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "现在可以在管理器中导入这个文件了！" -ForegroundColor Yellow
    Write-Host ""
    
    # 同时显示完整的 JSON（方便复制）
    Write-Host "完整 JSON（可直接复制）:" -ForegroundColor Cyan
    Write-Host "----------------------------------------" -ForegroundColor Gray
    @($importData) | ConvertTo-Json -Depth 10
    Write-Host "----------------------------------------" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  刷新失败" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    
    $errorMsg = $_.Exception.Message
    
    if ($errorMsg -match "400") {
        Write-Host "错误: 400 Bad Request" -ForegroundColor Red
        Write-Host ""
        Write-Host "可能的原因:" -ForegroundColor Yellow
        Write-Host "  1. Refresh Token 已过期" -ForegroundColor Gray
        Write-Host "  2. Refresh Token 格式错误" -ForegroundColor Gray
        Write-Host "  3. Refresh Token 已被撤销" -ForegroundColor Gray
        Write-Host ""
        Write-Host "建议: 在 Kiro IDE 中重新登录 Google/GitHub 账号" -ForegroundColor Cyan
    } elseif ($errorMsg -match "401") {
        Write-Host "错误: 401 Unauthorized" -ForegroundColor Red
        Write-Host ""
        Write-Host "Refresh Token 无效或已过期" -ForegroundColor Yellow
    } else {
        Write-Host "错误详情:" -ForegroundColor Red
        Write-Host $errorMsg -ForegroundColor Gray
        
        # 尝试解析响应体
        try {
            $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host ""
            Write-Host "服务器返回:" -ForegroundColor Yellow
            Write-Host ($errorResponse | ConvertTo-Json -Depth 10) -ForegroundColor Gray
        } catch {
            # 忽略解析错误
        }
    }
    
    Write-Host ""
    exit 1
}
