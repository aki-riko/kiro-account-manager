---
inclusion: always
---

# 项目结构

```
├── src/                      # React 前端
│   ├── main.jsx              # 应用入口
│   ├── App.jsx               # 根组件，路由管理
│   ├── i18n.jsx              # 国际化配置
│   ├── index.css             # 全局样式（Tailwind）
│   ├── assets/               # 静态资源
│   │   └── donate/           # 赞赏二维码图片
│   ├── components/           # React 组件
│   │   ├── AccountManager/   # 账号管理功能（卡片网格布局）
│   │   │   ├── index.jsx     # 主容器
│   │   │   ├── hooks/        # 自定义 hooks
│   │   │   │   ├── useAccounts.js    # 账号数据管理
│   │   │   │   └── useAccountStats.js # 账号统计
│   │   │   ├── AccountHeader.jsx     # 顶部工具栏
│   │   │   ├── AccountTable.jsx      # 卡片网格容器
│   │   │   ├── AccountCard.jsx       # 账号卡片组件（含右键菜单）
│   │   │   ├── AccountPagination.jsx # 分页控件
│   │   │   ├── AddAccountModal.jsx   # 添加账号弹窗
│   │   │   ├── ImportAccountModal.jsx # 导入账号弹窗
│   │   │   ├── EditAccountModal.jsx  # 编辑备注弹窗
│   │   │   ├── RefreshProgressModal.jsx # 刷新进度弹窗
│   │   │   └── ConfirmDialog.jsx     # 确认弹窗
│   │   ├── KiroConfig/       # Kiro 配置管理
│   │   │   ├── index.jsx     # 配置主页（Tab 切换）
│   │   │   ├── MCPPanel.jsx  # MCP 服务器面板
│   │   │   └── SteeringPanel.jsx # Steering 规则面板
│   │   ├── MCPManager/       # MCP 服务器管理
│   │   │   ├── index.jsx     # MCP 管理主页
│   │   │   ├── MCPServerCard.jsx # 服务器卡片
│   │   │   ├── AddMCPModal.jsx   # 添加弹窗
│   │   │   ├── EditMCPModal.jsx  # 编辑弹窗
│   │   │   └── MCPTemplates.js   # MCP 模板数据
│   │   ├── Home.jsx          # 首页（统计+配额）
│   │   ├── Login.jsx         # Desktop OAuth 登录页
│   │   ├── Settings.jsx      # 设置页
│   │   ├── Sidebar.jsx       # 侧边栏导航
│   │   ├── About.jsx         # 关于页
│   │   ├── UpdateChecker.jsx # 更新检查组件
│   │   ├── Watermark.jsx     # 水印组件
│   │   ├── AccountDetailModal.jsx # 账号详情弹窗
│   │   └── AuthCallback.jsx  # OAuth 回调处理
│   ├── contexts/             # React Context
│   │   ├── ThemeContext.jsx  # 主题管理（浅色/深色/紫色/绿色）
│   │   └── DialogContext.jsx # 全局弹窗管理
│   ├── locales/              # 国际化语言包
│   └── utils/                # 工具函数
│       └── accountStats.js   # 账号统计工具
│
├── src-tauri/                # Rust 后端
│   ├── src/
│   │   ├── main.rs           # Tauri 入口，命令注册
│   │   ├── commands/         # Tauri 命令处理
│   │   │   ├── mod.rs            # 模块导出
│   │   │   ├── account_cmd.rs    # 账号增删改查
│   │   │   ├── auth_cmd.rs       # 认证命令
│   │   │   ├── app_settings_cmd.rs   # 应用设置命令
│   │   │   ├── kiro_settings_cmd.rs  # Kiro IDE 设置命令
│   │   │   ├── machine_guid_cmd.rs   # 系统机器码命令
│   │   │   ├── mcp_cmd.rs        # MCP 管理命令
│   │   │   ├── proxy_cmd.rs      # 代理检测命令
│   │   │   ├── sso_import_cmd.rs # SSO Token 导入命令
│   │   │   ├── steering_cmd.rs   # Steering 规则命令
│   │   │   ├── fingerprint_cmd.rs # 指纹管理命令
│   │   │   └── update_cmd.rs     # 更新检查命令
│   │   ├── providers/        # 认证提供者实现
│   │   │   ├── mod.rs        # 模块导出
│   │   │   ├── base.rs       # 基础 trait
│   │   │   ├── factory.rs    # 提供者工厂
│   │   │   ├── social.rs     # Google/GitHub OAuth
│   │   │   └── idc.rs        # AWS IAM Identity Center
│   │   ├── kiro_portal_client.rs # Kiro Portal 客户端（获取配额）
│   │   ├── account.rs        # 账号模型和存储
│   │   ├── auth.rs           # 认证工具
│   │   ├── auth_social.rs    # 社交登录认证
│   │   ├── state.rs          # 应用状态管理
│   │   ├── kiro.rs           # Kiro IDE 集成
│   │   ├── mcp.rs            # MCP 配置管理
│   │   ├── process.rs        # 进程管理
│   │   ├── browser.rs        # 浏览器操作
│   │   ├── kiro_auth_client.rs       # Kiro 认证客户端
│   │   ├── codewhisperer_client.rs   # CodeWhisperer 客户端
│   │   ├── aws_sso_client.rs         # AWS SSO 客户端
│   │   ├── deep_link_handler.rs      # Deep Link 处理
│   │   └── steering.rs               # Steering 规则管理
│   ├── tauri.conf.json       # Tauri 配置
│   └── Cargo.toml            # Rust 依赖
│
├── docs/                     # 文档
│   ├── 开发规范文档.md       # 完整开发规范
│   ├── Kiro配置文件说明.md   # Kiro IDE 配置说明
│   ├── MCP管理功能规划.md    # MCP 功能规划
│   ├── 批量导入功能规划.md   # 批量导入规划
│   └── api/                  # API 文档
└── scripts/                  # 构建/工具脚本
    ├── check_kiro_db.py      # Kiro 数据库检查
    └── read_kiro_db.py       # Kiro 数据库读取
```

## 关键模式

### 前后端通信
使用 `invoke()` 调用 Rust 命令：
```javascript
import { invoke } from '@tauri-apps/api/core'
const accounts = await invoke('get_accounts')
```

### Tauri 命令
命令定义在 `src-tauri/src/commands/`，在 `main.rs` 中注册：
```rust
#[tauri::command]
pub fn get_accounts(state: State<AppState>) -> Vec<Account> {
    state.store.lock().unwrap().get_all()
}
```

### 组件组织
- 功能组件放在独立文件夹（如 `AccountManager/`）
- 自定义 hooks 放在 `hooks/` 子文件夹
- 共享 Context 放在 `src/contexts/`
- 账号管理采用卡片网格布局（AccountCard.jsx）

### 状态管理
- React Context 管理 UI 状态（主题、弹窗）
- Tauri AppState（Mutex 包装）管理后端状态
- 本地文件持久化存储（accounts.json、settings.json）

### 数据存储路径
- 账号数据：`%APPDATA%\.kiro-account-manager\accounts.json`
- 应用设置：`%APPDATA%\.kiro-account-manager\settings.json`
- MCP 配置：`~/.kiro/settings/mcp.json`

