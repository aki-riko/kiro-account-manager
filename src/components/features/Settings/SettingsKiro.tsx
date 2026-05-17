import type React from 'react'
import { Lock, Search, RefreshCw, Check } from 'lucide-react'
import { Input } from '../../ui/input'
import { Textarea } from '../../ui/textarea'
import { Switch } from '../../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Label } from '../../ui/label'
import { AI_MODELS } from './settingsConstants'
import SectionCard from './SectionCard'
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
      {/* === Kiro IDE 配置 === */}
      <SectionCard title={t('settings.kiroSettings')}>
          {/* AI 模型 */}
          <div>
            <Label className="block text-xs text-muted-foreground mb-1">
              {t('settings.aiModel')}
              {savingModel && <span className="text-[10px] ml-2 text-primary">{t('settings.saving')}</span>}
            </Label>
            <Select value={aiModel} onValueChange={handleApplyModel} disabled={savingModel}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AI_MODELS.map(m => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.recommended ? `${m.label} (⭐ ${t('common.recommended')})` : m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 锁定模型（紧凑开关行）*/}
          <label className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 border border-border bg-card hover:bg-muted/40">
            <Switch checked={lockModel} onCheckedChange={handleLockModelChange} />
            <Lock size={13} className="text-muted-foreground" />
            <span className="text-sm text-foreground">{t('settings.lockModel')}</span>
            <span className="text-xs text-muted-foreground ml-1">{t('settings.lockModelDesc')}</span>
          </label>

          {/* Agent 自主模式 + 信任命令（双列）*/}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="block text-xs text-muted-foreground mb-1">{t('settings.agentAutonomy')}</Label>
              <Select value={agentAutonomy} onValueChange={handleAgentAutonomyChange}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Supervised">{t('settings.agentSupervised')}</SelectItem>
                  <SelectItem value="Autopilot">{t('settings.agentAutopilot')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="block text-xs text-muted-foreground mb-1">{t('settings.trustedCommands')}</Label>
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

          {/* 信任工具 */}
          <div>
            <Label className="block text-xs text-muted-foreground mb-1">{t('settings.trustedTools')}</Label>
            <Input
              value={trustedTools}
              onChange={e => setTrustedTools(e.target.value)}
              onBlur={e => handleTrustedToolsSave(e.target.value)}
              placeholder={t('settings.trustedToolsPlaceholder')}
              className="h-8 text-xs"
            />
            <p className="text-[11px] text-muted-foreground mt-1">{t('settings.trustedToolsDesc')}</p>
          </div>

          {/* MCP + HTTP 代理（双列）*/}
          <div className="grid grid-cols-[160px_1fr] gap-3 items-end">
            <div>
              <Label className="block text-xs text-muted-foreground mb-1">{t('settings.configureMCP')}</Label>
              <Select value={configureMcp} onValueChange={handleConfigureMcpChange}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Enabled">{t('settings.configureMCPEnabled')}</SelectItem>
                  <SelectItem value="Disabled">{t('settings.configureMCPDisabled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="block text-xs text-muted-foreground mb-1">{t('settings.httpProxy')}</Label>
              <div className="flex gap-1.5">
                <Input
                  value={httpProxy}
                  onChange={e => setHttpProxy(e.target.value)}
                  placeholder="http://127.0.0.1:7897"
                  className="h-8 text-xs flex-1"
                />
                <button
                  onClick={handleDetectProxy}
                  disabled={detectingProxy}
                  className="px-2 h-8 border rounded-md bg-card hover:bg-muted/50 border-border text-foreground transition-colors disabled:opacity-50"
                  title={t('settings.detectProxyTitle')}
                >
                  {detectingProxy ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                </button>
                <button
                  onClick={handleApplyProxy}
                  disabled={savingProxy || !proxyChanged}
                  className={`px-3 h-8 rounded-md flex items-center gap-1 text-xs font-medium border transition-colors disabled:opacity-50 ${
                    proxyChanged
                      ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {savingProxy ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                  {savingProxy ? t('settings.saving') : t('settings.apply')}
                </button>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1">{t('settings.proxyTip')}</p>
      </SectionCard>

      {/* === Agent 行为开关（原 Agent tab 合并过来）=== */}
      <SectionCard
        title={t('settings.agentSettings')}
        badge={<span className="text-xs text-muted-foreground">{t('settings.agentSettingsDesc')}</span>}
      >
          <div className="grid grid-cols-2 gap-2">
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
    </div>
  )
}

export default SettingsKiro
