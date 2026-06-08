import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter
} from '@/components/shared/dialog'
import { toast } from 'sonner'
import { useApp } from '../../../hooks/useApp'
import { PromptFilterRule } from './gatewayPageState'

// 预置过滤规则
const PRESET_RULES = [
  {
    name: '过滤 Git 状态信息',
    ruleType: 'lines-containing',
    matchPattern: 'git status',
    replace: ''
  },
  {
    name: '过滤最近提交信息',
    ruleType: 'lines-containing',
    matchPattern: 'Recent commits:',
    replace: ''
  },
  {
    name: '过滤助手知识截止日期',
    ruleType: 'lines-containing',
    matchPattern: 'Assistant knowledge cutoff',
    replace: ''
  },
  {
    name: '过滤计费头信息',
    ruleType: 'lines-containing',
    matchPattern: 'x-anthropic-billing-header:',
    replace: ''
  },
  {
    name: '过滤快速模式标签',
    ruleType: 'regex',
    matchPattern: '<fast_mode_info>.*?</fast_mode_info>',
    replace: ''
  },
  {
    name: '过滤项目路径信息',
    ruleType: 'lines-containing',
    matchPattern: '.claude/projects/',
    replace: ''
  }
]

interface PromptFilterRulesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  promptFilterRules: PromptFilterRule[]
  setField: (key: string, value: PromptFilterRule[] | string | boolean) => void
  onSave?: () => void
}

function PromptFilterRulesDialog({ open, onOpenChange, promptFilterRules, setField, onSave }: PromptFilterRulesDialogProps) {
  const { t } = useApp()
  const rules = promptFilterRules || []

  const [newRuleName, setNewRuleName] = useState('')
  const [newRuleType, setNewRuleType] = useState('lines-containing')
  const [newMatchPattern, setNewMatchPattern] = useState('')
  const [newReplace, setNewReplace] = useState('')

  // 弹窗关闭时清理表单输入
  useEffect(() => {
    if (!open) {
      setNewRuleName('')
      setNewRuleType('lines-containing')
      setNewMatchPattern('')
      setNewReplace('')
    }
  }, [open])

  const handleToggle = (idx: number, checked: boolean) => {
    const updated = [...rules]
    updated[idx] = { ...updated[idx], enabled: checked }
    setField('promptFilterRules', updated)
  }

  const handleDelete = (idx: number) => {
    setField('promptFilterRules', rules.filter((_: PromptFilterRule, i: number) => i !== idx))
  }

  const handleAdd = () => {
    if (!newRuleName.trim() || !newMatchPattern.trim()) return

    const newRule = {
      id: crypto.randomUUID(),
      name: newRuleName.trim(),
      enabled: true,
      ruleType: newRuleType,
      matchPattern: newMatchPattern.trim(),
      replace: newRuleType === 'regex' ? newReplace : ''
    }
    setField('promptFilterRules', [...rules, newRule])
    setNewRuleName('')
    setNewMatchPattern('')
    setNewReplace('')
    toast.success(`已添加过滤规则: ${newRule.name}`)
  }

  const handlePreset = () => {
    const existingPatterns = new Set(rules.map((r: PromptFilterRule) => r.matchPattern))
    const newRules = PRESET_RULES
      .filter(p => !existingPatterns.has(p.matchPattern))
      .map(p => ({
        id: crypto.randomUUID(),
        name: p.name,
        enabled: true,
        ruleType: p.ruleType,
        matchPattern: p.matchPattern,
        replace: p.replace
      }))
    if (newRules.length > 0) {
      setField('promptFilterRules', [...rules, ...newRules])
      toast.success(`成功载入 ${newRules.length} 条预置过滤规则`)
    } else {
      toast.info('所有预置规则均已存在')
    }
  }

  const handleSave = async () => {
    if (onSave) {
      await onSave()
    }
    onOpenChange(false)
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="960px" className="max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{t('gateway.promptFilterRules')}</DialogTitle>
          <DialogDescription>
            {t('gateway.customRegexOrKeywordFilterRules')}
          </DialogDescription>
        </DialogHeader>

        {/* 滚动容器 */}
        <DialogBody className="space-y-4 pr-1 pt-2">
          {/* 现有规则列表 */}
          {rules.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('gateway.configuredRules', { count: rules.length })}</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-muted/20">
                {rules.map((rule: any, idx: number) => (
                  <div key={rule.id || idx} className="flex items-start gap-3 p-3 rounded-lg border bg-background">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked: boolean) => handleToggle(idx, checked)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{rule.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {rule.ruleType === 'regex' ? t('gateway.regex') : t('gateway.containKeywords')}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono break-all">
                        {t('gateway.match')}: {rule.matchPattern}
                      </div>
                      {rule.ruleType === 'regex' && rule.replace && (
                        <div className="text-xs text-muted-foreground font-mono break-all">
                          {t('gateway.replace')}: {rule.replace}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(idx)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 添加新规则 */}
          <div className="space-y-3 border rounded-lg p-4 bg-muted/10">
            <Label className="text-sm font-medium">添加新规则</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">规则名称</Label>
                <Input
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder="例如：过滤 Git 状态"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">规则类型</Label>
                <Select value={newRuleType} onValueChange={setNewRuleType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lines-containing">包含关键字（删除匹配行）</SelectItem>
                    <SelectItem value="regex">正则表达式（替换匹配内容）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">匹配模式</Label>
              <Textarea
                value={newMatchPattern}
                onChange={(e) => setNewMatchPattern(e.target.value)}
                placeholder="关键字模式：git status&#10;正则模式：&lt;fast_mode_info&gt;.*?&lt;/fast_mode_info&gt;"
                rows={2}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">替换内容（仅正则类型，留空表示删除）</Label>
              <Input
                value={newReplace}
                onChange={(e) => setNewReplace(e.target.value)}
                placeholder="留空表示删除匹配内容"
                className="font-mono text-xs"
                disabled={newRuleType !== 'regex'}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAdd}
                className="flex-1"
                disabled={!newRuleName.trim() || !newMatchPattern.trim()}
              >
                <Plus size={14} className="mr-1" />
                {t('gateway.addRule')}
              </Button>
              <Button size="sm" variant="outline" onClick={handlePreset}>
                <Filter size={14} className="mr-1" />
                {t('gateway.addPresetRules')}
              </Button>
            </div>
          </div>
        </DialogBody>

        {/* 底部操作 */}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('gateway.cancel')}
          </Button>
          <Button onClick={handleSave}>
            {t('gateway.saveConfig')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}

export default PromptFilterRulesDialog
