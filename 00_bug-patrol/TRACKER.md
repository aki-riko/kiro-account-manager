# Bug Patrol Tracker

- 当前基线：`131fa6f`
- 当前任务：KSK 隔离 Kiro 最终安装版验收
- 工作分支：`codex/ksk-isolated-ide`
- 状态：代码、安装和真实核心聊天已验证；最终 UI 模型下拉待用户重新输入 KSK 复核

## 当前待验收

- [P1] 最终安装版需在下一次用户 UI 输入真实 KSK 后确认模型下拉展示 15 个上游模型并完成同一路径聊天

## 当前会话

- [2026-07-14 KSK 隔离 IDE 模型不可选择](sessions/2026-07-14_KSK隔离IDE模型不可选择.md)

## 已修复问题

- [P1] KSK 隔离 Kiro 的 `ListAvailableModels` AWS JSON RPC 被白名单拒绝 — `131fa6f`
- [P2] 本地拒绝响应为纯文本，导致官方 SDK JSON 反序列化报错 — `9104c2e`
- [P1] UsageDetails 未读取 WithPrecision 配额字段 — `32a42ec`
- [P1] Responses 路由不能兼容 Chat messages 载荷 — `c305bbe`
- [P1] tool_choice 原始名称与 Kiro camelCase 工具名校验不一致 — `c305bbe`
- [P2] converter history 测试仍依赖 sanitize 前的固定索引 — `c305bbe`
- [P2] 模型、缓存、日志、配置和 token 测试未跟随现行契约 — `c305bbe`、`c70749b`、`a8780fb`
- [P2] messages 真实 HTTP 鉴权测试使用了未注册的 `/messages` 路径 — `a8780fb`

## 验收结果

- 真实 KSK management 探针：HTTP 200，返回 15 个模型，默认模型 `auto`
- 真实 KSK runtime 对话：HTTP 200，AWS EventStream 7 帧、1007 字节完整解析，助手精确返回测试标记
- 最终 Rust：261 项通过，0 项失败，1 项显式实机测试默认忽略
- 最终 Bun：29/29；TypeScript 和 Vite production build 通过
- 最终安装版假 KSK lifecycle：19.75 秒通过
- 最终 MSI 解包 EXE 与 Program Files 安装 EXE SHA256 完全一致
- 停止后 Kiro/KAM 进程、隔离目录和 endpoint 残留均为 0；正式 token/settings 恢复到启动前 SHA256
- `cargo test --bin kiro-account-manager`：240/240 通过
- 原始 239 项基线全部通过，另新增 1 项 precision 回归测试
- 未混入 `src-tauri/src/ksk_ide/` 和主工作区 `main.rs` 改动
- 四个修复组均已完成定向测试并独立提交
- 推送 `origin/codex/kam-baseline-tests` 失败：当前 GitHub 凭据无上游仓库写权限
