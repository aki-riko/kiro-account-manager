import { useEffect, useState } from 'react'
import i18n from 'i18next'
import { initReactI18next, I18nextProvider } from 'react-i18next'
import { locales, loadLocaleFromSettings, changeLanguage } from './utils/i18nUtils'

// 从 JSON 文件导入翻译
import zhCN from '../locales/zh-CN.json'
import enUS from '../locales/en-US.json'
import ruRU from '../locales/ru-RU.json'

// 初始化 i18n（默认中文，后续从设置加载）
i18n
  .use(initReactI18next)
  .init({
    lng: 'zh-CN',
    fallbackLng: 'zh-CN',
    supportedLngs: ['zh-CN', 'en-US', 'ru-RU'],
    
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
      'ru-RU': { translation: ruRU },
    },
    
    interpolation: {
      escapeValue: false,
    },
    
    react: {
      useSuspense: false,
    },
  })

// I18nProvider 组件
function I18nProvider({ children }) {
  const [loaded, setLoaded] = useState(false)
  
  useEffect(() => {
    loadLocaleFromSettings().finally(() => setLoaded(true))
  }, [])
  
  // 等待语言加载完成再渲染，显示加载状态避免闪烁
  if (!loaded) {
    return (
      <div className="h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-white/50 text-sm">加载中...</div>
      </div>
    )
  }
  
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

export { locales, I18nProvider, changeLanguage, loadLocaleFromSettings }
export default i18n
