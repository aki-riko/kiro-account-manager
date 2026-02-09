# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kiro Account Manager is a Tauri-based desktop application for managing Kiro IDE accounts. It supports multi-account switching, quota monitoring, and automated account management across Windows, macOS, and Linux platforms. The application is Chinese-only (simplified Chinese interface).

**Key Features:**
- Multi-account management with OAuth (Google/GitHub) and AWS IAM Identity Center (IdC) authentication
- Account switching with machine ID management
- Quota monitoring and automatic account switching when quota is low
- Tag and group organization for accounts
- MCP (Model Context Protocol) server configuration
- Steering rules management
- Import/export accounts from JSON or kiro-cli SQLite database

## Development Commands

### Frontend (React + Vite)
```bash
npm run dev              # Start Vite dev server (port 1420)
npm run build            # Build frontend for production
npm run preview          # Preview production build
```

### Backend (Rust + Tauri)
```bash
npm run tauri dev        # Run Tauri app in development mode
npm run tauri build      # Build production app for current platform
```

### Internationalization (Lingui)
```bash
npm run extract          # Extract translatable strings
npm run compile          # Compile translations
```

### Release Management
```bash
npm run release          # Create new release (auto-increment)
npm run release:patch    # Patch version bump (1.8.1 -> 1.8.2)
npm run release:minor    # Minor version bump (1.8.1 -> 1.9.0)
npm run release:major    # Major version bump (1.8.1 -> 2.0.0)
npm run publish          # Run release script (PowerShell)
```

### Rust Development
```bash
cd src-tauri
cargo build              # Build Rust backend
cargo test               # Run tests
cargo clippy             # Run linter
```

## Architecture

### Tech Stack
- **Frontend**: React 18 + Vite + TailwindCSS 4 + Mantine UI
- **Backend**: Rust + Tauri 2.x
- **State Management**: Tauri's managed state with Mutex-wrapped stores
- **HTTP Client**: reqwest with custom proxy support
- **Database**: JSON files for accounts/groups/tags, SQLite for kiro-cli import

### Project Structure

```
kiro-account-manager/
├── src/                          # React frontend
│   ├── api/                      # Tauri command wrappers
│   ├── components/
│   │   ├── features/             # Page-level components (Home, AccountManager, etc.)
│   │   ├── layout/               # Layout components (Sidebar, Header)
│   │   ├── modals/               # Modal dialogs
│   │   ├── shared/               # Shared components (AuthCallback)
│   │   └── ui/                   # Reusable UI components
│   ├── contexts/                 # React contexts
│   ├── hooks/                    # Custom React hooks
│   ├── utils/                    # Frontend utilities
│   ├── routes.jsx                # Route configuration
│   └── main.jsx                  # App entry point
│
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── commands/             # Tauri command handlers
│   │   │   ├── account_cmd.rs    # Account CRUD operations
│   │   │   ├── auth_cmd.rs       # Authentication commands
│   │   │   ├── group_tag_cmd.rs  # Group/tag management
│   │   │   ├── kiro_settings_cmd.rs  # Kiro IDE settings
│   │   │   ├── machine_guid/     # Platform-specific machine ID handling
│   │   │   ├── mcp_cmd.rs        # MCP server management
│   │   │   └── steering_cmd.rs   # Steering rules management
│   │   ├── providers/            # Authentication providers
│   │   │   ├── base.rs           # AuthProvider trait
│   │   │   ├── social.rs         # Google/GitHub OAuth
│   │   │   ├── idc.rs            # AWS IAM Identity Center
│   │   │   └── factory.rs        # Provider factory
│   │   ├── account.rs            # Account/Group/Tag data models
│   │   ├── auth.rs               # Desktop auth API client
│   │   ├── auth_social.rs        # Social OAuth flow
│   │   ├── auto_switch.rs        # Auto account switching logic
│   │   ├── aws_sso_client.rs     # AWS SSO OIDC client
│   │   ├── browser.rs            # Browser detection
│   │   ├── deep_link_handler.rs  # OAuth callback handler
│   │   ├── http_client.rs        # HTTP client with proxy support
│   │   ├── kiro.rs               # Kiro IDE integration
│   │   ├── kiro_auth_client.rs   # Kiro auth API client
│   │   ├── kiro_cli_db.rs        # kiro-cli SQLite import
│   │   ├── kiro_portal_client.rs # Kiro portal API (usage/quota)
│   │   ├── mcp.rs                # MCP config management
│   │   ├── process.rs            # Kiro IDE process management
│   │   ├── state.rs              # Global app state
│   │   ├── steering.rs           # Steering rules management
│   │   └── main.rs               # Tauri app entry point
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri configuration
│
├── docs/                         # Documentation
│   ├── kiro-source-analysis/    # Kiro IDE source code analysis
│   ├── api/                      # API documentation
│   └── dev-guides/               # Development guides
│
└── locales/                      # i18n translation files (zh-CN only)
```

### Key Architectural Patterns

#### 1. Provider Pattern for Authentication
The app uses a provider pattern to abstract different authentication methods:
- **SocialProvider**: Handles Google/GitHub OAuth via desktop auth API
- **IdcProvider**: Handles AWS IAM Identity Center (BuilderId + Enterprise)
- **AuthProvider trait**: Common interface for token refresh and account verification

All providers implement the `AuthProvider` trait defined in `src-tauri/src/providers/base.rs`.

