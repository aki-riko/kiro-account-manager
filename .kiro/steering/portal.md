---
inclusion: always
---

# Portal 规范

## ⚠️ 重要变更

**官网已迁移到独立仓库**：
- **仓库地址**：`https://github.com/hj01857655/kiro-website`（私有）
- **技术栈**：React 18 + Vite + Tailwind CSS + React Router
- **部署平台**：Vercel

## 目录结构

官网项目在独立仓库 `kiro-website` 中，不再位于 `portal/` 目录。

```
kiro-website/
├── src/
│   ├── components/      # React 组件
│   ├── pages/          # 页面（Home、Gateway）
│   ├── main.jsx        # 入口文件
│   └── index.css       # 样式
├── api/                # Vercel Serverless Functions
│   ├── announcement.ts # 公告 API
│   ├── usage.ts        # 配额查询 API
│   └── refresh.ts      # Token 刷新 API
├── public/             # 静态资源
├── vite.config.js      # Vite 配置
└── vercel.json         # Vercel 配置
```

## 开发流程

### 本地开发

```powershell
# 克隆仓库（工作区外）
git clone https://github.com/hj01857655/kiro-website.git

# 安装依赖
cd kiro-website
npm install

# 启动开发服务器
npm run dev
```

### 构建

```powershell
npm run build
```

### 部署

```powershell
vercel --prod
```

## 公告管理

公告内容在 `api/announcement.ts` 中配置。

修改公告后需要重新部署：
```powershell
cd kiro-website
vercel --prod
```

## 公告字段说明

- `id` - 公告唯一标识，改变此值会让所有用户重新看到公告
- `enabled` - 是否启用
- `title` - 标题
- `content` - 内容数组（每项一段）
- `officialUrl` - 官方开源地址
- `qqGroup` - 开源交流群号
- `qqGroupUrl` - 开源交流群链接
- `buyGroup` - 续杯交流群名称
- `buyGroupUrl` - 续杯交流群链接
- `buyUrl` - 在线购买链接

## 页面

- `/` - 项目官网首页（Kiro Account Manager）
- `/gateway` - Kiro Gateway 页面

## API 端点

- `/api/announcement` - GET 获取公告列表
- `/api/usage` - POST 获取账号配额
- `/api/refresh` - POST 刷新 Token

## 访问方式

由于官网在工作区外，必须使用 PowerShell 访问：

```powershell
# 读取文件
Get-Content "E:\VSCodeSpace\Kiro\kiro-website\src\pages\Home.jsx" -Raw

# 列出文件
Get-ChildItem "E:\VSCodeSpace\Kiro\kiro-website\src"

# 搜索内容
Select-String -Path "E:\VSCodeSpace\Kiro\kiro-website\src\**\*.jsx" -Pattern "关键词"
```
