# 刷新 Enterprise Token 脚本

param(
    [string]$RefreshToken = "aorAAAAAGnnhFcE-lz3fyoGmmOdc99Nsgu9iwWwPgFnjrNdUzYgUgn6BaZdtf3-Gxuu408sZqoLUkpfZRMhsqyUDABbg1:MGUCMQCV3aaHmN5XIL4M5kcFaitYAqiUVJxN2LcM76ecZTPdBtFCabIDkGGzEeoLvBbH1Q8CMDLxoqvL1DeYnZEssM3k4Dds2u/qQud788lI25dLiF0hZ34DprM4Pgpvfxu95gdsCw",
    [string]$ClientId = "z9Ce-if5EqxVu6V09Cw1CWFwLXNvdXRoZWFzdC0y",
    [string]$ClientSecret = "eyJraWQiOiJrZXktMTU2Njk2NzkxOCIsImFsZyI6IkhTMzg0In0.eyJzZXJpYWxpemVkIjoie1wiY2xpZW50SWRcIjp7XCJ2YWx1ZVwiOlwiejlDZS1pZjVFcXhWdTZWMDlDdzFDV0Z3TFhOdmRYUm9aV0Z6ZEMweVwifSxcImlkZW1wb3RlbnRLZXlcIjpudWxsLFwidGVuYW50SWRcIjpudWxsLFwiY2xpZW50TmFtZVwiOlwiS2lybyBJREVcIixcImJhY2tmaWxsVmVyc2lvblwiOm51bGwsXCJjbGllbnRUeXBlXCI6XCJQVUJMSUNcIixcInRlbXBsYXRlQXJuXCI6bnVsbCxcInRlbXBsYXRlQ29udGV4dFwiOm51bGwsXCJleHBpcmF0aW9uVGltZXN0YW1wXCI6MTc3Njc4MDE1My44MDc4NjM5ODgsXCJjcmVhdGVkVGltZXN0YW1wXCI6MTc2OTAwNDE1My44MDc4NjM5ODgsXCJ1cGRhdGVkVGltZXN0YW1wXCI6MTc2OTAwNDE1My44MDc4NjM5ODgsXCJjcmVhdGVkQnlcIjpudWxsLFwidXBkYXRlZEJ5XCI6bnVsbCxcInN0YXR1c1wiOm51bGwsXCJpbml0aWF0ZUxvZ2luVXJpXCI6XCJodHRwczovL2QtOTc2NzkzNjE4MS5hd3NhcHBzLmNvbS9zdGFydC9cIixcImVudGl0bGVkUmVzb3VyY2VJZFwiOm51bGwsXCJlbnRpdGxlZFJlc291cmNlQ29udGFpbmVySWRcIjpudWxsLFwiZXh0ZXJuYWxJZFwiOm51bGwsXCJzb2Z0d2FyZUlkXCI6bnVsbCxcInNjb3Blc1wiOlt7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6Y29tcGxldGlvbnNcIixcInN0YXR1c1wiOlwiSU5JVElBTFwiLFwiYXBwbGljYXRpb25Bcm5cIjpudWxsLFwiZnJpZW5kbHlJZFwiOlwiY29kZXdoaXNwZXJlclwiLFwidXNlQ2FzZUFjdGlvblwiOlwiY29tcGxldGlvbnNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifSx7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6YW5hbHlzaXNcIixcInN0YXR1c1wiOlwiSU5JVElBTFwiLFwiYXBwbGljYXRpb25Bcm5cIjpudWxsLFwiZnJpZW5kbHlJZFwiOlwiY29kZXdoaXNwZXJlclwiLFwidXNlQ2FzZUFjdGlvblwiOlwiYW5hbHlzaXNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifSx7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6Y29udmVyc2F0aW9uc1wiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJjb252ZXJzYXRpb25zXCIsXCJ0eXBlXCI6XCJJbW11dGFibGVBY2Nlc3NTY29wZVwiLFwic2NvcGVUeXBlXCI6XCJBQ0NFU1NfU0NPUEVcIn0se1wiZnVsbFNjb3BlXCI6XCJjb2Rld2hpc3BlcmVyOnRyYW5zZm9ybWF0aW9uc1wiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJ0cmFuc2Zvcm1hdGlvbnNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifSx7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6dGFza2Fzc2lzdFwiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJ0YXNrYXNzaXN0XCIsXCJ0eXBlXCI6XCJJbW11dGFibGVBY2Nlc3NTY29wZVwiLFwic2NvcGVUeXBlXCI6XCJBQ0NFU1NfU0NPUEVcIn1dLFwiYXV0aGVudGljYXRpb25Db25maWd1cmF0aW9uXCI6bnVsbCxcInNoYWRvd0F1dGhlbnRpY2F0aW9uQ29uZmlndXJhdGlvblwiOm51bGwsXCJlbmFibGVkR3JhbnRzXCI6e1wiQVVUSF9DT0RFXCI6e1widHlwZVwiOlwiSW1tdXRhYmxlQXV0aG9yaXphdGlvbkNvZGVHcmFudE9wdGlvbnNcIixcInJlZGlyZWN0VXJpc1wiOltcImh0dHA6Ly8xMjcuMC4wLjEvb2F1dGgvY2FsbGJhY2tcIl19LFwiUkVGUkVTSF9UT0tFTlwiOntcInR5cGVcIjpcIkltbXV0YWJsZVJlZnJlc2hUb2tlbkdyYW50T3B0aW9uc1wifX0sXCJlbmZvcmNlQXV0aE5Db25maWd1cmF0aW9uXCI6bnVsbCxcIm93bmVyQWNjb3VudElkXCI6bnVsbCxcInNzb0luc3RhbmNlQWNjb3VudElkXCI6bnVsbCxcInVzZXJDb25zZW50XCI6bnVsbCxcIm5vbkludGVyYWN0aXZlU2Vzc2lvbnNFbmFibGVkXCI6bnVsbCxcImFzc29jaWF0ZWRJbnN0YW5jZUFyblwiOm51bGwsXCJpc0JhY2tmaWxsZWRcIjpmYWxzZSxcImhhc0luaXRpYWxTY29wZXNcIjp0cnVlLFwiYXJlQWxsU2NvcGVzQ29uc2VudGVkVG9cIjpmYWxzZSxcImlzRXhwaXJlZFwiOmZhbHNlLFwiZ3JvdXBTY29wZXNCeUZyaWVuZGx5SWRcIjp7XCJjb2Rld2hpc3BlcmVyXCI6W3tcImZ1bGxTY29wZVwiOlwiY29kZXdoaXNwZXJlcjphbmFseXNpc1wiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJhbmFseXNpc1wiLFwidHlwZVwiOlwiSW1tdXRhYmxlQWNjZXNzU2NvcGVcIixcInNjb3BlVHlwZVwiOlwiQUNDRVNTX1NDT1BFXCJ9LHtcImZ1bGxTY29wZVwiOlwiY29kZXdoaXNwZXJlcjpjb252ZXJzYXRpb25zXCIsXCJzdGF0dXNcIjpcIklOSVRJQUxcIixcImFwcGxpY2F0aW9uQXJuXCI6bnVsbCxcImZyaWVuZGx5SWRcIjpcImNvZGV3aGlzcGVyZXJcIixcInVzZUNhc2VBY3Rpb25cIjpcImNvbnZlcnNhdGlvbnNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifSx7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6dGFza2Fzc2lzdFwiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJ0YXNrYXNzaXN0XCIsXCJ0eXBlXCI6XCJJbW11dGFibGVBY2Nlc3NTY29wZVwiLFwic2NvcGVUeXBlXCI6XCJBQ0NFU1NfU0NPUEVcIn0se1wiZnVsbFNjb3BlXCI6XCJjb2Rld2hpc3BlcmVyOmNvbXBsZXRpb25zXCIsXCJzdGF0dXNcIjpcIklOSVRJQUxcIixcImFwcGxpY2F0aW9uQXJuXCI6bnVsbCxcImZyaWVuZGx5SWRcIjpcImNvZGV3aGlzcGVyZXJcIixcInVzZUNhc2VBY3Rpb25cIjpcImNvbXBsZXRpb25zXCIsXCJ0eXBlXCI6XCJJbW11dGFibGVBY2Nlc3NTY29wZVwiLFwic2NvcGVUeXBlXCI6XCJBQ0NFU1NfU0NPUEVcIn0se1wiZnVsbFNjb3BlXCI6XCJjb2Rld2hpc3BlcmVyOnRyYW5zZm9ybWF0aW9uc1wiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJ0cmFuc2Zvcm1hdGlvbnNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifV19LFwic2hvdWxkR2V0VmFsdWVGcm9tVGVtcGxhdGVcIjpmYWxzZSxcImhhc1JlcXVlc3RlZFNjb3Blc1wiOmZhbHNlLFwiY29udGFpbnNPbmx5U3NvU2NvcGVzXCI6ZmFsc2UsXCJzc29TY29wZXNcIjpbXSxcImlzVjFCYWNrZmlsbGVkXCI6ZmFsc2UsXCJpc1YyQmFja2ZpbGxlZFwiOmZhbHNlLFwiaXNWM0JhY2tmaWxsZWRcIjpmYWxzZSxcImlzVjRCYWNrZmlsbGVkXCI6ZmFsc2V9In0.lwk2hnMC3QEKXfz9iUAff9NLrX6z-JtyGoVs0XGsIr1jLRr4rkIX_NAn-wizTuza",
    [string]$Region = "ap-southeast-2"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Enterprise Token 刷新脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# AWS SSO OIDC 端点
$endpoint = "https://oidc.$Region.amazonaws.com/token"

Write-Host "[1/3] 准备刷新请求..." -ForegroundColor Yellow
Write-Host "  Region: $Region" -ForegroundColor Gray
Write-Host "  Endpoint: $endpoint" -ForegroundColor Gray
Write-Host ""

# 构建请求体
$body = @{
    grant_type = "refresh_token"
    client_id = $ClientId
    client_secret = $ClientSecret
    refresh_token = $RefreshToken
}

try {
    Write-Host "[2/3] 发送刷新请求..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod -Uri $endpoint -Method Post -Body $body -ContentType "application/x-www-form-urlencoded" -ErrorAction Stop
    
    Write-Host "[3/3] 刷新成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  新 Token 信息" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    # 计算过期时间
    $expiresAt = (Get-Date).AddSeconds($response.expires_in).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    
    Write-Host "Access Token (前50字符):" -ForegroundColor Cyan
    Write-Host "  $($response.access_token.Substring(0, [Math]::Min(50, $response.access_token.Length)))..." -ForegroundColor White
    Write-Host ""
    
    Write-Host "Refresh Token (前50字符):" -ForegroundColor Cyan
    Write-Host "  $($response.refresh_token.Substring(0, [Math]::Min(50, $response.refresh_token.Length)))..." -ForegroundColor White
    Write-Host ""
    
    Write-Host "过期时间:" -ForegroundColor Cyan
    Write-Host "  $expiresAt (约 $([Math]::Round($response.expires_in / 3600, 1)) 小时)" -ForegroundColor White
    Write-Host ""
    
    # 构建导入用的 JSON
    $importData = @{
        refreshToken = $response.refresh_token
        clientId = $ClientId
        clientSecret = $ClientSecret
        region = $Region
        provider = "Enterprise"
        machineId = ""
        accessToken = $response.access_token
    }
    
    # 保存到文件
    $outputFile = "enterprise-token-refreshed.json"
    @($importData) | ConvertTo-Json -Depth 10 | Out-File $outputFile -Encoding UTF8
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  已保存到文件" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "文件路径: $outputFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "现在可以在管理器中导入这个文件了！" -ForegroundColor Yellow
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
        Write-Host "  1. Refresh Token 已过期（超过 90 天）" -ForegroundColor Gray
        Write-Host "  2. Client ID/Secret 不匹配" -ForegroundColor Gray
        Write-Host "  3. Refresh Token 格式错误" -ForegroundColor Gray
        Write-Host ""
        Write-Host "建议: 在 Kiro IDE 中重新登录 Enterprise 账号" -ForegroundColor Cyan
    } elseif ($errorMsg -match "401") {
        Write-Host "错误: 401 Unauthorized" -ForegroundColor Red
        Write-Host ""
        Write-Host "Client ID 或 Client Secret 无效" -ForegroundColor Yellow
    } else {
        Write-Host "错误详情:" -ForegroundColor Red
        Write-Host $errorMsg -ForegroundColor Gray
    }
    
    Write-Host ""
    exit 1
}
