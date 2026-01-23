import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function Home() {
  return (
    <div className="bg-dark text-gray-100 min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="animate-float mb-8">
            <img 
              src="https://raw.githubusercontent.com/hj01857655/kiro-account-manager/main/src-tauri/icons/128x128.png" 
              alt="Logo" 
              className="w-24 h-24 mx-auto" 
            />
          </div>
          <h1 className="text-5xl font-bold mb-4">
            <span className="gradient-text">Kiro Account Manager</span>
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            智能管理 Kiro IDE 账号，一键切换，配额监控<br />
            支持 Windows 和 macOS
          </p>
          <div className="flex items-center justify-center gap-4 mb-8">
            <img src="https://img.shields.io/github/v/release/hj01857655/kiro-account-manager?label=Version&color=00d9ff&style=for-the-badge" alt="Version" />
            <img src="https://img.shields.io/github/downloads/hj01857655/kiro-account-manager/total?color=a855f7&style=for-the-badge" alt="Downloads" />
          </div>
          <div className="flex items-center justify-center gap-4">
            <a 
              href="https://github.com/hj01857655/kiro-account-manager/releases/latest" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-8 py-3 bg-gradient-to-r from-primary to-purple-500 rounded-xl font-bold hover:opacity-90 transition"
            >
              ⬇️ 立即下载
            </a>
            <a 
              href="https://github.com/hj01857655/kiro-account-manager" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-8 py-3 bg-white/10 rounded-xl font-bold hover:bg-white/20 transition"
            >
              ⭐ GitHub
            </a>
          </div>
        </div>
      </section>

      {/* 截图 */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">📸 界面预览</h2>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <img src="/screenshots/首页.webp" alt="首页" className="rounded-2xl border border-white/10 shadow-2xl hover:scale-[1.02] transition" />
            <img src="/screenshots/账号管理.webp" alt="账号管理" className="rounded-2xl border border-white/10 shadow-2xl hover:scale-[1.02] transition" />
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <img src="/screenshots/桌面授权.webp" alt="桌面授权" className="rounded-xl border border-white/10 shadow-xl hover:scale-[1.02] transition" />
            <img src="/screenshots/规则管理.webp" alt="规则管理" className="rounded-xl border border-white/10 shadow-xl hover:scale-[1.02] transition" />
            <img src="/screenshots/网页授权登录.webp" alt="网页授权登录" className="rounded-xl border border-white/10 shadow-xl hover:scale-[1.02] transition" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <img src="/screenshots/设置.png" alt="设置" className="rounded-xl border border-white/10 shadow-xl hover:scale-[1.02] transition" />
            <img src="/screenshots/关于.png" alt="关于" className="rounded-xl border border-white/10 shadow-xl hover:scale-[1.02] transition" />
          </div>
        </div>
      </section>

      {/* 功能 */}
      <section id="features" className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">✨ 功能特性</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '🔐', title: '多方式登录', desc: '支持 Google/GitHub/BuilderId/Enterprise，SSO Token 批量导入' },
              { icon: '🔄', title: '一键切号', desc: '无感切换 Kiro IDE 账号，自动重置机器 ID' },
              { icon: '📊', title: '配额监控', desc: '实时显示主配额/试用/奖励，订阅类型一目了然' },
              { icon: '📦', title: '批量操作', desc: '智能并发控制（10-150），批量刷新/删除/打标签' },
              { icon: '🤖', title: 'Agent 自主模式', desc: '监督模式/自动驾驶模式，余额不足自动换号' },
              { icon: '🏷️', title: '标签管理', desc: '自定义标签颜色，按标签筛选账号' },
              { icon: '🎨', title: '多主题', desc: '浅色/深色/紫色/绿色四种主题' },
              { icon: '🔌', title: 'MCP 管理', desc: 'MCP 服务器增删改查，Steering 规则编辑' },
              { icon: '🔑', title: '机器码管理', desc: '查看/复制/重置，支持 Windows/macOS/Linux' },
            ].map((feature, i) => (
              <div key={i} className="glass rounded-2xl p-6 border border-white/10">
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 下载 */}
      <section id="download" className="py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-8">📥 下载安装</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Windows */}
            <div className="glass rounded-2xl p-6 border border-white/10">
              <div className="text-4xl mb-3">🪟</div>
              <h3 className="font-bold text-xl mb-2">Windows</h3>
              <p className="text-gray-400 text-xs mb-4">Windows 10/11 (64-bit)<br />需要 WebView2</p>
              <div className="space-y-2">
                <a 
                  href="https://github.com/hj01857655/kiro-account-manager/releases/latest/download/KiroAccountManager_x64_zh-CN.msi" 
                  className="block px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition text-sm"
                >
                  下载 .msi 安装包
                </a>
              </div>
            </div>
            {/* macOS */}
            <div className="glass rounded-2xl p-6 border border-white/10">
              <div className="text-4xl mb-3">🍎</div>
              <h3 className="font-bold text-xl mb-2">macOS</h3>
              <p className="text-gray-400 text-xs mb-4">macOS 10.15+<br />Intel / Apple Silicon</p>
              <div className="space-y-2">
                <a 
                  href="https://github.com/hj01857655/kiro-account-manager/releases/latest/download/KiroAccountManager_x64.dmg" 
                  className="block px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition text-sm"
                >
                  Intel 芯片
                </a>
                <a 
                  href="https://github.com/hj01857655/kiro-account-manager/releases/latest/download/KiroAccountManager_aarch64.dmg" 
                  className="block px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition text-sm"
                >
                  Apple Silicon
                </a>
              </div>
            </div>
            {/* Linux */}
            <div className="glass rounded-2xl p-6 border border-white/10">
              <div className="text-4xl mb-3">🐧</div>
              <h3 className="font-bold text-xl mb-2">Linux</h3>
              <p className="text-gray-400 text-xs mb-4">x86_64<br />deb / AppImage</p>
              <div className="space-y-2">
                <a 
                  href="https://github.com/hj01857655/kiro-account-manager/releases/latest/download/kiro-account-manager_amd64.deb" 
                  className="block px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition text-sm"
                >
                  下载 .deb
                </a>
                <a 
                  href="https://github.com/hj01857655/kiro-account-manager/releases/latest/download/kiro-account-manager_amd64.AppImage" 
                  className="block px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition text-sm"
                >
                  下载 .AppImage
                </a>
              </div>
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-6">
            <a href="https://github.com/hj01857655/kiro-account-manager/releases" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition">
              查看所有版本 →
            </a>
          </p>
        </div>
      </section>

      {/* 相关项目 */}
      <section className="py-16 px-4 bg-gradient-to-b from-transparent to-card/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">🔗 相关项目</h2>
          <p className="text-gray-400 text-center mb-8">需要 OpenAI 兼容 API？试试 Kiro Gateway</p>
          <div className="glass rounded-2xl p-8 border border-purple-500/30">
            <div className="flex items-start gap-6">
              <div className="text-5xl">🚀</div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">
                  <a href="https://github.com/hj01857655/kiro-gateway" target="_blank" rel="noopener noreferrer" className="gradient-text hover:opacity-80 transition">
                    Kiro Gateway
                  </a>
                </h3>
                <p className="text-gray-400 mb-4">
                  基于 Rust + Axum 的高性能 Kiro API 网关，提供 OpenAI 和 Anthropic 兼容接口
                </p>
                <div className="grid md:grid-cols-2 gap-3 mb-4">
                  {[
                    '多账号轮询 + 自动 Token 刷新',
                    '流式响应 + 工具调用',
                    'OpenAI Chat Completions API',
                    'Anthropic Messages API',
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span className="text-gray-300">{item}</span>
                    </div>
                  ))}
                </div>
                <a 
                  href="https://github.com/hj01857655/kiro-gateway" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg hover:opacity-90 transition"
                >
                  <span>查看项目</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 教程与交流 */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">📚 问题解答与交流</h2>
          <p className="text-gray-400 mb-8">常见问题解答，反馈交流</p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: '📖', title: '重复问题解答', desc: '飞书云文档', url: 'https://xcn46cm1l4ir.feishu.cn/wiki/YfaAw3qnoixFJgkzTSmcgtPfntc' },
              { icon: '💬', title: 'QQ 交流群', desc: '1020204332', url: 'https://qm.qq.com/q/Vh7mUrNpa8' },
              { icon: '🐛', title: '提交 Issue', desc: '反馈问题', url: 'https://github.com/hj01857655/kiro-account-manager/issues' },
            ].map((item, i) => (
              <a 
                key={i}
                href={item.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="glass rounded-2xl p-5 border border-white/10 hover:border-primary/50 transition"
              >
                <div className="text-2xl mb-2">{item.icon}</div>
                <div className="font-bold text-primary">{item.title}</div>
                <div className="text-gray-400 text-xs mt-1">{item.desc}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
