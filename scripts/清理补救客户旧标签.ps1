# 清理已补救客户的旧标签
# 逻辑：昨天补救文件里的邮箱，如果在当前账号里有对应客户的标签，就删掉

$downloadDir = "D:\Downloads"
$appDataDir = "$env:APPDATA\.kiro-account-manager"
$accountsFile = "$appDataDir\accounts.json"
$tagsFile = "$appDataDir\groups-tags.json"

# 读取当前账号数据
Write-Host "读取当前账号数据..." -ForegroundColor Cyan
$currentAccounts = Get-Content $accountsFile -Raw | ConvertFrom-Json
Write-Host "当前账号数量: $($currentAccounts.Count)" -ForegroundColor Green
Write-Host ""

# 读取标签定义
$tagsData = Get-Content $tagsFile -Raw | ConvertFrom-Json
$existingTags = @{}
foreach ($tag in $tagsData.tags) {
    $existingTags[$tag.name] = $tag.id
}

# 获取昨天的补救文件
$files = Get-ChildItem $downloadDir -Filter "*去重*.json" | 
    Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-1) } |
    Sort-Object LastWriteTime

Write-Host "找到 $($files.Count) 个补救文件" -ForegroundColor Cyan
Write-Host ""

# 提取标签
function Get-TagFromFilename {
    param($filename)
    
    # 匹配 QQ 号（纯数字开头）
    if ($filename -match '^(\d{6,11})[^0-9]') {
        return "售出给QQ：$($matches[1])"
    }
    
    return $null
}

# 收集需要清理的邮箱和对应的客户标签
$emailsToClean = @{}

foreach ($file in $files) {
    $tag = Get-TagFromFilename $file.Name
    
    if ($tag) {
        try {
            $backupAccounts = Get-Content $file.FullName -Raw | ConvertFrom-Json
            
            Write-Host "处理补救文件: $($file.Name)" -ForegroundColor Yellow
            Write-Host "  客户标签: $tag" -ForegroundColor Gray
            Write-Host "  补救账号数: $($backupAccounts.Count)" -ForegroundColor Gray
            
            foreach ($account in $backupAccounts) {
                $email = $account.email
                
                if (-not $emailsToClean.ContainsKey($email)) {
                    $emailsToClean[$email] = @()
                }
                
                # 记录这个邮箱需要删除的标签
                if (-not ($emailsToClean[$email] -contains $tag)) {
                    $emailsToClean[$email] += $tag
                }
            }
            
        } catch {
            Write-Host "❌ 解析失败: $($file.Name)" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "需要清理 $($emailsToClean.Count) 个邮箱的旧标签" -ForegroundColor Green
Write-Host ""

# 统计要删除的标签
$tagStats = @{}
foreach ($email in $emailsToClean.Keys) {
    foreach ($tag in $emailsToClean[$email]) {
        if (-not $tagStats.ContainsKey($tag)) {
            $tagStats[$tag] = 0
        }
        $tagStats[$tag]++
    }
}

Write-Host "==================== 要清理的标签 ====================" -ForegroundColor Cyan
$tagStats.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
    Write-Host "🗑️  $($_.Key): $($_.Value) 个账号" -ForegroundColor Yellow
}
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# 询问是否清理
$confirm = Read-Host "是否清理这些旧标签？(y/n)"
if ($confirm -ne 'y') {
    Write-Host "已取消" -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "开始清理旧标签..." -ForegroundColor Cyan

# 清理标签
$cleanedCount = 0

foreach ($account in $currentAccounts) {
    $email = $account.email
    
    if ($emailsToClean.ContainsKey($email)) {
        $tagsToRemove = $emailsToClean[$email]
        
        if ($account.tagLinks) {
            $originalCount = $account.tagLinks.Count
            
            # 删除指定的标签
            $account.tagLinks = $account.tagLinks | Where-Object {
                $tagName = $_.tagName
                -not ($tagsToRemove -contains $tagName)
            }
            
            $removedCount = $originalCount - $account.tagLinks.Count
            if ($removedCount -gt 0) {
                $cleanedCount += $removedCount
                Write-Host "  🗑️  $email - 删除 $removedCount 个旧标签" -ForegroundColor Gray
            }
        }
    }
}

# 保存
$currentAccounts | ConvertTo-Json -Depth 10 | Set-Content $accountsFile -Encoding UTF8

Write-Host ""
Write-Host "✅ 完成！" -ForegroundColor Green
Write-Host "   清理旧标签: $cleanedCount 个" -ForegroundColor Yellow
