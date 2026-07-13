# KSK 隔离 Kiro IDE 实施计划

## 1. 文档目的

本文档是 KAM 中实现“KSK-only 隔离 Kiro IDE”的持续执行基线。

后续开发、上下文压缩恢复、测试和代码审查均以本文档为准。任何改变安全边界、凭据落盘策略、代理协议或正式 Kiro 隔离方式的决策，都必须先更新本文档并单独提交。

## 2. 当前基线

- KAM 仓库：`D:\API\kiro-account-manager`
- 开发分支：`codex/ksk-isolated-ide`
- 上游基线：`8067e02 feat(gateway): honor OpenAI stream_options.include_usage`
- KAM 版本：`1.9.2`
- 官方 Kiro IDE 基线：`0.12.333`
- 基线修复提交：`d532fa8 chore(git): 对齐 Rust 文件行尾基线`
- 基线备份：`D:\API\.codex-backups\kiro-account-manager\20260714-003002`
- 本次数据连续性修订前的功能提交：`ef59113 docs(ksk-ide): 记录并行实测与安全边界`
- 当前安全边界：启动 KSK 隔离实例前必须完全退出所有 `Kiro.exe`；并行运行尚未验证，代码和前端均明确拒绝。

基线修复说明：仓库中 16 个 Rust 文件的提交内容是 CRLF，但 `.gitattributes` 强制 `*.rs` 使用 LF，导致刚克隆即显示修改。已通过独立纯行尾提交将 Git 索引规范化为 LF，提交后工作区为干净状态。

## 3. 目标

首版 PoC 必须实现：

1. 用户在 KAM 中输入一个有效 KSK 和目标区域。
2. 正式 Kiro 完全退出后，KAM 启动一个复用正式 user-data 和扩展目录、但使用隔离认证 HOME 的 Kiro IDE 实例。
3. 隔离 IDE 只持有无权限占位登录态，不持有真实 KSK、OAuth access token 或 refresh token。
4. 真实 KSK 只存在于 KAM Rust 后端的当前运行时内存中。
5. Kiro 原生请求通过本机 loopback 转发器发送到官方 Kiro 上游。
6. 转发器只替换认证和必须调整的 KSK 协议字段，不进行 Anthropic/OpenAI 协议转换。
7. `GenerateAssistantResponse` 的 AWS EventStream 响应按字节流返回给 IDE。
8. 正式 Kiro 的对话、工作区、历史和扩展连续可用；正式登录 token 不得被读取或修改，endpoint 设置只允许事务化临时覆盖并在停止或下次 KAM 启动时恢复。
9. 停止隔离实例后，代理监听、隔离进程、内存 KSK 和临时目录全部清理。
10. 使用同一个真实 KSK 会话验证核心聊天成功后，才允许声明 PoC 可用。

## 4. 非目标

首版不承诺：

- 创建、续期、删除或管理 KSK。
- KSK 永久保存或跨 KAM 重启恢复。
- 使用量、订阅、超额用量和支付门户可用。
- 所有自动补全、MCP、WebSearch、Profile 管理功能可用。
- 模拟完整 OAuth 登录和刷新流程。
- 修改官方 Kiro 安装目录或 `extension.js`。
- 修改系统代理、Hosts、证书信任、Nginx、FRP 或其他系统基础设施。
- 修改 `D:\API\kiro_rs`；该项目仅作为已验证的 KSK 请求行为参考。

## 5. 已坐实的技术事实

### 5.1 官方 IDE 登录门禁

官方 Kiro 认证状态仍以 `refreshToken` 是否存在作为登录判据。官方认证提供者只有 `social`、`IdC` 和 `external_idp`，没有完整接入的 `api_key` 提供者。

因此不能把 KSK 直接写入 `kiro-auth-token.json` 并期待 IDE 正常登录。隔离实例必须使用无权限占位登录态通过客户端门禁，真实认证由本地转发器完成。

### 5.2 官方 IDE 支持隔离启动参数

Kiro 自带 CLI 参数定义已确认支持：

- `--user-data-dir`
- `--extensions-dir`
- `--new-window`

隔离启动不得调用现有全局 `taskkill /IM Kiro.exe /F` 路径，必须跟踪本次启动的具体 PID 和进程树。

