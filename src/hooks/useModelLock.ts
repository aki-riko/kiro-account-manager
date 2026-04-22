import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { AppSettings } from '../contexts/AppSettingsContext'

/**
 * 模型锁定检查 Hook
 * @param appSettings - 应用设置
 * @param settingsLoading - 设置是否加载中
 */
export function useModelLock(appSettings: AppSettings | null, settingsLoading: boolean) {
  const modelLockTimerRef = useRef<NodeJS.Timeout | null>(null)
  const appSettingsRef = useRef<AppSettings | null>(appSettings)

  // 同步 appSettings 到 ref
  useEffect(() => {
    appSettingsRef.current = appSettings
  }, [appSettings])

  // 检查并恢复锁定的模型
  const checkAndRestoreLockedModel = async () => {
    try {
      const settings = appSettingsRef.current
      if (!settings || !settings.lockModel || !settings.lockedModel) return

      const kiroSettings = await invoke<{ modelSelection?: string }>('get_kiro_settings').catch(() => ({ modelSelection: undefined }))
      const currentModel = kiroSettings.modelSelection

      if (currentModel && currentModel !== settings.lockedModel) {
        await invoke('set_kiro_model', { model: settings.lockedModel })
      }
    } catch (e) {
      // 静默处理
    }
  }

  // 启动定时器
  const startModelLockTimer = () => {
    if (modelLockTimerRef.current) {
      clearInterval(modelLockTimerRef.current)
    }

    // 启动时立即检查一次
    checkAndRestoreLockedModel()

    // 每 30 秒检查一次
    modelLockTimerRef.current = setInterval(checkAndRestoreLockedModel, 30 * 1000)
  }

  // 设置加载完成后启动定时器
  useEffect(() => {
    if (settingsLoading) return

    startModelLockTimer()

    return () => {
      if (modelLockTimerRef.current) {
        clearInterval(modelLockTimerRef.current)
      }
    }
  }, [settingsLoading])

  return { checkAndRestoreLockedModel }
}
