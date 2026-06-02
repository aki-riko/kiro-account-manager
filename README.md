# Kiro Account Manager

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="Logo" width="80">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="Platform">
  <img src="https://img.shields.io/github/v/release/hj01857655/kiro-account-manager?label=Version&color=green" alt="Version">
  <img src="https://img.shields.io/github/downloads/hj01857655/kiro-account-manager/total?color=brightgreen" alt="Downloads">
  <img src="https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-orange" alt="License">
  <img src="https://img.shields.io/badge/Telegram-频道-2CA5E0?logo=telegram" alt="Telegram频道">
  <img src="https://img.shields.io/badge/Telegram-讨论组-2CA5E0?logo=telegram" alt="Telegram讨论组">
  <img src="https://img.shields.io/badge/语言-简体中文%20%7C%20English%20%7C%20Русский-brightgreen" alt="语言">
</p>

<p align="center">
  <b>🚀 智能管理 Kiro IDE 账号，一键切换，配额监控</b>
</p>

<p align="center">
  🌐 <b><a href="https://kiro-website-six.vercel.app">官方网站</a></b> |
  📥 <b><a href="#-下载">立即下载</a></b> |
  💬 <b><a href="https://t.me/ide520">Telegram 讨论组</a></b> |
  📚 <b><a href="README_EN.md">English</a></b> |
  📚 <b><a href="README_RU.md">Русский</a></b>
</p>

> **📢 语言支持**：本项目支持**简体中文、English、Русский**三种语言界面。

---

## 🏗️ 项目概览

Kiro Account Manager 是一个基于 **Tauri 2.x** 的桌面应用，用于集中管理 **Kiro IDE** 账号与本地配置。

**技术栈**：React 18 + Vite + shadcn/ui + TailwindCSS 4 | Rust + Tauri 2.x | Windows / macOS / Linux

**核心模块**：
- 账号管理：导入、导出、刷新、验证、分组、标签、远程删除
- 登录认证：Google / GitHub Social OAuth，AWS IAM Identity Center（BuilderId / Enterprise）
- Kiro 集成：切换账号、同步模型 / 代理 / MCP / Steering / Skills / Hooks / Custom Agents / Powers
- 自动化能力：Token 自动刷新、余额不足自动换号、机器 ID 绑定与重置
- 桌面端能力：Deep Link OAuth 回调、单实例、系统托盘、自动更新
- 网关能力：内置 Kiro API Gateway，支持 Anthropic Messages、OpenAI Responses、Chat Completions 与流式转发

---

## 📥 下载

