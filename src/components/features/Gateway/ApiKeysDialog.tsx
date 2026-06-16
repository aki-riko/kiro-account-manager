import React, { useState, useEffect } from 'react'
import { Plus, Dice6, Copy, Trash2, Pencil, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody
} from '@/components/shared/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { GatewayConfig } from './gatewayPageState'

interface ApiKeysDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientApiKeysText: string
  setConfig: React.Dispatch<React.SetStateAction<GatewayConfig>>
  onSave?: () => void
}

type ApiKeyItem = { name: string; key: string; enabled: boolean }

const DISABLED_PREFIX = '#disabled#'

const parseApiKeys = (text: string): ApiKeyItem[] =>
  (text || '')
    .split(/[\n,]+/)
    .map(k => k.trim())
    .filter(Boolean)
    .map(rawKey => {
      const enabled = !rawKey.startsWith(DISABLED_PREFIX)
      const rest = enabled ? rawKey : rawKey.substring(DISABLED_PREFIX.length)
      const colonIdx = rest.indexOf(':')
      const hasName = colonIdx > 0 && !rest.startsWith('sk-') && !rest.startsWith('PROXY_KEY:')

      return {
        name: hasName ? rest.substring(0, colonIdx) : '',
        key: hasName ? rest.substring(colonIdx + 1) : rest,
        enabled
      }
    })

const serializeApiKeys = (keys: ApiKeyItem[]) =>
  keys
    .map(({ name, key, enabled }) => `${enabled ? '' : DISABLED_PREFIX}${name ? `${name}:` : ''}${key}`)
    .join('\n')

