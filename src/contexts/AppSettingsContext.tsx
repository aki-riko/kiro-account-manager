import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { getAppSettings, saveAppSettings } from '../api/settingsApi'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { persistAppSettingsUpdate } from './appSettingsState'
import { DEFAULT_BROWSER_INCOGNITO } from '../utils/browserPreference'

export interface AppSettings {
  lockModel: boolean;
  lockedModel: string | null;
  autoRefresh: boolean;
  autoRefreshInterval: number;
  browserPath: string;
  browserIncognito: boolean;
  privacyMode: boolean;
  autoSwitchEnabled: boolean;
  autoSwitchThreshold: number;
  autoSwitchInterval: number;
  switchTarget: 'ide' | 'cli' | 'both';
  enableCodebaseIndexing: boolean;
  enableTabAutocomplete: boolean;
  usageSummary: boolean;
  enableDebugLogs: boolean;
  notifyActionRequired: boolean;
  notifyFailure: boolean;
  notifySuccess: boolean;
  notifyBilling: boolean;
  trustedTools: string[];
  referenceTracker: boolean;
  configureMcp: 'Enabled' | 'Disabled' | string;
  telemetryContentCollection: boolean;
  telemetryUsageAnalytics: boolean;
  telemetryEditStats: boolean;
  telemetryFeedback: boolean;
  appProxyMode: 'followKiro' | 'disabled' | string;
  kskIdeKeyTtlHours: number;
  kskIdeControlPlaneRegion: string;
}

interface AppSettingsContextValue {
  settings: AppSettings | null;
  loading: boolean;
  updateSettings: (updates: Partial<AppSettings>) => Promise<AppSettings | null>;
  reload: () => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null)

// 默认设置
const DEFAULT_SETTINGS: AppSettings = {
  lockModel: false,
  lockedModel: null,
  autoRefresh: true,
  autoRefreshInterval: 50,
  browserPath: '',
  browserIncognito: DEFAULT_BROWSER_INCOGNITO,
  privacyMode: true,
  autoSwitchEnabled: false,
  autoSwitchThreshold: 1,
  autoSwitchInterval: 5,
  switchTarget: 'ide',
  enableCodebaseIndexing: true,
  enableTabAutocomplete: true,
  usageSummary: true,
  enableDebugLogs: false,
  notifyActionRequired: true,
  notifyFailure: true,
  notifySuccess: true,
  notifyBilling: true,
  trustedTools: [],
  referenceTracker: false,
  configureMcp: 'Enabled',
  telemetryContentCollection: false,
  telemetryUsageAnalytics: false,
  telemetryEditStats: false,
  telemetryFeedback: false,
  appProxyMode: 'followKiro',
  kskIdeKeyTtlHours: 24,
  kskIdeControlPlaneRegion: 'us-east-1'
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const settingsRef = useRef<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const applySettings = (nextSettings: AppSettings) => {
    settingsRef.current = nextSettings
    setSettings(nextSettings)
  }

  // 加载设置
  const loadSettings = async () => {
    try {
      const appSettings = await getAppSettings<AppSettings>()
      applySettings(appSettings || DEFAULT_SETTINGS)
    } catch (err) {
      console.error('[AppSettings] 加载失败:', err)
      applySettings(DEFAULT_SETTINGS)
    } finally {
      setLoading(false)
    }
  }

  // 更新设置
  const updateSettings = async (updates: Partial<AppSettings>) => {
    try {
      const nextSettings = await persistAppSettingsUpdate(
        settingsRef.current,
        DEFAULT_SETTINGS,
        updates,
        saveAppSettings,
      )
      applySettings(nextSettings)
      return nextSettings
    } catch (err) {
      console.error('[AppSettings] 保存失败:', err)
      return null
    }
  }

  useEffect(() => {
    loadSettings()

    let unlisten: UnlistenFn | null = null

    const setupListener = async () => {
      unlisten = await listen<AppSettings | null>('app-settings-changed', (event) => {
        if (event.payload) {
          applySettings(event.payload)
        } else {
          loadSettings()
        }
      })
    }

    setupListener()

    return () => {
      if (unlisten) unlisten()
    }
  }, [])

  return (
    <AppSettingsContext.Provider value={{ settings, loading, updateSettings, reload: loadSettings }}>
      {children}
    </AppSettingsContext.Provider>
  )
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext)
  if (context === null) {
    throw new Error('useAppSettings must be used within AppSettingsProvider')
  }
  return context
}