官方 `extension.js` 的 `TokenStorage` 已二次核对：token 路径由 `path.join(os.homedir(), ".aws", "sso", "cache")` 生成，文件名为 `kiro-auth-token.json`。因此子进程级覆盖 `HOME` 和 `USERPROFILE` 可以隔离认证文件，同时 `--user-data-dir` 仍可指向正式 `AppData/Roaming/Kiro` 以保留对话和工作区状态。

### 5.3 官方扩展支持自定义服务端点

官方扩展会读取：

- `codewhisperer.config.endpoints`
- `codewhisperer.config.krsEndpoints`
- `codewhisperer.config.cpsEndpoints`

配置项元素使用 `{ region, endpoint }`。KRS 用于 runtime/streaming 服务，CPS 用于 management 服务，通用 endpoints 用于其他 Q 服务。

### 5.4 KAM 可复用能力

KAM 已有：

- Tauri 命令和全局状态管理。
- Axum 0.8 服务端。
- Reqwest 0.12 流式客户端和 HTTP/SOCKS 代理能力。
- Tokio、Futures、Tokio Stream。
- AWS EventStream 读取与流式响应经验。
- Kiro 安装路径发现和 token 文件原子写入经验。

现有 `GatewayRuntime` 是 Anthropic/OpenAI 到 Kiro 的协议转换器，不能直接作为 IDE 原生代理，但其生命周期管理、HTTP 客户端构建和测试模式可以复用。

### 5.5 KSK runtime 请求规则

现有 `kiro-rs` 已实现并测试以下 KSK 行为：

- `Authorization: Bearer <KSK>`
- `TokenType: API_KEY`，HTTP 字段名大小写不敏感。
- API Key runtime 请求体不携带顶层 `profileArn`。
- KSK 没有 OAuth refresh token，不进入 OAuth 刷新路径。

KAM PoC 必须复用这些规则，但仍需真实 KSK 请求验证当前服务端行为。

### 5.6 官方 Windows 单实例边界与 2026-07-14 实机观察

静态逆向已确认：

- `product.json` 的 `win32MutexName` 固定为 `kiro`，不随用户目录、版本或 PID 变化。
- mutex 创建失败只记录错误，不会接管或终止另一个 Kiro 实例。
- 主实例 IPC 管道由 `userDataPath` 哈希派生；不同 `--user-data-dir` 理论上使用不同 IPC。
- 官方没有覆盖或禁用 mutex 名称的启动参数。
- Windows `taskkill /PID <pid> /T` 按系统语义只结束指定 PID 及其子进程；Kiro 源码未发现跨实例退出传播。

实机生命周期测试曾在正式 Kiro 运行时启动第二实例。隔离进程、三端口、命令行和 profile 清理验证通过后，发现测试前记录的正式根 PID 已不存在。由于当时没有保存第二实例停止瞬间的完整 PID、PPID、命令行和创建时间快照，不能坐实是 PID 识别、时序变化还是用户侧退出，禁止把这次结果解释为并行安全。

恢复正式 Kiro 后，其 token 发生正常刷新轮换，正式 settings 哈希保持不变。因此该轮测试不满足“正式 token 全程未变化”的验收条件。当前稳定处理是禁止并行启动；只有补齐精确进程快照或 Windows Job Object 隔离并重新实测后，才允许重新讨论并行能力。

## 6. 总体架构

数据流：

```text
KAM 前端
  -> Tauri start_ksk_ide 命令
  -> KskIdeRuntime 绑定动态 loopback 端口
  -> 创建隔离 HOME，复用正式 user-data / extensions
  -> 写入无权限占位 token
  -> 事务化备份并临时合并本地 endpoint 配置
  -> 启动独立 Kiro.exe

隔离 Kiro IDE
  -> Kiro 原生 AWS SDK 请求
  -> 127.0.0.1 动态端口
  -> KskIdeProxy 校验服务和操作
  -> 替换 Authorization / TokenType
  -> 按 KSK 规则调整 profileArn
  -> 官方 Kiro 上游
  -> 原生 AWS EventStream 字节流
  -> 隔离 Kiro IDE
```

模块必须与现有 `gateway` 分开，避免把原生 IDE 代理继续塞进超大的 `gateway/proxy.rs`。

## 7. 隔离配置设计

### 7.1 会话目录

目录根路径从 Tauri 应用本地数据目录动态获取，不硬编码用户路径：

```text
<app-local-data>/isolated-ide/<session-id>/
├─ home/
│  └─ .aws/sso/cache/kiro-auth-token.json
├─ settings-recovery.json
└─ settings.backup
```

