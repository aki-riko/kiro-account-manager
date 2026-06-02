# Kiro Account Manager

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="Logo" width="80">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="Platform">
  <img src="https://img.shields.io/github/v/release/hj01857655/kiro-account-manager?label=Version&color=green" alt="Version">
  <img src="https://img.shields.io/github/downloads/hj01857655/kiro-account-manager/total?color=brightgreen" alt="Downloads">
  <img src="https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-orange" alt="License">
  <img src="https://img.shields.io/badge/Telegram-Channel-2CA5E0?logo=telegram" alt="Telegram Channel">
  <img src="https://img.shields.io/badge/Telegram-Community-2CA5E0?logo=telegram" alt="Telegram Community">
  <img src="https://img.shields.io/badge/Languages-Chinese%20%7C%20English%20%7C%20Russian-brightgreen" alt="Languages">
</p>

<p align="center">
  <b>🚀 Smart Kiro IDE Account Management - One-click Switching, Quota Monitoring</b>
</p>

<p align="center">
  🌐 <b><a href="https://kiro-website-six.vercel.app">Official Website</a></b> | 
  📥 <b><a href="#-download">Download Now</a></b> | 
  💬 <b><a href="https://t.me/ide520">Telegram Community</a></b>
</p>

> **📢 Language Support**: This project supports **Chinese (Simplified), English, and Russian** interfaces.

---

## 🏗️ Project Overview

Kiro Account Manager is a desktop application based on **Tauri 2.x** for centralized management of **Kiro IDE** accounts and local configurations.

**Tech Stack**: React 18 + Vite + shadcn/ui + TailwindCSS 4 | Rust + Tauri 2.x | Windows / macOS / Linux

**Core Modules**:
- Account Management: Import, export, refresh, verify, grouping, tagging, remote deletion
- Login Authentication: Google / GitHub Social OAuth, AWS IAM Identity Center (BuilderId / Enterprise)
- Kiro Integration: Switch accounts, sync models / proxy / MCP / Steering / Skills / Hooks / Custom Agents / Powers
- Automation: Auto-refresh tokens, auto-switch on low balance, machine ID binding and reset
- Desktop Capabilities: Deep Link OAuth callback, single instance, system tray, auto-update
- Gateway Capabilities: Built-in Kiro API Gateway, supports Anthropic Messages, OpenAI Responses, Chat Completions and streaming forwarding

---

## 📥 Download

