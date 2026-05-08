import { Server, Dice6, Plus, RotateCw, Scale, TrendingUp, Shuffle, Zap, Activity } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { GatewaySurfaceCard } from './GatewayShared'
import React from 'react'

interface GatewayConfigProps {
  colors: any;
  config: any;
  hasFieldErrors: boolean;
  hasUnsavedChanges: boolean;
  fieldErrors: Record<string, string>;
  setField: (key: string, value: any) => void;
  handleGenerateApiKey: () => void;
  securitySummary: any;
  routingSummary: any;
  accountOptions: any[];
  groupOptions: any[];
  actionSummary: any;
  ThemedAlert: React.ComponentType<any>;
  setConfig: React.Dispatch<React.SetStateAction<any>>;
  applyGatewayLocalOnlyChange: (config: any, checked: boolean, generator: () => string) => any;
  createGeneratedApiKey: () => string;
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
  createGeneratedApiKey}: GatewayConfigProps) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <GatewaySurfaceCard colors={colors}>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Server size={16} />
              <div className={`font-semibold text-foreground`}>网关配置</div>
            </div>
            <div className="flex items-center gap-2">
              {hasFieldErrors ? <Badge variant="destructive">配置待修正</Badge> : null}
              {hasUnsavedChanges ? <Badge variant="secondary">未保存变更</Badge> : <Badge variant="default">已同步</Badge>}
            </div>
          </div>

          <div className={`text-sm text-muted-foreground`}>
            配置监听地址、账号路由、安全策略等核心参数
          </div>

          <div className="flex flex-col gap-6 pt-2">
            {/* 网络配置 */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground flex items-center gap-2">
                <div className="w-1 h-4 bg-primary rounded-full"></div>
                网络配置
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>监听地址</Label>
                  <Input
                    value={config.host}
                    onChange={(e) => setField('host', e.target.value || '127.0.0.1')}
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
                    onChange={(e) => setField('port', Number(e.target.value) || 8765)}
                    className={fieldErrors.port ? 'border-red-500' : ''}
                  />
                  {fieldErrors.port && <div className="text-xs text-red-500">{fieldErrors.port}</div>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Region</Label>
                  <Select value={config.region} onValueChange={(v) => setField('region', v || 'us-east-1')}>
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
            </div>

            {/* 客户端认证 */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground flex items-center gap-2">
                <div className="w-1 h-4 bg-primary rounded-full"></div>
                客户端认证
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>客户端 API Keys</Label>
                <div className="text-xs text-muted-foreground">每行一个 Key，客户端可使用任意一个</div>
                <Textarea
                  placeholder={'sk-primary\nsk-secondary'}
                  rows={3}
                  value={config.clientApiKeysText}
                  onChange={(e) => {
                    const clientApiKeysText = e.target.value
                    const primaryApiKey = clientApiKeysText
                      .split(/[\n,]+/)
                      .map(item => item.trim())
                      .find(Boolean) || ''
                    setConfig((prev: any) => ({ ...prev, clientApiKeysText, apiKey: primaryApiKey }))
                  }}
                  className={fieldErrors.clientApiKeysText ? 'border-red-500' : ''}
                  autoComplete="off"
                />
                {fieldErrors.clientApiKeysText && <div className="text-xs text-red-500">{fieldErrors.clientApiKeysText}</div>}
                <div className="flex justify-end gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="outline" onClick={handleGenerateApiKey} className="h-8 w-8">
                        <Dice6 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>随机生成并追加</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        onClick={() => {
                          setConfig((prev: any) => ({
                            ...prev,
                            clientApiKeysText: prev.clientApiKeysText ? `${prev.clientApiKeysText}\n` : ''
                          }))
                        }}
                        className="h-8 w-8"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>追加空行</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* 账号路由 */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground flex items-center gap-2">
                <div className="w-1 h-4 bg-primary rounded-full"></div>
                账号路由
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>账号来源</Label>
                  <Select value={config.accountMode} onValueChange={(v) => setField('accountMode', v || 'single')}>
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
                  <div className="text-xs text-muted-foreground">
                    {config.accountMode === 'single' && '固定使用一个账号'}
                    {config.accountMode === 'group' && '使用指定分组的账号'}
                    {config.accountMode === 'pool' && '使用所有可用账号，最大化资源利用'}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>路由策略</Label>
                  <Select value={config.strategy} onValueChange={(v) => setField('strategy', v || 'round_robin')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round_robin">
                        <div className="flex items-center gap-2">
                          <RotateCw size={14} />
                          <span>轮询</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="balanced">
                        <div className="flex items-center gap-2">
                          <Scale size={14} />
                          <span>均衡使用</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="most_quota">
                        <div className="flex items-center gap-2">
                          <TrendingUp size={14} />
                          <span>优先剩余额度</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="random">
                        <div className="flex items-center gap-2">
                          <Shuffle size={14} />
                          <span>随机</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="weighted_random">
                        <div className="flex items-center gap-2">
                          <Zap size={14} />
                          <span>加权随机</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="least_connections">
                        <div className="flex items-center gap-2">
                          <Activity size={14} />
                          <span>最少连接</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">
                    {config.strategy === 'balanced' && '优先使用成功次数最少的账号'}
                    {config.strategy === 'round_robin' && '按顺序轮流使用账号'}
                    {config.strategy === 'most_quota' && '优先使用剩余配额最多的账号'}
                    {config.strategy === 'random' && '随机选择账号'}
                    {config.strategy === 'weighted_random' && '根据健康分数加权随机'}
                    {config.strategy === 'least_connections' && '优先使用活跃连接最少的账号'}
                  </div>
                </div>
              </div>

              {config.accountMode === 'single' && (
                <div className="flex flex-col gap-1.5">
                  <Label>指定账号</Label>
                  <Select value={config.accountId} onValueChange={(v) => setField('accountId', v)}>
                    <SelectTrigger className={fieldErrors.accountId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="选择一个账号" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountOptions.map(opt => (
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
                  <Select value={config.groupId} onValueChange={(v) => setField('groupId', v)}>
                    <SelectTrigger className={fieldErrors.groupId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="选择一个分组" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.groupId && <div className="text-xs text-red-500">{fieldErrors.groupId}</div>}
                </div>
              )}
            </div>

            {/* 安全与访问 */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground flex items-center gap-2">
                <div className="w-1 h-4 bg-primary rounded-full"></div>
                安全与访问
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex flex-col gap-1">
                    <Label>仅允许本机访问</Label>
                    <div className="text-xs text-muted-foreground">开启后拒绝非本机请求</div>
                  </div>
                  <Switch
                    checked={!!config.localOnly}
                    onCheckedChange={(checked) => {
                      setConfig((prev: any) => applyGatewayLocalOnlyChange(prev, checked, createGeneratedApiKey))
                    }}
                  />
                </div>

                {!config.localOnly && (
                  <div className="flex flex-col gap-1.5">
                    <Label>IP 白名单</Label>
                    <div className="text-xs text-muted-foreground">支持单个 IP 或 CIDR，每行或逗号分隔</div>
                    <Textarea
                      placeholder={'192.168.1.10\n10.0.0.0/24'}
                      rows={2}
                      value={config.allowedIpsText}
                      onChange={(e) => setField('allowedIpsText', e.target.value)}
                      className={fieldErrors.allowedIpsText ? 'border-red-500' : ''}
                    />
                    {fieldErrors.allowedIpsText && <div className="text-xs text-red-500">{fieldErrors.allowedIpsText}</div>}
                  </div>
                )}
              </div>
            </div>

            {/* 高级选项 */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground flex items-center gap-2">
                <div className="w-1 h-4 bg-primary rounded-full"></div>
                高级选项
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>切换阈值 (%)</Label>
                  <Input
                    type="number"
                    value={config.threshold}
                    min={1}
                    max={100}
                    onChange={(e) => setField('threshold', Number(e.target.value) || 90)}
                  />
                  <div className="text-xs text-muted-foreground">账号使用率达到该值时切换</div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>日志级别</Label>
                  <Select value={config.logLevel} onValueChange={(v) => setField('logLevel', v || 'debug')}>
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

                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex flex-col gap-1">
                    <Label>自动启动</Label>
                    <div className="text-xs text-muted-foreground">随应用启动</div>
                  </div>
                  <Switch
                    checked={!!config.enabled}
                    onCheckedChange={(checked) => setField('enabled', checked)}
                  />
                </div>
              </div>
            </div>
          </div>

          {hasFieldErrors ? (
            <ThemedAlert color="red" variant="light" title="保存前需修正" colors={colors}>
              <div className={`text-sm text-muted-foreground`}>
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
              <div className={`text-sm text-muted-foreground`}>
                {actionSummary.description}
              </div>
            </ThemedAlert>
          )}
        </div>
      </GatewaySurfaceCard>
    </div>
  )
}

export default GatewayConfig
