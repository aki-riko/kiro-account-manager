import { useState, useEffect } from 'react'
import { Copy, Check, Play, Square, Loader2, Terminal, Trash2 } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../hooks/useApp'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { useKiroGateTokens } from '../../hooks/useKiroGateTokens'
import { useDialog } from '../../contexts/DialogContext'

const DEFAULT_PORT = 8000
const PORT_OPTIONS = [8000, 8080, 8888, 9000, 9090, 3000, 3001, 5000]

function ServerConfig() {
  const { colors } = useApp()
  const { settings, updateSettings } = useAppSettings()
  const { tokens } = useKiroGateTokens()
  const { showSuccess, showError, showConfirm } = useDialog()
  
  const [port, setPort] = useState(DEFAULT_PORT)
  const [proxyKey, setProxyKey] = useState('')
  const [serverStatus, setServerStatus] = useState({ running: false, port: 0, url: '' })
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  // Claude Code 配置状态
  const [claudeCodeConfigured, setClaudeCodeConfigured] = useState(false)
  const [claudeCodeLoading, setClaudeCodeLoading] = useState(false)
  const [apiKeys, setApiKeys] = useState([])

  useEffect(() => {
    if (settings) {
      setPort(settings.kiroGatePort || DEFAULT_PORT)
      setProxyKey(settings.kiroGateProxyKey || '')
    }
  }, [settings])

  // 加载 API Keys 和 Claude Code 配置状态
  useEffect(() => {
    const loadData = async () => {
      try {
        const [keys, claudeSettings] = await Promise.all([
          invoke('get_api_keys'),
          invoke('get_claude_code_settings')
        ])
        setApiKeys(keys || [])
        // 检查是否已配置 KiroGate
        const env = claudeSettings?.env || {}
        setClaudeCodeConfigured(!!env.ANTHROPIC_BASE_URL && env.ANTHROPIC_BASE_URL.includes('localhost'))
      } catch (e) { console.error(e) }
    }
    loadData()
  }, [])

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await invoke('get_kiro_gate_status')
        setServerStatus(status)
      } catch (e) { console.error(e) }
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 3000)
    return () => clearInterval(interval)
  }, [])

  const savePort = (v) => { const p = parseInt(v) || DEFAULT_PORT; setPort(p); updateSettings({ kiroGatePort: p }) }
  const saveProxyKey = (v) => { setProxyKey(v); updateSettings({ kiroGateProxyKey: v }) }

  const startServer = async () => {
    const finalProxyKey = proxyKey || 'default-proxy-key'
    setLoading(true)
    try {
      const status = await invoke('start_kiro_gate', { params: { port, proxy_api_key: finalProxyKey } })
      setServerStatus(status)
      if (!proxyKey) saveProxyKey(finalProxyKey)
    } catch (e) { alert('启动失败: ' + e) }
    finally { setLoading(false) }
  }

  const stopServer = async () => {
    setLoading(true)
    try { await invoke('stop_kiro_gate'); setServerStatus({ running: false, port: 0, url: '' }) }
    catch (e) { alert('停止失败: ' + e) }
    finally { setLoading(false) }
  }

  const copyUrl = async () => {
    await navigator.clipboard.writeText(serverStatus.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 一键配置 Claude Code
  const configureClaudeCode = async () => {
    if (!serverStatus.running) {
      await showError('配置失败', '请先启动 KiroGate 服务器')
      return
    }
    if (apiKeys.length === 0) {
      await showError('配置失败', '请先在「API Key」页生成一个 sk- 格式的 API Key')
      return
    }
    
    setClaudeCodeLoading(true)
    try {
      // apiKeys[0].apiKey 就是完整的 sk-xxx 格式 API Key
      const selectedKey = apiKeys[0]
      
      await invoke('configure_claude_code', {
        apiKey: selectedKey.apiKey,
        baseUrl: serverStatus.url
      })
      
      setClaudeCodeConfigured(true)
      await showSuccess('配置成功', 'Claude Code 已配置为使用 KiroGate，重启 Claude Code 生效')
    } catch (e) {
      await showError('配置失败', String(e))
    } finally {
      setClaudeCodeLoading(false)
    }
  }

  // 清除 Claude Code 配置
  const clearClaudeCodeConfig = async () => {
    const confirmed = await showConfirm('清除配置', '确定要清除 Claude Code 的 KiroGate 配置吗？')
    if (!confirmed) return
    
    setClaudeCodeLoading(true)
    try {
      await invoke('clear_claude_code_config')
      setClaudeCodeConfigured(false)
      await showSuccess('已清除', 'Claude Code 配置已清除，重启 Claude Code 生效')
    } catch (e) {
      await showError('清除失败', String(e))
    } finally {
      setClaudeCodeLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 状态卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className={`${colors.card} rounded-xl p-4 border ${colors.cardBorder} text-center`}>
          <div className="text-2xl mb-1">{serverStatus.running ? '🟢' : '⚪'}</div>
          <div className={`font-bold ${serverStatus.running ? 'text-green-400' : colors.textMuted}`}>
            {serverStatus.running ? '运行中' : '已停止'}
          </div>
          <div className={`text-xs ${colors.textMuted}`}>服务状态</div>
        </div>
        <div className={`${colors.card} rounded-xl p-4 border ${colors.cardBorder} text-center`}>
          <div className="text-2xl mb-1">🔑</div>
          <div className={`font-bold ${proxyKey ? 'text-cyan-400' : colors.textMuted}`}>
            {proxyKey ? '已配置' : '未配置'}
          </div>
          <div className={`text-xs ${colors.textMuted}`}>代理密钥</div>
        </div>
        <div className={`${colors.card} rounded-xl p-4 border ${colors.cardBorder} text-center`}>
          <div className="text-2xl mb-1">👥</div>
          <div className={`font-bold ${tokens.length > 0 ? 'text-purple-400' : colors.textMuted}`}>
            {tokens.length}
          </div>
          <div className={`text-xs ${colors.textMuted}`}>Token 数量</div>
        </div>
        <div className={`${colors.card} rounded-xl p-4 border ${colors.cardBorder} text-center`}>
          <div className="text-2xl mb-1">💻</div>
          <div className={`font-bold ${claudeCodeConfigured ? 'text-orange-400' : colors.textMuted}`}>
            {claudeCodeConfigured ? '已配置' : '未配置'}
          </div>
          <div className={`text-xs ${colors.textMuted}`}>Claude Code</div>
        </div>
      </div>

      {/* 配置表单 */}
      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={`block text-sm mb-2 ${colors.textMuted}`}>端口</label>
            <select value={port} onChange={(e) => savePort(e.target.value)} disabled={serverStatus.running}
              className={`w-full px-4 py-2.5 border rounded-xl ${colors.text} ${colors.input} disabled:opacity-50`}>
              {PORT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-sm mb-2 ${colors.textMuted}`}>PROXY_API_KEY</label>
            <input type="text" value={proxyKey} onChange={(e) => saveProxyKey(e.target.value)} disabled={serverStatus.running}
              placeholder="设置代理密钥（任意字符串）" className={`w-full px-4 py-2.5 border rounded-xl ${colors.text} ${colors.input} disabled:opacity-50`} />
            <div className={`text-xs ${colors.textMuted} mt-1`}>用于多租户模式，sk- 格式 API Key 不需要此密钥</div>
          </div>
        </div>

        {serverStatus.running && (
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
            <div className="flex items-center justify-between">
              <span className={`text-sm ${colors.textMuted}`}>服务地址</span>
              <button onClick={copyUrl} className="p-1.5 rounded-lg hover:bg-white/10">
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className={colors.textMuted} />}
              </button>
            </div>
            <code className={`block text-sm ${colors.text} mt-1`}>{serverStatus.url}</code>
          </div>
        )}

        <button onClick={serverStatus.running ? stopServer : startServer} disabled={loading}
          className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
            serverStatus.running ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' :
            'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90'
          }`}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : serverStatus.running ? <><Square size={18} />停止服务器</> : <><Play size={18} />启动服务器</>}
        </button>
      </div>

      {/* Claude Code 一键配置 */}
      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Terminal size={20} className="text-orange-400" />
            <h3 className={`font-semibold ${colors.text}`}>Claude Code 配置</h3>
          </div>
          {claudeCodeConfigured && (
            <span className="px-2 py-1 text-xs rounded-lg bg-orange-500/20 text-orange-400">已配置</span>
          )}
        </div>
        
        <p className={`text-sm ${colors.textMuted} mb-4`}>
          一键配置 Claude Code 使用 KiroGate 作为 API 代理，无需手动修改配置文件。
        </p>

        <div className="flex gap-3">
          <button 
            onClick={configureClaudeCode} 
            disabled={claudeCodeLoading || !serverStatus.running || apiKeys.length === 0}
            className={`flex-1 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
              claudeCodeConfigured 
                ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' 
                : 'bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:opacity-90'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {claudeCodeLoading ? <Loader2 size={16} className="animate-spin" /> : <Terminal size={16} />}
            {claudeCodeConfigured ? '重新配置' : '一键配置'}
          </button>
          
          {claudeCodeConfigured && (
            <button 
              onClick={clearClaudeCodeConfig}
              disabled={claudeCodeLoading}
              className={`px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50`}
            >
              <Trash2 size={16} />
              清除
            </button>
          )}
        </div>

        {!serverStatus.running && (
          <p className={`text-xs text-yellow-500 mt-2`}>⚠️ 请先启动 KiroGate 服务器</p>
        )}
        {serverStatus.running && apiKeys.length === 0 && (
          <p className={`text-xs text-yellow-500 mt-2`}>⚠️ 请先在「API Key」页生成 API Key</p>
        )}
      </div>

      {/* 使用说明 */}
      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <h3 className={`font-semibold ${colors.text} mb-3`}>使用流程</h3>
        <div className={`text-sm ${colors.textMuted} space-y-2`}>
          <p>1. 设置端口并启动服务器</p>
          <p>2. 在「Token 管理」页添加 Kiro refresh token</p>
          <p>3. 在「API Key」页生成 sk- 格式的 API Key</p>
          <p>4. 点击「一键配置」自动配置 Claude Code</p>
          <p>5. 重启 Claude Code 即可使用</p>
        </div>
      </div>
    </div>
  )
}

export default ServerConfig
