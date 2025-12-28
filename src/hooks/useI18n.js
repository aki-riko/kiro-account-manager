// 兼容旧的 useI18n hook
import { useState, useReducer } from 'react'
import { useTranslation } from 'react-i18next'
import { changeLanguage } from '../utils/i18nUtils'

export function useI18n() {
  const { t, i18n: i18nInstance } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [, forceUpdate] = useReducer(x => x + 1, 0)
  
  const setLocale = async (lng) => {
    setLoading(true)
    try {
      await changeLanguage(lng)
      forceUpdate()
    } finally {
      setLoading(false)
    }
  }
  
  return {
    t,
    locale: i18nInstance.language,
    setLocale,
    loading,
  }
}
