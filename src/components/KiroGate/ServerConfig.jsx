import { useState, useEffect } from 'react'
import { Copy, Check, Play, Square, Loader2 } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../hooks/useApp'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { useKiroGateTokens } from '../../hooks/useKiroGateTokens'

const DEFAULT_PORT = 8000
const PORT_OPTIONS = [8000, 8080, 8888, 9000, 9090, 3000, 3001, 5000]

function ServerConfig() {
  const { colors } = useApp()
  const { settings, updateSettings } = useAppSettings()
  const { tokens } = useKiroGateTokens()
  
  const [port, setPort] = useState(DEFAULT_PORT)
  const [proxyKey, setProxyKey] = useState('')
  const [serverStatus, setServerStatus] = useState({ running: false, port: 0, url: '' })
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (settings) {
      setPort(settings.kiroGatePort || DEFAULT_PORT)
      setProxyKey(settings.kiroGateProxyKey || '')
    }
  }, [settings])

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
    if (!proxyKey) return alert('请先设置 PROXY_API_KEY')
    setLoading(true)
    try {
      const status = await invoke('start_kiro_gate', { params: { port, proxy_api_key: proxyKey } })
      setServerStatus(status)
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

  return (
    <div className="space-y-5">
      {/* 状态卡片 */}
      <div className="grid grid-cols-3 gap-4">
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
              placeholder="设置代理密钥" className={`w-full px-4 py-2.5 border rounded-xl ${colors.text} ${colors.input} disabled:opacity-50`} />
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

        <button onClick={serverStatus.running ? stopServer : startServer} disabled={loading || (!serverStatus.running && !proxyKey)}
          className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
            serverStatus.running ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' :
            proxyKey ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white' : `${colors.card} ${colors.textMuted} cursor-not-allowed`
          }`}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : serverStatus.running ? <><Square size={18} />停止服务器</> : <><Play size={18} />启动服务器</>}
        </button>
      </div>
    </div>
  )
}

export default ServerConfig
