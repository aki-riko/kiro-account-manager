// i18n 工具函数（非组件）
import i18n from 'i18next'
import { invoke } from '@tauri-apps/api/core'

// 支持的语言
export const locales = {
  'zh-CN': '简体中文',
  'en-US': 'English',
  'ru-RU': 'Русский',
}

// 从 app-settings.json 加载语言设置
export const loadLocaleFromSettings = async () => {
  try {
    const settings = await invoke('get_app_settings')
    if (settings?.locale && locales[settings.locale]) {
      await i18n.changeLanguage(settings.locale)
    }
  } catch (e) {
    console.error('[i18n] Failed to load locale from settings:', e)
  }
}

// 切换语言（保存到 app-settings.json）
export const changeLanguage = async (lng) => {
  await i18n.changeLanguage(lng)
  try {
    await invoke('save_app_settings', { settings: { locale: lng } })
  } catch (e) {
    console.error('[i18n] Failed to save locale:', e)
  }
}
