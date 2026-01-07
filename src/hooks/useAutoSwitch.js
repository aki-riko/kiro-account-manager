import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'
import { getQuota, getUsed } from '../utils/accountStats'

// 默认值
const DEFAULT_THRESHOLD = 1 // 余额阈值
const DEFAULT_INTERVAL = 5  // 检查间隔（分钟）

/**
 * 自动换号 Hook
 * 当当前账号余额低于阈值时，自动切换到其他可用账号
 * @param {Object} appSettings - 应用设置
 * @param {boolean} settingsLoading - 设置是否加载中
 */
export function useAutoSwitch(appSettings, settingsLoading) {
  const timerRef = useRef(null)
  const appSettingsRef = useRef(appSettings)

  // 同步 appSettings 到 ref
  useEffect(() => {
    appSettingsRef.current = appSettings
  }, [appSettings])

  // 检查并自动切换账号
  const checkAndAutoSwitch = async () => {
    const settings = appSettingsRef.current || {}
    
    // 未启用自动换号
    if (!settings.autoSwitchEnabled) return

    const threshold = settings.autoSwitchThreshold ?? DEFAULT_THRESHOLD

    try {
      // 获取所有账号
      const accounts = await invoke('get_accounts')
      if (!accounts?.length) return

      // 获取当前使用的账号（从本地 Kiro 凭证）
      let currentAccount = null
      try {
        const localToken = await invoke('get_local_token')
        if (localToken?.refreshToken) {
          currentAccount = accounts.find(acc => acc.refreshToken === localToken.refreshToken)
        }
      } catch (e) {
        console.warn('[AutoSwitch] 获取本地 token 失败:', e)
        return
      }

      if (!currentAccount) {
        console.log('[AutoSwitch] 未找到当前使用的账号')
        return
      }

      // 先刷新当前账号状态获取最新余额
      try {
        const updated = await invoke('sync_account', { id: currentAccount.id })
        currentAccount = updated
      } catch (e) {
        const errorMsg = String(e)
        if (errorMsg.includes('BANNED')) {
          console.warn('[AutoSwitch] 当前账号已封禁')
          // 更新账号状态为封禁
          try {
            await invoke('update_account', { 
              id: currentAccount.id, 
              updates: { status: 'banned' } 
            })
            emit('accounts-updated')
          } catch (updateErr) {
            console.error('[AutoSwitch] 更新封禁状态失败:', updateErr)
          }
          return
        } else if (errorMsg.includes('AUTH_ERROR') || errorMsg.includes('invalid')) {
          console.warn('[AutoSwitch] 当前账号 Token 已失效')
        } else {
          console.warn('[AutoSwitch] 刷新当前账号失败:', errorMsg)
        }
      }

      // 计算剩余额度
      const quota = getQuota(currentAccount)
      const used = getUsed(currentAccount)
      const remaining = quota - used

      console.log(`[AutoSwitch] 当前账号: ${currentAccount.email}, 剩余: ${remaining}, 阈值: ${threshold}`)

      // 检查是否需要切换
      if (remaining > threshold) {
        console.log('[AutoSwitch] 余额充足，无需切换')
        return
      }

      console.log(`[AutoSwitch] 账号 ${currentAccount.email} 余额不足，开始查找可用账号...`)

      // 查找可用账号
      const availableAccount = accounts.find(acc => {
        // 排除当前账号
        if (acc.id === currentAccount.id) return false
        // 排除被封禁的账号
        if (acc.status === 'banned' || acc.status === '封禁' || acc.status === '已封禁') return false
        // 排除余额不足的账号
        const accQuota = getQuota(acc)
        const accUsed = getUsed(acc)
        const accRemaining = accQuota - accUsed
        if (accRemaining <= threshold) return false
        return true
      })

      if (!availableAccount) {
        console.log('[AutoSwitch] 没有可用账号可切换')
        return
      }

      console.log(`[AutoSwitch] 切换到: ${availableAccount.email}`)

      // 执行切换
      await invoke('switch_account', {
        id: availableAccount.id,
        resetMachineId: settings.autoChangeMachineId ?? false,
        bindMachineIdToAccount: settings.bindMachineIdToAccount ?? true
      })

      console.log(`[AutoSwitch] 切换成功: ${availableAccount.email}`)
      emit('accounts-updated')
      emit('account-switched', { email: availableAccount.email })

    } catch (e) {
      console.error('[AutoSwitch] 检查失败:', e)
    }
  }

  // 启动定时器
  const startAutoSwitchTimer = () => {
    // 先清理旧定时器
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    const settings = appSettingsRef.current || {}
    
    // 未启用则不启动
    if (!settings.autoSwitchEnabled) {
      console.log('[AutoSwitch] 自动换号未启用')
      return
    }

    const interval = settings.autoSwitchInterval ?? DEFAULT_INTERVAL
    const intervalMs = interval * 60 * 1000

    console.log(`[AutoSwitch] 启动定时器，间隔: ${interval} 分钟`)

    // 立即检查一次
    checkAndAutoSwitch()

    // 设置定时检查
    timerRef.current = setInterval(checkAndAutoSwitch, intervalMs)
  }

  // 停止定时器
  const stopAutoSwitchTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
      console.log('[AutoSwitch] 定时器已停止')
    }
  }

  // 设置加载完成后启动定时器
  useEffect(() => {
    if (settingsLoading) return

    const settings = appSettingsRef.current || {}
    if (settings.autoSwitchEnabled) {
      console.log('[AutoSwitch] 设置加载完成，启动定时器')
      startAutoSwitchTimer()
    }

    return () => {
      stopAutoSwitchTimer()
    }
  }, [settingsLoading])

  // 监听设置变化
  useEffect(() => {
    if (settingsLoading) return
    
    const settings = appSettingsRef.current || {}
    if (settings.autoSwitchEnabled) {
      startAutoSwitchTimer()
    } else {
      stopAutoSwitchTimer()
    }
  }, [appSettings?.autoSwitchEnabled, appSettings?.autoSwitchInterval, settingsLoading])

  return { startAutoSwitchTimer, stopAutoSwitchTimer, checkAndAutoSwitch }
}
