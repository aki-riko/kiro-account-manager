# Kiro Account Manager

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="Logo" width="80">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="Platform">
  <img src="https://img.shields.io/github/v/release/hj01857655/kiro-account-manager?label=Version&color=green" alt="Version">
  <img src="https://img.shields.io/github/downloads/hj01857655/kiro-account-manager/total?color=brightgreen" alt="Downloads">
  <img src="https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-orange" alt="License">
  <img src="https://img.shields.io/badge/QQ群1-1020204332-12B7F5?logo=tencentqq" alt="QQ群1">
  <img src="https://img.shields.io/badge/QQ群2-1080919449-12B7F5?logo=tencentqq" alt="QQ群2">
  <img src="https://img.shields.io/badge/语言-简体中文-red" alt="语言">
</p>

<p align="center">
  <b>🚀 智能管理 Kiro IDE 账号，一键切换，配额监控</b>
</p>

<p align="center">
  🌐 <b><a href="https://kiro-website-six.vercel.app">官方网站</a></b> | 
  📥 <b><a href="#-下载">立即下载</a></b> | 
  💬 <b><a href="https://qm.qq.com/q/xi0AglEqGs">加入 QQ 2群</a></b>
</p>

> **📢 语言支持**：本项目**仅支持简体中文界面**。

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

## 💬 交流反馈

