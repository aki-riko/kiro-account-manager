import { Switch } from '../../ui/switch'

interface ToggleRowProps {
  checked: boolean
  onChange: (v: boolean) => Promise<void> | void
  label: string
}

/**
 * 紧凑型开关行，用于 Settings 各 tab 的批量布尔配置（Agent / 通知 / 遥测）。
 */
function ToggleRow({ checked, onChange, label }: ToggleRowProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer px-2.5 py-1.5 rounded-md border border-border bg-card hover:bg-muted/40 transition-colors">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span className="text-xs text-foreground">{label}</span>
    </label>
  )
}

export default ToggleRow