**Latest Version v1.9.1** (Released 2026-06-02): Please visit [Releases](https://github.com/hj01857655/kiro-account-manager/releases/latest) (auto-kept up-to-date)

> The download links below may lag behind, refer to Releases for the latest versions.

| Platform | Architecture | File Format | Download Link |
|----------|-------------|-------------|---------------|
| 🪟 **Windows** | x64 | MSI Installer | [KiroAccountManager_1.9.1_x64_zh-CN.msi](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.9.1/KiroAccountManager_1.9.1_x64_zh-CN.msi) |
| 🍎 **macOS** | Intel (x64) | DMG Image | [KiroAccountManager_1.9.1_x64.dmg](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.9.1/KiroAccountManager_1.9.1_x64.dmg) |
| 🍎 **macOS** | Apple Silicon (M1/M2/M3) | DMG Image | [KiroAccountManager_1.9.1_aarch64.dmg](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.9.1/KiroAccountManager_1.9.1_aarch64.dmg) |
| 🐧 **Linux** | x86_64 | AppImage | [KiroAccountManager_1.9.1_amd64.AppImage](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.9.1/KiroAccountManager_1.9.1_amd64.AppImage) |
| 🐧 **Linux** | x86_64 | DEB Package | [KiroAccountManager_1.9.1_amd64.deb](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.9.1/KiroAccountManager_1.9.1_amd64.deb) |

> **macOS Style Note**: If style display issues occur, please adjust based on the current repository source code (I don't have a macOS device, cannot reproduce and debug).

**System Requirements**:
- **Windows**: Windows 10/11 (64-bit), requires [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (built-in on Win11)
- **macOS**: macOS 10.15+ (Catalina and above)
- **Linux**: x86_64 architecture, requires WebKitGTK 4.0+

**Installation Instructions**:
- **Windows**: Double-click `.msi` file to install
- **macOS**: Open `.dmg`, drag to Applications, allow in "Security & Privacy" on first run
- **Linux AppImage**: Run directly after `chmod +x`
- **Linux DEB**: Install with `sudo dpkg -i`

---

## 📸 Screenshots

![Home](screenshots/首页.png)
![Account Management](screenshots/账号管理.png)
![Online Login](screenshots/在线登录.png)
![Rules Management](screenshots/规则管理.png)
![Session Management](screenshots/会话管理.png)
![Kiro API Proxy](screenshots/Kiro2API.png)
![Settings](screenshots/设置.png)
![About](screenshots/关于.png)

---

## ✨ Core Features

### 🔐 Login Authentication
- **Social Login**: Google / GitHub OAuth, automatic token refresh
- **IdC Login**: BuilderId / Enterprise, complete SSO OIDC flow

### 📊 Account Management
- Card / List dual view, quota progress bar, subscription type indicators
- Ban detection, token expiration countdown, status highlighting
- Tags and groups, advanced filtering (subscription type / status / usage rate)

### 🔄 One-click Account Switching
- Seamless Kiro IDE account switching, automatic machine ID reset
- Auto-skip banned accounts, auto-switch on low balance

### 📦 Batch Operations
- JSON import/export, import from Kiro IDE / kiro-cli
- Batch refresh / delete / tag / remote logout

### 🔌 Kiro Configuration Sync
One-stop management: MCP servers, Steering rules, Hooks, Skills, Custom Agents, Powers

### ⚙️ System Settings
Four themes, AI model locking, Agent autonomous mode, auto token refresh, proxy configuration

### 🌐 Kiro API Gateway
Built-in OpenAI-compatible gateway, supports direct integration with third-party tools like Cursor / Continue / Cline.
- Compatible with Anthropic `/v1/messages`, OpenAI `/v1/responses`, `/v1/chat/completions`
- Intelligent model degradation, multi-account load balancing, API Key authentication

---

## ❓ FAQ

**Q: "bearer token invalid" error when switching accounts**
A: Token has expired, click the "Refresh" button before switching.

**Q: macOS shows "app is damaged and can't be opened"**
A: Execute `xattr -cr /Applications/KiroAccountManager.app` and reopen.

**Q: Application doesn't exit after clicking close button?**
A: It's hidden to system tray, click "Exit App" in tray menu to completely exit.

**Q: Windows MSI shows "same version already installed"**
A: Continue installation (v1.8.3+ supports overwrite upgrade).

---

## 📝 Build from Source

```bash
git clone https://github.com/hj01857655/kiro-account-manager.git
cd kiro-account-manager
npm install
npm run tauri dev    # Development mode
npm run tauri build  # Build release
```

Prerequisites: Node.js 20+, Rust toolchain, system WebView dependencies.

**⚠️ This project is permanently free! If someone charges you, you've been scammed!**

---

## 💬 Feedback

- 🐛 [Submit Issue](https://github.com/hj01857655/kiro-account-manager/issues)
- 📢 Telegram Channel: [https://t.me/kiro520](https://t.me/kiro520)
- 💬 Telegram Community: [https://t.me/ide520](https://t.me/ide520)

---

## 🤝 Sponsors

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://fishxcode.com/" target="_blank"><b>🐟 FishXCode</b></a><br>
      <sub>Stable Claude API relay service</sub>
    </td>
    <td align="center" width="50%">
      <a href="https://synai996.space/" target="_blank"><b>🤖 SynAI996</b></a><br>
      <sub>High-performance AI model API proxy platform</sub>
    </td>
  </tr>
</table>

## 💖 Sponsorship

If this project helps you, you can buy the author a coffee ☕ (please note your GitHub username for easy addition to the sponsor list)

<p align="center">
  <img src="src/assets/donate/wechat.jpg" alt="WeChat" width="200">
  <img src="src/assets/donate/alipay.jpg" alt="Alipay" width="200">
</p>

Thanks to sponsors: 🌟 [shiro123444](https://github.com/shiro123444)

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=hj01857655/kiro-account-manager&type=Date)](https://star-history.com/#hj01857655/kiro-account-manager&Date)

---

## 📄 License

[CC BY-NC-SA 4.0](LICENSE) - **Commercial use prohibited**

This software is for learning and communication purposes only. Users are responsible for any consequences arising from the use of this software.

---

<p align="center">Made with ❤️ by hj01857655</p>
<p align="center"><sub>Last updated: 2026-06-02 | Version: v1.9.1</sub></p>