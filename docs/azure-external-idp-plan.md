# Azure / External IdP 登录与导入实施计划

## 1. 目标

在 Kiro Account Manager 中增加官方 Kiro 0.12.333 同语义的 External IdP 支持，首要目标是 Microsoft Azure / Entra 企业账号：

1. 支持通过 Kiro 官方门户完成 Azure 在线登录。
2. 支持导入官方 `kiro-auth-token.json` 或兼容 JSON 中的 External IdP 凭据。
3. 支持标准 OAuth2 refresh token grant，并原子保存轮换后的 refresh token。
4. 支持在线解析真实 profileArn、查询额度和模型列表。
5. 支持把 External IdP 账号切换到官方 Kiro IDE。
6. 支持 KAM Gateway 使用 External IdP 账号完成正常对话。
7. 保持 External IdP 禁止签发 KSK、禁止远程注销、禁止组织超额开关的安全边界。

## 2. 官方行为基线

官方 Kiro IDE 版本：`0.12.333`。

认证标识：

```text
authMethod = external_idp
provider   = ExternalIdp
```

官方登录流程：

```text
app.kiro.dev/signin
  -> 门户按工作邮箱域名查询 /getLoginMetadata
  -> 返回 issuerUrl/clientId/scopes/audience
  -> OIDC Discovery
  -> Authorization Code + PKCE S256
  -> kiro://kiro.oauth/callback
  -> 客户 IdP token endpoint
  -> ListAvailableProfiles
  -> 保存 token 与 profile
```

已坐实约束：

- 不使用 device code。
- 不使用 client secret。
- `issuerUrl/clientId/scopes/audience` 由门户动态返回，禁止写死组织值。
- scope 缺少 `offline_access` 时必须补齐。
- refresh 时重新执行 OIDC Discovery。
- IdP 返回新 refresh token 时必须覆盖旧值；未返回时保留旧值。
- Kiro Management/Runtime 请求必须带 `TokenType: EXTERNAL_IDP`。
- `profileArn` 不在 External IdP token 文件中，必须通过 `ListAvailableProfiles` 获取。
- 官方 0.12.333 主调用路径取得但未转发 `audience`；KAM 保存该字段，默认不发送以对齐当前行为。

## 3. 数据模型

`Account` 增加以下可选字段，serde 使用 camelCase：

```text
tokenEndpoint
issuerUrl
scopes
audience
profileName
```

最小可导入字段：

```json
{
  "refreshToken": "...",
  "authMethod": "external_idp",
  "provider": "ExternalIdp",
  "issuerUrl": "https://...",
  "clientId": "...",
  "scopes": "..."
}
```

`tokenEndpoint` 可以从 OIDC Discovery 补全。`accessToken`、`expiresAt`、`profileArn`、`profileName`、`region`、`machineId` 为可选增强字段。

## 4. 模块设计

### 4.1 External IdP Provider

新增独立 provider，禁止混入 Social 或 AWS IdC：

- OIDC Discovery：解析 `authorization_endpoint` 和 `token_endpoint`。
- 登录：PKCE S256、state、固定官方回调 URI。
- token exchange：form-urlencoded，无 client secret。
- refresh：form-urlencoded，无 client secret，带已保存 scopes。
- access token 仅作为 Bearer 使用，不做 Kiro auth-service token exchange。
- 日志禁止输出 code、access token、refresh token 或完整回调 URL。

### 4.2 官方门户

门户配置从项目配置文件读取，不在业务代码中散落 URL、回调端口或路径：

- 官方门户 URL。
- 官方本地回调端口候选。
- 允许的门户回调路径。
- External IdP deep-link 回调 URI。
- External IdP profile 区域候选。

本地门户回调必须校验：

- 请求路径。
- OAuth state。
- `login_option=external_idp`。
- `issuer_url/client_id/scopes` 非空。

### 4.3 Deep Link

现有 `kiro://` 注册保持不变。等待器增加精确回调路由：

