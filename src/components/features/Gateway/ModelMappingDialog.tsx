import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody
} from '@/components/shared/dialog'
import { toast } from 'sonner'
import { getAvailableModels } from '../../../api/gatewayApi'
import { ModelMappingRule } from './gatewayPageState'

// 常见源模型名 — 用于源模型下拉（包含 GPT 和 Claude）
const SOURCE_MODELS = [
  // GPT 5.5 系列
  'gpt-5.5',
  'gpt-5.5-pro',
  'gpt-5.5-instant',
  // GPT 5.4 系列
  'gpt-5.4',
  'gpt-5.4-pro',
  'gpt-5.4-mini',
  // GPT 5.3 系列
  'gpt-5.3-codex',
  'gpt-5.3-codex-spark',
  'gpt-5.3-instant',
  // GPT 5.2 系列
  'gpt-5.2',
  'gpt-5.2-pro',
  'gpt-5.2-codex',
  // GPT 5.1 系列
  'gpt-5.1',
  'gpt-5.1-pro',
  'gpt-5.1-codex',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex-mini',
  'gpt-5.1-instant',
]

// 预置 GPT/Codex → Claude 映射规则（5.5 ~ 5.1 系列）
// 注意：目标模型使用 -thinking 版本（与 /v1/models 接口一致）
const PRESET_RULES = [
  // GPT-5.5 系列 → Opus 4.8/4.7
  { source: 'gpt-5.5', target: 'claude-opus-4.8-thinking', name: 'GPT-5.5 → Opus 4.8' },
  { source: 'gpt-5.5-pro', target: 'claude-opus-4.7-thinking', name: 'GPT-5.5-pro → Opus 4.7' },
  { source: 'gpt-5.5-instant', target: 'claude-sonnet-4.6-thinking', name: 'GPT-5.5-instant → Sonnet 4.6' },
  // GPT-5.4 系列 → Opus/Sonnet 4.6
  { source: 'gpt-5.4', target: 'claude-opus-4.6-thinking', name: 'GPT-5.4 → Opus 4.6' },
  { source: 'gpt-5.4-pro', target: 'claude-opus-4.6-thinking', name: 'GPT-5.4-pro → Opus 4.6' },
  { source: 'gpt-5.4-mini', target: 'claude-sonnet-4.6-thinking', name: 'GPT-5.4-mini → Sonnet 4.6' },
  // GPT-5.3 系列 → Opus 4.5 / Sonnet 4.5
  { source: 'gpt-5.3-codex', target: 'claude-opus-4.5-thinking', name: 'GPT-5.3-codex → Opus 4.5' },
  { source: 'gpt-5.3-codex-spark', target: 'claude-sonnet-4.5-thinking', name: 'GPT-5.3-codex-spark → Sonnet 4.5' },
  { source: 'gpt-5.3-instant', target: 'claude-sonnet-4.5-thinking', name: 'GPT-5.3-instant → Sonnet 4.5' },
  // GPT-5.2 系列 → Opus 4.5
  { source: 'gpt-5.2', target: 'claude-opus-4.5-thinking', name: 'GPT-5.2 → Opus 4.5' },
  { source: 'gpt-5.2-pro', target: 'claude-opus-4.5-thinking', name: 'GPT-5.2-pro → Opus 4.5' },
  { source: 'gpt-5.2-codex', target: 'claude-opus-4.5-thinking', name: 'GPT-5.2-codex → Opus 4.5' },
  // GPT-5.1 系列 → Sonnet 4.5 / Haiku 4.5
  { source: 'gpt-5.1', target: 'claude-sonnet-4.5-thinking', name: 'GPT-5.1 → Sonnet 4.5' },
  { source: 'gpt-5.1-pro', target: 'claude-sonnet-4.5-thinking', name: 'GPT-5.1-pro → Sonnet 4.5' },
  { source: 'gpt-5.1-codex', target: 'claude-sonnet-4.5-thinking', name: 'GPT-5.1-codex → Sonnet 4.5' },
  { source: 'gpt-5.1-codex-max', target: 'claude-opus-4.5-thinking', name: 'GPT-5.1-codex-max → Opus 4.5' },
  { source: 'gpt-5.1-codex-mini', target: 'claude-haiku-4.5-thinking', name: 'GPT-5.1-codex-mini → Haiku 4.5' },
  { source: 'gpt-5.1-instant', target: 'claude-haiku-4.5-thinking', name: 'GPT-5.1-instant → Haiku 4.5' },
]

interface ModelMappingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  modelMappings: ModelMappingRule[]
  setField: (key: string, value: ModelMappingRule[] | string | boolean) => void
  onSave?: () => void
}

