import type React from 'react'
import { Search, RefreshCw, Check, Sparkles, Bot, Network, Wrench, Lock } from 'lucide-react'
import { Input } from '../../ui/input'
import { Textarea } from '../../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Label } from '../../ui/label'
import { AI_MODELS } from './settingsConstants'
import SectionCard from './SectionCard'
import SwitchRow from './SwitchRow'
import ToggleRow from './ToggleRow'

interface SettingsKiroProps {
  // 模型/工具
  aiModel: string
  lockModel: boolean
  agentAutonomy: string
  trustedCommandsMode: string
  customTrustedCommands: string
  trustedTools: string
  setTrustedTools: (value: string) => void
  configureMcp: string
  // 代理
  httpProxy: string
  setHttpProxy: (value: string) => void
  originalProxy: string
  appProxyMode: string
  savingProxy: boolean
  detectingProxy: boolean
  savingModel: boolean
  // Agent 行为开关（从原 SettingsAgent 合并过来）
  enableCodebaseIndexing: boolean
  enableTabAutocomplete: boolean
  usageSummary: boolean
  enableDebugLogs: boolean
  referenceTracker: boolean
  // handlers
  handleApplyModel: (model: string) => Promise<void>
  handleLockModelChange: (checked: boolean) => Promise<void>
  handleAgentAutonomyChange: (mode: string) => Promise<void>
  handleTrustedCommandsModeChange: (mode: string) => Promise<void>
  handleCustomTrustedCommandsChange: (commands: string) => Promise<void>
  handleTrustedToolsSave: (value: string) => Promise<void>
  handleConfigureMcpChange: (mode: string) => Promise<void>
  handleApplyProxy: () => Promise<void>
  handleDetectProxy: () => Promise<void>
  handleAppProxyModeChange: (mode: string) => Promise<void>
  handleCodebaseIndexingChange: (checked: boolean) => Promise<void>
  handleTabAutocompleteChange: (checked: boolean) => Promise<void>
  handleUsageSummaryChange: (checked: boolean) => Promise<void>
  handleDebugLogsChange: (checked: boolean) => Promise<void>
  handleReferenceTrackerChange: (checked: boolean) => Promise<void>
  t: (key: string) => string
}

