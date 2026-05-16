import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Shield, CheckCircle2, XCircle, AlertCircle, Download, Play, Square,
  RefreshCw, Check, FolderOpen, Globe, Cpu, Filter, Dices, Trash2, ScrollText,
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
  const [logLines, setLogLines] = useState<string[]>([])
  const [logExpanded, setLogExpanded] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const logScrollRef = useRef<HTMLDivElement>(null)

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

  // 日志轮询：运行中或日志面板展开时每 1s 拉一次
  useEffect(() => {
    if (!status?.running && !logExpanded) return
    let cancelled = false
    const tick = async () => {
      try {
        const lines = await invoke<string[]>('read_mitm_log', { maxLines: 200 })
        if (!cancelled) setLogLines(lines)
      } catch {/* 忽略 */ }
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [status?.running, logExpanded])

  // 自动滚到底部
  useEffect(() => {
    if (!autoScroll || !logScrollRef.current) return
    logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight
  }, [logLines, autoScroll])

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

                {/* 实时日志滚动面板 */}
                <div className="border rounded-md overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                    <button
                      type="button"
                      onClick={() => setLogExpanded(!logExpanded)}
                      className="flex items-center gap-1.5 text-xs font-medium hover:text-primary"
                    >
                      <ScrollText size={13} />
                      <span>实时日志</span>
                      <span className="text-muted-foreground">({logLines.length})</span>
                      <span className="text-muted-foreground text-[10px]">{logExpanded ? '▾' : '▸'}</span>
                    </button>
                    <div className="flex items-center gap-1">
                      {status?.running && (
                        <span className="flex items-center gap-1 text-[10px] text-green-600">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                          实时
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => setAutoScroll(!autoScroll)}
                        title="自动滚到底部"
                      >
                        {autoScroll ? '🔒' : '🔓'} 跟随
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5"
                        onClick={async () => {
                          try {
                            await invoke('clear_mitm_log')
                            setLogLines([])
                          } catch (e) { console.error(e) }
                        }}
                        title="清空日志"
                      >
                        <Trash2 size={11} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5"
                        onClick={async () => {
                          try { await invoke('open_mitm_log_dir') }
                          catch (e) { alert(`打开失败：${e}`) }
                        }}
                        title="打开日志目录"
                      >
                        <FolderOpen size={11} />
                      </Button>
                    </div>
                  </div>
                  {logExpanded && (
                    <div
                      ref={logScrollRef}
                      className="bg-zinc-950 text-zinc-100 font-mono text-[11px] leading-relaxed overflow-y-auto"
                      style={{ height: 240 }}
                    >
                      {logLines.length === 0 ? (
                        <div className="p-3 text-zinc-500">暂无日志，启动代理后会实时显示</div>
                      ) : (
                        <div className="p-2.5 space-y-0.5">
                          {logLines.map((line, i) => (
                            <LogLine key={i} line={line} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="留空不替换"
                        value={targetDeviceId}
                        onChange={(e) => setTargetDeviceId(e.target.value.toLowerCase())}
                        className="h-8 font-mono text-xs flex-1"
                        maxLength={64}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 shrink-0"
                        title="生成随机机器码（与 IDE 输出格式一致：64 位小写 hex）"
                        onClick={async () => {
                          const bytes = new Uint8Array(32)
                          crypto.getRandomValues(bytes)
                          const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
                          setTargetDeviceId(hex)
                        }}
                      >
                        <Dices size={13} className="mr-1" />生成
                      </Button>
                    </div>
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

export default MitmProxy

// 实时日志行（按事件类型上色）
function LogLine({ line }: { line: string }) {
  const m = line.match(/^\[([^\]]+)\] (.+)$/)
  const time = m?.[1] ?? ''
  const body = m?.[2] ?? line
  let bodyClass = 'text-zinc-200'
  if (body.startsWith('CONNECT')) bodyClass = 'text-sky-300'
  else if (body.startsWith('已替换机器码')) bodyClass = 'text-emerald-300'
  else if (body.startsWith('已过滤')) bodyClass = 'text-amber-300'
  else if (body.startsWith('代理服务器已启动')) bodyClass = 'text-violet-300'
  else if (body.includes('失败') || body.includes('错误')) bodyClass = 'text-red-400'
  return (
    <div className="flex gap-2">
      <span className="text-zinc-500 shrink-0">{time}</span>
      <span className={bodyClass}>{body}</span>
    </div>
  )
}
