# 发布流程规范

## 仓库说明

- 私有仓库（源码）：`hj01857655/kiro-account-manager_dev`
- 公开仓库（构建触发）：`hj01857655/kiro-account-manager`

## 构建原理

公开仓库的 Actions workflow 会从私有仓库 dev 分支拉取源码构建。私有仓库的 workflow 有 `if: ${{ !endsWith(github.repository, '_dev') }}` 判断，打 tag 不会触发构建。

## ⚠️ 严格禁止

- ❌ 禁止使用 git push 推送源码到公开仓库
- ✅ 公开仓库只允许：打 tag 触发构建、更新 Release Notes

## 发布步骤概览

1. 版本号处理（检查失败版本、决定版本号）
2. 更新私有仓库版本号（package.json、tauri.conf.json、Cargo.toml）
3. 检查依赖变化（如有变化提示用户运行 npm install）
4. 提交推送到私有仓库
5. 私有仓库打 tag
6. 清理公开仓库（失败的 Actions、旧 tag/release）
7. 触发构建（在公开仓库打 tag）
8. 等待构建完成，更新 Release Notes
9. 验证 Release 完整性（检查 latest.json）
10. 生成 QQ 群发布文案
11. 发送 Telegram 通知（中/英/俄三语言）

## Release Notes 规则

- ❌ 禁止提及 scripts/ 目录内容
- ❌ 禁止提及 vercel-api/ 目录内容
- ❌ 禁止提及私有仓库名称
- ✅ 只写用户可见的功能、优化、修复

## 失败处理

如果发布失败，必须清理两个仓库的残留后重新发布同一版本：
- 私有仓库：删除本地和远程 tag、release、失败的 Actions
- 公开仓库：删除 tag、release、失败的 Actions

## 触发方式

使用 `.kiro/hooks/release.kiro.hook` 手动触发发布流程。
