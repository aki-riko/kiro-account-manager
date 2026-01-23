import { Link } from 'react-router-dom'

export default function Navbar({ isGateway = false }) {
  return (
    <nav className="fixed top-0 w-full z-50 glass border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src={isGateway 
              ? "https://raw.githubusercontent.com/hj01857655/kiro-gateway/main/src-tauri/icons/32x32.png"
              : "https://raw.githubusercontent.com/hj01857655/kiro-account-manager/main/src-tauri/icons/32x32.png"
            } 
            alt="Logo" 
            className="w-8 h-8" 
          />
          <span className="font-bold text-lg">
            {isGateway ? 'Kiro Gateway' : 'Kiro Account Manager'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {isGateway ? (
            <>
              <Link to="/" className="text-gray-400 hover:text-white transition">返回首页</Link>
              <a href="#features" className="text-gray-400 hover:text-white transition">功能</a>
            </>
          ) : (
            <>
              <a href="#features" className="text-gray-400 hover:text-white transition">功能</a>
              <Link to="/gateway" className="text-gray-400 hover:text-white transition">Kiro Gateway</Link>
              <a href="/tutorial.html" className="text-gray-400 hover:text-white transition">问题解答</a>
              <a href="/api-test.html" className="text-gray-400 hover:text-white transition">API 测试</a>
              <a href="https://kiro.dev/downloads" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition">Kiro官网</a>
            </>
          )}
          <a 
            href={isGateway 
              ? "https://github.com/hj01857655/kiro-gateway"
              : "https://github.com/hj01857655/kiro-account-manager"
            } 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </a>
        </div>
      </div>
    </nav>
  )
}