**最新版本 v1.9.1**（发布于 2026-06-02）：请前往 [Releases](https://github.com/hj01857655/kiro-account-manager/releases/latest)（自动保持最新）

> 以下下载链接可能滞后，以 Releases 为准。

| 平台 | 架构 | 文件格式 | 下载链接 |
|------|------|---------|---------|
| 🪟 **Windows** | x64 | MSI 安装包 | [KiroAccountManager_1.9.1_x64_zh-CN.msi](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.9.1/KiroAccountManager_1.9.1_x64_zh-CN.msi) |
| 🍎 **macOS** | Intel (x64) | DMG 镜像 | [KiroAccountManager_1.9.1_x64.dmg](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.9.1/KiroAccountManager_1.9.1_x64.dmg) |
| 🍎 **macOS** | Apple Silicon (M1/M2/M3) | DMG 镜像 | [KiroAccountManager_1.9.1_aarch64.dmg](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.9.1/KiroAccountManager_1.9.1_aarch64.dmg) |
| 🐧 **Linux** | x86_64 | AppImage | [KiroAccountManager_1.9.1_amd64.AppImage](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.9.1/KiroAccountManager_1.9.1_amd64.AppImage) |
| 🐧 **Linux** | x86_64 | DEB 包 | [KiroAccountManager_1.9.1_amd64.deb](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.9.1/KiroAccountManager_1.9.1_amd64.deb) |

> **macOS 样式说明**：若出现样式显示异常，请基于当前仓库源码自行调整（我没有 macOS 设备，无法复现与调试）。

**系统要求**：
- **Windows**: Windows 10/11 (64-bit)，需要 [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (Win11 已内置)
- **macOS**: macOS 10.15+ (Catalina 及以上)
- **Linux**: x86_64 架构，需要 WebKitGTK 4.0+

**安装说明**：
- **Windows**: 双击 `.msi` 文件安装
- **macOS**: 打开 `.dmg`，拖动到 Applications，首次运行在「安全性与隐私」中允许
- **Linux AppImage**: `chmod +x` 后直接运行
- **Linux DEB**: `sudo dpkg -i` 安装

---

## 📸 截图

![首页](screenshots/首页.png)
![账号管理](screenshots/账号管理.png)
![在线登录](screenshots/在线登录.png)
![规则管理](screenshots/规则管理.png)
![会话管理](screenshots/会话管理.png)
![Kiro API 反代](screenshots/Kiro2API.png)
![设置](screenshots/设置.png)
![关于](screenshots/关于.png)

---

## ✨ 核心功能

### 🔐 登录认证
- **Social 登录**：Google / GitHub OAuth，自动刷新 Token
- **IdC 登录**：BuilderId / Enterprise，完整 SSO OIDC 流程

### 📊 账号管理
- 卡片 / 列表双视图，配额进度条，订阅类型标识
- 封禁检测、Token 过期倒计时、状态高亮
- 标签与分组、高级筛选（订阅类型 / 状态 / 使用率）

### 🔄 一键切号
- 无感切换 Kiro IDE 账号，自动重置机器 ID
- 封禁账号自动跳过，余额不足自动换号

### 📦 批量操作
- JSON 导入导出、从 Kiro IDE / kiro-cli 导入
- 批量刷新 / 删除 / 打标签 / 远程注销

### 🔌 Kiro 配置同步
一站式管理：MCP 服务器、Steering 规则、Hooks、Skills、Custom Agents、Powers

### ⚙️ 系统设置
四种主题、AI 模型锁定、Agent 自主模式、Token 自动刷新、代理配置

### 🌐 Kiro API 网关
内置 OpenAI 兼容网关，支持 Cursor / Continue / Cline 等第三方工具直接接入。
- 兼容 Anthropic `/v1/messages`、OpenAI `/v1/responses`、`/v1/chat/completions`
- 模型智能降级、多账号负载均衡、API Key 鉴权

---

## ❓ 常见问题

**Q: 切换账号时提示 "bearer token invalid"**
A: Token 过期了，切换前先点「刷新」按钮。

**Q: macOS 打开应用提示"已损坏，无法打开"**
A: 执行 `xattr -cr /Applications/KiroAccountManager.app` 后重新打开。

**Q: 点击关闭按钮后应用没退出？**
A: 隐藏到系统托盘了，点托盘菜单「退出应用」可彻底退出。

**Q: Windows MSI 安装时提示"已安装相同版本"**
A: 直接继续安装即可（v1.8.3+ 支持覆盖升级）。

---

## 📝 自行编译

```bash
git clone https://github.com/hj01857655/kiro-account-manager.git
cd kiro-account-manager
npm install
npm run tauri dev    # 开发模式
npm run tauri build  # 构建发行版
```

前置要求：Node.js 20+、Rust 工具链、系统 WebView 依赖。

**⚠️ 本项目永久免费！如果有人向你收费，你被骗了！**

---

## 💬 交流反馈

- 🐛 [提交 Issue](https://github.com/hj01857655/kiro-account-manager/issues)
- 📢 Telegram 频道：[https://t.me/kiro520](https://t.me/kiro520)
- 💬 Telegram 讨论组：[https://t.me/ide520](https://t.me/ide520)

---

## 🤝 赞助商

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://fishxcode.com/" target="_blank"><b>🐟 FishXCode</b></a><br>
      <sub>稳定的 Claude API 中转服务</sub>
    </td>
    <td align="center" width="50%">
      <a href="https://synai996.space/" target="_blank"><b>🤖 SynAI996</b></a><br>
      <sub>高性能 AI 模型 API 代理平台</sub>
    </td>
  </tr>
</table>

## 💖 赞助

如果这个项目对你有帮助，可以请作者喝杯咖啡 ☕（请备注 GitHub 用户名，方便添加到赞赏名单）

<p align="center">
  <img src="src/assets/donate/wechat.jpg" alt="微信" width="200">
  <img src="src/assets/donate/alipay.jpg" alt="支付宝" width="200">
</p>

感谢赞赏：🌟 [shiro123444](https://github.com/shiro123444)

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=hj01857655/kiro-account-manager&type=Date)](https://star-history.com/#hj01857655/kiro-account-manager&Date)

---

## 📄 许可证

[CC BY-NC-SA 4.0](LICENSE) - **禁止商业使用**

本软件仅供学习交流使用，使用本软件所产生的任何后果由用户自行承担。

---

<p align="center">Made with ❤️ by hj01857655</p>
<p align="center"><sub>最后更新：2026-06-02 | 版本：v1.9.1</sub></p>