`session-id` 使用随机 UUID。目录不得包含 KSK。正式数据目录不复制进临时目录：

- `--user-data-dir` 指向系统动态发现的正式 Kiro user-data。
- `--extensions-dir` 指向系统动态发现的正式 `.kiro/extensions`。
- 正式 Kiro 必须关闭，避免同一 user-data 并发写入。

### 7.2 占位登录态

占位 token 仅用于满足 IDE 客户端登录门禁：

- `accessToken`：每次会话随机生成的非敏感占位值。
- `refreshToken`：每次会话随机生成的非敏感占位值。
- `expiresAt`：从当前时间动态计算，覆盖本次测试时长但不永久有效。
- `authMethod`：使用官方已经支持的 `social` 门禁路径。
- `provider`：使用官方 social 路径可识别的 provider，仅作为客户端兼容字段。
- `profileArn`：根据用户选择区域生成语法有效、明确标识为本地占位的 ARN，仅供 IDE 解析区域。

强制约束：

- 占位 token 不得包含 KSK 的全部或部分内容。
- 占位 token 不得由 KSK 哈希派生，避免建立可关联指纹。
- 占位 `profileArn` 不得发送到官方上游；代理必须在 KSK runtime 请求中删除它。
- 不得把正式用户的 token 文件复制进隔离目录。

### 7.3 正式 settings.json 的事务化 endpoint overlay

监听器成功绑定并取得动态端口后，才对正式 `User/settings.json` 合并三个 endpoint 键。除这三个键外，不允许主动修改其他设置。

配置至少包含：

- `codewhisperer.config.endpoints`
- `codewhisperer.config.krsEndpoints`
- `codewhisperer.config.cpsEndpoints`

三类服务使用独立动态 loopback 端口，避免依靠尚未验证的 URL path prefix 区分上游服务。

恢复约束：

- 覆盖前保存原始 settings 字节备份和按键恢复 journal，恢复文件使用私有权限且不包含 KSK。
- 正常停止时，如果用户未改其他设置，必须逐字节恢复原 settings。
- 如果用户在 KSK 会话中改了其他设置，只还原三个 endpoint 键，保留其余修改。
- KAM 异常退出后，下次启动必须自动扫描 UUID 会话 journal 并恢复正式 settings。
- journal 中的目标路径必须与系统动态发现的正式 settings 路径完全一致，禁止借 journal 写入任意文件。

不得写入：

- KSK
- Authorization 头
- OAuth token
- 固定端口
- 三个 endpoint 键以外的正式设置

### 7.4 子进程环境和参数

Windows 首版启动参数：

- Kiro 可执行文件使用 KAM 已有安装路径发现逻辑。
- `USERPROFILE` 指向隔离 `home`。
- `HOME` 指向隔离 `home`。
- `--user-data-dir` 指向正式 Kiro user-data，保留对话、工作区、历史和扩展状态。
- `--extensions-dir` 指向正式 `.kiro/extensions`，保留已安装插件。
- `--new-window` 强制独立窗口。

启动前置条件：

- 两次检查系统中是否存在 `Kiro.exe`：创建隔离资源前一次，真正 spawn 前一次。
- 任一检查发现 Kiro 正在运行时明确拒绝启动，不创建可用会话。
- 当前版本禁止正式 Kiro 与 KSK 隔离 Kiro 并行运行。

不得修改 KAM 主进程环境变量；环境变量只设置在 Kiro 子进程上。

### 7.5 进程停止

- 保存 `std::process::Child` 和 PID。
- 停止时只结束该 PID 的进程树。
- 禁止调用现有全局 `kill_kiro()`。
- 在 Windows 上使用 PID 定向的进程树结束方式，不得按映像名杀进程。
- 先停止目标 Kiro 进程树和代理，再恢复正式 settings，最后清理隔离认证目录。
- 清理失败必须记录脱敏错误并向前端返回部分失败状态，禁止静默吞掉。

## 8. 本地转发器设计

### 8.1 Runtime 结构

新增独立运行时：

```rust
pub struct KskIdeRuntime {
    // KSK、监听器、关闭通道、服务任务、Kiro 子进程、隔离目录和状态
}
```

`AppState` 增加：

```rust
pub ksk_ide: Mutex<Option<KskIdeRuntime>>
```

