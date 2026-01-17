# 诊断账号列表为空问题

Write-Host "=== 诊断账号列表显示问题 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 检查数据文件
Write-Host "1. 检查数据文件..." -ForegroundColor Yellow
$accountsPath = "$env:APPDATA\.kiro-account-manager\accounts.json"
$tagsPath = "$env:APPDATA\.kiro-account-manager\groups-tags.json"

if (Test-Path $accountsPath) {
    $accounts = Get-Content $accountsPath -Raw | ConvertFrom-Json
    Write-Host "   ✓ 账号数据文件存在，共 $($accounts.Count) 个账号" -ForegroundColor Green
} else {
    Write-Host "   ✗ 账号数据文件不存在！" -ForegroundColor Red
    exit
}

if (Test-Path $tagsPath) {
    $tagsData = Get-Content $tagsPath -Raw | ConvertFrom-Json
    Write-Host "   ✓ 标签数据文件存在，共 $($tagsData.tags.Count) 个标签" -ForegroundColor Green
} else {
    Write-Host "   ✗ 标签数据文件不存在！" -ForegroundColor Red
}

Write-Host ""

# 2. 检查标签引用完整性
Write-Host "2. 检查标签引用完整性..." -ForegroundColor Yellow
$tagIds = $tagsData.tags | ForEach-Object { $_.id }
$invalidRefs = @()
$accounts | ForEach-Object {
    $acc = $_
    if ($acc.tagLinks) {
        $acc.tagLinks | ForEach-Object {
            if ($tagIds -notcontains $_.tagId) {
                $invalidRefs += [PSCustomObject]@{
                    Email = $acc.email
                    TagId = $_.tagId
                }
            }
        }
    }
}

if ($invalidRefs.Count -gt 0) {
    Write-Host "   ✗ 发现 $($invalidRefs.Count) 个无效标签引用" -ForegroundColor Red
    $invalidRefs | Format-Table -AutoSize
} else {
    Write-Host "   ✓ 所有标签引用都有效" -ForegroundColor Green
}

Write-Host ""

# 3. 检查账号数据结构
Write-Host "3. 检查账号数据结构..." -ForegroundColor Yellow
$sampleAccount = $accounts[0]
$requiredFields = @('id', 'email', 'status', 'provider', 'addedAt')
$missingFields = @()
foreach ($field in $requiredFields) {
    if (-not $sampleAccount.PSObject.Properties[$field]) {
        $missingFields += $field
    }
}

if ($missingFields.Count -gt 0) {
    Write-Host "   ✗ 缺少必需字段: $($missingFields -join ', ')" -ForegroundColor Red
} else {
    Write-Host "   ✓ 账号数据结构完整" -ForegroundColor Green
}

Write-Host ""

# 4. 统计账号状态
Write-Host "4. 统计账号状态..." -ForegroundColor Yellow
$statusCount = @{}
$accounts | ForEach-Object {
    $status = $_.status
    if ($statusCount.ContainsKey($status)) {
        $statusCount[$status]++
    } else {
        $statusCount[$status] = 1
    }
}

foreach ($status in $statusCount.Keys) {
    Write-Host "   - $status : $($statusCount[$status]) 个" -ForegroundColor Cyan
}

Write-Host ""

# 5. 检查浏览器 localStorage
Write-Host "5. 检查浏览器筛选状态..." -ForegroundColor Yellow
Write-Host "   请在浏览器控制台（F12）执行以下命令:" -ForegroundColor White
Write-Host ""
Write-Host "   // 查看当前筛选状态" -ForegroundColor Gray
Write-Host "   console.log('viewMode:', localStorage.getItem('accountViewMode'))" -ForegroundColor Gray
Write-Host "   console.log('selectedGroup:', localStorage.getItem('selectedGroup'))" -ForegroundColor Gray
Write-Host "   console.log('selectedTag:', localStorage.getItem('selectedTag'))" -ForegroundColor Gray
Write-Host "   console.log('selectedStatus:', localStorage.getItem('selectedStatus'))" -ForegroundColor Gray
Write-Host ""
Write-Host "   // 如果发现异常值，清空 localStorage" -ForegroundColor Gray
Write-Host "   localStorage.clear()" -ForegroundColor Gray
Write-Host "   location.reload()" -ForegroundColor Gray
Write-Host ""

# 6. 检查前端控制台错误
Write-Host "6. 检查前端错误..." -ForegroundColor Yellow
Write-Host "   请打开浏览器控制台（F12），查看是否有 JavaScript 错误" -ForegroundColor White
Write-Host "   特别注意红色的错误信息" -ForegroundColor White
Write-Host ""

# 7. 建议操作
Write-Host "=== 建议操作 ===" -ForegroundColor Cyan
Write-Host "1. 在浏览器控制台执行 localStorage.clear() 清空筛选状态" -ForegroundColor Yellow
Write-Host "2. 刷新页面（Ctrl+R 或 F5）" -ForegroundColor Yellow
Write-Host "3. 检查浏览器控制台是否有 JavaScript 错误" -ForegroundColor Yellow
Write-Host "4. 如果仍然为空，尝试重启应用" -ForegroundColor Yellow
Write-Host ""

Write-Host "诊断完成！" -ForegroundColor Green
