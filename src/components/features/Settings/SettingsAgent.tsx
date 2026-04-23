import { Switch } from '../../ui/switch'
import { Card, CardContent } from '../../ui/card'
import React from 'react'

interface SettingsAgentProps {
  enableCodebaseIndexing: boolean;
  enableTabAutocomplete: boolean;
  usageSummary: boolean;
  codeReferences: boolean;
  enableDebugLogs: boolean;
  referenceTracker: boolean;
  handleCodebaseIndexingChange: (checked: boolean) => Promise<void>;
  handleTabAutocompleteChange: (checked: boolean) => Promise<void>;
  handleUsageSummaryChange: (checked: boolean) => Promise<void>;
  handleCodeReferencesChange: (checked: boolean) => Promise<void>;
  handleDebugLogsChange: (checked: boolean) => Promise<void>;
  handleReferenceTrackerChange: (checked: boolean) => Promise<void>;
  t: (key: string) => string;
}

function SettingsAgent({
  enableCodebaseIndexing,
  enableTabAutocomplete,
  usageSummary,
  codeReferences,
  enableDebugLogs,
  referenceTracker,
  handleCodebaseIndexingChange,
  handleTabAutocompleteChange,
  handleUsageSummaryChange,
  handleCodeReferencesChange,
  handleDebugLogsChange,
  handleReferenceTrackerChange,
  t
}: SettingsAgentProps) {
  return (
    <Card className="card-glow animate-slide-in-left delay-200 mb-6">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">{t('settings.agentSettings')}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t('settings.agentSettingsDesc')}</p>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50">
            <Switch checked={enableCodebaseIndexing} onCheckedChange={handleCodebaseIndexingChange} />
            <span className="text-xs text-foreground">{t('settings.enableCodebaseIndexing')}</span>
          </div>
          <div className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50">
            <Switch checked={enableTabAutocomplete} onCheckedChange={handleTabAutocompleteChange} />
            <span className="text-xs text-foreground">{t('settings.enableTabAutocomplete')}</span>
          </div>
          <div className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50">
            <Switch checked={usageSummary} onCheckedChange={handleUsageSummaryChange} />
            <span className="text-xs text-foreground">{t('settings.usageSummary')}</span>
          </div>
          <div className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50">
            <Switch checked={codeReferences} onCheckedChange={handleCodeReferencesChange} />
            <span className="text-xs text-foreground">{t('settings.codeReferences')}</span>
          </div>
          <div className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50">
            <Switch checked={enableDebugLogs} onCheckedChange={handleDebugLogsChange} />
            <span className="text-xs text-foreground">{t('settings.enableDebugLogs')}</span>
          </div>
          <div className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50">
            <Switch checked={referenceTracker} onCheckedChange={handleReferenceTrackerChange} />
            <span className="text-xs text-foreground">{t('settings.referenceTracker')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default SettingsAgent