- Social：`kiro.kiroAgent/authenticate-success`
- External IdP：`kiro.oauth/callback`

收到其他 authority/path 时保留等待器并拒绝处理，避免不同认证流互相消费回调。

### 4.4 Profile 与 Kiro API

- External IdP 禁止使用 Social/BuilderId 默认 profileArn。
- 没有真实 profileArn 时，按官方配置区域调用 `ListAvailableProfiles`。
- profileArn 与命中 region 成对保存。
- Management、模型列表、Gateway Runtime 请求仅在 `authMethod=external_idp` 时增加 `TokenType: EXTERNAL_IDP`。
- Microsoft token endpoint 请求不得携带该头。

### 4.5 Kiro IDE 本地数据

读取 External IdP token 时保留全部 External IdP 字段，并从官方 `profile.json` 补充 profile。

切换到 External IdP 账号时：

1. 原子写入 `kiro-auth-token.json`，不写 `profileArn`。
2. 原子写入官方 `profile.json`。
3. 不创建 AWS IdC client registration sidecar。

### 4.6 前端

- 登录页增加 Microsoft / Azure 入口。
- JSON 导入优先根据 `authMethod/provider/tokenEndpoint` 识别 External IdP，不能用 `aor` 前缀规则拦截。
- 增加 External IdP 模板、筛选项和中英俄文案。
- 账号详情显示 External IdP 元数据，但 token 保持现有脱敏策略。
- 隐藏远程注销与组织超额操作。
- KSK 入口继续显示明确的不支持原因。

## 5. 稳定标识与并发安全

- Kiro 后端 userId 仍以 `GetUsageLimits.userInfo.userId` 为准。
- JWT `preferred_username/email/upn` 只用于显示邮箱。
- JWT `oid`，回退 `sub`，只用于派生账号级稳定 machineId。
- 禁止用会轮换的 refresh token 派生 External IdP machineId。
- refresh 写回前比较当前存储的 refresh token 与本次使用值；过期并发结果不得覆盖更新结果。

## 6. 实施阶段与提交

1. `docs(azure-auth)`：落盘实施计划和逆向边界。
2. `feat(azure-auth)`：数据模型、导入、refresh 与轮换保护。
3. `feat(azure-auth)`：官方门户、OIDC Discovery、PKCE 与 deep link。
4. `feat(azure-auth)`：profile 自动发现、Kiro API/Gateway 请求头和 IDE 切号。
5. `feat(ui)`：登录、导入、筛选、详情与 i18n。
6. `test(azure-auth)` / `docs(azure-auth)`：真实验收与最终记录。

累计三次提交或功能完成时，同时推送：

- `origin`：私人 Git 仓库。
- `github`：`aki-riko/kiro-account-manager`。

禁止推送 `upstream`。

## 7. 验证门禁

每阶段至少运行受影响模块测试。最终必须通过：

```powershell
bun test
bun x tsc --noEmit
bun run build
cargo test --manifest-path src-tauri/Cargo.toml --bin kiro-account-manager
cargo check --manifest-path src-tauri/Cargo.toml --bin kiro-account-manager
```

真实验收使用同一个 Azure 账号依次验证：

1. 官方门户登录。
2. JSON 与本地 Kiro 导入。
3. refresh token 轮换写回。
4. profileArn 和 region 自动解析。
5. 额度查询与模型列表。
6. Gateway 核心对话。
7. 切换到官方 Kiro IDE 后模型获取和对话。

在真实账号未完成上述验证前，只能声明“代码与自动化验证通过”，不能声明 Azure 登录已经端到端修好。

## 8. 基线

开发基线提交：`efde290c04a68073a333d83fc65656c695eadf21`。

开发分支：`codex/azure-external-idp`。

原工作树的 17 个未提交 Rust 改动不属于本功能，开发在独立工作树中进行，禁止暂存、提交或覆盖它们。

开始开发前基线验证：

- Bun：33 通过，0 失败。
- TypeScript：通过。
- Rust：266 通过，0 失败，1 忽略。
