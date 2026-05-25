// i18n hook
import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'

const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
] as const

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code']

export function useI18n() {
  const { t, i18n } = useTranslation()

  const setLocale = useCallback((lng: string) => {
    i18n.changeLanguage(lng)
    localStorage.setItem('app-language', lng)
  }, [i18n])

  return {
    t,
    locale: i18n.language as LanguageCode,
    setLocale,
    supportedLanguages: SUPPORTED_LANGUAGES,
    loading: false,
  }
}
