import React, { useState } from 'react'
import { Server, Dice6, Plus, RotateCw, Scale, TrendingUp, Shuffle, Zap, Activity, Copy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { GatewaySurfaceCard } from './GatewayShared'
import ModelMappingDialog from './ModelMappingDialog'
import ApiKeysDialog from './ApiKeysDialog'

interface GatewayConfigProps {
  colors: any;
  config: any;
  hasFieldErrors: boolean;
  hasUnsavedChanges: boolean;
  fieldErrors: Record<string, string>;
  setField: (key: string, value: any) => void;
  handleGenerateApiKey: () => void;
  accountOptions: any[];
  groupOptions: any[];
  actionSummary: any;
  ThemedAlert: React.ComponentType<any>;
  setConfig: React.Dispatch<React.SetStateAction<any>>;
  applyGatewayLocalOnlyChange: (config: any, checked: boolean, generator: () => string) => any;
  createGeneratedApiKey: () => string;
  handleSaveConfig: () => Promise<void>;
  handleAutoStartToggle: (checked: boolean) => Promise<void>;
}

function GatewayConfig({
  colors,
  config,
  hasFieldErrors,
  hasUnsavedChanges,
  fieldErrors,
  setField,
  handleGenerateApiKey,
  accountOptions,
  groupOptions,
  actionSummary,
  ThemedAlert,
  setConfig,
  applyGatewayLocalOnlyChange,
  createGeneratedApiKey,
  handleSaveConfig,
  handleAutoStartToggle,
}: GatewayConfigProps) {
  const [showModelMappingDialog, setShowModelMappingDialog] = useState(false)
  const [showApiKeysDialog, setShowApiKeysDialog] = useState(false)

  return (
    <div className="grid grid-cols-1 gap-4">
      <GatewaySurfaceCard colors={colors}>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Server size={16} />
              <div className="font-semibold text-foreground">网关配置</div>
            </div>
            <div className="flex items-center gap-2">
              {hasFieldErrors ? <Badge variant="destructive">配置待修正</Badge> : null}
              {hasUnsavedChanges ? <Badge variant="secondary">未保存变更</Badge> : <Badge variant="default">已同步</Badge>}
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            配置监听地址、账号路由、安全策略等核心参数
          </div>

          <div className="flex flex-col gap-6 pt-2">
            {/* Section 1: 网络与路由 */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground flex items-center gap-2">
                <div className="w-1 h-4 bg-primary rounded-full"></div>
                网络与路由
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>监听地址</Label>
                  <Input
                    value={config.host}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField('host', e.target.value || '127.0.0.1')}
                    className={fieldErrors.host ? 'border-red-500' : ''}
                  />
                  {fieldErrors.host && <div className="text-xs text-red-500">{fieldErrors.host}</div>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>端口</Label>
                  <Input
                    type="number"
                    value={config.port}
                    min={1}
                    max={65535}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField('port', Number(e.target.value) || 8765)}
                    className={fieldErrors.port ? 'border-red-500' : ''}
                  />
                  {fieldErrors.port && <div className="text-xs text-red-500">{fieldErrors.port}</div>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Region</Label>
                  <Select value={config.region} onValueChange={(v: string) => setField('region', v || 'us-east-1')}>
                    <SelectTrigger className={fieldErrors.region ? 'border-red-500' : ''}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us-east-1">us-east-1</SelectItem>
                      <SelectItem value="eu-central-1">eu-central-1</SelectItem>
                      <SelectItem value="us-west-2">us-west-2</SelectItem>
                      <SelectItem value="ap-northeast-1">ap-northeast-1</SelectItem>
                      <SelectItem value="ap-southeast-1">ap-southeast-1</SelectItem>
                      <SelectItem value="us-gov-west-1">us-gov-west-1</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldErrors.region && <div className="text-xs text-red-500">{fieldErrors.region}</div>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>账号来源</Label>
                  <Select value={config.accountMode} onValueChange={(v: string) => setField('accountMode', v || 'single')}>
                    <SelectTrigger className={fieldErrors.accountMode ? 'border-red-500' : ''}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">指定单账号</SelectItem>
                      <SelectItem value="group">按分组账号池</SelectItem>
                      <SelectItem value="pool">账号管理池（推荐）</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldErrors.accountMode && <div className="text-xs text-red-500">{fieldErrors.accountMode}</div>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>路由策略</Label>
                  <Select value={config.strategy} onValueChange={(v: string) => setField('strategy', v || 'round_robin')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round_robin"><div className="flex items-center gap-2"><RotateCw size={14} /><span>轮询</span></div></SelectItem>
                      <SelectItem value="balanced"><div className="flex items-center gap-2"><Scale size={14} /><span>均衡使用</span></div></SelectItem>
                      <SelectItem value="most_quota"><div className="flex items-center gap-2"><TrendingUp size={14} /><span>优先剩余额度</span></div></SelectItem>
                      <SelectItem value="random"><div className="flex items-center gap-2"><Shuffle size={14} /><span>随机</span></div></SelectItem>
                      <SelectItem value="weighted_random"><div className="flex items-center gap-2"><Zap size={14} /><span>加权随机</span></div></SelectItem>
                      <SelectItem value="least_connections"><div className="flex items-center gap-2"><Activity size={14} /><span>最少连接</span></div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {config.accountMode === 'single' && (
                <div className="flex flex-col gap-1.5">
                  <Label>指定账号</Label>
                  <Select value={config.accountId} onValueChange={(v: string) => setField('accountId', v)}>
                    <SelectTrigger className={fieldErrors.accountId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="选择一个账号" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountOptions.map((opt: any) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.accountId && <div className="text-xs text-red-500">{fieldErrors.accountId}</div>}
                </div>
              )}

              {config.accountMode === 'group' && (
                <div className="flex flex-col gap-1.5">
                  <Label>账号分组</Label>
                  <Select value={config.groupId} onValueChange={(v: string) => setField('groupId', v)}>
                    <SelectTrigger className={fieldErrors.groupId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="选择一个分组" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupOptions.map((opt: any) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.groupId && <div className="text-xs text-red-500">{fieldErrors.groupId}</div>}
                </div>
              )}
            </div>

            {/* Section 2: 客户端认证与模型 */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground flex items-center gap-2">
                <div className="w-1 h-4 bg-primary rounded-full"></div>
                客户端认证与模型
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                  <div className="text-xs text-muted-foreground">
                    {(() => {
                      const rawKeys = (config.clientApiKeysText || '').split(/[\n,]+/).map((k: string) => k.trim()).filter(Boolean)
                      const enabledCount = rawKeys.filter((k: string) => !k.startsWith('#disabled#')).length
                      return rawKeys.length > 0
                        ? `${rawKeys.length} 个 Key，${enabledCount} 个启用`
                        : '暂无 API Key'
                    })()}
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowApiKeysDialog(true)}>
                    管理 Keys
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                  <div className="text-xs text-muted-foreground">
                    {config.modelMappings?.length > 0
                      ? `${config.modelMappings.length} 条映射规则，${config.modelMappings.filter((r: any) => r.enabled).length} 条启用`
                      : '暂无映射规则'}
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowModelMappingDialog(true)}>
                    <Shuffle size={12} className="mr-1" />
                    映射规则
                  </Button>
                </div>
              </div>
              {fieldErrors.clientApiKeysText && <div className="text-xs text-red-500">{fieldErrors.clientApiKeysText}</div>}
            </div>

            {/* Section 3: 安全与高级 */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground flex items-center gap-2">
                <div className="w-1 h-4 bg-primary rounded-full"></div>
                安全与高级
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex flex-col gap-0.5">
                    <Label className="text-xs">仅本机访问</Label>
                  </div>
                  <Switch
                    checked={!!config.localOnly}
                    onCheckedChange={(checked: boolean) => {
                      setConfig((prev: any) => applyGatewayLocalOnlyChange(prev, checked, createGeneratedApiKey))
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>切换阈值 (%)</Label>
                  <Input
                    type="number"
                    value={config.threshold}
                    min={1}
                    max={100}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField('threshold', Number(e.target.value) || 90)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>日志级别</Label>
                  <Select value={config.logLevel} onValueChange={(v: string) => setField('logLevel', v || 'debug')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debug">debug</SelectItem>
                      <SelectItem value="info">info</SelectItem>
                      <SelectItem value="warn">warn</SelectItem>
                      <SelectItem value="error">error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!config.localOnly && (
                <div className="flex flex-col gap-1.5">
                  <Label>IP 白名单</Label>
                  <Textarea
                    placeholder={'192.168.1.10\n10.0.0.0/24'}
                    rows={2}
                    value={config.allowedIpsText}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setField('allowedIpsText', e.target.value)}
                    className={fieldErrors.allowedIpsText ? 'border-red-500' : ''}
                  />
                  {fieldErrors.allowedIpsText && <div className="text-xs text-red-500">{fieldErrors.allowedIpsText}</div>}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex flex-col gap-0.5">
                    <Label className="text-xs">自动启动</Label>
                  </div>
                  <Switch checked={!!config.enabled} onCheckedChange={handleAutoStartToggle} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex flex-col gap-0.5">
                    <Label className="text-xs">Claude Code 精简</Label>
                  </div>
                  <Switch checked={!!config.filterClaudeCode} onCheckedChange={(checked: boolean) => setField('filterClaudeCode', checked)} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex flex-col gap-0.5">
                    <Label className="text-xs">去除边界标记</Label>
                  </div>
                  <Switch checked={!!config.filterStripBoundaries} onCheckedChange={(checked: boolean) => setField('filterStripBoundaries', checked)} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex flex-col gap-0.5">
                    <Label className="text-xs">去除环境噪音</Label>
                  </div>
                  <Switch checked={!!config.filterEnvNoise} onCheckedChange={(checked: boolean) => setField('filterEnvNoise', checked)} />
                </div>
              </div>
            </div>
          </div>

          {/* Error/Success Alert */}
          {hasFieldErrors ? (
            <ThemedAlert color="red" variant="light" title="保存前需修正" colors={colors}>
              <div className="text-sm text-muted-foreground">
                {Object.values(fieldErrors).join('；')}
              </div>
            </ThemedAlert>
          ) : (
            <ThemedAlert
              color={actionSummary.tone}
              variant="light"
              colors={colors}
              title={actionSummary.title}
            >
              <div className="text-sm text-muted-foreground">
                {actionSummary.description}
              </div>
            </ThemedAlert>
          )}
        </div>
      </GatewaySurfaceCard>

      {/* ModelMappingDialog */}
      <ModelMappingDialog
        open={showModelMappingDialog}
        onOpenChange={setShowModelMappingDialog}
        modelMappings={config.modelMappings}
        setField={setField}
      />

      {/* ApiKeysDialog */}
      <ApiKeysDialog
        open={showApiKeysDialog}
        onOpenChange={setShowApiKeysDialog}
        clientApiKeysText={config.clientApiKeysText}
        setConfig={setConfig}
        handleGenerateApiKey={handleGenerateApiKey}
      />
    </div>
  )
}

export default GatewayConfig
