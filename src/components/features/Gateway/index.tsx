import { startTransition, useCallback, useEffect, useMemo, useState } from 'react'
import { Play, RotateCcw, Square, Zap, Save, ScrollText } from 'lucide-react'
import { Alert as AlertPrimitive, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../../hooks/useApp'
import { Stack, Group, Badge, Card, Text } from '@/components/shared/layout'
import GatewayConfigComponent from './GatewayConfig'
import { RequestLogsDialog } from './RequestLogsDialog'
import { GatewayConfig, GatewayStatus } from './gatewayPageState'
import {
  GatewayConfigProvider,
  GatewayStatusProvider,
  GatewayDataProvider
} from './contexts'
import { 
  applyGatewayLocalOnlyChange, 
  buildGatewayActionSummary, 
  buildGatewayBaseUrl, 
  buildGatewayIntegrationSummary, 
  buildGatewayRoutingSummary, 
  buildGatewaySecuritySummary, 
  createGatewayFieldErrors, 
  formatGatewayAccountOptionLabel, 
  formatGatewayTimestamp, 
  mergeErrorHistory 
} from './gatewayPageUtils'
import {
  buildGatewayConfigSnapshot,
  buildGatewayRuntimeSnapshot,
  buildGatewayStatusState,
  DEFAULT_GATEWAY_CONFIG,
  DEFAULT_GATEWAY_STATUS,
  loadGatewayPageData,
  openGatewayLogDir,
  saveGatewayConfig,
  startGateway,
  stopGateway,
  hydrateGatewayConfig
} from './gatewayPageState'
import { useGatewayPolling } from './useGatewayPolling'
import React from 'react'

function Alert(props: any) {
  return <AlertPrimitive {...props} />
}

function ThemedAlert({ title, children, ...props }: any) {
  return (
    <Alert {...props}>
      {title && <AlertTitle className={"text-foreground"}>{title}</AlertTitle>}
      <AlertDescription className={"text-muted-foreground"}>
        {children}
      </AlertDescription>
    </Alert>
  )
}

function GatewayPage() {
  const { t } = useApp()

  // 定义反代页面使用的色彩系统
  const colors = useMemo(() => ({
    inputFocus: 'focus:ring-primary/20 focus:border-primary',
  }), [])

  const [config, setConfig] = useState<GatewayConfig>(DEFAULT_GATEWAY_CONFIG)
  const [status, setStatus] = useState<GatewayStatus>(DEFAULT_GATEWAY_STATUS)
  const [errorHistory, setErrorHistory] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copySuccess, setCopySuccess] = useState('')
  const [logDir, setLogDir] = useState('')
  const [showRequestLogs, setShowRequestLogs] = useState(false)
  const [savedConfigSnapshot, setSavedConfigSnapshot] = useState(() => buildGatewayConfigSnapshot(DEFAULT_GATEWAY_CONFIG))
  const [appliedRuntimeSnapshot, setAppliedRuntimeSnapshot] = useState<any>(null)
  const [lastStatusSyncAt, setLastStatusSyncAt] = useState('-')
  const [showClientConfig, setShowClientConfig] = useState(false)
  const [clientConfigLoading, setClientConfigLoading] = useState(false)
  const [clientConfigResults, setClientConfigResults] = useState<any[]>([])
  const [selectedClients, setSelectedClients] = useState<string[]>(['claudeCode'])

  const accountOptions = useMemo(
    () => accounts.map(account => ({
      value: account.id,
      label: formatGatewayAccountOptionLabel(account)})),
    [accounts]
  )

  const groupOptions = useMemo(
    () => groups.map(group => ({ value: group.id, label: group.name })),
    [groups]
  )

  const fieldErrors = useMemo(() => createGatewayFieldErrors(config), [config])
  const hasFieldErrors = Object.keys(fieldErrors).length > 0
  const configSnapshot = useMemo(() => buildGatewayConfigSnapshot(config), [config])
  const runtimeSnapshot = useMemo(() => buildGatewayRuntimeSnapshot(config), [config])
  const hasUnsavedChanges = configSnapshot !== savedConfigSnapshot
  const hasRuntimeChanges = !!status.running && !!appliedRuntimeSnapshot && runtimeSnapshot !== appliedRuntimeSnapshot
  
  const effectiveConfig = useMemo(
    () => (status.running && status.runtimeConfig ? status.runtimeConfig : config),
    [status.running, status.runtimeConfig, config]
  )
  const effectiveBaseUrl = useMemo(
    () => buildGatewayBaseUrl(effectiveConfig.host, effectiveConfig.port, effectiveConfig.localOnly),
    [effectiveConfig.host, effectiveConfig.port, effectiveConfig.localOnly]
  )
  const actionSummary = useMemo(
    () => buildGatewayActionSummary({ running: status.running, isDirty: hasUnsavedChanges, hasUnsavedChanges, hasRuntimeChanges, hasFieldErrors }),
    [status.running, hasUnsavedChanges, hasRuntimeChanges, hasFieldErrors]
  )
  const effectiveSecuritySummary = useMemo(
    () => buildGatewaySecuritySummary({ config: effectiveConfig }),
    [effectiveConfig]
  )
  const integrationSummary = useMemo(
    () => buildGatewayIntegrationSummary({
      baseUrl: effectiveBaseUrl,
      apiKey: effectiveConfig.clientApiKeysText || effectiveConfig.apiKey,
      clientApiKeysText: effectiveConfig.clientApiKeysText || effectiveConfig.apiKey,
      logDir,
      errorHistory}),
    [effectiveBaseUrl, effectiveConfig.clientApiKeysText, effectiveConfig.apiKey, logDir, errorHistory]
  )
  const effectiveRoutingSummary = useMemo(() => buildGatewayRoutingSummary({
    config: effectiveConfig,
    counts: {
      accounts: accounts.length,
      groups: groups.length},
    selectedLabels: {
      single: accountOptions.find(item => item.value === effectiveConfig.accountId)?.label,
      group: groupOptions.find(item => item.value === effectiveConfig.groupId)?.label}}), [effectiveConfig, accounts.length, groups.length, accountOptions, groupOptions])

  const latestErrorEntry = useMemo(
    () => errorHistory[0] || null,
    [errorHistory]
  )

  const consoleHighlights = useMemo(() => ([
    {
      label: '当前入口',
      value: effectiveBaseUrl,
      detail: `${effectiveConfig.localOnly ? '仅本机访问' : '允许远程访问'} · ${status.running ? '运行中' : '待启动'}`},
    {
      label: '客户端 Key',
      value: effectiveSecuritySummary.apiKeyState,
      detail: integrationSummary.authLabel},
    {
      label: '路由模式',
      value: effectiveRoutingSummary.modeLabel,
      detail: `${effectiveRoutingSummary.selectionLabel}：${effectiveRoutingSummary.selectionValue}`},
    {
      label: '最近风险',
      value: latestErrorEntry ? '需要排查' : '状态平稳',
      detail: latestErrorEntry?.message || `最后同步 ${lastStatusSyncAt}`},
    {
      label: '运行差异',
      value: hasRuntimeChanges ? '需重启生效' : '运行态已对齐',
      detail: hasUnsavedChanges ? '页面有未保存配置' : '配置已保存'},
  ]), [
    effectiveBaseUrl,
    effectiveConfig.localOnly,
    status.running,
    effectiveSecuritySummary.apiKeyState,
    integrationSummary.authLabel,
    effectiveRoutingSummary.modeLabel,
    effectiveRoutingSummary.selectionLabel,
    effectiveRoutingSummary.selectionValue,
    latestErrorEntry,
    lastStatusSyncAt,
    hasRuntimeChanges,
    hasUnsavedChanges,
  ])

  const pollingFallbackConfig = useMemo(
    () => ({
      host: config.host,
      port: config.port}),
    [config.host, config.port]
  )

  const pushError = (msg: any) => {
    const normalized = String(msg?.message || msg || '').trim()
    if (!normalized) return
    setErrorHistory(prev => mergeErrorHistory(prev, normalized, formatGatewayTimestamp(), 8))
  }

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const { gatewayConfig, gatewayStatus, accounts: accountList, groups: groupList, logDir: gatewayLogDir } = await loadGatewayPageData()

      const nextConfig = hydrateGatewayConfig(gatewayConfig)
      const nextStatus = buildGatewayStatusState(gatewayStatus, gatewayConfig, nextConfig)
      const runtimeConfig = gatewayStatus?.running && nextStatus.runtimeConfig ? nextStatus.runtimeConfig : null
      setConfig(nextConfig)
      setSavedConfigSnapshot(buildGatewayConfigSnapshot(nextConfig))
      setAppliedRuntimeSnapshot(runtimeConfig ? buildGatewayRuntimeSnapshot(runtimeConfig) : null)
      setStatus(nextStatus)
      setLastStatusSyncAt(formatGatewayTimestamp())
      setAccounts(accountList)
      setGroups(groupList)
      setLogDir(gatewayLogDir)

      if (gatewayStatus?.lastError) {
        pushError(gatewayStatus.lastError)
      }
    } catch (e) {
      pushError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    startTransition(() => {
      loadAll()
    })
  }, [loadAll])

  const handleStatusPoll = useCallback(({ status: nextStatus, fallbackConfig, syncedAt }: any) => {
    const nextState = buildGatewayStatusState(nextStatus, nextStatus, fallbackConfig)
    setStatus(nextState)
    setAppliedRuntimeSnapshot(nextState.running && nextState.runtimeConfig
      ? buildGatewayRuntimeSnapshot(nextState.runtimeConfig)
      : null)
    setLastStatusSyncAt(syncedAt)
    if (nextStatus?.lastError) {
      pushError(nextStatus.lastError)
    }
  }, [])

  useGatewayPolling({
    activeTab: 'config',
    fallbackConfig: pollingFallbackConfig,
    onStatus: handleStatusPoll})

  const setField = (key: string, value: any) => setConfig(prev => ({ ...prev, [key]: value }))

  const createGeneratedApiKey = () => {
    const random = crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now()}${Math.random().toString(36).slice(2)}`
    return `sk-${random}`
  }

  const handleRefresh = async () => {
    await loadAll()
  }

  const handleClearErrors = () => {
    setErrorHistory([])
  }

  const handleGenerateApiKey = () => {
    setConfig(prev => {
      const generatedKey = createGeneratedApiKey()
      const existingKeys = String(prev.clientApiKeysText || prev.apiKey || '').trim()
      const clientApiKeysText = existingKeys ? `${existingKeys}\n${generatedKey}` : generatedKey
      return {
        ...prev,
        apiKey: generatedKey,
        clientApiKeysText}
    })
  }

  const handleOpenLogDir = async () => {
    try {
      const dir = await openGatewayLogDir()
      setLogDir(String(dir || ''))
    } catch (e) {
      pushError(e)
    }
  }

  const guardInvalidConfig = () => {
    if (!hasFieldErrors) {
      return false
    }
    pushError('请先修正表单错误后再继续')
    return true
  }

  const handleSave = async () => {
    if (guardInvalidConfig()) return
    setSaving(true)
    try {
      await saveGatewayConfig(config)
      setSavedConfigSnapshot(buildGatewayConfigSnapshot(config))
      // 保存成功后，如果网关正在运行则自动重启使配置生效
      if (status.running) {
        await stopGateway()
        const st = await startGateway(config)
        const nextStatus = buildGatewayStatusState(st, st, config)
        setStatus(nextStatus)
        setAppliedRuntimeSnapshot(nextStatus.runtimeConfig ? buildGatewayRuntimeSnapshot(nextStatus.runtimeConfig) : buildGatewayRuntimeSnapshot(config))
        setLastStatusSyncAt(formatGatewayTimestamp())
      }
    } catch (e) {
      pushError(e)
    } finally {
      setSaving(false)
    }
  }

  const handleStart = async () => {
    if (guardInvalidConfig()) return
    setSaving(true)
    try {
      const st = await startGateway(config)
      const nextStatus = buildGatewayStatusState(st, st, config)
      setStatus(nextStatus)
      setAppliedRuntimeSnapshot(nextStatus.runtimeConfig ? buildGatewayRuntimeSnapshot(nextStatus.runtimeConfig) : buildGatewayRuntimeSnapshot(config))
      setLastStatusSyncAt(formatGatewayTimestamp())
    } catch (e) {
      pushError(e)
    } finally {
      setSaving(false)
    }
  }

  const handleRestart = async () => {
    if (guardInvalidConfig()) return
    setSaving(true)
    try {
      if (status.running) {
        await stopGateway()
      }
      const st = await startGateway(config)
      const nextStatus = buildGatewayStatusState(st, st, config)
      setStatus(nextStatus)
      setAppliedRuntimeSnapshot(nextStatus.runtimeConfig ? buildGatewayRuntimeSnapshot(nextStatus.runtimeConfig) : buildGatewayRuntimeSnapshot(config))
      setLastStatusSyncAt(formatGatewayTimestamp())
    } catch (e) {
      pushError(e)
    } finally {
      setSaving(false)
    }
  }

  const handleStop = async () => {
    setSaving(true)
    try {
      await stopGateway()
      setStatus(prev => ({ ...prev, running: false }))
      setAppliedRuntimeSnapshot(null)
      setLastStatusSyncAt(formatGatewayTimestamp())
    } catch (e) {
      pushError(e)
    } finally {
      setSaving(false)
    }
  }

  const handleAutoStartToggle = async (checked: boolean) => {
    setField('enabled', checked)
    
    // 延迟执行，确保 setField 先更新状态
    setTimeout(async () => {
      try {
        // 先保存配置
        await saveGatewayConfig({ ...config, enabled: checked })
        setSavedConfigSnapshot(buildGatewayConfigSnapshot({ ...config, enabled: checked }))
        
        // 如果勾选自动启动且配置有效，立即启动反代
        if (checked && !hasFieldErrors) {
          setSaving(true)
          const st = await startGateway({ ...config, enabled: checked })
          const nextStatus = buildGatewayStatusState(st, st, { ...config, enabled: checked })
          setStatus(nextStatus)
          setAppliedRuntimeSnapshot(nextStatus.runtimeConfig ? buildGatewayRuntimeSnapshot(nextStatus.runtimeConfig) : buildGatewayRuntimeSnapshot({ ...config, enabled: checked }))
          setLastStatusSyncAt(formatGatewayTimestamp())
          setSaving(false)
        } else if (!checked && status.running) {
          // 如果取消自动启动且反代正在运行，停止反代
          setSaving(true)
          await stopGateway()
          setStatus(prev => ({ ...prev, running: false }))
          setAppliedRuntimeSnapshot(null)
          setLastStatusSyncAt(formatGatewayTimestamp())
          setSaving(false)
        }
      } catch (e) {
        pushError(e)
        setSaving(false)
      }
    }, 100)
  }

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopySuccess(successMessage)
      setTimeout(() => setCopySuccess(''), 1600)
    } catch (e) {
      pushError(e)
    }
  }

  const handleConfigureClients = async () => {
    setClientConfigLoading(true)
    try {
      const apiKey = effectiveConfig.clientApiKeysText || effectiveConfig.apiKey || ''
      const results = await invoke<any[]>('configure_proxy_clients', {
        clients: selectedClients,
        host: effectiveConfig.host,
        port: effectiveConfig.port,
        apiKey: apiKey.split('\n')[0]?.trim() || apiKey.trim(),
      })
      setClientConfigResults(results)
    } catch (e) {
      pushError(e)
    } finally {
      setClientConfigLoading(false)
    }
  }

  return (
    <GatewayConfigProvider>
      <GatewayStatusProvider>
        <GatewayDataProvider>
            <div className={`h-full overflow-y-auto p-4 glass-main`}>
              <Stack gap="md">
                <Card className={`glass-card border border-border rounded-xl p-4`}>
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Group gap="xs">
                  <Text fw={700} className={"text-foreground"}>Kiro API 反代</Text>
                  <Badge color={status.running ? 'green' : 'gray'}>{status.running ? '运行中' : '已停止'}</Badge>
                  <Badge color={effectiveConfig.localOnly ? 'teal' : 'yellow'}>{effectiveConfig.localOnly ? '本机' : '远程'}</Badge>
                  {hasUnsavedChanges && <Badge variant="light" color="yellow">未保存</Badge>}
                </Group>
                <Text size="sm" className={"text-muted-foreground"}>
                  {effectiveBaseUrl} · {effectiveRoutingSummary.modeLabel} · {effectiveSecuritySummary.apiKeyState}
                </Text>
              </Stack>

              <Group gap="xs">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasUnsavedChanges || hasFieldErrors || saving || loading}
                >
                  <Save size={14} className="mr-1" />
                  {status.running ? '保存并重启' : '保存'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClientConfig(!showClientConfig)}
                  title="一键配置客户端"
                >
                  <Zap size={14} className="mr-1" />
                  配置客户端
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRequestLogs(true)}
                  disabled={!status.running}
                  title="查看请求日志"
                >
                  <ScrollText size={14} className="mr-1" />
                  查看日志
                </Button>
                {!status.running ? (
                  <Button
                    size="sm"
                    onClick={handleStart}
                    disabled={hasFieldErrors || saving || loading}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Play size={14} className="mr-1" />
                    启动
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRestart}
                      disabled={hasFieldErrors || saving || loading}
                    >
                      <RotateCcw size={14} className="mr-1" />
                      重启
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleStop}
                      disabled={saving || loading}
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      <Square size={14} className="mr-1" />
                      停止
                    </Button>
                  </>
                )}
              </Group>
            </Group>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
              {consoleHighlights.map((item) => (
                <div key={item.label} className="border rounded-lg p-2.5">
                  <Text size="xs" className={"text-muted-foreground"}>{item.label}</Text>
                  <Text fw={700} size="sm" className={"text-foreground"}>{item.value}</Text>
                </div>
              ))}
            </div>
          </Stack>
        </Card>

        <GatewayConfigComponent
          colors={colors}
          config={config}
          hasFieldErrors={hasFieldErrors}
          fieldErrors={fieldErrors}
          setField={setField}
          handleGenerateApiKey={handleGenerateApiKey}
          accountOptions={accountOptions}
          groupOptions={groupOptions}
          setConfig={setConfig}
          applyGatewayLocalOnlyChange={applyGatewayLocalOnlyChange}
          createGeneratedApiKey={createGeneratedApiKey}
          handleSaveConfig={handleSave}
          handleAutoStartToggle={handleAutoStartToggle}
        />

        <RequestLogsDialog open={showRequestLogs} onOpenChange={setShowRequestLogs} />

        {/* 快速配置客户端弹窗 */}
        <Dialog open={showClientConfig} onOpenChange={(open) => { setShowClientConfig(open); if (!open) setClientConfigResults([]) }}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader className="">
              <DialogTitle className="">⚡ 快速配置客户端</DialogTitle>
              <DialogDescription className="">
                一键将反代地址写入客户端配置文件，配置前自动备份
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 mt-2">
              {/* 客户端选择 */}
              <div className="flex gap-3">
                {[
                  { id: 'claudeCode', label: 'Claude Code CLI', desc: '~/.claude/settings.json' },
                  { id: 'codex', label: 'Codex CLI', desc: '~/.codex/auth.json + config.toml' },
                ].map(client => (
                  <div
                    key={client.id}
                    onClick={() => setSelectedClients(prev =>
                      prev.includes(client.id) ? prev.filter(c => c !== client.id) : [...prev, client.id]
                    )}
                    className={`flex-1 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedClients.includes(client.id)
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-muted/20 hover:bg-muted/40'
                    }`}
                  >
                    <Text size="sm" fw={600} className="text-foreground">{client.label}</Text>
                    <Text size="xs" className="text-muted-foreground font-mono mt-1">{client.desc}</Text>
                  </div>
                ))}
              </div>

              {/* 配置预览 */}
              <div className="bg-muted/30 border border-border rounded-xl p-3">
                <Text size="xs" className="text-muted-foreground mb-2">将写入的配置：</Text>
                <div className="flex flex-col gap-2 font-mono text-[11px]">
                  {selectedClients.includes('claudeCode') && (
                    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground text-[10px] font-sans">Claude Code → ~/.claude/settings.json</span>
                      <span className="text-foreground">ANTHROPIC_BASE_URL = {effectiveBaseUrl}</span>
                      <span className="text-foreground">ANTHROPIC_API_KEY = {(effectiveConfig.clientApiKeysText || effectiveConfig.apiKey || '').split('\n')[0]?.substring(0, 12)}***</span>
                    </div>
                  )}
                  {selectedClients.includes('codex') && (
                    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground text-[10px] font-sans">Codex → ~/.codex/config.toml + auth.json</span>
                      <span className="text-foreground">base_url = "{effectiveBaseUrl}/v1"</span>
                      <span className="text-foreground">OPENAI_API_KEY = {(effectiveConfig.clientApiKeysText || effectiveConfig.apiKey || '').split('\n')[0]?.substring(0, 12)}***</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 执行按钮 */}
              <Button
                onClick={handleConfigureClients}
                disabled={selectedClients.length === 0 || clientConfigLoading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Zap size={16} className="mr-1" />
                {clientConfigLoading ? '配置中...' : `一键配置 ${selectedClients.length} 个客户端`}
              </Button>

              {/* 结果展示 */}
              {clientConfigResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  {clientConfigResults.map((result: any, idx: number) => (
                    <div key={idx} className={`p-3 rounded-lg border ${result.success ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                      <Text size="sm" fw={600} className={result.success ? 'text-green-600' : 'text-red-500'}>
                        {result.success ? '✓' : '✗'} {result.client}
                      </Text>
                      {result.success && result.paths?.length > 0 && (
                        <Text size="xs" className="text-muted-foreground font-mono mt-1">
                          {result.paths.join(', ')}
                        </Text>
                      )}
                      {result.error && (
                        <Text size="xs" className="text-red-500 mt-1">{result.error}</Text>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </Stack>
    </div>
        </GatewayDataProvider>
      </GatewayStatusProvider>
    </GatewayConfigProvider>
  )
}

export default GatewayPage
