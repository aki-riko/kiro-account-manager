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
  handleAutoStartToggle}: GatewayConfigProps) {
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
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label>客户端 API Keys</Label>
                  <div className="flex gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={handleGenerateApiKey}
                          className="h-8 gap-1"
                        >
                          <Dice6 className="h-3.5 w-3.5" />
                          生成
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>随机生成并添加</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            const newKey = `sk-${Date.now()}`
                            setConfig((prev: any) => ({
                              ...prev,
                              clientApiKeysText: prev.clientApiKeysText ? `${prev.clientApiKeysText}\n${newKey}` : newKey
                            }))
                          }}
                          className="h-8 gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          添加
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>添加新 Key</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* API Keys 表格 */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 border-b">
                    <div className="flex text-sm">
                      <div className="flex-shrink-0 w-[60px] p-3 font-semibold">#</div>
                      <div className="flex-1 p-3 font-semibold">API Key</div>
                      <div className="flex-shrink-0 w-[100px] p-3 font-semibold text-center">启用</div>
                      <div className="flex-shrink-0 w-[80px] p-3 font-semibold">操作</div>
                    </div>
                  </div>
                  
                  <div className="max-h-[240px] overflow-y-auto">
                    {(() => {
                      const rawKeys = (config.clientApiKeysText || '')
                        .split(/[\n,]+/)
                        .map((k: string) => k.trim())
                        .filter(Boolean)
                      
                      if (rawKeys.length === 0) {
                        return (
                          <div className="p-6 text-center text-sm text-muted-foreground">
                            暂无 API Key，点击"生成"或"添加"按钮创建
                          </div>
                        )
                      }

                      // 解析 Key 的启用状态（使用 #disabled# 前缀标记禁用的 Key）
                      const keys = rawKeys.map((rawKey: string) => {
                        const isDisabled = rawKey.startsWith('#disabled#')
                        const key = isDisabled ? rawKey.substring(10) : rawKey
                        return { key, enabled: !isDisabled }
                      })

                      return keys.map((item: { key: string; enabled: boolean }, idx: number) => (
                        <div key={idx} className="flex text-sm border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                          <div className="flex-shrink-0 w-[60px] p-3 font-mono text-xs text-muted-foreground flex items-center">
                            {idx + 1}
                          </div>
                          <div className="flex-1 p-3">
                            <Input
                              value={item.key}
                              onChange={(e) => {
                                const newKeys = [...keys]
                                newKeys[idx] = { ...newKeys[idx], key: e.target.value }
                                const newRawKeys = newKeys.map(k => k.enabled ? k.key : `#disabled#${k.key}`)
                                setConfig((prev: any) => ({
                                  ...prev,
                                  clientApiKeysText: newRawKeys.join('\n'),
                                  apiKey: newKeys.find(k => k.enabled)?.key || newKeys[0]?.key || ''
                                }))
                              }}
                              className="h-8 font-mono text-xs"
                              placeholder="sk-..."
                              disabled={!item.enabled}
                            />
                          </div>
                          <div className="flex-shrink-0 w-[100px] p-3 flex items-center justify-center">
                            <Switch
                              checked={item.enabled}
                              onCheckedChange={(checked) => {
                                const newKeys = [...keys]
                                newKeys[idx] = { ...newKeys[idx], enabled: checked }
                                const newRawKeys = newKeys.map(k => k.enabled ? k.key : `#disabled#${k.key}`)
                                setConfig((prev: any) => ({
                                  ...prev,
                                  clientApiKeysText: newRawKeys.join('\n'),
                                  apiKey: newKeys.find(k => k.enabled)?.key || newKeys[0]?.key || ''
                                }))
                              }}
                            />
                          </div>
                          <div className="flex-shrink-0 w-[80px] p-3 flex items-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const newKeys = keys.filter((_: any, i: number) => i !== idx)
                                const newRawKeys = newKeys.map(k => k.enabled ? k.key : `#disabled#${k.key}`)
                                setConfig((prev: any) => ({
                                  ...prev,
                                  clientApiKeysText: newRawKeys.join('\n'),
                                  apiKey: newKeys.find(k => k.enabled)?.key || newKeys[0]?.key || ''
                                }))
                              }}
                              className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              删除
                            </Button>
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
                
                {fieldErrors.clientApiKeysText && (
                  <div className="text-xs text-red-500">{fieldErrors.clientApiKeysText}</div>
                )}
                
                <div className="text-xs text-muted-foreground">
                  客户端可使用任意已启用的 Key 进行认证，禁用的 Key 不会被使用
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
                    <Label>仅本机访问（推荐）</Label>
                    <div className="text-xs text-muted-foreground">开启后只允许 127.0.0.1/::1 访问，拒绝局域网其他设备</div>
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
                    <Label>IP 白名单（允许远程访问）</Label>
                    <div className="text-xs text-muted-foreground">允许局域网其他设备访问，支持单个 IP 或 CIDR，每行或逗号分隔</div>
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
                    <div className="text-xs text-muted-foreground">勾选后立即启动反代，并在应用启动时自动启动</div>
                  </div>
                  <Switch
                    checked={!!config.enabled}
                    onCheckedChange={handleAutoStartToggle}
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