首版只允许同时存在一个 KSK 隔离实例。重复启动必须明确报错，不能覆盖旧 runtime。

### 8.2 监听安全

- 只绑定 `127.0.0.1`，禁止绑定 `0.0.0.0`、局域网地址或 IPv6 全局地址。
- 使用端口 `0` 让操作系统分配动态端口。
- 端口不得写入普通日志。
- 每个监听器只接受对应服务的操作白名单。
- 未识别路径、方法或操作返回明确的本地拒绝响应，不得转成开放代理。
- 后续如果确认 AWS SDK 保留 endpoint path prefix，可增加每会话随机 path nonce；在真实验证前不猜测该行为。

### 8.3 请求处理

必须保留：

- HTTP 方法、请求路径和查询参数。
- 官方 IDE 生成的 `user-agent`。
- `x-amz-user-agent`。
- `amz-sdk-invocation-id`。
- `amz-sdk-request`。
- Kiro agent mode、opt-out 和其他已验证业务头。
- 原始 JSON 中与认证无关的字段。

必须删除或重建：

- `Authorization`
- `TokenType` / `tokentype`
- `Host`
- `Content-Length`
- `Connection`、`Transfer-Encoding` 等 hop-by-hop 字段

上游认证统一写入：

```text
Authorization: Bearer <KSK>
TokenType: API_KEY
```

Runtime KSK 请求体：

- 如果是 JSON 对象，删除顶层 `profileArn`。
- 不改变 `conversationState`、模型、工具、历史、上下文或其他字段。
- JSON 解析失败时不得盲目透传；返回本地错误并记录不含正文的诊断。

### 8.4 响应处理

- 保留上游状态码。
- 保留必要的内容类型和 Kiro/AWS 响应头。
- 删除 hop-by-hop 响应头和需要由 Axum 重新计算的长度头。
- 使用 `reqwest::Response::bytes_stream()` 和 Axum 流式 Body。
- `application/vnd.amazon.eventstream` 不解析、不转换、不聚合。
- 客户端断开时取消当前上游流，避免后台继续消耗 KSK。

### 8.5 服务路由策略

KRS/runtime：

- 首个允许操作为核心聊天 `GenerateAssistantResponse`。
- 其他 runtime 操作只有在真实流量中出现并确认 KSK 支持后再加入白名单。

Q/generic：

- 默认拒绝未知操作。
- MCP、WebSearch 等功能必须在真实操作名和请求结构坐实后单独开放。

CPS/management：

- 首版不假设 KSK 支持使用量、Profile、订阅或超额管理。
- 先记录脱敏操作名和失败状态。
- 如核心聊天不依赖该操作，返回明确的功能不可用响应。
- 如核心聊天被某个管理调用阻断，必须先取得同一真实会话的失败请求和日志，再设计最小兼容响应。
- 禁止凭空构造未验证的 JSON 字段。

## 9. KSK 生命周期和存储

PoC：

- 前端使用密码输入框接收 KSK。
- KSK 通过一次 Tauri IPC 请求交给 Rust 后端。
- KSK 只保存在 `KskIdeRuntime` 内存中。
- 前端启动成功后立即清空输入状态。
- 停止 runtime 后释放 KSK。
- 不写入 `accounts.json`、settings、token 文件、日志或命令行。

MVP 后续阶段：

- 如果用户确认需要跨重启保存，再接 Windows Credential Manager 或 DPAPI。
- `accounts.json` 只保存非敏感元数据和 secret reference。
- 不得直接增加明文 `kiroApiKey` 持久化。

## 10. 日志和观测

PoC 需要足够观测能力完成真实复现，但必须默认脱敏。

允许记录：

- 会话 ID 的短前缀。
- 服务类型：runtime、generic、management。
- 方法、路径、已验证的操作名。
- 上游状态码。
- 首字节耗时、总耗时、请求和响应字节数。
- 代理启动、停止和子进程退出状态。

禁止记录：

- KSK、Authorization、TokenType 值。
- 占位 access/refresh token。
- 完整请求体或 EventStream payload。
- 用户输入、提示词、文件内容、工具参数。
- settings.json 和 token 文件全文。

所有错误分支必须返回可理解的错误并写脱敏日志，禁止空 `catch` 或静默忽略。

## 11. 前端设计

在 Account Manager 增加“KSK 隔离启动”入口，不混入现有 OAuth 导入校验。

首版弹窗字段：