#### 2. State Management
Global state is managed via Tauri's `manage()` API with Mutex-wrapped stores:
- **AccountStore**: Persists accounts to `~/.kiro-account-manager/accounts.json`
- **GroupTagStore**: Persists groups/tags to `~/.kiro-account-manager/groups-tags.json`
- **AuthState**: In-memory authentication state (current user, tokens)
- **PendingLogin**: Temporary OAuth state during login flow

#### 3. Deep Link OAuth Flow
OAuth callbacks use custom protocol (`kiro-account-manager://`) handled by:
1. `deep_link_handler.rs`: Registers protocol and handles callbacks
2. `auth_social.rs`: Initiates OAuth flow with PKCE
3. Frontend `AuthCallback` component: Displays success/error messages

#### 4. Machine ID Management
Platform-specific machine ID handling in `src-tauri/src/commands/machine_guid/`:
- **Windows**: Registry `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`
- **macOS**: IOPlatformUUID with optional override file
- **Linux**: `/etc/machine-id` or `/var/lib/dbus/machine-id`

Used for Kiro IDE account binding and switching.

#### 5. Kiro IDE Integration
The app integrates with Kiro IDE by:
- Reading/writing `~/.kiro/config.json` for settings (proxy, model, etc.)
- Reading `~/.kiro/token.json` for current account
- Switching accounts by updating token.json and resetting machine ID
- Managing MCP servers in `~/.kiro/mcp.json`
- Managing steering rules in `~/.kiro/steering/`

## Important Implementation Details

### Account Data Model
Accounts support two authentication methods:
- **social**: Google/GitHub with `access_token`, `refresh_token`, `profile_arn`
- **IdC**: AWS IAM Identity Center with `client_id`, `client_secret`, `region`, `sso_session_id`

Enterprise accounts (IdC) may not have an `email` field; use `user_id` instead.

### Token Refresh Strategy
- Social accounts: Use desktop auth API (`/refreshToken` endpoint)
- IdC accounts: Use AWS SSO OIDC (`CreateToken` API)
- Refresh tokens are stored in accounts.json and automatically refreshed on expiry
- Failed refreshes (401, 423, 403) mark accounts as banned

### Proxy Support
The app supports HTTP proxies configured in settings:
- Auto-detect system proxy (Windows registry, macOS/Linux env vars)
- Custom proxy URL (http://host:port)
- TUN mode detection (checks for 198.18.0.0/15 routes)
- Proxy is applied to both Rust HTTP client and Kiro IDE config

### Account Switching Flow
1. User selects account to switch to
2. App checks if Kiro IDE is running (prompts to close if needed)
3. Reads current machine ID or generates new one (random/bound mode)
4. Updates `~/.kiro/token.json` with new account's tokens
5. Resets system machine ID (if enabled in settings)
6. Syncs proxy and model settings to Kiro IDE config

### Auto Account Switching
When enabled, the app monitors quota usage and automatically switches accounts:
1. Periodically checks current account's usage via Kiro portal API
2. If usage exceeds threshold (e.g., 90%), switches to next available account
3. Skips banned accounts and accounts with expired tokens
4. Configurable check interval and threshold in settings

## Data Storage Locations

- **Accounts**: `~/.kiro-account-manager/accounts.json`
- **Groups/Tags**: `~/.kiro-account-manager/groups-tags.json`
- **App Settings**: `~/.kiro-account-manager/settings.json`
- **Usage History**: `~/.kiro-account-manager/usage-history.json`
- **Machine ID Bindings**: `~/.kiro-account-manager/machine-bindings.json`
- **Kiro IDE Config**: `~/.kiro/config.json`
- **Kiro IDE Token**: `~/.kiro/token.json`
- **MCP Config**: `~/.kiro/mcp.json`
- **Steering Rules**: `~/.kiro/steering/*.json`

## Testing and Debugging

### Frontend Debugging
- Dev server runs on `http://localhost:1420`
- React DevTools available in development mode
- Console logs are stripped in production builds (terser config)

### Backend Debugging
- Rust logs filtered to `kiro_account_manager::*` only (see `setup_log_plugin()`)
- Use `log::debug!()`, `log::info!()`, etc. for logging
- Logs visible in terminal when running `npm run tauri dev`

### Testing OAuth Flow
1. Run app in dev mode: `npm run tauri dev`
2. Navigate to "桌面授权" (Desktop OAuth) page
3. Click provider button (Google/GitHub/BuilderId/Enterprise)
4. Browser opens for OAuth consent
5. After consent, redirects to `kiro-account-manager://callback?code=...`
6. App handles callback and adds account

## Common Pitfalls

1. **Machine ID Reset Requires Admin**: On Windows, resetting machine ID requires admin privileges. The app will prompt for elevation if needed.

2. **Kiro IDE Must Be Closed**: Account switching fails if Kiro IDE is running. Always check `is_kiro_ide_running()` before switching.

3. **Token Expiry**: Access tokens expire after ~1 hour. Always check `expires_at` and refresh if needed before API calls.

4. **Enterprise Account Differences**: Enterprise accounts don't have `email` field. Use `user_id` for identification and `is_enterprise()` helper.

5. **Proxy Configuration**: Proxy changes require restarting Kiro IDE to take effect. The app syncs proxy to Kiro config but doesn't restart IDE automatically.

6. **Deep Link Protocol**: In development on Windows, use `kiro-account-manager-dev://` protocol. Production uses `kiro-account-manager://`.

## Related Projects

- **kiro-gateway**: OpenAI/Anthropic-compatible API gateway for Kiro accounts (separate repository)
