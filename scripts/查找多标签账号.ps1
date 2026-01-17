# 查找有多个标签的账号（被多次转售）

$accounts = Get-Content "$env:APPDATA\.kiro-account-manager\accounts.json" -Raw | ConvertFrom-Json
$tags = Get-Content "$env:APPDATA\.kiro-account-manager\groups-tags.json" -Raw | ConvertFrom-Json

Write-Host "=== 有多个标签的账号（被多次转售）===" -ForegroundColor Cyan
Write-Host ""

$multiTagAccounts = @()

foreach ($acc in $accounts) {
    if ($acc.tagLinks -and $acc.tagLinks.Count -gt 1) {
        $tagNames = @()
        foreach ($link in $acc.tagLinks) {
            $tag = $tags.tags | Where-Object { $_.id -eq $link.tagId }
            if ($tag) {
                $tagNames += $tag.name
            }
        }
        
        $multiTagAccounts += [PSCustomObject]@{
            Email = $acc.email
            TagCount = $acc.tagLinks.Count
            OldestTag = $tagNames[0]
            NewestTag = $tagNames[-1]
            AllTags = ($tagNames -join " → ")
        }
    }
}

Write-Host "共 $($multiTagAccounts.Count) 个账号" -ForegroundColor Yellow
Write-Host ""

if ($multiTagAccounts.Count -gt 0) {
    $multiTagAccounts | Sort-Object -Property TagCount -Descending | Format-Table -Property Email, TagCount, OldestTag, NewestTag -AutoSize
    
    Write-Host ""
    Write-Host "=== 解决方案 ===" -ForegroundColor Cyan
    Write-Host "1. 保留最新标签（最后一次交易的客户）" -ForegroundColor Yellow
    Write-Host "2. 删除旧标签（之前的客户）" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "执行清理脚本：" -ForegroundColor Green
    Write-Host ".\scripts\清理多标签账号旧标签.ps1" -ForegroundColor White
}
