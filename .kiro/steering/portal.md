---
inclusion: always
---

# Portal 规范

## 目录结构

官网和 API 服务在 `portal/` 目录下。

## 公告管理

公告内容在 `portal/api/announcement.ts` 中配置。

修改公告后需要重新部署：
```powershell
cd portal && vercel --prod
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

- `/` - 项目官网首页
- `/api-test.html` - API 测试页面

## API 端点

- `/api/announcement` - GET 获取公告列表
- `/api/usage` - POST 获取账号配额
- `/api/refresh` - POST 刷新 Token