- 🐛 [提交 Issue](https://github.com/hj01857655/kiro-account-manager/issues)
- 💬 QQ 1群：[1020204332](https://qm.qq.com/q/Vh7mUrNpa8)
- 💬 QQ 2群：[1080919449](https://qm.qq.com/q/xi0AglEqGs)

---

## 📥 下载

**最新版本 v1.8.7**（发布于 2026-05-10）：请前往 [Releases](https://github.com/hj01857655/kiro-account-manager/releases/latest)（自动保持最新）

> 以下下载链接可能滞后，以 Releases 为准。

| 平台 | 架构 | 文件格式 | 下载链接 |
|------|------|---------|---------|
| 🪟 **Windows** | x64 | MSI 安装包 | [KiroAccountManager_1.8.7_x64_zh-CN.msi](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.8.7/KiroAccountManager_1.8.7_x64_zh-CN.msi) |
| 🍎 **macOS** | Intel (x64) | DMG 镜像 | [KiroAccountManager_1.8.7_x64.dmg](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.8.7/KiroAccountManager_1.8.7_x64.dmg) |
| 🍎 **macOS** | Apple Silicon (M1/M2/M3) | DMG 镜像 | [KiroAccountManager_1.8.7_aarch64.dmg](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.8.7/KiroAccountManager_1.8.7_aarch64.dmg) |
| 🐧 **Linux** | x86_64 | AppImage | [KiroAccountManager_1.8.7_amd64.AppImage](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.8.7/KiroAccountManager_1.8.7_amd64.AppImage) |
| 🐧 **Linux** | x86_64 | DEB 包 | [KiroAccountManager_1.8.7_amd64.deb](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.8.7/KiroAccountManager_1.8.7_amd64.deb) |

> **macOS 样式说明**：若出现样式显示异常，请基于当前仓库源码自行调整（我没有 macOS 设备，无法复现与调试）。

**系统要求**：
- **Windows**: Windows 10/11 (64-bit)，需要 [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (Win11 已内置)
- **macOS**: macOS 10.15+ (Catalina 及以上)
- **Linux**: x86_64 架构，需要 WebKitGTK 4.0+

**安装说明**：
- **Windows**: 双击 `.msi` 文件安装，首次运行可能需要安装 WebView2
- **macOS**: 打开 `.dmg` 文件，拖动应用到 Applications 文件夹，首次运行需要在「系统偏好设置 → 安全性与隐私」中允许
- **Linux AppImage**: 添加执行权限 `chmod +x KiroAccountManager_amd64.AppImage`，然后直接运行
- **Linux DEB**: 使用 `sudo dpkg -i KiroAccountManager_amd64.deb` 安装

---

## 🤝 赞助商

感谢以下赞助商对本项目的支持：

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://fishxcode.com/" target="_blank">
        <b>🐟 FishXCode</b>
      </a>
      <br>
      <sub>稳定的 Claude API 中转服务</sub>
    </td>
    <td align="center" width="50%">
      <a href="https://synai996.space/" target="_blank">
        <b>🤖 SynAI996</b>
      </a>
      <br>
      <sub>高性能 AI 模型 API 代理平台</sub>
    </td>
  </tr>
</table>

> 如需成为赞助商，请联系项目维护者。

---

## 💖 赞赏名单
感谢以下朋友对本项目的支持：
- 🌟 [shiro123444](https://github.com/shiro123444)

如需更新名单，请直接修改此处。

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
- 封禁账号自动跳过，CLI 2.0 切号支持
- 🆕 余额不足自动换号

### 📦 批量操作

- JSON 导入导出、从 Kiro IDE / kiro-cli 导入
- 批量刷新 / 删除 / 打标签 / 远程注销
- 必填字段：`refreshToken`（以 `aor` 开头），详见应用内说明

### 🔌 Kiro 配置同步

一站式管理 Kiro IDE 的所有配置项：
- **MCP 服务器** - 增删改查、启用/禁用、autoApprove、环境变量
- **Steering 规则** - 四种 inclusion 模式、Markdown 编辑
- **Hooks / Skills / Custom Agents / Powers** - 完整 CRUD 支持

### ⚙️ 系统设置

- 四种界面主题（浅色 / 深色 / 紫色 / 绿色）
- AI 模型锁定、Agent 自主模式（监督 / 自动驾驶）
- Token 自动刷新、隐私模式、代理配置

### 🌐 Kiro API 网关

内置 OpenAI 兼容的 API 网关，支持第三方工具（Cursor、Continue、Cline 等）直接接入。

- 兼容 Anthropic `/v1/messages`、OpenAI `/v1/responses`、`/v1/chat/completions`
- 🆕 模型智能降级（Free 用户自动降到可用模型）
- 🆕 多账号负载均衡（轮询、健康检测、429 自动切换）
- OpenAI GPT → Claude 模型映射，模型别名简写
- 客户端 API Key 鉴权、IP 白名单、请求日志

---

## 📸 截图

![首页](screenshots/首页.webp)
![账号管理](screenshots/账号管理.webp)
![桌面授权](screenshots/桌面授权.webp)
![规则管理](screenshots/规则管理.webp)
![设置](screenshots/设置.png)
![关于](screenshots/关于.png)

---

## ❓ 常见问题

**Q: 切换账号时提示 "bearer token invalid"**

A: Token 过期了，切换前先点「刷新」按钮。这是 Kiro 服务端返回的错误，不是管理器的问题。

**Q: 刷新 Token 失败**

A: 网络超时，手动再刷新一次或换个网络试试。

**Q: macOS 打开应用提示"已损坏，无法打开"**

A: 把应用拖到 `/Applications` 后执行：

```bash
xattr -cr /Applications/KiroAccountManager.app
```

然后重新打开应用即可。

**Q: 点击关闭按钮后，应用为什么没有退出？**

A: 主窗口会隐藏到系统托盘继续后台运行。点击托盘图标菜单中的「退出应用」可彻底退出。

**Q: Windows MSI 安装时提示"已安装相同版本"**

A: v1.8.3+ 支持同版本覆盖升级，直接继续安装即可。如果仍有问题，可以先卸载旧版本再安装。

---

## 📝 源码说明

本仓库源码会持续同步更新；如仅需安装包，请前往 Releases。

**⚠️ 本项目永久免费！如果有人向你收费，你被骗了！**

### 🔨 自行编译

**前置要求**：
- Node.js 20+
- Rust 工具链（通过 [rustup](https://rustup.rs/) 安装）
- 系统依赖：
  - Windows: WebView2（Win11 已内置）
  - macOS: Xcode Command Line Tools
  - Linux: `libwebkit2gtk-4.1-dev libappindicator3-dev`

**编译步骤**：
```bash
git clone https://github.com/hj01857655/kiro-account-manager.git
cd kiro-account-manager
npm install
npm run tauri dev    # 开发模式
npm run tauri build  # 构建发行版
```

---

## 💖 赞助

如果这个项目对你有帮助，可以请作者喝杯咖啡 ☕

<p align="center">
  <img src="src/assets/donate/wechat.jpg" alt="微信" width="200">
  <img src="src/assets/donate/alipay.jpg" alt="支付宝" width="200">
</p>

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=hj01857655/kiro-account-manager&type=Date)](https://star-history.com/#hj01857655/kiro-account-manager&Date)

---

## 📄 许可证

[CC BY-NC-SA 4.0](LICENSE) - **禁止商业使用**

## ⚠️ 免责声明

本软件仅供学习交流使用，**严禁商业用途**。使用本软件所产生的任何后果由用户自行承担。

---

<p align="center">Made with ❤️ by hj01857655</p>

<p align="center"><sub>最后更新：2026-05-10 | 版本：v1.8.7</sub></p>
