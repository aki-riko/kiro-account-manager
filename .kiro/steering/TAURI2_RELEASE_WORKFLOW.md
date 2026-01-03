# Tauri 2.0 + Rust + React 私有仓库发布

## 原理

```
私有仓库（源码保密）
        ↓
GitHub Actions 虚拟机（Rust + Node.js 构建）
        ↓
公开仓库 Release（只有可执行文件）
```

## 项目结构

```
project/
├── src-tauri/          # Rust 后端
│   ├── src/
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                # React 前端
│   ├── App.tsx
│   └── ...
├── package.json
├── vite.config.ts
└── .github/workflows/
    └── release.yml     # GitHub Actions
```

## 实现步骤

### 1. 创建 Personal Access Token（PAT）

GitHub Settings:
- Developer settings → Personal access tokens → Tokens (classic)
- New token → 勾选 `repo` 权限
- 复制 token

### 2. 添加 Secret 到公开仓库

方式一（网页）：
- Settings → Secrets and variables → Actions
- New repository secret
- Name: `PAT`
- Value: 粘贴 token

方式二（gh 命令）：
```powershell
gh secret set PAT --body "your-token-here" -R owner/public-repo
```

查看已有 secret：
```powershell
gh secret list -R owner/public-repo
```

### 3. 创建 Workflow 文件

在公开仓库创建 `.github/workflows/release.yml`：

```yaml
name: Tauri Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version (e.g., v1.0.0)'
        required: true

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: windows-latest
            target: x86_64-pc-windows-msvc
            artifact: .msi
          - os: macos-15-intel
            target: x86_64-apple-darwin
            artifact: .dmg
          - os: macos-latest
            target: aarch64-apple-darwin
            artifact: .dmg
          - os: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
            artifact: .deb

    runs-on: ${{ matrix.os }}
    steps:
      # 拉取私有仓库
      - uses: actions/checkout@v3
        with:
          repository: username/private-repo
          token: ${{ secrets.PAT }}

      # 安装 Node.js
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      # 安装 Rust
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          target: ${{ matrix.target }}

      # 安装依赖
      - name: Install dependencies
        run: npm install

      # 构建 React 前端
      - name: Build React frontend
        run: npm run build

      # 构建 Tauri 应用
      - name: Build Tauri app
        run: npm run tauri build

      # 上传产物到 Release
      - name: Upload to Release
        uses: softprops/action-gh-release@v1
        with:
          token: ${{ secrets.PAT }}
          repository: username/public-repo
          tag_name: ${{ github.event.inputs.version }}
          name: Release ${{ github.event.inputs.version }}
          files: src-tauri/target/release/bundle/*/*${{ matrix.artifact }}
```

### 4. 调整 tauri.conf.json

确保构建配置正确：

```json
{
  "build": {
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  }
}
```

### 5. 更新 package.json

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "tauri": "tauri",
    "tauri build": "tauri build"
  }
}
```

## 手动触发构建

方式一（网页）：
1. 公开仓库 → Actions
2. 选择 "Tauri Release"
3. "Run workflow"
4. 输入版本号（v1.0.0）
5. 等待多平台构建完成

方式二（gh 命令）：
```powershell
gh workflow run release.yml -R owner/public-repo -f version=v1.0.0
```

查看 workflow 状态：
```powershell
gh run list -R owner/public-repo --workflow release.yml
```

查看最新构建日志：
```powershell
gh run view --log -R owner/public-repo
```

## 构建产物

| 平台 | 产物 |
|------|------|
| Linux | `*.deb` |
| macOS | `*.dmg` |
| Windows | `*.msi` |

## 环境变量（可选）

如果需要 Tauri 签名，添加 Secret：

```yaml
      - name: Build Tauri app
        env:
          TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
          TAURI_KEY_PASSWORD: ${{ secrets.TAURI_KEY_PASSWORD }}
        run: npm run tauri build
```

## 验证

构建完成后，公开仓库 Release 中有各平台的可执行文件，源码完全保密。

查看 release：
```powershell
gh release list -R owner/public-repo
```

查看某个 release 的详情和文件：
```powershell
gh release view v1.0.0 -R owner/public-repo
```

下载 release 文件：
```powershell
gh release download v1.0.0 -R owner/public-repo
```

## 常见问题

**Q: 构建时间很长？**
A: Rust 编译耗时，首次构建可能 10+ 分钟。

**Q: 如何只构建某个平台？**
A: 修改 strategy matrix，只保留需要的平台。

**Q: Windows 签名？**
A: 需要配置代码签名证书，添加到 Secrets 中。

**Q: macOS Intel 构建失败？**
A: `macos-13` 已退役，使用 `macos-15-intel` 构建 x86_64。`macos-latest` 现在是 ARM。
参考：https://github.com/actions/runner-images/issues/13046

**Q: Linux deb 安装后自动更新推送 AppImage？**
A: 已解决。deb 安装会自动检测并使用 `latest-deb.json` 更新源，AppImage 使用默认的 `latest.json`。
检测逻辑在 `src-tauri/src/commands/update_cmd.rs` 的 `detect_linux_install_type()` 函数。

**Q: Linux 登录时启动多个实例？**
A: 已解决。需要启用 `tauri-plugin-single-instance` 插件，确保 deep link 回调传递给已运行的实例而不是启动新实例。
