import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function Gateway() {
  return (
    <div className="bg-dark text-gray-100 min-h-screen">
      <Navbar isGateway />

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="animate-float mb-8">
            <img 
              src="https://raw.githubusercontent.com/hj01857655/kiro-gateway/main/src-tauri/icons/128x128.png" 
              alt="Logo" 
              className="w-24 h-24 mx-auto" 
            />
          </div>
          <h1 className="text-5xl font-bold mb-4">
            <span className="gradient-text">Kiro Gateway</span>
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            基于 Rust + Axum 的高性能 Kiro API 网关<br />
            提供 OpenAI 和 Anthropic 兼容接口
          </p>
          <div className="flex items-center justify-center gap-4 mb-8">
            <img src="https://img.shields.io/github/v/release/hj01857655/kiro-gateway?label=Version&color=a855f7&style=for-the-badge" alt="Version" />
            <img src="https://img.shields.io/github/downloads/hj01857655/kiro-gateway/total?color=ec4899&style=for-the-badge" alt="Downloads" />
          </div>
          <div className="flex items-center justify-center gap-4">
            <a 
              href="https://github.com/hj01857655/kiro-gateway/releases/latest" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-bold hover:opacity-90 transition"
            >
              ⬇️ 立即下载
            </a>
            <a 
              href="https://github.com/hj01857655/kiro-gateway" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-8 py-3 bg-white/10 rounded-xl font-bold hover:bg-white/20 transition"
            >
              ⭐ GitHub
            </a>
          </div>
        </div>
      </section>

      {/* 特性 */}
      <section className="py-16 px-4 bg-gradient-to-b from-transparent to-card/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">✨ 为什么选择 Kiro Gateway？</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              { icon: '🚀', title: '高性能 Rust 实现', desc: '基于 Rust + Axum 构建，内存安全、并发高效。相比 Python/Node.js 实现，性能提升 10 倍以上，资源占用更低。', color: 'purple' },
              { icon: '🔄', title: '智能账号管理', desc: '多账号轮询、自动 Token 刷新、配额监控、限流跳过、过期标记。无需手动管理，全自动运行。', color: 'pink' },
              { icon: '🔌', title: '完整 API 兼容', desc: '支持 OpenAI Chat Completions API 和 Anthropic Messages API，无缝对接现有应用，无需修改代码。', color: 'purple' },
              { icon: '⚡', title: '流式响应 + 工具调用', desc: '完整支持流式响应（SSE）、工具调用、图片上传、Thinking block 解析，功能与官方 API 一致。', color: 'pink' },
            ].map((item, i) => (
              <div key={i} className={`glass rounded-2xl p-8 border border-${item.color}-500/30`}>
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 功能列表 */}
      <section id="features" className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">🎯 核心功能</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '🔐', title: '多账号轮询', desc: '支持多个 Kiro 账号轮询使用，自动切换' },
              { icon: '🔄', title: '自动 Token 刷新', desc: 'Token 过期自动刷新，无需手动维护' },
              { icon: '📊', title: '配额监控', desc: '实时监控账号配额，自动跳过限流账号' },
              { icon: '🌊', title: '流式响应', desc: '完整支持 SSE 流式响应，实时返回结果' },
              { icon: '🛠️', title: '工具调用', desc: '支持 Function Calling 和 Tool Use' },
              { icon: '🖼️', title: '图片支持', desc: '支持图片上传和多模态对话' },
              { icon: '💭', title: 'Thinking Block', desc: '解析并返回 AI 思考过程' },
              { icon: '📈', title: '统计监控', desc: '请求统计、延迟监控、日志记录' },
              { icon: '🖥️', title: 'Web 管理界面', desc: 'Tauri 桌面应用，可视化管理' },
            ].map((item, i) => (
              <div key={i} className="glass rounded-xl p-6 border border-white/10">
                <div className="text-2xl mb-2">{item.icon}</div>
                <h3 className="font-bold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 下载 */}
      <section id="download" className="py-16 px-4 bg-gradient-to-b from-transparent to-card/30">
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
                  href="https://github.com/hj01857655/kiro-gateway/releases/latest" 
                  className="block px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition text-sm"
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
                  href="https://github.com/hj01857655/kiro-gateway/releases/latest" 
                  className="block px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition text-sm"
                >
                  下载 .dmg
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
                  href="https://github.com/hj01857655/kiro-gateway/releases/latest" 
                  className="block px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition text-sm"
                >
                  下载 .deb / .AppImage
                </a>
              </div>
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-6">
            <a href="https://github.com/hj01857655/kiro-gateway/releases" target="_blank" rel="noopener noreferrer" className="hover:text-purple-400 transition">
              查看所有版本 →
            </a>
          </p>
        </div>
      </section>

      {/* 使用场景 */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">💡 使用场景</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="glass rounded-2xl p-8 border border-white/10">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="text-2xl">🤖</span>
                <span>AI 应用开发</span>
              </h3>
              <p className="text-gray-400 leading-relaxed mb-4">
                使用 OpenAI SDK 或 Anthropic SDK 开发 AI 应用，只需修改 base_url 即可接入 Kiro API，无需修改代码逻辑。
              </p>
              <div className="bg-black/30 rounded-lg p-4 text-sm font-mono">
                <span className="text-gray-500"># Python 示例</span><br />
                <span className="text-purple-400">client</span> = <span className="text-pink-400">OpenAI</span>(<br />
                &nbsp;&nbsp;<span className="text-blue-400">base_url</span>=<span className="text-green-400">"http://localhost:8080/v1"</span><br />
                )
              </div>
            </div>
            <div className="glass rounded-2xl p-8 border border-white/10">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="text-2xl">🔌</span>
                <span>第三方工具集成</span>
              </h3>
              <p className="text-gray-400 leading-relaxed mb-4">
                将 Kiro API 接入到支持 OpenAI API 的第三方工具，如 ChatBox、OpenCat、BotGem 等。
              </p>
              <div className="space-y-2">
                {[
                  'ChatBox、OpenCat 等桌面客户端',
                  'BotGem、NextChat 等 Web 应用',
                  'Cursor、Continue 等编程工具',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-green-400">✓</span>
                    <span className="text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 相关项目 */}
      <section className="py-16 px-4 bg-gradient-to-b from-transparent to-card/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">🔗 相关项目</h2>
          <p className="text-gray-400 mb-8">需要管理 Kiro 账号？试试 Kiro Account Manager</p>
          <div className="glass rounded-2xl p-8 border border-primary/30">
            <div className="flex items-start gap-6">
              <div className="text-5xl">🎯</div>
              <div className="flex-1 text-left">
                <h3 className="text-2xl font-bold mb-2">
                  <Link to="/" className="text-primary hover:opacity-80 transition">
                    Kiro Account Manager
                  </Link>
                </h3>
                <p className="text-gray-400 mb-4">
                  智能管理 Kiro IDE 账号，一键切换，配额监控，支持 Windows 和 macOS
                </p>
                <Link 
                  to="/"
                  className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-primary to-purple-500 rounded-lg hover:opacity-90 transition"
                >
                  <span>查看项目</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer repo="kiro-gateway" />
    </div>
  )
}
