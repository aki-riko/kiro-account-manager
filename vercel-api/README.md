# Kiro API (Vercel)

Kiro 账号管理 API，部署到 Vercel Serverless Functions。

## 接口

### POST /api/refresh
刷新 Token

请求体：
```json
{
  "accessToken": "xxx",
  "sessionToken": "xxx",
  "csrfToken": "xxx",
  "idp": "Google" | "Github" | "BuilderId"
}
```

### POST /api/usage
获取配额

请求体：
```json
{
  "accessToken": "xxx",
  "idp": "Google" | "Github" | "BuilderId"
}
```

## 部署

```bash
cd vercel-api
npm install
vercel
```

## 本地测试

```bash
npm run dev
```
