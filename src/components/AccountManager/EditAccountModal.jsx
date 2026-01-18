import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { CopyButton, Stack, Select, ActionIcon } from '@mantine/core'
import { Copy, Check, Folder, Plus, X } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import { useDialog } from '../../contexts/DialogContext'
import { setAccountTags, setAccountGroup, getGroups, addGroup } from '../../api/groupTag'
import { TagSelector } from './GroupTagManager'
import { TokenJsonView } from './TokenJsonView'

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
]

function GroupSelector({ groups, value, onChange, onGroupsChange }) {
  const { t, colors } = useApp()
  const [newGroupName, setNewGroupName] = useState('')
  const [showInput, setShowInput] = useState(false)

  const handleAddGroup = async () => {
    const trimmed = newGroupName.trim().slice(0, 20)
    if (!trimmed) return
    if (groups.some(g => g.name === trimmed)) {
      setNewGroupName('')
      return
    }
    const color = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
    try {
      const newGroup = await addGroup(trimmed, color)
      onGroupsChange([...groups, newGroup])
      onChange(newGroup.id)
      setNewGroupName('')
      setShowInput(false)
    } catch (e) {
      console.error('创建分组失败:', e)
    }
  }

  if (showInput) {
    return (
      <div className="flex gap-2">
        <input
          type="text"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
          placeholder={t('groups.newGroupPlaceholder') || '输入新分组名...'}
          className={`flex-1 px-4 py-2.5 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
        />
        <button
          onClick={handleAddGroup}
          disabled={!newGroupName.trim()}
          className="p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-all"
        >
          <Check size={16} />
        </button>
        <button
          onClick={() => { setShowInput(false); setNewGroupName('') }}
          className={`p-2.5 rounded-xl ${colors.cardHover} transition-all`}
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`flex-1 px-4 py-2.5 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
      >
        <option value="">{t('groups.noGroup') || '无分组'}</option>
        {groups.map(g => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
      <button
        onClick={() => setShowInput(true)}
        className="p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}

function EditAccountModal({ account, onClose, onSuccess }) {
  const { t, colors } = useApp()
  const { showError } = useDialog()
  
  const [form, setForm] = useState({
    label: account.label || '',
    accessToken: account.accessToken || '',
    refreshToken: account.refreshToken || '',
    clientId: account.clientId || '',
    clientSecret: account.clientSecret || '',
    machineId: account.machineId || '',
  })
  const [selectedTagIds, setSelectedTagIds] = useState((account.tagLinks || []).map(link => link.tagId))
  const [selectedGroupId, setSelectedGroupId] = useState(account.groupId || '')
  const [groups, setGroups] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getGroups().then(setGroups).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const params = {
        id: account.id,
        label: form.label || null,
        accessToken: form.accessToken || null,
        refreshToken: form.refreshToken || null,
        machineId: form.machineId || null,
      }
      if (account.provider === 'BuilderId') {
        params.clientId = form.clientId || null
        params.clientSecret = form.clientSecret || null
      }
      await invoke('update_account', params)
      await setAccountGroup(account.id, selectedGroupId || null)
      await setAccountTags(account.id, selectedTagIds)
      onSuccess?.()
      onClose()
    } catch (e) {
      await showError(t('editAccount.saveFailed'), e.toString())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className={`
          relative overflow-hidden
          ${colors.card} 
          rounded-2xl w-full max-w-[600px] 
          shadow-2xl
          border ${colors.cardBorder}
        `}
        onClick={e => e.stopPropagation()}
        style={{ animation: 'dialogSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* 顶部渐变装饰 */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
        
        {/* 装饰性光晕 */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-full blur-3xl opacity-50" />
        
        {/* Header */}
        <div className="relative px-6 pt-6 pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`
                w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10
                flex items-center justify-center
                ring-1 ${colors.ringColor}
                shadow-lg
              `}>
                <Folder size={24} className="text-emerald-400" strokeWidth={2} />
              </div>
              <div>
                <h2 className={`text-lg font-semibold ${colors.text} leading-tight`}>{t('editAccount.title')}</h2>
                <p className={`text-xs ${colors.textMuted} mt-0.5 truncate max-w-[400px]`}>{account.email}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition-all duration-200 ${colors.cardHover}`}
            >
              <X size={18} className={colors.textMuted} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="relative px-6 py-4 max-h-[70vh] overflow-y-auto">
          <Stack gap="lg">
            <div>
              <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                {t('accounts.remark')}
              </label>
              <input
                type="text"
                placeholder={t('editAccount.labelPlaceholder')}
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                {t('addAccount.machineId')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('addAccount.machineIdPlaceholder')}
                  value={form.machineId}
                  onChange={(e) => setForm({ ...form, machineId: e.target.value })}
                  className={`w-full px-4 py-3 pr-10 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
                />
                <CopyButton value={form.machineId}>
                  {({ copied, copy }) => (
                    <button
                      onClick={copy}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg ${colors.cardHover} transition-all`}
                      title={copied ? '已复制' : '复制'}
                    >
                      {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} className={colors.textMuted} />}
                    </button>
                  )}
                </CopyButton>
              </div>
            </div>

            {account.provider === 'BuilderId' && (
              <>
                <div>
                  <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                    Client ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="刷新 Token 需要"
                      value={form.clientId}
                      onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                      className={`w-full px-4 py-3 pr-10 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
                    />
                    <CopyButton value={form.clientId}>
                      {({ copied, copy }) => (
                        <button
                          onClick={copy}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg ${colors.cardHover} transition-all`}
                          title={copied ? '已复制' : '复制'}
                        >
                          {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} className={colors.textMuted} />}
                        </button>
                      )}
                    </CopyButton>
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                    Client Secret
                  </label>
                  <div className="relative">
                    <textarea
                      placeholder="刷新 Token 需要"
                      value={form.clientSecret}
                      onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                      rows={2}
                      className={`w-full px-4 py-3 pr-10 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 resize-none transition-all`}
                    />
                    <CopyButton value={form.clientSecret}>
                      {({ copied, copy }) => (
                        <button
                          onClick={copy}
                          className={`absolute right-3 top-3 p-1.5 rounded-lg ${colors.cardHover} transition-all`}
                          title={copied ? '已复制' : '复制'}
                        >
                          {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} className={colors.textMuted} />}
                        </button>
                      )}
                    </CopyButton>
                  </div>
                </div>
              </>
            )}

            <div>
              <div className={`text-sm font-medium mb-2 flex items-center gap-1.5 ${colors.text}`}>
                <Folder size={14} />
                {t('groups.title') || '分组'}
              </div>
              <GroupSelector
                groups={groups}
                value={selectedGroupId}
                onChange={setSelectedGroupId}
                onGroupsChange={setGroups}
              />
            </div>

            <TagSelector 
              selectedTagIds={selectedTagIds} 
              onChange={setSelectedTagIds} 
            />

            <TokenJsonView account={account} defaultExpanded={false} />
          </Stack>
        </div>

        {/* Footer */}
        <div className={`relative px-6 py-5 ${colors.dialogFooter} flex justify-end gap-3`}>
          <button
            onClick={onClose}
            className={`px-5 py-2.5 text-sm font-medium rounded-xl ${colors.btnSecondary} transition-all duration-200 active:scale-[0.98]`}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`
              px-6 py-2.5 text-sm font-medium rounded-xl text-white
              bg-gradient-to-r from-emerald-500 to-teal-600
              shadow-lg shadow-emerald-500/30
              hover:opacity-90 hover:shadow-xl
              disabled:opacity-50 disabled:cursor-not-allowed 
              flex items-center gap-2 
              transition-all duration-200 active:scale-[0.98]
            `}
          >
            {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {t('common.save')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes dialogSlideIn {
          from {
            opacity: 0;
            transform: scale(0.92) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}

export default EditAccountModal