const createApiKey = (length = 16) => {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now()}${Math.random().toString(36).slice(2)}`
  return `sk-${random.substring(0, length)}`
}

const maskApiKey = (key: string) => (key.length > 24 ? `${key.substring(0, 10)}...${key.slice(-4)}` : key)

type IconButtonProps = React.ComponentProps<typeof Button>

function IconButton({ className, ...props }: IconButtonProps) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className={cn('h-7 w-7 p-0 shrink-0', className)}
      {...props}
    />
  )
}

interface ApiKeyRowProps {
  item: ApiKeyItem
  index: number
  editing: boolean
  editingKey: string
  copied: boolean
  onPatch: (index: number, patch: Partial<ApiKeyItem>) => void
  onEditKeyChange: (key: string) => void
  onStartEdit: (index: number) => void
  onConfirmEdit: (index: number) => void
  onCopy: (key: string, index: number) => void
  onDelete: (index: number) => void
}

function ApiKeyRow({
  item,
  index,
  editing,
  editingKey,
  copied,
  onPatch,
  onEditKeyChange,
  onStartEdit,
  onConfirmEdit,
  onCopy,
  onDelete
}: ApiKeyRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-[auto_minmax(96px,144px)_minmax(0,1fr)_auto] items-center gap-2 p-2.5 border-b last:border-b-0 hover:bg-muted/30',
        !item.enabled && 'opacity-50'
      )}
    >
      <Switch checked={item.enabled} onCheckedChange={(checked) => onPatch(index, { enabled: checked })} />
      <Input
        value={item.name}
        onChange={(e) => onPatch(index, { name: e.target.value })}
        className="h-7 text-xs"
        placeholder="名称"
      />

      {editing ? (
        <Input
          value={editingKey}
          onChange={(e) => onEditKeyChange(e.target.value)}
          className="h-7 text-xs font-mono"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') onConfirmEdit(index) }}
          onBlur={() => onConfirmEdit(index)}
        />
      ) : (
        <code className="min-w-0 text-xs font-mono bg-muted/50 px-2 py-1 rounded truncate">
          {maskApiKey(item.key)}
        </code>
      )}

      <div className="flex items-center gap-1">
        {editing ? (
          <IconButton className="text-green-600" onClick={() => onConfirmEdit(index)}>
            <Check size={12} />
          </IconButton>
        ) : (
          <>
            <IconButton onClick={() => onStartEdit(index)}>
              <Pencil size={12} className="text-muted-foreground" />
            </IconButton>
            <IconButton onClick={() => onCopy(item.key, index)}>
              {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} className="text-muted-foreground" />}
            </IconButton>
          </>
        )}
        <IconButton className="text-red-500 hover:text-red-600" onClick={() => onDelete(index)}>
          <Trash2 size={12} />
        </IconButton>
      </div>
    </div>
  )
}

export function ApiKeysDialog({ open, onOpenChange, clientApiKeysText, setConfig, onSave }: ApiKeysDialogProps) {
  const [localKeys, setLocalKeys] = useState<ApiKeyItem[]>([])
  const [hasInitialized, setHasInitialized] = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editingKey, setEditingKey] = useState('')
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  // 弹窗打开时，单次解析 Props 文本初始化本地临时状态
  useEffect(() => {
    if (!open) {
      setHasInitialized(false)
      setEditingIdx(null)
      return
    }

    if (hasInitialized) return

    setLocalKeys(parseApiKeys(clientApiKeysText))
    setHasInitialized(true)
  }, [open, clientApiKeysText, hasInitialized])

  const writeConfig = (keysToSave: ApiKeyItem[]) => {
    setConfig((prev: any) => ({
      ...prev,
      clientApiKeysText: serializeApiKeys(keysToSave),
      apiKey: keysToSave.find(k => k.enabled)?.key || keysToSave[0]?.key || ''
    }))
  }

  const commitKeys = (updated: ApiKeyItem[]) => {
    setLocalKeys(updated)
    writeConfig(updated)
  }

  const patchKey = (idx: number, patch: Partial<ApiKeyItem>) => {
    commitKeys(localKeys.map((item, i) => i === idx ? { ...item, ...patch } : item))
  }

  const appendKey = (key: string, message: string, editAfterAdd = false) => {
    const next = [...localKeys, { name: '', key, enabled: true }]
    commitKeys(next)
    toast.success(message)

    if (editAfterAdd) {
      setEditingIdx(next.length - 1)
      setEditingKey(key)
    }
  }

  const generateKey = () => appendKey(createApiKey(), '已随机生成并添加 API Key')

  const addKey = () => appendKey(createApiKey(12), '已添加新行，请直接编辑 API Key', true)

  const startEdit = (idx: number) => {
    setEditingIdx(idx)
    setEditingKey(localKeys[idx].key)
  }

  const confirmEdit = (idx = editingIdx) => {
    if (idx === null || !editingKey.trim()) return
    patchKey(idx, { key: editingKey.trim() })
    setEditingIdx(null)
    setEditingKey('')
  }

  const handleDelete = (idx: number) => {
    commitKeys(localKeys.filter((_, i) => i !== idx))
    toast.success('已删除 API Key')
  }

  const handleCopy = async (keyText: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(keyText)
      setCopiedIdx(idx)
      toast.success('复制成功')
      setTimeout(() => {
        setCopiedIdx(null)
      }, 1500)
    } catch {
      toast.error('复制失败')
    }
  }

  // 弹窗关闭处理，支持自动提交未完成的行内编辑值
  const handleClose = (v: boolean) => {
    if (!v) {
      let finalKeys = [...localKeys]
      if (editingIdx !== null && editingKey.trim()) {
        finalKeys[editingIdx] = { ...finalKeys[editingIdx], key: editingKey.trim() }
      }
      writeConfig(finalKeys)
      setEditingIdx(null)
      onSave?.()
    }
    onOpenChange(v)
  }

  return (
    <DialogRoot open={open} onOpenChange={handleClose}>
      <DialogContent maxWidth="800px" className="max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>客户端 API Keys</DialogTitle>
          <DialogDescription>管理客户端认证密钥，禁用的 Key 不会被使用</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3 pt-2 min-h-0">
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={generateKey} className="h-7 text-xs gap-1">
              <Dice6 size={12} /> 随机生成
            </Button>
            <Button size="sm" variant="outline" onClick={addKey} className="h-7 text-xs gap-1">
              <Plus size={12} /> 添加
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden max-h-[420px] overflow-y-auto">
            {localKeys.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                暂无 API Key，点击"随机生成"创建
              </div>
            ) : (
              localKeys.map((item, idx) => (
                <ApiKeyRow
                  key={`${item.key}-${idx}`}
                  item={item}
                  index={idx}
                  editing={editingIdx === idx}
                  editingKey={editingKey}
                  copied={copiedIdx === idx}
                  onPatch={patchKey}
                  onEditKeyChange={setEditingKey}
                  onStartEdit={startEdit}
                  onConfirmEdit={confirmEdit}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  )
}

export default ApiKeysDialog