- KSK：密码输入框，必填，不回显。
- 区域：从后端允许区域列表选择，不允许自由输入未知区域。

显示状态：

- 未运行
- 启动中
- 运行中
- 停止中
- 部分清理失败
- 错误

可用操作：

- 启动隔离 Kiro
- 停止隔离 Kiro
- 复制脱敏诊断摘要

禁止把 KSK 放进 React Query 缓存、localStorage、sessionStorage、URL、日志或错误提示。

## 12. 预计文件清单

### 新增文件

- `src-tauri/src/ksk_ide/mod.rs`：模块导出和共享类型。
- `src-tauri/src/ksk_ide/config.rs`：区域、上游和会话配置校验。
- `src-tauri/src/ksk_ide/profile.rs`：隔离目录、占位 token 和 settings 生成。
- `src-tauri/src/ksk_ide/proxy.rs`：原生请求和 EventStream 字节转发。
- `src-tauri/src/ksk_ide/runtime.rs`：监听器、任务和关闭生命周期。
- `src-tauri/src/ksk_ide/launcher.rs`：Kiro 子进程启动、PID 跟踪和定向停止。
- `src-tauri/src/ksk_ide/security.rs`：头过滤、日志脱敏和临时数据清理辅助函数。
- `src-tauri/src/ksk_ide/settings_overlay.rs`：正式 settings 的原子覆盖、按键恢复、字节备份和崩溃 journal。
- `src-tauri/src/ksk_ide/profile/shared_data_tests.rs`：共享数据、隔离认证和恢复行为测试。
- `src-tauri/src/commands/ksk_ide_cmd.rs`：Tauri 启动、停止、状态命令。
- `src/api/kskIdeApi.ts`：前端 Tauri API 包装。
- `src/components/features/AccountManager/KskIsolatedIdeModal.tsx`：KSK 隔离启动界面。

测试优先放在对应 Rust 模块的 `#[cfg(test)]` 中；如果集成测试体积明显增大，再新增 `src-tauri/tests/ksk_ide_proxy.rs`。

### 修改文件

- `src-tauri/src/main.rs`：注册 runtime 状态和 Tauri 命令。
- `src-tauri/src/state.rs`：增加独立 `KskIdeRuntime` 状态。
- `src-tauri/src/commands/mod.rs`：导出 KSK IDE 命令模块。
- `src/components/features/AccountManager/index.tsx`：添加入口并维护弹窗状态。

首版不修改：

- `src-tauri/src/core/account.rs`
- `src/types/account.ts`
- `src/components/features/AccountManager/ImportAccountModal.tsx`
- `src-tauri/src/gateway/proxy.rs`
- 官方 Kiro 安装目录中的任何文件

## 13. 分阶段执行计划

### 阶段 0：基线与计划

状态：已完成。

- 修复克隆后的 CRLF/LF 假修改。
- 创建开发分支。
- 落盘本文档。
- 独立提交计划文档。

门禁：

- `git status --short` 只显示计划文档。
- 基线提交与计划提交分离。

### 阶段 1：代理核心与单元测试

状态：已完成。

- 建立 `ksk_ide` 模块骨架。
- 实现 loopback 动态监听。
- 实现请求头过滤和 KSK 认证注入。
- 实现 runtime 请求体顶层 `profileArn` 删除。
- 实现响应字节流透传。
- 使用本地 mock 上游验证 EventStream 字节完全一致。
- 验证未知操作不会成为开放代理。

门禁：

- 先让测试复现缺失能力，再实现通过。
- `cargo test` 中 KSK proxy 相关测试全部通过。
- 不允许加入真实 KSK 测试夹具。

### 阶段 2：隔离 Profile 与 Launcher

状态：共享数据修订与假 KSK 实机回归均已完成；真实 KSK 聊天仍待用户验收。

- 创建会话目录。
- 原子写占位 token，并对正式 settings 事务化覆盖三个 endpoint 键。
- 正式 user-data 和扩展目录直接复用，认证 HOME 独立。
- 正常停止按键恢复，异常退出由 journal 在下次 KAM 启动自动恢复。
- 验证生成文件中不存在输入 KSK。
- 使用子进程专属环境启动 Kiro。
- 跟踪 PID，不使用全局 kill。
- 停止后清理目录并报告部分失败。

门禁：

