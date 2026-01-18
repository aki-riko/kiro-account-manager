import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { SegmentedControl, Stack, Alert, Button } from '@mantine/core'
import { Download, Key, AlertCircle, X } from 'lucide-react'
import { useApp } from '../../hooks/useApp'

function AddAccountModal({ onClose, onSuccess }) {
  const { t, colors } = useApp()
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [accountType, setAccountType] = useState('social')
  const [socialProvider, setSocialProvider] = useState('Google')
  const [refreshToken, setRefreshToken] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [region, setRegion] = useState('us-east-1')
  const [machineId, setMachineId] = useState('')

  const awsRegions = [
    { value: 'us-east-1', label: 'us-east-1 (N. Virginia)' },
    { value: 'us-west-2', label: 'us-west-2 (Oregon)' },
    { value: 'eu-west-1', label: 'eu-west-1 (Ireland)' },
  ]

  const handleSaveLocal = async () => {
    setAddLoading(true)
    setAddError('')
    try {
      await invoke('add_local_kiro_account')
      onSuccess()
      onClose()
    } catch (e) {
      setAddError(e.toString())
    } finally {
      setAddLoading(false)
    }
  }

  const handleAddManual = async () => {
    if (!refreshToken) {
      setAddError(t('addAccount.errorNoToken'))
      return
    }
    
    if (accountType === 'social' && !refreshToken.startsWith('aor')) {
      setAddError(t('addAccount.errorSocialFormat'))
      return
    }
    
    setAddLoading(true)
    setAddError('')
    try {
      if (accountType === 'idc') {
        if (!clientId || !clientSecret) {
          setAddError(t('addAccount.errorNoClientId'))
          setAddLoading(false)
          return
        }
        await invoke('add_account_by_idc', { 
          refreshToken, 
          clientId, 
          clientSecret, 
          region,
          machineId: machineId.trim() || null
        })
      } else {
        await invoke('add_account_by_social', { 
          refreshToken, 
          provider: socialProvider,
          machineId: machineId.trim() || null
        })
      }
      onSuccess()
      onClose()
    } catch (e) {
      setAddError(e.toString())
    } finally {
      setAddLoading(false)
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
          rounded-2xl w-full max-w-[500px] 
          shadow-2xl
          border ${colors.cardBorder}
        `}
        onClick={e => e.stopPropagation()}
        style={{ animation: 'dialogSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* 顶部渐变装饰 */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-blue-500/10 via-transparent to-transparent pointer-events-none" />
        
        {/* 装饰性光晕 */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-500/20 to-purple-500/10 rounded-full blur-3xl opacity-50" />
        
        {/* Header */}
        <div className="relative px-6 pt-6 pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`
                w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/10
                flex items-center justify-center
                ring-1 ${colors.ringColor}
                shadow-lg
              `}>
                <Key size={24} className="text-blue-400" strokeWidth={2} />
              </div>
              <div>
                <h2 className={`text-lg font-semibold ${colors.text} leading-tight`}>{t('addAccount.title')}</h2>
                <p className={`text-xs ${colors.textMuted} mt-0.5`}>{t('addAccount.subtitle') || '添加新账号到管理器'}</p>
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
            {/* 保存本地账号 */}
            <div className={`p-5 rounded-xl border-2 border-dashed ${colors.cardBorder} ${colors.cardSecondary} hover:border-teal-500/50 transition-all group`}>
              <Button
                onClick={handleSaveLocal}
                disabled={addLoading}
                variant="light"
                color="teal"
                leftSection={<Download size={18} />}
                fullWidth
                size="lg"
                classNames={{
                  root: 'h-auto py-4 group-hover:scale-[1.02] transition-transform rounded-xl'
                }}
              >
                <div className="text-left w-full">
                  <div className="font-semibold text-base">{t('addAccount.saveLocal')}</div>
                  <div className={`text-xs mt-1 opacity-70 ${colors.textMuted}`}>{t('addAccount.saveLocalDesc')}</div>
                </div>
              </Button>
            </div>

            <div className="relative">
              <div className={`absolute inset-0 flex items-center`}>
                <div className={`w-full border-t ${colors.cardBorder}`}></div>
              </div>
              <div className="relative flex justify-center">
                <span className={`px-4 text-sm ${colors.textMuted} ${colors.card}`}>{t('addAccount.orManual')}</span>
              </div>
            </div>

            {/* 账号类型选择 */}
            <SegmentedControl
              value={accountType}
              onChange={setAccountType}
              data={[
                { value: 'social', label: 'Google/Github' },
                { value: 'idc', label: 'BuilderId' }
              ]}
              fullWidth
            />

            {/* Social Provider 选择 */}
            {accountType === 'social' && (
              <SegmentedControl
                value={socialProvider}
                onChange={setSocialProvider}
                data={[
                  { value: 'Google', label: 'Google' },
                  { value: 'Github', label: 'Github' }
                ]}
                fullWidth
              />
            )}

            {/* Refresh Token */}
            <div>
              <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                {t('addAccount.refreshToken')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder={accountType === 'idc' ? t('addAccount.idcPlaceholder') : t('addAccount.socialPlaceholder')}
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
              />
            </div>

            {/* BuilderId 专用字段 */}
            {accountType === 'idc' && (
              <>
                <div>
                  <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                    {t('addAccount.clientId')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="OIDC Client ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                    {t('addAccount.clientSecret')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="OIDC Client Secret"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                    {t('addAccount.awsRegion')}
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
                  >
                    {awsRegions.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* 机器码（可选） */}
            <div>
              <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                {t('addAccount.machineId')} ({t('common.optional')})
              </label>
              <input
                type="text"
                placeholder={t('addAccount.machineIdPlaceholder')}
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
              />
            </div>

            {/* 错误提示 */}
            {addError && (
              <Alert icon={<AlertCircle size={16} />} color="red" variant="light" radius="xl">
                {addError}
              </Alert>
            )}
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
            onClick={handleAddManual}
            disabled={addLoading || !refreshToken}
            className={`
              px-6 py-2.5 text-sm font-medium rounded-xl text-white
              bg-gradient-to-r from-blue-500 to-purple-600
              shadow-lg shadow-blue-500/30
              hover:opacity-90 hover:shadow-xl
              disabled:opacity-50 disabled:cursor-not-allowed 
              flex items-center gap-2 
              transition-all duration-200 active:scale-[0.98]
            `}
          >
            {addLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <Key size={16} />
            {t('addAccount.add')}
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

export default AddAccountModal