export function ModelMappingDialog({ open, onOpenChange, modelMappings, setField, onSave }: ModelMappingDialogProps) {
  const rules = modelMappings || []

  const [newSourceModel, setNewSourceModel] = useState('')
  const [newTargetModel, setNewTargetModel] = useState('')
  const [newRuleType, setNewRuleType] = useState('replace')
  const [targetModels, setTargetModels] = useState<string[]>([])

  // 弹窗打开时获取可用模型列表
  useEffect(() => {
    if (open) {
      getAvailableModels()
        .then(models => setTargetModels(models))
        .catch(err => {
          console.error('获取可用模型失败:', err)
          toast.error('获取可用模型列表失败')
        })
    }
  }, [open])

  // 弹窗关闭时清理表单输入
  useEffect(() => {
    if (!open) {
      setNewSourceModel('')
      setNewTargetModel('')
      setNewRuleType('replace')
    }
  }, [open])

  const handleToggle = (idx: number, checked: boolean) => {
    const updated = [...rules]
    updated[idx] = { ...updated[idx], enabled: checked }
    setField('modelMappings', updated)
  }

  const handleDelete = (idx: number) => {
    setField('modelMappings', rules.filter((_: ModelMappingRule, i: number) => i !== idx))
  }

  const handleOpenChange = (value: boolean) => {
    onOpenChange(value)
    if (!value && onSave) onSave()
  }

  const handleAdd = () => {
    if (!newSourceModel.trim() || !newTargetModel.trim()) return

    const newRule = {
      id: crypto.randomUUID(),
      name: `${newSourceModel.trim()} → ${newTargetModel.trim()}`,
      enabled: true,
      ruleType: newRuleType,
      sourceModel: newSourceModel.trim(),
      targetModels: [newTargetModel.trim()],
      weights: []
    }
    setField('modelMappings', [...rules, newRule])
    setNewSourceModel('')
    setNewTargetModel('')
    setNewRuleType('replace')
    toast.success(`已添加映射规则: ${newRule.name}`)
  }

  const handlePreset = () => {
    const existingSources = new Set(rules.map((r: any) => r.sourceModel))
    const newRules = PRESET_RULES
      .filter(p => !existingSources.has(p.source))
      .map(p => ({
        id: crypto.randomUUID(),
        name: p.name,
        enabled: true,
        ruleType: 'replace',
        sourceModel: p.source,
        targetModels: [p.target],
        weights: []
      }))
    if (newRules.length > 0) {
      setField('modelMappings', [...rules, ...newRules])
      toast.success(`成功载入 ${newRules.length} 条预置映射规则`)
    } else {
      toast.info('所有预置映射规则均已存在')
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={handleOpenChange}>
      <DialogContent maxWidth="720px">
        <DialogHeader>
          <DialogTitle>模型映射规则</DialogTitle>
          <DialogDescription>
            客户端请求的模型名会根据规则映射到 Kiro 内部模型
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="pt-2">
          {/* 规则列表 */}
          <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
            {rules.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                暂无规则
              </div>
            ) : (
              rules.map((rule: any, idx: number) => (
                <div key={rule.id} className={`flex items-center gap-2 p-3 border-b last:border-b-0 hover:bg-muted/30 ${!rule.enabled ? 'opacity-50' : ''}`}>
                  <Switch
                    size="sm"
                    checked={rule.enabled}
                    onCheckedChange={(checked) => handleToggle(idx, checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{rule.name || rule.sourceModel}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {rule.ruleType === 'replace' ? '替换' : rule.ruleType === 'alias' ? '别名' : '负载均衡'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                      {rule.sourceModel} → {rule.targetModels.join(', ')}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    onClick={() => handleDelete(idx)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* 添加新规则 */}
          <div className="space-y-2 p-3 border rounded-lg bg-muted/10">
            <div className="text-xs font-medium text-muted-foreground">添加新规则</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Input
                  placeholder="源模型名"
                  className="text-xs"
                  value={newSourceModel}
                  onChange={(e) => setNewSourceModel(e.target.value)}
                  list="model-list-source"
                />
                <datalist id="model-list-source">
                  {SOURCE_MODELS.map(m => <option key={m} value={m} />)}
                </datalist>
              </div>
              <div className="relative">
                <Input
                  placeholder="目标模型名"
                  className="text-xs"
                  value={newTargetModel}
                  onChange={(e) => setNewTargetModel(e.target.value)}
                  list="model-list-target"
                />
                <datalist id="model-list-target">
                  {targetModels.map(m => <option key={m} value={m} />)}
                </datalist>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={newRuleType} onValueChange={setNewRuleType}>
                <SelectTrigger className="text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="replace">替换 (replace)</SelectItem>
                  <SelectItem value="alias">别名 (alias)</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="text-xs"
                onClick={handleAdd}
                disabled={!newSourceModel.trim() || !newTargetModel.trim()}
              >
                <Plus size={14} className="mr-1" />
                添加
              </Button>
            </div>
          </div>

          {/* 预置规则 */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-muted-foreground">快速添加 OpenAI/Codex 兼容映射</div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handlePreset}>
              <Zap size={12} className="mr-1" />
              预置 GPT 映射
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  )
}

export default ModelMappingDialog