- 单元测试覆盖共享路径、认证隔离、原子写入、按键合并、逐字节恢复、崩溃恢复和 KSK 泄漏扫描。
- 手工启动前确认正式 Kiro 已完全退出，并记录正式 token/config 哈希。
- 停止隔离实例后再次核对正式 token/config 哈希。

### 阶段 3：Tauri 状态与命令

状态：已完成，包括 KAM 退出时同步清理隔离 runtime。

- 增加 `start_ksk_ide`、`stop_ksk_ide`、`get_ksk_ide_status`。
- 同时只允许一个隔离 runtime。
- KAM 退出时执行隔离 runtime 清理。
- KAM 启动时自动恢复异常退出残留的正式 Kiro endpoint 设置。
- 所有状态转换可观测并可恢复。

门禁：

- 重复启动返回明确错误。
- 未运行时停止为幂等成功或明确的未运行状态。
- runtime 启动中途失败不会残留代理任务、子进程或目录。

### 阶段 4：前端入口

状态：已完成，并明确提示当前禁止并行启动。

- 增加 KSK 隔离启动弹窗。
- 接入启动、停止、状态展示。
- 启动成功后清空前端 KSK。
- 错误信息脱敏。

门禁：

- `npm run build` 通过。
- 搜索构建源码和状态代码，确认没有 localStorage/sessionStorage 持久化 KSK。
- 不修改现有 OAuth 导入语义。

### 阶段 5：真实 KSK 验证

状态：待执行。前置条件是正式 Kiro 已完全退出。

必须使用用户提供的同一个真实 KSK 会话完成：

1. 确认正式 Kiro 未运行，记录正式 token 文件哈希和正式配置文件哈希。
2. 从 KAM 启动隔离 Kiro。
3. 用真实用户输入发起核心聊天。
4. 验证响应持续流式输出并正常结束。
5. 验证代理日志中没有 OAuth refresh 请求。
6. 验证隔离目录、命令行和日志中不存在 KSK。
7. 停止隔离 Kiro。
8. 验证代理端口关闭、进程树退出、隔离目录清理。
9. 再次核对正式 token 和配置哈希未改变。

只有以上同一真实会话全部通过，才能声明“核心聊天 PoC 已验证”。

如果失败：

- 保留脱敏 operation、状态码和时间窗口。
- 不用自造成功输入替代。
- 先补观测或定位真实失败链，再提出下一步修改。
- 修复后必须用同一个真实 KSK 和同一请求路径回归。

### 阶段 6：Review 与收尾

状态：进行中。共享数据修订的自动化门禁和新版假 KSK 生命周期已通过；安装包和真实 KSK 聊天尚未验收。

- 检查是否存在 KSK、Authorization、占位 token 泄漏。
- 检查所有错误分支是否有脱敏日志。
- 检查是否误用全局 Kiro kill。
- 检查正式用户目录只发生预期的数据写入和三个 endpoint 临时覆盖，停止后 token/settings 恢复一致。
- 检查新增文件大小、函数长度和嵌套深度。
- 完整运行后端和前端验证。
- 记录尚未支持的 management、MCP、WebSearch、自动补全能力。

2026-07-14 共享数据修订验证结果：

- `cargo test`：280 项通过，1 项显式实机测试默认忽略。
- `cargo check`：通过，仅保留既有 dead-code 警告。
- TypeScript `--noEmit`：通过。
- Bun：29 项通过，0 项失败；同步修正 5 个 API 层迁移后过期的前端测试文件。
- Vite production build：通过，1908 个模块完成转换。
- 假 KSK 实机 lifecycle：通过，耗时 19.36 秒。
- lifecycle 验证：正式 user-data、sessions 和 extensions 路径被复用；正式 token 未变化；正式 settings 停止后逐字节恢复；三个代理端口关闭；Kiro 进程退出；临时目录清理；假 KSK 未落盘。
- 首次 lifecycle 暴露真实 Windows 退出时序：5 秒门限过短，`taskkill` 在进程终止中返回 `There is no running instance of the task`。已改为单一 45 秒总截止时间，并将该实测返回视为继续等待条件；同一测试复跑通过。

## 14. 测试命令

每个 Rust 阶段至少执行：

```powershell
cd D:\API\kiro-account-manager\src-tauri
cargo test
cargo check
```

前端阶段执行：

```powershell
cd D:\API\kiro-account-manager
npm run build
```

最终完整验证：

