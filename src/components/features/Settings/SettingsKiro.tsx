import { Lock, Search, RefreshCw, Check } from 'lucide-react'
import { Card, CardContent } from '../../ui/card'
import { Input } from '../../ui/input'
import { Textarea } from '../../ui/textarea'
import { Switch } from '../../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Label } from '../../ui/label'
import { AI_MODELS } from './settingsConstants'
import React from 'react'

interface SettingsKiroProps {
  aiModel: string;
  lockModel: boolean;
  agentAutonomy: string;
  trustedCommandsMode: string;
  customTrustedCommands: string;
  trustedTools: string;
  setTrustedTools: (value: string) => void;
  configureMcp: string;
  httpProxy: string;
  setHttpProxy: (value: string) => void;
  originalProxy: string;
  savingProxy: boolean;
  detectingProxy: boolean;
  savingModel: boolean;
  handleApplyModel: (model: string) => Promise<void>;
  handleLockModelChange: (checked: boolean) => Promise<void>;
  handleAgentAutonomyChange: (mode: string) => Promise<void>;
  handleTrustedCommandsModeChange: (mode: string) => Promise<void>;
  handleCustomTrustedCommandsChange: (commands: string) => Promise<void>;
  handleTrustedToolsSave: (value: string) => Promise<void>;
  handleConfigureMcpChange: (mode: string) => Promise<void>;
  handleApplyProxy: () => Promise<void>;
  handleDetectProxy: () => Promise<void>;
  t: (key: string) => string;
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
  handleApplyModel,
  handleLockModelChange,
  handleAgentAutonomyChange,
  handleTrustedCommandsModeChange,
  handleCustomTrustedCommandsChange,
  handleTrustedToolsSave,
  handleConfigureMcpChange,
  handleApplyProxy,
  handleDetectProxy,
  t
}: SettingsKiroProps) {
  const proxyChanged = httpProxy !== originalProxy

  return (
    <Card className="card-glow animate-slide-in-left delay-150 mb-6">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">{t('settings.kiroSettings')}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t('settings.kiroSettingsDesc')}</p>

        <div className="grid grid-cols-2 gap-6">
          {/* 左列：下拉选项 + 代理 */}
          <div className="space-y-4">
            {/* AI 模型 */}
            <div>
              <Label className="block text-sm text-muted-foreground mb-1.5">
                {t('settings.aiModel')} {savingModel && <span className="text-xs ml-2 text-primary">{t('settings.saving')}</span>}
              </Label>
              <Select value={aiModel} onValueChange={handleApplyModel} disabled={savingModel}>
                <SelectTrigger className="text-foreground bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {AI_MODELS.map(model => (
                    <SelectItem key={model.value} value={model.value} className="text-foreground">
                      {model.recommended ? `${model.label} (⭐ ${t('common.recommended')})` : model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 锁定模型 */}
            <div className="flex items-center gap-3 cursor-pointer rounded-lg p-3 border border-border bg-muted/30 hover:bg-muted/50">
              <Switch checked={lockModel} onCheckedChange={handleLockModelChange} />
              <Lock size={14} className="text-muted-foreground" />
              <div>
                <span className="text-sm text-foreground">{t('settings.lockModel')}</span>
                <p className="text-xs text-muted-foreground">{t('settings.lockModelDesc')}</p>
              </div>
            </div>

            {/* Agent 自主模式 */}
            <div>
              <Label className="block text-sm text-muted-foreground mb-1.5">{t('settings.agentAutonomy')}</Label>
              <Select value={agentAutonomy} onValueChange={handleAgentAutonomyChange}>
                <SelectTrigger className="text-foreground bg-background border-border focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="Supervised" className="text-foreground">{t('settings.agentSupervised')}</SelectItem>
                  <SelectItem value="Autopilot" className="text-foreground">{t('settings.agentAutopilot')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 信任命令 */}
            <div>
              <Label className="block text-sm text-muted-foreground mb-1.5">{t('settings.trustedCommands')}</Label>
              <Select value={trustedCommandsMode} onValueChange={handleTrustedCommandsModeChange}>
                <SelectTrigger className="text-foreground bg-background border-border focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="none" className="text-foreground">{t('settings.trustedCommandsNone')}</SelectItem>
                  <SelectItem value="common" className="text-foreground">{t('settings.trustedCommandsCommon')}</SelectItem>
                  <SelectItem value="all" className="text-foreground">{t('settings.trustedCommandsAll')}</SelectItem>
                </SelectContent>
              </Select>
              {trustedCommandsMode === 'common' && (
                <Textarea
                  value={customTrustedCommands}
                  onChange={(e) => handleCustomTrustedCommandsChange(e.target.value)}
                  placeholder="npm *&#10;git *&#10;cargo *"
                  className="text-foreground bg-background border-border focus:ring-primary/20 font-mono text-sm mt-2"
                  rows={3}
                />
              )}
              <p className="text-xs text-muted-foreground mt-1">{t('settings.trustedCommandsDesc')}</p>
            </div>

            {/* 信任工具 */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">{t('settings.trustedTools')}</label>
              <Input
                value={trustedTools}
                onChange={(e) => setTrustedTools(e.target.value)}
                onBlur={(e) => handleTrustedToolsSave(e.target.value)}
                placeholder={t('settings.trustedToolsPlaceholder')}
                className="text-foreground bg-background border-border"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('settings.trustedToolsDesc')}</p>
            </div>

            {/* MCP 配置 */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">{t('settings.configureMCP')}</label>
              <Select value={configureMcp} onValueChange={handleConfigureMcpChange}>
                <SelectTrigger className="text-foreground bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="Enabled" className="text-foreground">{t('settings.configureMCPEnabled')}</SelectItem>
                  <SelectItem value="Disabled" className="text-foreground">{t('settings.configureMCPDisabled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* HTTP 代理 */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">{t('settings.httpProxy')}</label>
              <div className="flex gap-2">
                <Input
                  value={httpProxy}
                  onChange={(e) => setHttpProxy(e.target.value)}
                  placeholder="http://127.0.0.1:7897"
                  className="text-foreground bg-background border-border flex-1"
                />
                <button
                  onClick={handleDetectProxy}
                  disabled={detectingProxy}
                  className="px-3 py-2 border rounded-lg bg-card hover:bg-muted/50 border-border text-foreground flex items-center gap-1 text-xs"
                  title={t('settings.detectProxyTitle')}
                >
                  {detectingProxy ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                  {t('settings.detect')}
                </button>
                <button
                  onClick={handleApplyProxy}
                  disabled={savingProxy || !proxyChanged}
                  className={`px-3 py-2 rounded-lg flex items-center gap-1 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed border ${proxyChanged
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border"
                    }`}
                >
                  {savingProxy ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  {savingProxy ? t('settings.saving') : t('settings.apply')}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t('settings.proxyTip')}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default SettingsKiro
