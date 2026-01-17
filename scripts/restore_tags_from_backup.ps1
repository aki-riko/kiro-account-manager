# 从备份文件恢复标签
# 根据文件名中的 QQ 号或标识自动打标签

$backupDir = "D:\Downloads\backup"
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
Write-Host "已有标签数量: $($existingTags.Count)" -ForegroundColor Green
Write-Host ""

# 获取所有备份文件，按时间升序排序
$files = Get-ChildItem $backupDir -Filter "*accounts*.json" | 
    Where-Object { $_.Name -notlike "*kirogate*" } |
    Sort-Object LastWriteTime

Write-Host "找到 $($files.Count) 个备份文件，按时间升序处理" -ForegroundColor Cyan
Write-Host ""

# 提取文件名中的标签（QQ号或标识）
function Get-TagFromFilename {
    param($filename)
    
    # 匹配 QQ 号（纯数字开头）
    if ($filename -match '^(\d{6,11})[^0-9]') {
        return "售出给QQ：$($matches[1])"
    }
    
    # 匹配 LD 开头的订单号
    if ($filename -match '(LD\d{6}[A-Z0-9]{6})') {
        return "订单号：$($matches[1])"
    }
    
    # 匹配 Downloads 开头
    if ($filename -match '^Downloads') {
        return "Downloads"
    }
    
    return $null
}

# 创建邮箱到标签列表的映射（记录所有标签）
$emailToTags = @{}
$processedCount = 0

foreach ($file in $files) {
    $tag = Get-TagFromFilename $file.Name
    
    if ($tag) {
        try {
            $backupAccounts = Get-Content $file.FullName -Raw | ConvertFrom-Json
            
            foreach ($account in $backupAccounts) {
                $email = $account.email
                
                # 初始化邮箱的标签列表
                if (-not $emailToTags.ContainsKey($email)) {
                    $emailToTags[$email] = @()
                }
                
                # 检查是否已有相同标签（避免重复）
                $hasTag = $emailToTags[$email] | Where-Object { $_.Tag -eq $tag }
                if (-not $hasTag) {
                    $emailToTags[$email] += @{
                        Tag = $tag
                        Time = $file.LastWriteTime
                        File = $file.Name
                    }
                }
            }
            
            $processedCount++
            
        } catch {
            Write-Host "❌ 解析失败: $($file.Name)" -ForegroundColor Red
        }
    }
}

Write-Host "处理完成！共处理 $processedCount 个文件" -ForegroundColor Green
Write-Host "识别出 $($emailToTags.Count) 个邮箱的标签" -ForegroundColor Green
Write-Host ""

# 统计标签分布和多次出售情况
$tagStats = @{}
$multiSoldCount = 0

foreach ($email in $emailToTags.Keys) {
    $tags = $emailToTags[$email]
    
    # 统计每个标签的使用次数（去重，一个邮箱只算一次）
    $uniqueTags = $tags | Select-Object -ExpandProperty Tag -Unique
    foreach ($tag in $uniqueTags) {
        if (-not $tagStats.ContainsKey($tag)) {
            $tagStats[$tag] = 0
        }
        $tagStats[$tag]++
    }
    
    # 统计多次出售的账号
    if ($tags.Count -gt 1) {
        $multiSoldCount++
    }
}

Write-Host "==================== 标签分布 ====================" -ForegroundColor Cyan
$tagStats.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
    Write-Host "📌 $($_.Key): $($_.Value) 个账号" -ForegroundColor Yellow
}
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  多次出售的账号: $multiSoldCount 个" -ForegroundColor Yellow
Write-Host ""

# 询问是否应用标签
$confirm = Read-Host "是否应用这些标签到当前账号？(y/n)"
if ($confirm -ne 'y') {
    Write-Host "已取消" -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "开始应用标签..." -ForegroundColor Cyan

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

# 保存更新后的数据
$currentAccounts | ConvertTo-Json -Depth 10 | Set-Content $accountsFile -Encoding UTF8
$tagsData | ConvertTo-Json -Depth 10 | Set-Content $tagsFile -Encoding UTF8

Write-Host ""
Write-Host "✅ 完成！" -ForegroundColor Green
Write-Host "   创建新标签: $newTagsCount 个" -ForegroundColor Yellow
Write-Host "   更新账号: $updatedCount 个" -ForegroundColor Yellow
