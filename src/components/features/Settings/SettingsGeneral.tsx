import { Clock, Globe, Search, Shield, Shuffle, AlertTriangle, Eye, EyeOff, Repeat, RefreshCw, Check, Copy, Cpu, X, FolderOpen, ExternalLink } from 'lucide-react'
import { Card, CardContent } from '../../ui/card'
import { Input } from '../../ui/input'
import { Switch } from '../../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import React from 'react'
import { TFunction } from 'i18next'

interface BrowserInfo {
  name: string;
  path: string;
  incognitoArg?: string;
}

interface SystemMachineInfo {
  machineGuid: string;
  osType: string;
  requiresAdmin: boolean;
  canModify: boolean;
}

interface SettingsGeneralProps {
  autoRefresh: boolean;
  autoRefreshInterval: number;
  autoChangeMachineId: boolean;
  machineIdMode: string;
  privacyMode: boolean;
  setPrivacyMode: (checked: boolean) => void;
  autoSwitchEnabled: boolean;
  autoSwitchThreshold: number;
  autoSwitchInterval: number;
  browserPath: string;
  setBrowserPath: (path: string) => void;
  originalBrowserPath: string;
  savingBrowser: boolean;
  detectedBrowsers: BrowserInfo[];
  showBrowserList: boolean;
  setShowBrowserList: (show: boolean) => void;
  customKiroPath: string | null;
  handleBrowseKiroPath: () => void;
  handleClearKiroPath: () => void;
  systemMachineInfo: SystemMachineInfo | null;
  machineGuidAction: string | null;
  handleResetSystemMachineGuid: () => void;
  appDataDir: string;
  handleOpenAppDataDir: () => void;
  handleDetectBrowsers: () => void;
  handleApplyBrowser: () => void;
  handleAutoRefreshChange: (checked: boolean) => void;
  handleAutoRefreshIntervalChange: (value: string) => void;
  handleAutoChangeMachineIdChange: (checked: boolean) => void;
  handleMachineIdModeChange: (mode: string) => void;
  handleAutoSwitchEnabledChange: (checked: boolean) => void;
  handleAutoSwitchThresholdChange: (value: number) => void;
  handleAutoSwitchIntervalChange: (value: string) => void;
  t: TFunction;
}

