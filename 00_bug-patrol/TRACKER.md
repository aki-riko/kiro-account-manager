# Bug Patrol Tracker

- 当前基线：`d20497e`
- 当前任务：修复 KSK 隔离 Kiro 的模型列表被本地代理拒绝
- 工作分支：`codex/ksk-isolated-ide`
- 状态：修复中

## 当前问题

- [P1] KSK 隔离 Kiro 的 `ListAvailableModels` 管理面请求被白名单拒绝，官方 SDK 回退为空模型列表 — 已确认

## 当前会话

- [2026-07-14 KSK 隔离 IDE 模型不可选择](sessions/2026-07-14_KSK隔离IDE模型不可选择.md)

## 已修复问题

- [P1] UsageDetails 未读取 WithPrecision 配额字段 — `32a42ec`
- [P1] Responses 路由不能兼容 Chat messages 载荷 — `c305bbe`
- [P1] tool_choice 原始名称与 Kiro camelCase 工具名校验不一致 — `c305bbe`
- [P2] converter history 测试仍依赖 sanitize 前的固定索引 — `c305bbe`
- [P2] 模型、缓存、日志、配置和 token 测试未跟随现行契约 — `c305bbe`、`c70749b`、`a8780fb`
- [P2] messages 真实 HTTP 鉴权测试使用了未注册的 `/messages` 路径 — `a8780fb`

## 验收结果

- `cargo test --bin kiro-account-manager`：240/240 通过
- 原始 239 项基线全部通过，另新增 1 项 precision 回归测试
- 未混入 `src-tauri/src/ksk_ide/` 和主工作区 `main.rs` 改动
- 四个修复组均已完成定向测试并独立提交
- 推送 `origin/codex/kam-baseline-tests` 失败：当前 GitHub 凭据无上游仓库写权限