```powershell
cd D:\API\kiro-account-manager\src-tauri
cargo test
cargo build

cd D:\API\kiro-account-manager
npm run build
```

测试失败时立即停止后续阶段，先分析根因；不得跳过或用更小范围测试冒充完整通过。

## 15. 安全验收清单

- KSK 不进入 Kiro token 文件。
- KSK 不进入 settings.json。
- KSK 不进入 Kiro 命令行。
- KSK 不进入 KAM 普通日志或错误文本。
- KSK 不进入前端持久化存储。
- KSK 不进入 Git diff、测试夹具或快照。
- 代理只绑定 loopback。
- 代理不是任意目标开放代理。
- 正式 Kiro token 始终不变，settings 在停止后恢复；无其他设置修改时字节必须完全一致。
- 正式对话、工作区、历史和扩展目录由启动参数直接复用。
- 停止操作不按进程名杀死全部 Kiro。
- 临时目录路径经过边界检查后才能清理。
- 清理失败可见，不静默忽略。

## 16. 主要风险与处理

### 风险 1：KSK 不支持某些 IDE 初始化接口

处理：首版以核心聊天为验收边界。management 操作先观测，不猜字段；只对真实阻断调用做最小兼容。

### 风险 2：占位登录态触发 OAuth refresh 或自动登出

处理：每次会话生成足够覆盖测试窗口的 `expiresAt`；代理和日志观测 refresh 调用。如果仍触发，使用真实调用链定位，不继续伪造 provider 行为。

### 风险 3：Electron 初始 PID 退出并派生新主进程

处理：记录实际进程树；PID 定向停止使用单一 45 秒总截止时间，先给 5 秒优雅期，再强制停止并等待剩余时间。实测 `taskkill` 的“no running instance”表示进程已进入终止流程，应继续等待 `Child` 退出而非立即失败。如果后续仍出现脱离 PID 树的存活进程，再升级为 Windows Job Object；不得退回按映像名 kill。

### 风险 4：本机其他进程滥用动态代理端口

处理：绑定 loopback、使用动态端口、隐藏端口、实施严格操作白名单。确认 endpoint path prefix 行为后再增加随机 path nonce。

### 风险 5：KSK 明文持久化

处理：PoC 完全不持久化。需要持久化时单独设计 Windows Credential Manager/DPAPI 阶段，不复用明文 `accounts.json`。

### 风险 6：官方 Kiro 更新改变内部配置或认证门禁

处理：启动时检查 Kiro 版本和已验证的 endpoint 配置能力。未知版本显示警告并要求重新验证，不静默假设兼容。

### 风险 7：并行 Kiro 的 PID 识别或停止时序不可靠

处理：当前版本直接拒绝并行启动。后续若恢复并行能力，必须在启动前后记录完整 PID、PPID、命令行、创建时间和 user-data 归属，并优先使用 Windows Job Object 绑定隔离进程树；在同一正式 Kiro 真实会话保持不变的实测通过前，不得移除安全闸。

### 风险 8：异常退出后正式 settings 残留 loopback endpoint

处理：覆盖前先写原始字节备份与恢复 journal；正常退出立即恢复，下次 KAM 启动再次扫描恢复。journal 目标路径和 UUID 会话目录必须双重校验，恢复失败时保留现场并明确记录错误，不静默删除备份。

## 17. 提交策略

按阶段即时提交，功能完成或累计三次提交时推送：

1. `docs`：落盘本实施计划。
2. `feat(ksk-ide)`：代理核心和单元测试。
3. `feat(ksk-ide)`：隔离 profile、launcher 和 Tauri runtime。
4. `feat(ui)`：KSK 隔离启动界面。
5. `fix(ksk-ide)`：基于真实 KSK 失败输入的必要修复。
6. `docs`：记录最终验证结果和未支持能力。

每个提交前必须根据实际 diff 生成提交说明，不把调试代码、真实 KSK 或临时日志带入提交。

## 18. 当前下一步

当前下一步按顺序执行：

1. 提交并推送私人远端。
2. 重建并安装 KAM，确认新界面明确提示“保留正式数据、只隔离凭据”。
3. 再用安装版执行一次假 KSK UI 生命周期，核对正式 token/settings、进程、端口和目录清理。
4. 最终由用户在 UI 输入真实 KSK 完成同一真实聊天链路验收；真实 KSK 不得进入聊天记录、日志、命令行或测试夹具。
