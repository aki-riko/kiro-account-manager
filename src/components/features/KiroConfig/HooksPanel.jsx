import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Textarea, TextInput } from '@mantine/core'
import { Link2, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react'
import { useApp } from '../../../hooks/useApp'
import { useDialog } from '../../../contexts/DialogContext'
import { getThemeAccent, getGradientAccentButton, getSolidAccentButton, getThemeSurfaceStyles } from './themeAccent'

const formatSize = (bytes) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`


function HooksPanel({ onCountChange, projectDir }) {
  const { t, theme, colors } = useApp()
  const { showConfirm, showError } = useDialog()
  const accent = getThemeAccent(theme)
  const surface = getThemeSurfaceStyles(theme)
  const accentSolidButtonClass = getSolidAccentButton(accent)
  const accentGradientButtonClass = getGradientAccentButton(accent)

  const [hooks, setHooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedHook, setSelectedHook] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadHooks = useCallback(async () => {
    setLoading(true)
    try {
      const data = await invoke('get_hooks', { projectDir: projectDir || null })
      setHooks(data)
      onCountChange?.(data?.length || 0)
    } catch (e) {
      console.error('加载 Hooks 失败:', e)
    } finally {
      setLoading(false)
    }
  }, [onCountChange, projectDir])

  useEffect(() => {
    setSelectedHook(null)
    setEditContent('')
    setHasChanges(false)
    loadHooks()
  }, [loadHooks])

  const handleSelect = async (hookFile) => {
    if (hasChanges && !await showConfirm(t('hooks.unsavedChanges'), t('hooks.confirmSwitch'))) return
    setSelectedHook(hookFile)
    setEditContent(hookFile.content || '')
    setHasChanges(false)
  }

  const handleSave = async () => {
    if (!selectedHook) return
    setSaving(true)
    try {
      await invoke('save_hook', {
        fileName: selectedHook.fileName,
        content: editContent,
        projectDir: projectDir || null
      })
      const newList = hooks.map(h => (h.fileName === selectedHook.fileName)
        ? { ...h, content: editContent }
        : h)
      setHooks(newList)
      setSelectedHook({ ...selectedHook, content: editContent })
      setHasChanges(false)
    } catch (e) {
      showError(t('hooks.saveFailed'), String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (hookFile) => {
    if (!await showConfirm(t('hooks.confirmDelete'), t('hooks.confirmDeleteFile', { fileName: hookFile.fileName }))) return
    try {
      await invoke('delete_hook', {
        fileName: hookFile.fileName,
        projectDir: projectDir || null
      })
      const next = hooks.filter(h => h.fileName !== hookFile.fileName)
      setHooks(next)
      onCountChange?.(next.length)
      if (selectedHook?.fileName === hookFile.fileName) {
        setSelectedHook(null)
        setEditContent('')
        setHasChanges(false)
      }
    } catch (e) {
      showError(t('hooks.deleteFailed'), String(e))
    }
  }

  const handleCreate = async (fileName) => {
    const normalized = fileName.endsWith('.kiro.hook') ? fileName : `${fileName}.kiro.hook`
    const template = `{
  "enabled": true,
  "event": "userPromptSubmit",
  "matcher": "",
  "actions": []
}
`
    try {
      const newHook = await invoke('create_hook', {
        fileName: normalized,
        content: template,
        projectDir: projectDir || null
      })
      const next = [...hooks, newHook]
      setHooks(next)
      onCountChange?.(next.length)
      setShowCreateModal(false)
      handleSelect(newHook)
    } catch (e) {
      showError(t('hooks.createFailed'), String(e))
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><RefreshCw className={`animate-spin ${accent.text}`} size={24} /></div>
  }

  return (
    <div className="h-full flex gap-4 p-4">
      <div className={`w-80 flex flex-col ${colors.card} border ${colors.cardBorder} rounded-2xl overflow-hidden shadow-lg max-w-full`}>
        <div className={`p-4 border-b ${colors.cardBorder}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
            <Link2 size={18} className={accent.text} />
            <span className={`text-sm font-semibold ${colors.text}`}>{t('hooks.title')}</span>
            <span className={`text-xs ${colors.textMuted}`}>({hooks.length})</span>
          </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCreateModal(true)} className={`p-2 rounded-lg ${colors.cardHover} transition-colors cursor-pointer`} title={t('hooks.newHook')}>
                <Plus size={16} className={accent.text} />
              </button>
              <button onClick={loadHooks} className={`p-2 rounded-lg ${colors.cardHover} transition-colors cursor-pointer`} title={t('common.refresh')}>
                <RefreshCw size={16} className={colors.textMuted} />
              </button>
            </div>
          </div>
          <div className={`mt-2 text-[11px] ${colors.textMuted} leading-relaxed`}>{t('hooks.projectOnly')}</div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {hooks.length === 0 ? (
            <div className={`text-center py-16 ${colors.textMuted}`}>
              <Link2 size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">{t('hooks.noHooks')}</p>
              <button onClick={() => setShowCreateModal(true)} className={`mt-4 px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer ${accentSolidButtonClass}`}>
                {t('hooks.createFirst')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {hooks.map(h => {
                const isSelected = selectedHook?.fileName === h.fileName
                return (
                  <div
                    key={h.fileName}
                    onClick={() => handleSelect(h)}
                    className={`p-4 rounded-xl cursor-pointer group transition-all duration-200 ${
                      isSelected
                        ? `${accent.bg} ring-2 ${accent.ring} shadow-xl border-2 ${accent.border}`
                        : `${colors.card} border ${colors.cardBorder} ${colors.cardHover} hover:shadow-lg`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${isSelected ? accent.bg : colors.cardSecondary}`}>
                          <Link2 size={16} className={isSelected ? accent.text : colors.textMuted} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold text-sm truncate ${isSelected ? accent.text : colors.text}`}>{h.fileName}</div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(h) }}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/20 flex-shrink-0 transition-all duration-200 cursor-pointer"
                        title={t('common.delete')}
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    </div>
                    <div className={`flex items-center gap-2.5 text-xs ${colors.textMuted} ml-11`}>
                      <span className={`px-2 py-1 rounded-md ${colors.cardSecondary} font-medium`}>{formatSize(h.size)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 flex flex-col ${colors.card} border ${colors.cardBorder} rounded-2xl overflow-hidden shadow-lg`}>
        {selectedHook ? (
          <>
            <div className={`p-4 border-b ${colors.cardBorder} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold ${colors.text}`}>{selectedHook.fileName}</h3>
                {hasChanges && <span className="text-xs text-orange-500">● {t('hooks.unsaved')}</span>}
              </div>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${hasChanges ? accentSolidButtonClass : colors.btnDisabled} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Save size={14} />
                {saving ? t('hooks.saving') : t('hooks.save')}
              </button>
            </div>
            <div className="flex-1 p-4 overflow-hidden">
              <Textarea
                value={editContent}
                onChange={(e) => {
                  const next = e.target.value
                  setEditContent(next)
                  setHasChanges(next !== (selectedHook.content || ''))
                }}
                placeholder={t('hooks.contentPlaceholder')}
                classNames={{ input: `${colors.inputFocus}` }}
                styles={{
                  root: { height: '100%', display: 'flex', flexDirection: 'column' },
                  wrapper: { flex: 1, display: 'flex' },
                  input: {
                    flex: 1,
                    height: '100%',
                    minHeight: '400px',
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    resize: 'none',
                    color: surface.editorText,
                    backgroundColor: surface.editorBg,
                    borderColor: surface.editorBorder,
                  }
                }}
              />
            </div>
          </>
        ) : (
          <div className={`flex-1 flex items-center justify-center ${colors.textMuted}`}>
            <div className="text-center">
              <Link2 size={48} className="mx-auto mb-2 opacity-30" />
              <p>{t('hooks.selectToEdit')}</p>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateHookModal
          onCreate={handleCreate}
          onClose={() => setShowCreateModal(false)}
          colors={colors}
          t={t}
          accent={accent}
          accentGradientButtonClass={accentGradientButtonClass}
        />
      )}
    </div>
  )
}

function CreateHookModal({ onCreate, onClose, colors, t, accent, accentGradientButtonClass }) {
  const [fileName, setFileName] = useState('')

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`${colors.card} rounded-2xl w-full max-w-[420px] shadow-2xl border ${colors.cardBorder} overflow-hidden`} onClick={(e) => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 ${colors.dialogHeader}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${colors.info} flex items-center justify-center`}>
              <Link2 size={20} className={accent.text} />
            </div>
            <h2 className={`text-base font-semibold ${colors.text}`}>{t('hooks.newHook')}</h2>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${colors.cardHover} cursor-pointer`}>
            <X size={18} className={colors.textMuted} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>{t('hooks.fileName')}</label>
            <TextInput
              placeholder={t('hooks.fileNamePlaceholder')}
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              size="md"
              classNames={{ input: `${colors.text} ${colors.input} ${colors.inputFocus}` }}
              styles={{ input: { borderRadius: '0.5rem' } }}
            />
            <p className={`text-xs ${colors.textMuted} mt-1`}>{t('hooks.fileNameHint')}</p>
          </div>


          <button
            disabled={!fileName.trim()}
            className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer ${accentGradientButtonClass}`}
          >
            {t('common.add')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default HooksPanel
