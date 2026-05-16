import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Shield, CheckCircle2, XCircle, AlertCircle, Download, Play, Square,
  RefreshCw, Copy, Check, FolderOpen, Globe, Cpu, Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface MitmStatus {
  running: boolean
  port: number
  caGenerated: boolean
  caInstalled: boolean
  caCertPath: string | null
  mitmDomains: string[]
  targetDeviceId: string | null
}

function MitmProxy() {
  const [status, setStatus] = useState<MitmStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [port, setPort] = useState(8766)
  const [targetDeviceId, setTargetDeviceId] = useState('')
  const [mitmDomains, setMitmDomains] = useState('')
  const [logRequests, setLogRequests] = useState(true)
  const [filterKiroPrompt, setFilterKiroPrompt] = useState(false)
  const [customPromptReplacement, setCustomPromptReplacement] = useState('')

  const fetchStatus = async () => {
    try {
      const [s, cfg] = await Promise.all([
        invoke<MitmStatus>('get_mitm_status'),
        invoke<{
          port?: number
          targetDeviceId?: string | null
          mitmDomains?: string[]
          logRequests?: boolean
          filterKiroPrompt?: boolean
          customPromptReplacement?: string | null
        }>('get_mitm_config'),
      ])
      setStatus(s)
      setPort(cfg.port || 8766)
      setTargetDeviceId(cfg.targetDeviceId || '')
      setMitmDomains((cfg.mitmDomains || s.mitmDomains || []).join('\n'))
      setLogRequests(cfg.logRequests ?? true)
      setFilterKiroPrompt(cfg.filterKiroPrompt ?? false)
      setCustomPromptReplacement(cfg.customPromptReplacement || '')
    } catch (e) {
      console.error('Failed to get MITM status:', e)
    }
  }

  useEffect(() => { fetchStatus() }, [])

  const saveConfig = async () => {
    try {
      await invoke('save_mitm_config', {
        configData: {
          port,
          targetDeviceId: targetDeviceId || null,
          mitmDomains: mitmDomains.split('\n').map(s => s.trim()).filter(Boolean),
          logRequests,
          filterKiroPrompt,
          customPromptReplacement: customPromptReplacement || null,
          enabled: status?.running ?? false,
        },
      })
    } catch (e) {
      console.error('Save config failed:', e)
    }
  }

  // 配置变更时自动保存（1.5s debounce）
  useEffect(() => {
    const timer = setTimeout(saveConfig, 1500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port, targetDeviceId, mitmDomains, logRequests, filterKiroPrompt, customPromptReplacement])

  const handleGenerateCa = async () => {
    setLoading(true)
    try {
      await invoke('generate_mitm_ca')
      await fetchStatus()
    } catch (e) {
      console.error('Generate CA failed:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleInstallCa = async () => {
    setLoading(true)
    try {
      await invoke('install_mitm_ca')
      await fetchStatus()
    } catch (e) {
      alert(`安装失败：${e}`)
    } finally {
      setLoading(false)
    }
  }

  const handleExportCa = async () => {
    try {
      const pem = await invoke<string>('get_mitm_ca_pem')
      const blob = new Blob([pem], { type: 'application/x-pem-file' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'kiro-account-manager-ca.crt'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export CA failed:', e)
    }
  }

  const handleStart = async () => {
    setLoading(true)
    try {
      await invoke('start_mitm_proxy', {
        port,
        targetDeviceId: targetDeviceId || null,
        mitmDomains: mitmDomains.split('\n').map(s => s.trim()).filter(Boolean),
      })
      await fetchStatus()
    } catch (e) {
      alert(`启动失败：${e}`)
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      await invoke('stop_mitm_proxy')
      await fetchStatus()
    } catch (e) {
      alert(`停止失败：${e}`)
    } finally {
      setLoading(false)
    }
  }

  // 当前步骤推进
  const stepCa = status?.caInstalled ? 'done' : status?.caGenerated ? 'partial' : 'todo'
  const stepStart = status?.running ? 'done' : stepCa === 'done' ? 'active' : 'pending'

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        {/* 顶部：状态总览条 */}
        <div className="border rounded-lg bg-card overflow-hidden">
          <div className="flex items-center gap-4 p-4">
            <div className="flex items-center gap-2.5">
              <Shield size={20} className="text-primary" />
              <div>
                <div className="text-base font-semibold leading-tight">MITM 代理</div>
                <div className="text-xs text-muted-foreground">拦截 Kiro IDE 请求 · 机器码替换 · 提示词过滤</div>
              </div>
            </div>
            <div className="flex-1" />
            <StatusPill running={!!status?.running} port={port} />
            {status?.running ? (
              <Button size="sm" variant="destructive" onClick={handleStop} disabled={loading}>
                <Square size={14} className="mr-1.5" />停止
              </Button>
            ) : (
              <Button size="sm" onClick={handleStart} disabled={loading || !status?.caGenerated}>
                <Play size={14} className="mr-1.5" />启动
              </Button>
            )}
          </div>
          <div className="grid grid-cols-3 border-t divide-x bg-muted/20">
            <StatTile
              icon={<Shield size={14} />}
              label="CA 证书"
              value={
                stepCa === 'done' ? '已安装' : stepCa === 'partial' ? '已生成' : '未生成'
              }
              tone={stepCa === 'done' ? 'success' : stepCa === 'partial' ? 'warn' : 'muted'}
            />
            <StatTile
              icon={<Globe size={14} />}
              label="拦截域名"
              value={`${mitmDomains.split('\n').filter(Boolean).length} 个`}
              tone="muted"
            />
            <StatTile
              icon={<Cpu size={14} />}
              label="机器码替换"
              value={targetDeviceId ? '已设置' : '未启用'}
              tone={targetDeviceId ? 'success' : 'muted'}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* 左：3 步引导（占 3/5）*/}
          <div className="lg:col-span-3 space-y-3">
            {/* Step 1 · CA 证书 */}
            <StepCard index={1} title="安装 CA 证书" state={stepCa === 'done' ? 'done' : stepCa === 'partial' ? 'active' : 'active'}>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  {status?.caGenerated ? (
                    <Badge variant="secondary" className="gap-1"><CheckCircle2 size={11} className="text-green-600" />已生成</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-muted-foreground"><XCircle size={11} />未生成</Badge>
                  )}
                  {status?.caInstalled ? (
                    <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"><CheckCircle2 size={11} />已安装到系统</Badge>
                  ) : status?.caGenerated ? (
                    <Badge variant="outline" className="gap-1 text-orange-600 border-orange-500/30"><AlertCircle size={11} />未安装到系统</Badge>
                  ) : null}
                </div>

                {status?.caCertPath && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1.5">
                    <FolderOpen size={12} className="shrink-0" />
                    <code className="font-mono truncate" title={status.caCertPath}>{status.caCertPath}</code>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleGenerateCa} disabled={loading}>
                    <RefreshCw size={12} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                    {status?.caGenerated ? '重新生成' : '生成'}
                  </Button>
                  <Button size="sm" onClick={handleInstallCa} disabled={!status?.caGenerated || status?.caInstalled || loading}>
                    {status?.caInstalled ? '已安装' : '安装到系统'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExportCa} disabled={!status?.caGenerated}>
                    <Download size={12} className="mr-1.5" />导出
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  生成根证书后，「安装到系统」会弹出系统授权对话框（Windows UAC / macOS / Linux pkexec），自动加入信任存储。
                </p>
              </div>
            </StepCard>

            {/* Step 2 · 启动并验证 */}
            <StepCard index={2} title="启动代理并使用 Kiro" state={stepStart === 'done' ? 'done' : stepStart === 'active' ? 'active' : 'pending'}>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">监听端口</Label>
                    <Input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      className="h-8"
                      disabled={status?.running}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">记录请求日志</Label>
                    <div className="h-8 flex items-center">
                      <Switch checked={logRequests} onCheckedChange={setLogRequests} />
                    </div>
                  </div>
                </div>

                {!status?.caGenerated && (
                  <div className="flex items-start gap-2 text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded px-2 py-1.5">
                    <AlertCircle size={13} className="shrink-0 mt-px" />
                    <span>请先完成 Step 1 生成 CA 证书，否则启动后 TLS 握手会失败。</span>
                  </div>
                )}

                <details className="group">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none flex items-center gap-1.5">
                    <Globe size={12} />
                    <span>需要 Kiro IDE 走代理？查看环境变量配置</span>
                  </summary>
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <Tabs defaultValue="windows" className="w-full">
                      <TabsList className="h-7">
                        <TabsTrigger value="windows" className="text-xs h-5">Windows</TabsTrigger>
                        <TabsTrigger value="unix" className="text-xs h-5">macOS / Linux</TabsTrigger>
                        <TabsTrigger value="single" className="text-xs h-5">仅作用 Kiro</TabsTrigger>
                      </TabsList>
                      <TabsContent value="windows" className="mt-2 space-y-2">
                        <CommandRow
                          label="PowerShell（永久，重启终端生效）"
                          command={`[System.Environment]::SetEnvironmentVariable('HTTPS_PROXY','http://127.0.0.1:${port}','User'); [System.Environment]::SetEnvironmentVariable('HTTP_PROXY','http://127.0.0.1:${port}','User')`}
                        />
                        <CommandRow
                          label="cmd（临时，仅当前终端）"
                          command={`set HTTPS_PROXY=http://127.0.0.1:${port}&& set HTTP_PROXY=http://127.0.0.1:${port}`}
                        />
                      </TabsContent>
                      <TabsContent value="unix" className="mt-2 space-y-2">
                        <CommandRow
                          label="bash / zsh（写入 ~/.zshrc 或 ~/.bashrc）"
                          command={`export HTTPS_PROXY=http://127.0.0.1:${port}\nexport HTTP_PROXY=http://127.0.0.1:${port}`}
                        />
                      </TabsContent>
                      <TabsContent value="single" className="mt-2 space-y-2">
                        <CommandRow
                          label="Windows · 仅本次启动 Kiro"
                          command={`set HTTPS_PROXY=http://127.0.0.1:${port}&& "%LOCALAPPDATA%\\Programs\\Kiro\\Kiro.exe"`}
                        />
                        <CommandRow
                          label="macOS / Linux · 仅本次启动 Kiro"
                          command={`HTTPS_PROXY=http://127.0.0.1:${port} HTTP_PROXY=http://127.0.0.1:${port} kiro`}
                        />
                      </TabsContent>
                    </Tabs>
                    <p className="text-[11px] text-muted-foreground">设置后必须重启 Kiro 才生效。</p>
                  </div>
                </details>
              </div>
            </StepCard>
          </div>

          {/* 右：高级配置（占 2/5）*/}
          <div className="lg:col-span-2">
            <div className="border rounded-lg bg-card sticky top-4">
              <div className="px-4 py-3 border-b">
                <div className="text-sm font-semibold">高级配置</div>
                <div className="text-xs text-muted-foreground mt-0.5">所有改动会自动保存</div>
              </div>

              <Tabs defaultValue="domains" className="w-full">
                <TabsList className="w-full grid grid-cols-3 h-9 rounded-none border-b bg-transparent">
                  <TabsTrigger value="domains" className="text-xs gap-1"><Globe size={12} />域名</TabsTrigger>
                  <TabsTrigger value="machine" className="text-xs gap-1"><Cpu size={12} />机器码</TabsTrigger>
                  <TabsTrigger value="prompt" className="text-xs gap-1"><Filter size={12} />提示词</TabsTrigger>
                </TabsList>

                <TabsContent value="domains" className="p-4 space-y-2 mt-0">
                  <Label className="text-xs text-muted-foreground">每行一个域名，匹配的会被 MITM 拦截，其他直连</Label>
                  <Textarea
                    value={mitmDomains}
                    onChange={(e) => setMitmDomains(e.target.value)}
                    rows={9}
                    className="font-mono text-xs"
                  />
                </TabsContent>

                <TabsContent value="machine" className="p-4 space-y-3 mt-0">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">目标机器码（64 位小写十六进制）</Label>
                    <Input
                      placeholder="留空不替换"
                      value={targetDeviceId}
                      onChange={(e) => setTargetDeviceId(e.target.value.toLowerCase())}
                      className="h-8 font-mono text-xs"
                      maxLength={64}
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">长度 {targetDeviceId.length}/64</span>
                      {targetDeviceId.length === 64 && /^[a-f0-9]{64}$/.test(targetDeviceId) && (
                        <span className="text-green-600 flex items-center gap-1"><Check size={11} />格式正确</span>
                      )}
                      {targetDeviceId.length > 0 && targetDeviceId.length !== 64 && (
                        <span className="text-orange-600">需 64 位</span>
                      )}
                      {targetDeviceId.length === 64 && !/^[a-f0-9]{64}$/.test(targetDeviceId) && (
                        <span className="text-red-600">仅小写 hex</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    替换请求中所有出现的 64 位机器码（包括 User-Agent 头、x-kiro-machineid 头、系统提示词中的 Machine ID 字段），实现多人共享账号。
                  </p>
                </TabsContent>

                <TabsContent value="prompt" className="p-4 space-y-3 mt-0">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">过滤 Kiro 系统提示</Label>
                      <p className="text-xs text-muted-foreground">检测 Kiro IDE 提示特征并替换</p>
                    </div>
                    <Switch checked={filterKiroPrompt} onCheckedChange={setFilterKiroPrompt} />
                  </div>
                  {filterKiroPrompt && (
                    <div className="space-y-1.5 pt-2 border-t">
                      <Label className="text-xs text-muted-foreground">替换为</Label>
                      <Textarea
                        placeholder="留空使用默认精简提示"
                        value={customPromptReplacement}
                        onChange={(e) => setCustomPromptReplacement(e.target.value)}
                        rows={5}
                        className="text-xs"
                      />
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== 子组件 =====

function StatusPill({ running, port }: { running: boolean; port: number }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-muted/60">
      <div className={`w-2 h-2 rounded-full ${running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
      <span className="text-xs font-medium">
        {running ? `运行中 :${port}` : '已停止'}
      </span>
    </div>
  )
}

function StatTile({
  icon, label, value, tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'success' | 'warn' | 'muted'
}) {
  const valueClass =
    tone === 'success' ? 'text-green-600 dark:text-green-400' :
      tone === 'warn' ? 'text-orange-600 dark:text-orange-400' :
        'text-foreground'
  return (
    <div className="px-4 py-2.5 flex items-center gap-2.5">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-sm font-medium ${valueClass}`}>{value}</div>
      </div>
    </div>
  )
}

function StepCard({
  index, title, state, children,
}: {
  index: number
  title: string
  state: 'todo' | 'active' | 'done' | 'pending'
  children: React.ReactNode
}) {
  const dot =
    state === 'done' ? (
      <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0">
        <Check size={14} />
      </div>
    ) : state === 'active' ? (
      <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
        {index}
      </div>
    ) : (
      <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-semibold shrink-0">
        {index}
      </div>
    )

  return (
    <div className={`border rounded-lg bg-card overflow-hidden ${state === 'pending' ? 'opacity-60' : ''}`}>
      <div className="px-4 py-3 flex items-center gap-3 border-b bg-muted/20">
        {dot}
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function CommandRow({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      console.error('Copy failed:', e)
    }
  }
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-stretch gap-1.5">
        <code className="flex-1 bg-muted/60 border px-2.5 py-1.5 rounded text-xs font-mono break-all whitespace-pre-wrap leading-relaxed">{command}</code>
        <Button
          size="sm"
          variant={copied ? 'default' : 'outline'}
          className="h-auto px-2.5 shrink-0"
          onClick={handleCopy}
        >
          {copied ? <><Check size={12} className="mr-1" />已复制</> : <><Copy size={12} className="mr-1" />复制</>}
        </Button>
      </div>
    </div>
  )
}

export default MitmProxy
