# Bug Patrol Tracker

- 当前基线：`d16dc11`
- 当前任务：修复 KAM 上游已有的 15 个基线测试失败
- 工作分支：`codex/kam-baseline-tests`
- 状态：排查完成，正在执行修复

## 当前问题

- [P1] UsageDetails 未读取 WithPrecision 配额字段
- [P1] Responses 路由不能兼容 Chat messages 载荷
- [P1] tool_choice 原始名称与 Kiro camelCase 工具名校验不一致
- [P2] converter history 测试仍依赖 sanitize 前的固定索引
- [P2] 模型、缓存、日志、配置和 token 测试未跟随现行契约
- [P2] messages 真实 HTTP 鉴权测试使用了未注册的 `/messages` 路径

## 验收条件

- `cargo test --bin kiro-account-manager`：239/239 通过
- 不混入 `src-tauri/src/ksk_ide/` 和主工作区 `main.rs` 改动
- 每组修改定向测试通过后提交