function SettingsKiro({
  aiModel,
  lockModel,
  agentAutonomy,
  trustedCommandsMode,
  customTrustedCommands,
  trustedTools,
  setTrustedTools,
  configureMcp,
  httpProxy,
  setHttpProxy,
  originalProxy,
  appProxyMode,
  savingProxy,
  detectingProxy,
  savingModel,
  enableCodebaseIndexing,
  enableTabAutocomplete,
  usageSummary,
  enableDebugLogs,
  referenceTracker,
  handleApplyModel,
  handleLockModelChange,
  handleAgentAutonomyChange,
  handleTrustedCommandsModeChange,
  handleCustomTrustedCommandsChange,
  handleTrustedToolsSave,
  handleConfigureMcpChange,
  handleApplyProxy,
  handleDetectProxy,
  handleAppProxyModeChange,
  handleCodebaseIndexingChange,
  handleTabAutocompleteChange,
  handleUsageSummaryChange,
  handleDebugLogsChange,
  handleReferenceTrackerChange,
  t,
}: SettingsKiroProps) {
  const proxyChanged = httpProxy !== originalProxy

  return (
    <div className="space-y-3">
      {/* === 1. AI 模型 === */}
      <SectionCard
        title={t('settings.aiModel')}
        accent="violet"
        icon={<Sparkles size={14} className="text-violet-500" />}
        badge={savingModel ? <span className="text-[10px] text-primary animate-pulse">{t('settings.saving')}</span> : undefined}
      >
        <Select value={aiModel} onValueChange={handleApplyModel} disabled={savingModel}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AI_MODELS.map(m => (
              <SelectItem key={m.value} value={m.value}>
                {m.recommended ? `${m.label} (⭐ ${t('common.recommended')})` : m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SwitchRow
          checked={lockModel}
          onCheckedChange={handleLockModelChange}
          icon={<Lock size={13} />}
          label={t('settings.lockModel')}
          hint={t('settings.lockModelDesc')}
        />
      </SectionCard>

      {/* === 2. Agent 行为 === */}
      <SectionCard
        title={t('settings.agentSettings')}
        accent="blue"
        icon={<Bot size={14} className="text-blue-500" />}
        badge={<span className="text-[11px] text-muted-foreground">{t('settings.agentSettingsDesc')}</span>}
      >
        {/* Agent 模式 + 信任命令（双列）*/}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="block text-[11px] text-muted-foreground mb-1">{t('settings.agentAutonomy')}</Label>
            <Select value={agentAutonomy} onValueChange={handleAgentAutonomyChange}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Supervised">{t('settings.agentSupervised')}</SelectItem>
                <SelectItem value="Autopilot">{t('settings.agentAutopilot')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="block text-[11px] text-muted-foreground mb-1">{t('settings.trustedCommands')}</Label>
            <Select value={trustedCommandsMode} onValueChange={handleTrustedCommandsModeChange}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('settings.trustedCommandsNone')}</SelectItem>
                <SelectItem value="common">{t('settings.trustedCommandsCommon')}</SelectItem>
                <SelectItem value="all">{t('settings.trustedCommandsAll')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {trustedCommandsMode === 'common' && (
          <div>
            <Textarea
              value={customTrustedCommands}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleCustomTrustedCommandsChange(e.target.value)}
              placeholder="npm *&#10;git *&#10;cargo *"
              className="font-mono text-xs"
              rows={3}
            />
            <p className="text-[11px] text-muted-foreground mt-1">{t('settings.trustedCommandsDesc')}</p>
          </div>
        )}

        {/* 行为开关（5 个一排 grid）*/}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ToggleRow
            checked={enableCodebaseIndexing}
            onChange={handleCodebaseIndexingChange}
            label={t('settings.enableCodebaseIndexing')}
          />
          <ToggleRow
            checked={enableTabAutocomplete}
            onChange={handleTabAutocompleteChange}
            label={t('settings.enableTabAutocomplete')}
          />
          <ToggleRow
            checked={usageSummary}
            onChange={handleUsageSummaryChange}
            label={t('settings.usageSummary')}
          />
          <ToggleRow
            checked={referenceTracker}
            onChange={handleReferenceTrackerChange}
            label={t('settings.referenceTracker')}
          />
          <ToggleRow
            checked={enableDebugLogs}
            onChange={handleDebugLogsChange}
            label={t('settings.enableDebugLogs')}
          />
        </div>
      </SectionCard>

      {/* === 3. 工具与扩展 === */}
      <SectionCard
        title={t('settings.trustedTools')}
        accent="amber"
        icon={<Wrench size={14} className="text-amber-500" />}
      >
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card">
          <span className="text-sm font-medium text-foreground whitespace-nowrap">{t('settings.configureMCP')}</span>
          <Select value={configureMcp} onValueChange={handleConfigureMcpChange}>
            <SelectTrigger className="h-8 text-xs ml-auto w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Enabled">{t('settings.configureMCPEnabled')}</SelectItem>
              <SelectItem value="Disabled">{t('settings.configureMCPDisabled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Input
          value={trustedTools}
          onChange={e => setTrustedTools(e.target.value)}
          onBlur={e => handleTrustedToolsSave(e.target.value)}
          placeholder={t('settings.trustedToolsPlaceholder')}
          className="h-8 text-xs"
        />
        <p className="text-[11px] text-muted-foreground">{t('settings.trustedToolsDesc')}</p>
      </SectionCard>

      {/* === 4. 网络代理 === */}
      <SectionCard
        title={t('settings.proxy')}
        accent="green"
        icon={<Network size={14} className="text-emerald-500" />}
        desc={t('settings.proxyTip')}
      >
        <div className="space-y-3">
          {/* Kiro IDE 代理输入 + 操作按钮 */}
          <div>
            <Label className="block text-[11px] text-muted-foreground mb-1">{t('settings.httpProxy')}</Label>
            <div className="flex gap-1.5">
              <Input
                value={httpProxy}
                onChange={e => setHttpProxy(e.target.value)}
                placeholder="http://127.0.0.1:7897"
                className="h-8 text-xs flex-1 font-mono"
              />
              <button
                onClick={handleDetectProxy}
                disabled={detectingProxy}
                className="px-2.5 h-8 border rounded-md bg-card hover:bg-muted/50 border-border text-foreground transition-colors disabled:opacity-50 inline-flex items-center justify-center cursor-pointer"
                title={t('settings.detectProxyTitle')}
              >
                {detectingProxy ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
              </button>
              <button
                onClick={handleApplyProxy}
                disabled={savingProxy || !proxyChanged}
                className={`px-3 h-8 rounded-md inline-flex items-center gap-1 text-xs font-medium border transition-colors disabled:opacity-50 cursor-pointer ${
                  proxyChanged
                    ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                {savingProxy ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                <span className="hidden sm:inline">{savingProxy ? t('settings.saving') : t('settings.apply')}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card">
            <div className="min-w-0">
              <span className="text-sm font-medium text-foreground whitespace-nowrap">{t('settings.appProxyMode')}</span>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t('settings.appProxyModeDesc')}</p>
            </div>
            <Select value={appProxyMode} onValueChange={handleAppProxyModeChange}>
              <SelectTrigger className="h-8 text-xs ml-auto w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="followKiro">{t('settings.appProxyFollowKiro')}</SelectItem>
                <SelectItem value="disabled">{t('settings.appProxyDisabled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

export default SettingsKiro
