import { useEffect, useMemo, useState } from 'react'
import { Copy, KeyRound, Loader2, Play, Square } from 'lucide-react'

import {
  getKskIdeRegions,
  getKskIdeStatus,
  KskIdeStatus,
  startKskIde,
  stopKskIde,
} from '../../../api/kskIdeApi'
import {
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../../shared/dialog'
import { Button } from '../../shared/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'

interface KskIsolatedIdeModalProps {
  onClose: () => void
}

const IDLE_STATUS: KskIdeStatus = {
  running: false,
  region: null,
  pid: null,
  sessionId: null,
  startedAt: null,
}

function KskIsolatedIdeModal({ onClose }: KskIsolatedIdeModalProps) {
  const [ksk, setKsk] = useState('')
  const [region, setRegion] = useState('')
  const [regions, setRegions] = useState<string[]>([])
  const [status, setStatus] = useState<KskIdeStatus>(IDLE_STATUS)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<'start' | 'stop' | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([getKskIdeRegions(), getKskIdeStatus()])
      .then(([availableRegions, currentStatus]) => {
        if (!active) return
        setRegions(availableRegions)
        setRegion(currentStatus.region || availableRegions[0] || '')
        setStatus(currentStatus)
      })
      .catch(cause => active && setError(String(cause)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const diagnostic = useMemo(() => [
    `状态: ${status.running ? '运行中' : '未运行'}`,
    `区域: ${status.region || '-'}`,
    `会话: ${status.sessionId || '-'}`,
    `PID: ${status.pid || '-'}`,
    `启动时间: ${status.startedAt || '-'}`,
  ].join('\n'), [status])

  const handleStart = async () => {
    setAction('start')
    setError('')
    try {
      const nextStatus = await startKskIde({ ksk: ksk.trim(), region })
      setStatus(nextStatus)
      setKsk('')
    } catch (cause) {
      setError(String(cause))
    } finally {
      setAction(null)
    }
  }

  const handleStop = async () => {
    setAction('stop')
    setError('')
    try {
      setStatus(await stopKskIde())
    } catch (cause) {
      setError(String(cause))
    } finally {
      setAction(null)
    }
  }

  const handleCopyDiagnostic = async () => {
    try {
      await navigator.clipboard.writeText(diagnostic)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch (cause) {
      setError(`复制诊断摘要失败: ${String(cause)}`)
    }
  }

  const busy = loading || action !== null

  return (
    <DialogRoot open onOpenChange={open => !open && onClose()}>
      <DialogContent maxWidth="520px">
        <DialogHeader icon={KeyRound} iconColor="text-amber-400" iconBg="bg-amber-500/10">
          <DialogTitle>KSK 隔离 Kiro IDE</DialogTitle>
          <DialogDescription>
            KSK 仅保存在 KAM 当前运行时内存中；正式 Kiro 配置和登录态不会被修改。
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            首版仅保证核心聊天链路。用量、订阅、MCP、自动补全等功能可能显示不可用。
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">KSK</span>
            <input
              type="password"
              value={ksk}
              onChange={event => setKsk(event.target.value)}
              placeholder="ksk_..."
              autoComplete="off"
              spellCheck={false}
              disabled={status.running || busy}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">区域</span>
            <Select value={region} onValueChange={setRegion} disabled={status.running || busy}>
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="选择 Kiro 区域" />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                {regions.map(item => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">
                  {status.running ? '隔离实例运行中' : '隔离实例未运行'}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {status.running
                    ? `${status.region} · 会话 ${status.sessionId} · PID ${status.pid}`
                    : '启动后 KAM 会创建独立 profile 和动态 loopback 代理。'}
                </div>
              </div>
              <span className={`h-2.5 w-2.5 rounded-full ${status.running ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
              {error}
            </div>
          )}
        </DialogBody>

        <DialogFooter className="justify-between">
          <Button variant="secondary" size="sm" onClick={handleCopyDiagnostic} disabled={busy}>
            <Copy size={14} />
            {copied ? '已复制' : '复制诊断摘要'}
          </Button>
          <div className="flex gap-2">
            {status.running ? (
              <Button variant="danger" size="sm" onClick={handleStop} disabled={busy}>
                {action === 'stop' ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
                停止隔离 Kiro
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleStart}
                disabled={busy || !region || !ksk.trim().startsWith('ksk_')}
              >
                {action === 'start' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                启动隔离 Kiro
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}

export default KskIsolatedIdeModal
