import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FolderSearch,
  KeyRound,
  Loader2,
  MonitorPlay,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Square,
  User,
} from 'lucide-react'

import {
  getKskIdeRegions,
  getKskIdeStatus,
  IDLE_KSK_IDE_STATUS,
  KskIdeStatus,
  startKskIde,
  startKskIdeFromAccount,
  stopKskIde,
} from '../../../api/kskIdeApi'
import {
  checkIdeInstallation,
  clearCustomKiroPath,
  getCustomKiroPath,
  setCustomKiroPath,
} from '../../../api/settingsApi'
import { useAccount } from '../../../contexts/AccountContext'
import { getManagedKskEligibility } from '../../../utils/kskIde'
import { showError, showSuccess } from '../../../utils/toast'
import { Button } from '../../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'

type BusyAction = 'account' | 'manual' | 'stop' | 'refresh' | null

interface IdeInstallationInfo {
  ide_executable_exists: boolean
  ide_path: string | null
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

function statusLabel(status: KskIdeStatus) {
  if (status.running) return '运行中'
  if (status.managedKey) return '已停止，等待撤销 KSK'
  return '未运行'
}

function accountLabel(account: { label?: string; email?: string; userId?: string; id: string }) {
  return account.label || account.email || account.userId || account.id
}

function KskIdePage() {
  const { accounts, loading: accountsLoading } = useAccount()
  const [regions, setRegions] = useState<string[]>([])
  const [manualRegion, setManualRegion] = useState('')
  const [manualKsk, setManualKsk] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [status, setStatus] = useState<KskIdeStatus>(IDLE_KSK_IDE_STATUS)
  const [busy, setBusy] = useState<BusyAction>('refresh')
  const [pathBusy, setPathBusy] = useState(false)
  const [error, setError] = useState('')
  const [kiroExecutablePath, setKiroExecutablePath] = useState<string | null>(null)
  const [customKiroPath, setConfiguredKiroPath] = useState<string | null>(null)

  const accountOptions = useMemo(() => accounts.map(account => ({
    account,
    eligibility: getManagedKskEligibility(account),
  })), [accounts])

  const selectedAccount = useMemo(
    () => accountOptions.find(item => item.account.id === selectedAccountId),
    [accountOptions, selectedAccountId],
  )

  const refreshStatus = useCallback(async (notify = false) => {
    setBusy(current => current || 'refresh')
    try {
      const nextStatus = await getKskIdeStatus()
      setStatus(nextStatus)
      setError('')
      if (notify) showSuccess('KSK IDE 状态已刷新')
      return nextStatus
    } catch (cause) {
      const message = String(cause)
      setError(message)
      if (notify) showError(message)
      throw cause
    } finally {
      setBusy(current => current === 'refresh' ? null : current)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([
      getKskIdeRegions(),
      getKskIdeStatus(),
      checkIdeInstallation<IdeInstallationInfo>().catch(() => ({
        ide_executable_exists: false,
        ide_path: null,
      })),
      getCustomKiroPath().catch(() => null),
    ])
      .then(([availableRegions, currentStatus, ideInfo, configuredPath]) => {
        if (!active) return
        setRegions(availableRegions)
        setManualRegion(currentStatus.region || availableRegions[0] || '')
        setStatus(currentStatus)
        setKiroExecutablePath(ideInfo.ide_executable_exists ? ideInfo.ide_path : null)
        setConfiguredKiroPath(configuredPath?.trim() || null)
      })
      .catch(cause => {
        if (active) setError(String(cause))
      })
      .finally(() => {
        if (active) setBusy(null)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedAccountId) return
    if (accountOptions.some(item => (
      item.account.id === selectedAccountId && item.eligibility.eligible
    ))) return
    setSelectedAccountId('')
  }, [accountOptions, selectedAccountId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (busy) return
      getKskIdeStatus().then(setStatus).catch(() => {})
    }, 3000)
    return () => window.clearInterval(timer)
  }, [busy])

  const handleAccountLaunch = async () => {
    if (!selectedAccount) return
    if (!selectedAccount.eligibility.eligible) {
      showError(selectedAccount.eligibility.reason)
      return
    }
    setBusy('account')
    setError('')
    try {
      const nextStatus = await startKskIdeFromAccount({
        accountId: selectedAccount.account.id,
      })
      setStatus(nextStatus)
      showSuccess('短期 KSK 已签发，隔离 Kiro IDE 已启动')
    } catch (cause) {
      const message = String(cause)
      setError(message)
      showError(message)
      await refreshStatus().catch(() => {})
    } finally {
      setBusy(null)
    }
  }

  const refreshKiroExecutable = async () => {
    const [ideInfo, configuredPath] = await Promise.all([
      checkIdeInstallation<IdeInstallationInfo>(),
      getCustomKiroPath(),
    ])
    setKiroExecutablePath(ideInfo.ide_executable_exists ? ideInfo.ide_path : null)
    setConfiguredKiroPath(configuredPath?.trim() || null)
    return ideInfo
  }

  const handleBrowseKiroExecutable = async () => {
    setPathBusy(true)
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        directory: false,
        multiple: false,
        title: '选择 Kiro.exe',
        filters: [{ name: 'Kiro IDE', extensions: ['exe'] }],
      })
      if (!selected) return
      await setCustomKiroPath(selected)
      const ideInfo = await refreshKiroExecutable()
      if (!ideInfo.ide_executable_exists) {
        throw new Error('已保存路径，但仍无法读取 Kiro.exe')
      }
      setError('')
      showSuccess('Kiro IDE 路径已保存，KSK 隔离启动会立即使用该路径')
    } catch (cause) {
      const message = String(cause)
      setError(message)
      showError(message)
    } finally {
      setPathBusy(false)
    }
  }

  const handleClearKiroExecutable = async () => {
    setPathBusy(true)
    try {
      await clearCustomKiroPath()
      await refreshKiroExecutable()
      setError('')
      showSuccess('已恢复自动检测 Kiro IDE 路径')
    } catch (cause) {
      const message = String(cause)
      setError(message)
      showError(message)
    } finally {
      setPathBusy(false)
    }
  }

  const handleManualLaunch = async () => {
    const ksk = manualKsk.trim()
    if (!ksk.startsWith('ksk_') || !manualRegion) return
    setBusy('manual')
    setError('')
    try {
      const nextStatus = await startKskIde({ ksk, region: manualRegion })
      setStatus(nextStatus)
      setManualKsk('')
      showSuccess('隔离 Kiro IDE 已启动')
    } catch (cause) {
      const message = String(cause)
      setError(message)
      showError(message)
    } finally {
      setBusy(null)
    }
  }

  const handleStop = async () => {
    const managedKey = status.managedKey
    setBusy('stop')
    setError('')
    try {
      setStatus(await stopKskIde())
      showSuccess(managedKey ? '隔离 Kiro IDE 已停止，临时 KSK 已撤销' : '隔离 Kiro IDE 已停止')
    } catch (cause) {
      const message = String(cause)
      setError(message)
      showError(message)
      await refreshStatus().catch(() => {})
    } finally {
      setBusy(null)
    }
  }

  const occupied = status.running || status.managedKey
  const statusTone = status.running
    ? 'bg-green-500/10 text-green-500 border-green-500/20'
    : status.managedKey
      ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
      : 'bg-muted text-muted-foreground border-border'

  return (
    <div className="h-full overflow-auto glass-main">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MonitorPlay className="text-primary" size={24} />
              <h1 className="text-xl font-bold text-foreground">KSK 隔离 Kiro IDE</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              从账号签发短期 KSK 并直接启动；正式对话、插件和历史数据继续复用原 Kiro 用户目录。
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refreshStatus(true)}
            disabled={Boolean(busy)}
          >
            <RefreshCw className={busy === 'refresh' ? 'animate-spin' : ''} />
            刷新状态
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </div>
        )}

        <Card className="border border-border">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="flex items-center gap-2">
              <FolderSearch size={18} />Kiro IDE 可执行文件
            </CardTitle>
            <CardDescription>
              自动读取自定义路径、Windows 安装信息、默认用户目录及本地磁盘根目录。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 rounded-lg border border-border/70 bg-muted/25 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                {customKiroPath ? '自定义路径' : '自动检测结果'}
              </p>
              <p
                className={`mt-1 truncate text-sm font-mono ${kiroExecutablePath ? 'text-foreground' : 'text-red-500'}`}
                title={kiroExecutablePath || '未找到 Kiro IDE 可执行文件'}
              >
                {kiroExecutablePath || '未找到 Kiro IDE 可执行文件'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBrowseKiroExecutable} disabled={pathBusy || occupied}>
                {pathBusy ? <Loader2 className="animate-spin" /> : <FolderSearch />}
                选择 Kiro.exe
              </Button>
              {customKiroPath && (
                <Button variant="ghost" onClick={handleClearKiroExecutable} disabled={pathBusy || occupied}>
                  恢复自动检测
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="border-b border-border/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck size={18} />运行状态
                </CardTitle>
                <CardDescription>账号签发的完整 KSK 不会显示、复制或写入前端状态。</CardDescription>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone}`}>
                {statusLabel(status)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatusItem label="来源账号" value={status.sourceAccountLabel || '手工 KSK / —'} />
            <StatusItem label="区域" value={status.region || '—'} />
            <StatusItem label="KSK 前缀" value={status.keyPrefix || '—'} mono />
            <StatusItem label="到期时间" value={formatDate(status.keyExpiresAt)} />
            <StatusItem label="进程 PID" value={status.pid?.toString() || '—'} mono />
            <StatusItem label="隔离会话" value={status.sessionId || '—'} mono />
            <StatusItem label="启动时间" value={formatDate(status.startedAt)} />
            <div className="flex items-end">
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleStop}
                disabled={!occupied || Boolean(busy)}
              >
                {busy === 'stop' ? <Loader2 className="animate-spin" /> : <Square />}
                停止并撤销
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="border border-primary/25">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket size={18} />账号一键启动
              </CardTitle>
              <CardDescription>
                KAM 会刷新账号、签发默认 24 小时的短期 KSK，并把它直接交给本地隔离代理。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
                disabled={accountsLoading || occupied || Boolean(busy)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={accountsLoading ? '正在加载账号…' : '选择签发账号'} />
                </SelectTrigger>
                <SelectContent>
                  {accountOptions.map(({ account, eligibility }) => (
                    <SelectItem key={account.id} value={account.id} disabled={!eligibility.eligible}>
                      <span className="flex items-center gap-2">
                        <User size={13} />
                        {accountLabel(account)}
                        {!eligibility.eligible && <span className="text-muted-foreground">· 不支持签发</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedAccount && !selectedAccount.eligibility.eligible && (
                <p className="text-xs text-orange-500">{selectedAccount.eligibility.reason}</p>
              )}

              <Button
                className="w-full"
                onClick={handleAccountLaunch}
                disabled={
                  !selectedAccount
                  || !selectedAccount.eligibility.eligible
                  || occupied
                  || Boolean(busy)
                }
              >
                {busy === 'account' ? <Loader2 className="animate-spin" /> : <Rocket />}
                签发 KSK 并启动 Kiro
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck size={18} />隔离边界
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• 对话数据、插件和工作区继续使用正式 Kiro 的共享数据。</p>
              <p>• 认证 Token 位于隔离目录；临时 settings 改写由会话日志负责恢复。</p>
              <p>• 正式 Kiro 运行时会拒绝启动，避免官方单实例互相抢占。</p>
              <p>• 停止或退出 KAM 时会撤销账号签发的临时 KSK。</p>
            </CardContent>
          </Card>
        </div>

        <details className="rounded-xl border border-border bg-card/40 p-4">
          <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
            高级入口：使用已有 KSK 手工启动
          </summary>
          <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]">
            <Select
              value={manualRegion}
              onValueChange={setManualRegion}
              disabled={occupied || Boolean(busy)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择区域" />
              </SelectTrigger>
              <SelectContent>
                {regions.map(region => (
                  <SelectItem key={region} value={region}>{region}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
              <input
                type="password"
                value={manualKsk}
                onChange={event => setManualKsk(event.target.value)}
                disabled={occupied || Boolean(busy)}
                autoComplete="off"
                spellCheck={false}
                placeholder="ksk_…（只保存在当前页面内存）"
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleManualLaunch}
              disabled={
                occupied
                || Boolean(busy)
                || !manualRegion
                || !manualKsk.trim().startsWith('ksk_')
              }
            >
              {busy === 'manual' ? <Loader2 className="animate-spin" /> : <MonitorPlay />}
              手工启动
            </Button>
          </div>
        </details>
      </div>
    </div>
  )
}

function StatusItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate text-sm font-medium text-foreground ${mono ? 'font-mono' : ''}`} title={value}>
        {value}
      </p>
    </div>
  )
}

export default KskIdePage
