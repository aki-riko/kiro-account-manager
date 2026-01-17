# 补充昨天下载目录的标签

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

# 获取昨天的文件
$files = Get-ChildItem $downloadDir -Filter "*.json" | 
    Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-1) } |
    Sort-Object LastWriteTime

Write-Host "找到 $($files.Count) 个昨天的文件" -ForegroundColor Cyan
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

# 收集邮箱到标签的映射
$emailToTags = @{}

foreach ($file in $files) {
    $tag = Get-TagFromFilename $file.Name
    
    if ($tag) {
        try {
            $backupAccounts = Get-Content $file.FullName -Raw | ConvertFrom-Json
            
            Write-Host "处理文件: $($file.Name)" -ForegroundColor Yellow
            Write-Host "  标签: $tag" -ForegroundColor Gray
            Write-Host "  账号数: $($backupAccounts.Count)" -ForegroundColor Gray
            
            foreach ($account in $backupAccounts) {
                $email = $account.email
                
                if (-not $emailToTags.ContainsKey($email)) {
                    $emailToTags[$email] = @()
                }
                
                # 检查是否已有相同标签
                $hasTag = $emailToTags[$email] | Where-Object { $_.Tag -eq $tag }
                if (-not $hasTag) {
                    $emailToTags[$email] += @{
                        Tag = $tag
                        Time = $file.LastWriteTime
                        File = $file.Name
                    }
                }
            }
            
        } catch {
            Write-Host "❌ 解析失败: $($file.Name)" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "识别出 $($emailToTags.Count) 个邮箱需要补充标签" -ForegroundColor Green
Write-Host ""

# 统计
$tagStats = @{}
foreach ($email in $emailToTags.Keys) {
    $tags = $emailToTags[$email]
    $uniqueTags = $tags | Select-Object -ExpandProperty Tag -Unique
    foreach ($tag in $uniqueTags) {
        if (-not $tagStats.ContainsKey($tag)) {
            $tagStats[$tag] = 0
        }
        $tagStats[$tag]++
    }
}

Write-Host "==================== 标签分布 ====================" -ForegroundColor Cyan
$tagStats.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
    Write-Host "📌 $($_.Key): $($_.Value) 个账号" -ForegroundColor Yellow
}
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# 询问是否应用
$confirm = Read-Host "是否补充这些标签？(y/n)"
if ($confirm -ne 'y') {
    Write-Host "已取消" -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "开始补充标签..." -ForegroundColor Cyan

# 应用标签
$updatedCount = 0
$newTagsCount = 0

foreach ($account in $currentAccounts) {
    $email = $account.email
    
    if ($emailToTags.ContainsKey($email)) {
        $tags = $emailToTags[$email] | Sort-Object Time
        
        foreach ($tagInfo in $tags) {
            $tagName = $tagInfo.Tag
            
            # 检查标签是否存在，不存在则创建
            if (-not $existingTags.ContainsKey($tagName)) {
                $newTagId = [guid]::NewGuid().ToString()
                $newTag = @{
                    id = $newTagId
                    name = $tagName
                    color = "#ef4444"
                    createdAt = $null
                }
                $tagsData.tags += $newTag
                $existingTags[$tagName] = $newTagId
                $newTagsCount++
                Write-Host "  ➕ 创建新标签: $tagName" -ForegroundColor Green
            }
            
            $tagId = $existingTags[$tagName]
            
            # 添加标签关联
            if (-not $account.tagLinks) {
                $account.tagLinks = @()
            }
            
            # 检查是否已有此标签
            $hasTag = $account.tagLinks | Where-Object { $_.tagId -eq $tagId }
            if (-not $hasTag) {
                $account.tagLinks += @{
                    tagId = $tagId
                    tagName = $tagName
                    linkedAt = $tagInfo.Time.ToString("yyyy-MM-dd HH:mm")
                }
                $updatedCount++
            }
        }
    }
}

# 保存
$currentAccounts | ConvertTo-Json -Depth 10 | Set-Content $accountsFile -Encoding UTF8
$tagsData | ConvertTo-Json -Depth 10 | Set-Content $tagsFile -Encoding UTF8

Write-Host ""
Write-Host "✅ 完成！" -ForegroundColor Green
Write-Host "   创建新标签: $newTagsCount 个" -ForegroundColor Yellow
Write-Host "   更新账号: $updatedCount 个" -ForegroundColor Yellow
