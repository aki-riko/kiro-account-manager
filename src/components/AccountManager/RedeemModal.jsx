import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useTranslation } from 'react-i18next'
import { X, Key, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

/**
 * 卡密兑换弹窗
 */
export default function RedeemModal({ isOpen, onClose, onSuccess, colors }) {
  const { t } = useTranslation()
  const [cardKey, setCardKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null) // { success, message, email }

  const handleRedeem = async () => {
    if (!cardKey.trim()) return

    setLoading(true)
    setResult(null)

    try {
      const res = await invoke('redeem_card', { cardKey: cardKey.trim() })
      setResult({ success: true, message: t('redeem.success'), email: res.email })
      setCardKey('')
      if (onSuccess) onSuccess()
    } catch (e) {
      setResult({ success: false, message: String(e) })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setCardKey('')
    setResult(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={`${colors.card} rounded-2xl shadow-xl w-full max-w-md mx-4`}>
        {/* 标题栏 */}
        <div className={`flex items-center justify-between p-4 border-b ${colors.cardBorder}`}>
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-500" />
            <h3 className={`text-lg font-semibold ${colors.text}`}>{t('accounts.redeem')}</h3>
          </div>
          <button onClick={handleClose} className={`p-1 rounded-lg ${colors.textMuted} hover:bg-gray-100 dark:hover:bg-gray-700`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-4">
          <p className={`text-sm ${colors.textMuted}`}>
            {t('redeem.desc')}
          </p>

          <input
            type="text"
            value={cardKey}
            onChange={(e) => setCardKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
            placeholder={t('redeem.placeholder')}
            className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all font-mono`}
            disabled={loading}
            autoFocus
          />

          {/* 结果提示 */}
          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              result.success 
                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' 
                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              {result.success ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <div>
                <p className="font-medium">{result.message}</p>
                {result.email && (
                  <p className="text-sm opacity-80">{t('redeem.account')}: {result.email}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className={`flex justify-end gap-3 p-4 border-t ${colors.cardBorder}`}>
          <button
            onClick={handleClose}
            className={`px-4 py-2 rounded-lg ${colors.textMuted} hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
          >
            {t('common.close')}
          </button>
          <button
            onClick={handleRedeem}
            disabled={loading || !cardKey.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('redeem.submit')}
          </button>
        </div>
      </div>
    </div>
  )
}
