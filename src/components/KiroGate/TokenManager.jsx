import { useState, useEffect } from 'react'
import { Trash2, Edit2, Download, Upload, RefreshCw, Loader2 } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../hooks/useApp'
import { useKiroGateTokens } from '../../hooks/useKiroGateTokens'
import TokenModal from './TokenModal'

function TokenManager() {
  const { colors } = useApp()
  const { tokens, loading: tokensLoading, addToken, updateToken, deleteToken } = useKiroGateTokens()
  
  const [showModal, setShowModal] = useState(false)
  const [editingToken, setEditingToken] = useState(null)
  const [usageMap, setUsageMap] = useState({})
  const [loadingUsage, setLoadingUsage] = useState({})
  const [refreshingAll, setRefreshingAll] = useState(false)

  // Token 列表加载完成后自动获取配额
  useEffect(() => {
    if (!tokensLoading && tokens.length > 0) {
      tokens.forEach(t => {
        if (!usageMap[t.id]) fetchUsage(t.id)
      })
    }
  }, [tokens, tokensLoading])

  const openAddModal = () => { setEditingToken(null); setShowModal(true) }
  const openEditModal = (t) => { setEditingToken(t); setShowModal(true) }

  const handleSave = async (name, refreshToken) => {
    if (editingToken) await updateToken(editingToken.id, name, refreshToken)
    else await addToken(name, refreshToken)
    setShowModal(false)
  }

  const handleBatchSave = async (tokenList) => {
    for (const t of tokenList) { await addToken(t) }
    setShowModal(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('确定删除此 Token？')) return
    await deleteToken(id)
    setUsageMap(prev => { const n = {...prev}; delete n[id]; return n })
  }

  const fetchUsage = async (tokenId) => {
    setLoadingUsage(prev => ({ ...prev, [tokenId]: true }))
    try {
      const usage = await invoke('get_kiro_gate_token_usage', { tokenId })
      setUsageMap(prev => ({ ...prev, [tokenId]: usage }))
    } catch (e) {
      setUsageMap(prev => ({ ...prev, [tokenId]: { error: String(e) } }))
    } finally {
      setLoadingUsage(prev => ({ ...prev, [tokenId]: false }))
    }
  }

  const refreshAllUsage = async () => {
    setRefreshingAll(true)
    for (const t of tokens) { await fetchUsage(t.id) }
    setRefreshingAll(false)
  }

  const handleExport = () => {
    if (tokens.length === 0) return alert('没有可导出的 Token')
    const data = tokens.map(t => ({
      name: t.name, refreshToken: t.refreshToken, authMethod: t.authMethod,
      profileArn: t.profileArn, clientId: t.clientId, clientSecret: t.clientSecret, region: t.region
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `kirogate-tokens-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  const renderUsage = (tokenId) => {
    const usage = usageMap[tokenId]
    const loading = loadingUsage[tokenId]
    
    if (loading) return <div className="flex items-center gap-1 text-xs text-blue-400"><Loader2 size={12} className="animate-spin" />加载中...</div>
    if (!usage) return <div className={`text-xs ${colors.textMuted}`}>等待加载...</div>
    
    if (usage.error) {
      const isAuth = usage.error.includes('AUTH_ERROR') || usage.error.includes('过期')
      const isBanned = usage.error.includes('BANNED')
      return (
        <div className="text-xs">
          <span className={isBanned ? 'text-red-400' : isAuth ? 'text-yellow-400' : 'text-red-400'}>
            {isBanned ? '🚫 已封禁' : isAuth ? '⚠️ Token 过期' : '❌ 获取失败'}
          </span>
          <button onClick={() => fetchUsage(tokenId)} className="ml-2 text-blue-400 hover:text-blue-300">重试</button>
        </div>
      )
    }
    
    const mainLimit = usage.usageLimit || 0, mainUsage = usage.currentUsage || 0
    const trialLimit = usage.freeTrialLimit || 0, trialUsage = usage.freeTrialUsage || 0
    const bonusLimit = usage.bonusLimit || 0, bonusUsage = usage.bonusUsage || 0
    const totalLimit = mainLimit + trialLimit + bonusLimit
    const totalUsage = mainUsage + trialUsage + bonusUsage
    const percent = totalLimit > 0 ? Math.round((totalUsage / totalLimit) * 100) : 0
    
    return (
      <div className="space-y-1">
        {usage.email && <div className={`text-xs ${colors.textMuted} truncate`} title={usage.email}>{usage.email}</div>}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(percent, 100)}%` }} />
          </div>
          <span className={`text-xs ${colors.textMuted}`}>{totalUsage}/{totalLimit}</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {mainLimit > 0 && <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">主 {mainUsage}/{mainLimit}</span>}
          {trialLimit > 0 && <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">试用 {trialUsage}/{trialLimit}</span>}
          {bonusLimit > 0 && <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">奖励 {Math.round(bonusUsage)}/{Math.round(bonusLimit)}</span>}
          {usage.daysUntilReset > 0 && <span className={`px-1.5 py-0.5 rounded ${colors.card} ${colors.textMuted}`}>{usage.daysUntilReset}天后重置</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className={`${colors.card} rounded-xl p-4 border ${colors.cardBorder} text-center`}>
        <div className="text-3xl mb-1">👥</div>
        <div className="text-2xl font-bold text-purple-400">{tokens.length}</div>
        <div className={`text-xs ${colors.textMuted}`}>已添加 Token</div>
      </div>

      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`font-semibold ${colors.text}`}>Token 列表</h3>
          <div className="flex items-center gap-2">
            {tokens.length > 0 && (
              <button onClick={refreshAllUsage} disabled={refreshingAll}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-sm disabled:opacity-50">
                <RefreshCw size={14} className={refreshingAll ? 'animate-spin' : ''} />刷新配额
              </button>
            )}
            <button onClick={handleExport} disabled={tokens.length === 0}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${tokens.length > 0 ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : `${colors.card} ${colors.textMuted} cursor-not-allowed`}`}>
              <Download size={14} />导出
            </button>
            <button onClick={openAddModal} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 text-sm">
              <Upload size={14} />导入
            </button>
          </div>
        </div>

        {tokens.length === 0 ? (
          <div className={`text-center py-8 ${colors.textMuted}`}>暂无 Token，点击上方添加</div>
        ) : (
          <div className="space-y-3">
            {tokens.map(t => (
              <div key={t.id} className={`p-4 rounded-xl ${colors.card} border ${colors.cardBorder}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${colors.text}`}>{t.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${t.authMethod === 'IdC' ? 'bg-orange-500/20 text-orange-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                      {t.authMethod === 'IdC' ? 'BuilderId' : 'Social'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => fetchUsage(t.id)} className="p-1.5 rounded-lg hover:bg-white/10" title="刷新配额">
                      <RefreshCw size={14} className={`${colors.textMuted} ${loadingUsage[t.id] ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={() => openEditModal(t)} className="p-1.5 rounded-lg hover:bg-white/10"><Edit2 size={14} className={colors.textMuted} /></button>
                    <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-red-500/20"><Trash2 size={14} className="text-red-400" /></button>
                  </div>
                </div>
                <div className={`text-xs ${colors.textMuted} mb-2 font-mono`}>{t.refreshToken.slice(0, 30)}...</div>
                {renderUsage(t.id)}
              </div>
            ))}
          </div>
        )}
      </div>

      <TokenModal show={showModal} token={editingToken} onClose={() => setShowModal(false)} onSave={handleSave} onBatchSave={handleBatchSave} />
    </div>
  )
}

export default TokenManager