function SettingsGeneral({
  autoRefresh,
  autoRefreshInterval,
  autoChangeMachineId,
  machineIdMode,
  privacyMode,
  setPrivacyMode,
  autoSwitchEnabled,
  autoSwitchThreshold,
  autoSwitchInterval,
  browserPath,
  setBrowserPath,
  originalBrowserPath,
  savingBrowser,
  detectedBrowsers,
  showBrowserList,
  setShowBrowserList,
  customKiroPath,
  handleBrowseKiroPath,
  handleClearKiroPath,
  systemMachineInfo,
  machineGuidAction,
  handleResetSystemMachineGuid,
  appDataDir,
  handleOpenAppDataDir,
  handleDetectBrowsers,
  handleApplyBrowser,
  handleAutoRefreshChange,
  handleAutoRefreshIntervalChange,
  handleAutoChangeMachineIdChange,
  handleMachineIdModeChange,
  handleAutoSwitchEnabledChange,
  handleAutoSwitchThresholdChange,
  handleAutoSwitchIntervalChange,
  t
}: SettingsGeneralProps) {
  const accountToggleContainerClass = "bg-card hover:bg-muted/50 border border-border text-foreground"
  const browserChanged = browserPath !== originalBrowserPath

  const [copiedField, setCopiedField] = React.useState<string | null>(null)
  const copiedTimerRef = React.useRef<NodeJS.Timeout | null>(null)

  React.useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).catch(e => console.error('Copy failed:', e))
    setCopiedField(field)
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current)
    }
    copiedTimerRef.current = setTimeout(() => setCopiedField(null), 1500)
  }

  const handleSelectBrowser = (browser: BrowserInfo, useIncognito = true) => {
    const path = useIncognito && browser.incognitoArg
      ? `"${browser.path}" ${browser.incognitoArg}`
      : `"${browser.path}"`
    setBrowserPath(path)
    setShowBrowserList(false)
  }

  const resolveOsLabel = (osType: string, defaultLabel: string) => {
    switch (osType) {
      case 'windows': return 'Windows'
      case 'macos': return 'macOS'
      case 'linux': return 'Linux'
      default: return defaultLabel
    }
  }

  return (
    <div className="space-y-6">
      {/* 账号管理 */}
      <Card className="card-glow animate-slide-in-left delay-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-5 bg-primary rounded-full"></div>
            <h2 className="text-lg font-semibold text-foreground">{t('settings.account')}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">{t('settings.accountDesc')}</p>

          <div className="space-y-3">
            {/* 自动刷新 Token */}
            <div className="flex items-center gap-3">
              <label className={`flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl border flex-shrink-0 transition-colors ${accountToggleContainerClass}`} title={t('settings.autoRefreshDesc')}>
                <Switch checked={autoRefresh} onCheckedChange={handleAutoRefreshChange} />
                <Clock size={16} />
                <span className="text-sm font-medium whitespace-nowrap">{t('settings.autoRefresh')}</span>
              </label>
              <Select value={String(autoRefreshInterval)} onValueChange={handleAutoRefreshIntervalChange} disabled={!autoRefresh}>
                <SelectTrigger className="text-foreground bg-background border-border focus:ring-primary/20 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="10" className="text-foreground">10 {t('common.minutes')}</SelectItem>
                  <SelectItem value="20" className="text-foreground">20 {t('common.minutes')}</SelectItem>
                  <SelectItem value="30" className="text-foreground">30 {t('common.minutes')}</SelectItem>
                  <SelectItem value="40" className="text-foreground">40 {t('common.minutes')}</SelectItem>
                  <SelectItem value="50" className="text-foreground">50 {t('common.minutes')} ({t('common.recommended')})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 机器码设置 */}
            <div className="flex items-center gap-3">
              <label className={`flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl border flex-shrink-0 transition-colors ${accountToggleContainerClass}`} title={t('settings.autoChangeMachineIdDesc')}>
                <Switch checked={autoChangeMachineId} onCheckedChange={handleAutoChangeMachineIdChange} />
                <Shuffle size={16} />
                <span className="text-sm font-medium whitespace-nowrap">{t('settings.autoChangeMachineId')}</span>
              </label>
              <Select value={machineIdMode} onValueChange={handleMachineIdModeChange} disabled={!autoChangeMachineId}>
                <SelectTrigger className="text-foreground bg-background border-border focus:ring-primary/20 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="bind" className="text-foreground">{t('settings.machineIdBind')} ({t('common.recommended')})</SelectItem>
                  <SelectItem value="random" className="text-foreground">{t('settings.machineIdRandom')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 隐私模式 */}
            <label className={`flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl border transition-colors ${accountToggleContainerClass}`} title={t('settings.privacyModeDesc')}>
              <Switch checked={privacyMode} onCheckedChange={setPrivacyMode} />
              {privacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
              <span className="text-sm font-medium whitespace-nowrap">{t('settings.privacyMode')}</span>
              <span className="text-xs text-muted-foreground ml-1">({t('settings.privacyModeHint')})</span>
            </label>

            {/* 自动换号 */}
            <div className="space-y-2">
              <label className={`flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl border transition-colors ${accountToggleContainerClass}`} title={t('settings.autoSwitchDesc')}>
                <Switch checked={autoSwitchEnabled} onCheckedChange={handleAutoSwitchEnabledChange} />
                <Repeat size={16} />
                <span className="text-sm font-medium whitespace-nowrap">{t('settings.autoSwitch')}</span>
              </label>
              {autoSwitchEnabled && (
                <div className="flex items-center gap-2 pl-4">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{t('settings.autoSwitchThreshold')}</span>
                  <Input
                    type="number"
                    value={autoSwitchThreshold}
                    onChange={(e) => handleAutoSwitchThresholdChange(parseFloat(e.target.value) || 0)}
                    disabled={!autoSwitchEnabled}
                    min={0}
                    step={0.1}
                    className="text-foreground bg-background border-border text-center w-20"
                  />
                  <Select value={String(autoSwitchInterval)} onValueChange={handleAutoSwitchIntervalChange} disabled={!autoSwitchEnabled}>
                    <SelectTrigger className="text-foreground bg-background border-border flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="1" className="text-foreground">1 {t('common.minutes')}</SelectItem>
                      <SelectItem value="3" className="text-foreground">3 {t('common.minutes')}</SelectItem>
                      <SelectItem value="5" className="text-foreground">5 {t('common.minutes')}</SelectItem>
                      <SelectItem value="10" className="text-foreground">10 {t('common.minutes')}</SelectItem>
                      <SelectItem value="15" className="text-foreground">15 {t('common.minutes')}</SelectItem>
                      <SelectItem value="30" className="text-foreground">30 {t('common.minutes')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 应用数据目录 */}
      <Card className="card-glow animate-slide-in-left delay-225">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-5 bg-primary rounded-full"></div>
            <FolderOpen size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{t('settings.appDataDir')}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">{t('settings.appDataDirDesc')}</p>

          <div className="space-y-3">
            <div className="rounded-xl p-4 border border-border bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <code className="flex-1 text-sm px-3 py-2 rounded-lg font-mono text-foreground border border-border bg-card break-all">
                  {appDataDir || t('common.loading')}
                </code>
                {appDataDir && (
                  <button onClick={() => copyToClipboard(appDataDir, 'appDataDir')} className="p-2 rounded-lg hover:bg-muted/50 transition-colors flex-shrink-0" title="复制路径">
                    {copiedField === 'appDataDir' ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-muted-foreground" />}
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handleOpenAppDataDir}
              disabled={!appDataDir}
              className="w-full px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-medium bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ExternalLink size={16} />
              {t('settings.openInExplorer')}
            </button>

            <p className="text-xs text-muted-foreground">{t('settings.appDataDirTip')}</p>
          </div>
        </CardContent>
      </Card>

      {/* 浏览器 */}
      <Card className="card-glow animate-slide-in-left delay-250">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-5 bg-primary rounded-full"></div>
            <Globe size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{t('settings.browser')}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">{t('settings.browserDesc')}</p>

          <div className="space-y-3">
            <div className="flex gap-3">
              <Input
                value={browserPath}
                onChange={(e) => setBrowserPath(e.target.value)}
                placeholder={t('settings.browserPlaceholder')}
                className="text-foreground bg-background border-border flex-1"
              />
              <button
                onClick={handleDetectBrowsers}
                className="px-4 py-2.5 border rounded-xl bg-card hover:bg-muted/50 border-border text-foreground flex items-center gap-2 transition-colors"
                title={t('settings.detectBrowsersTitle')}
              >
                <Search size={16} />
                <span className="hidden sm:inline">{t('settings.detect')}</span>
              </button>
              <button
                onClick={handleApplyBrowser}
                disabled={savingBrowser || !browserChanged}
                className={`px-5 py-2.5 rounded-xl flex items-center gap-2 font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed border transition-colors ${browserChanged
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                  : "bg-muted text-muted-foreground border-border"
                  }`}
              >
                {savingBrowser ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                <span className="hidden sm:inline">{savingBrowser ? t('settings.saving') : t('settings.apply')}</span>
              </button>
            </div>

            {/* 检测到的浏览器列表 */}
            {showBrowserList && detectedBrowsers.length > 0 && (
              <div className="p-4 rounded-xl border border-border bg-muted/30 animate-slide-in-down">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">{t('settings.detectedBrowsers')}</span>
                  <button onClick={() => setShowBrowserList(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {t('settings.close')}
                  </button>
                </div>
                <div className="space-y-2">
                  {detectedBrowsers.map((browser, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-card hover:bg-muted/50 transition-colors border border-border">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">{browser.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{browser.path}</div>
                      </div>
                      <button onClick={() => handleSelectBrowser(browser, true)} className="ml-3 px-3 py-1.5 text-xs rounded-lg transition-colors border bg-primary text-primary-foreground border-primary hover:bg-primary/90">
                        {t('settings.selectBrowser')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">{t('settings.browserTip')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Kiro IDE 路径 */}
      <Card className="card-glow animate-slide-in-left delay-275">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-5 bg-primary rounded-full"></div>
            <Cpu size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{t('settings.kiroIdePath')}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">{t('settings.kiroIdePathDesc')}</p>

          <div className="space-y-3">
            <div className="flex gap-3">
              <Input
                value={customKiroPath || ''}
                placeholder={t('settings.useDefaultPath')}
                readOnly
                className="text-foreground bg-muted/50 border-border flex-1 cursor-not-allowed"
              />
              <button
                onClick={handleBrowseKiroPath}
                className="px-4 py-2.5 border rounded-xl bg-card hover:bg-muted/50 border-border text-foreground flex items-center gap-2 transition-colors"
                title={t('settings.browse')}
              >
                <Search size={16} />
                <span className="hidden sm:inline">{t('settings.browse')}</span>
              </button>
              {customKiroPath && (
                <button
                  onClick={handleClearKiroPath}
                  className="px-4 py-2.5 border rounded-xl bg-card hover:bg-red-500/10 border-border text-red-500 flex items-center gap-2 transition-colors"
                  title={t('settings.clear')}
                >
                  <X size={16} />
                  <span className="hidden sm:inline">{t('settings.clear')}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t('settings.kiroPathTip')}</p>
          </div>
        </CardContent>
      </Card>

      {/* 系统机器码 */}
      <Card className="card-glow animate-slide-in-left delay-300">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-5 bg-orange-500 rounded-full"></div>
            <Shield size={18} className="text-orange-500" />
            <h2 className="text-lg font-semibold text-foreground">{t('settings.systemMachineGuid')}</h2>
            {systemMachineInfo?.osType && (
              <span className="text-xs px-2 py-0.5 rounded-full text-muted-foreground border border-border bg-muted/30">
                {resolveOsLabel(systemMachineInfo.osType, t('common.unknown'))}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            {systemMachineInfo?.osType === 'macos'
              ? t('settings.machineGuidDescMac')
              : systemMachineInfo?.osType === 'linux'
                ? t('settings.machineGuidDescLinux')
                : t('settings.machineGuidDescWin')}
          </p>

          <div className="space-y-4">
            {/* 当前值 */}
            <div className="rounded-xl p-4 border border-border bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">{t('settings.currentMachineGuid')}</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm px-3 py-2 rounded-lg font-mono text-foreground border border-border bg-card break-all">
                  {systemMachineInfo?.machineGuid || t('common.loading')}
                </code>
                {systemMachineInfo?.machineGuid && (
                  <button onClick={() => copyToClipboard(systemMachineInfo.machineGuid, 'sysMachineGuid')} className="p-2 rounded-lg hover:bg-muted/50 transition-colors flex-shrink-0" title="复制">
                    {copiedField === 'sysMachineGuid' ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-muted-foreground" />}
                  </button>
                )}
              </div>
            </div>

            {/* 警告提示 */}
            {systemMachineInfo?.requiresAdmin && (
              <div className="flex items-start gap-3 bg-orange-500/10 rounded-xl p-4 border border-orange-500/20">
                <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-orange-500 mb-2 text-sm">{t('settings.adminWarningTitle')}</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                    <li>{t('settings.adminWarning1')}</li>
                    <li>{t('settings.adminWarning2')}</li>
                    <li>{t('settings.adminWarning3')}</li>
                  </ul>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            {systemMachineInfo?.canModify && (
              <button
                onClick={handleResetSystemMachineGuid}
                disabled={machineGuidAction !== null}
                className="w-full px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 transition-colors"
              >
                {machineGuidAction === 'reset' ? <RefreshCw size={16} className="animate-spin" /> : <Shuffle size={16} />}
                {t('common.reset')}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default SettingsGeneral
