import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Shield, CheckCircle, XCircle, Download, Play, Square, Plus, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

interface MitmStatus {
  running: boolean
  port: number
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
      const s = await invoke<MitmStatus>('get_mitm_status')
      setStatus(s)
      setPort(s.port)
      if (s.targetDeviceId) setTargetDeviceId(s.targetDeviceId)
      setMitmDomains(s.mitmDomains.join('\n'))
    } catch (e) {
      console.error('Failed to get MITM status:', e)
    }
  }

  useEffect(() => { fetchStatus() }, [])

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
      alert(`安装失败（需要管理员权限）: ${e}`)
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

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* 标题 */}
        <div className="flex items-center gap-3">
          <Shield size={22} />
          <div>
            <h1 className="text-lg font-bold">MITM 代理</h1>
            <p className="text-sm text-muted-foreground">拦截 Kiro IDE 请求，支持机器码替换和提示词过滤</p>
          </div>
        </div>

        {/* Section 1: 代理控制 */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status?.running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-sm font-medium">{status?.running ? `运行中 :${port}` : '已停止'}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={status?.running || !status?.caInstalled}>
                <Play size={14} className="mr-1" />启动
              </Button>
              <Button size="sm" variant="destructive" disabled={!status?.running}>
                <Square size={14} className="mr-1" />停止
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">监听端口</Label>
              <Input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} className="h-8" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">记录日志</Label>
              <div className="flex items-center h-8">
                <Switch checked={logRequests} onCheckedChange={setLogRequests} />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: CA 证书 */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="text-sm font-medium flex items-center gap-2">
            <div className="w-1 h-4 bg-primary rounded-full" />
            CA 证书
          </div>
          <div className="flex items-center gap-2">
            {status?.caInstalled ? (
              <><CheckCircle size={14} className="text-green-500" /><span className="text-sm">已生成</span></>
            ) : (
              <><XCircle size={14} className="text-muted-foreground" /><span className="text-sm text-muted-foreground">未生成</span></>
            )}
          </div>
          {status?.caCertPath && (
            <div className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded truncate" title={status.caCertPath}>
              {status.caCertPath}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleGenerateCa} disabled={loading}>
              <RefreshCw size={12} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
              {status?.caInstalled ? '重新生成' : '生成'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleInstallCa} disabled={!status?.caInstalled || loading}>
              安装到系统
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportCa} disabled={!status?.caInstalled}>
              <Download size={12} className="mr-1" />导出
            </Button>
          </div>
        </div>

        {/* Section 3: 机器码替换 */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="text-sm font-medium flex items-center gap-2">
            <div className="w-1 h-4 bg-primary rounded-full" />
            机器码替换
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">目标机器码（64位十六进制，留空不替换）</Label>
            <Input
              placeholder="e.g. a1b2c3d4e5f6..."
              value={targetDeviceId}
              onChange={(e) => setTargetDeviceId(e.target.value)}
              className="h-8 font-mono text-xs"
              maxLength={64}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            替换请求中的 Machine ID，实现多人共享同一账号
          </p>
        </div>

        {/* Section 4: 提示词过滤 */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="text-sm font-medium flex items-center gap-2">
            <div className="w-1 h-4 bg-primary rounded-full" />
            提示词过滤
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">过滤 Kiro IDE 系统提示</Label>
            <Switch checked={filterKiroPrompt} onCheckedChange={setFilterKiroPrompt} />
          </div>
          {filterKiroPrompt && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">替换为（留空则完全删除）</Label>
              <Textarea
                placeholder="You are a helpful AI assistant."
                value={customPromptReplacement}
                onChange={(e) => setCustomPromptReplacement(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>
          )}
        </div>

        {/* Section 5: 拦截域名 */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="text-sm font-medium flex items-center gap-2">
            <div className="w-1 h-4 bg-primary rounded-full" />
            拦截域名
          </div>
          <Textarea
            value={mitmDomains}
            onChange={(e) => setMitmDomains(e.target.value)}
            rows={3}
            className="font-mono text-xs"
            placeholder="q.us-east-1.amazonaws.com&#10;q.eu-central-1.amazonaws.com"
          />
          <p className="text-xs text-muted-foreground">每行一个域名，只有匹配的域名会被 MITM 拦截，其他流量直连</p>
        </div>

        {/* Section 6: 使用说明 */}
        <div className="border rounded-lg p-4 space-y-2 bg-muted/20">
          <div className="text-sm font-medium">使用步骤</div>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>生成并安装 CA 证书到系统信任存储</li>
            <li>设置系统环境变量 <code className="bg-muted px-1 rounded text-xs">HTTPS_PROXY=http://127.0.0.1:{port}</code></li>
            <li>重启 Kiro IDE</li>
            <li>启动 MITM 代理</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default MitmProxy
