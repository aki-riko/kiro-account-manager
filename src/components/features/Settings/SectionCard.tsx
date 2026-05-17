import type React from 'react'
import { Card, CardContent } from '../../ui/card'

interface SectionCardProps {
  title: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  desc?: string
  accent?: 'primary' | 'orange'
  className?: string
  children: React.ReactNode
}

/**
 * 紧凑分组卡片：彩色短竖条 + 可选图标 + 标题 + 可选 badge / 描述。
 * 用于 Settings 各 tab 的统一分组容器，比原版 p-6 + text-lg 节省一半空间。
 */
function SectionCard({
  title,
  icon,
  badge,
  desc,
  accent = 'primary',
  className = '',
  children,
}: SectionCardProps) {
  const accentClass = accent === 'orange' ? 'bg-orange-500' : 'bg-primary'
  return (
    <Card className={`card-glow ${className}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className={`w-1 h-4 ${accentClass} rounded-full`} />
          {icon}
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {badge}
        </div>
        {desc && <p className="text-xs text-muted-foreground -mt-1">{desc}</p>}
        {children}
      </CardContent>
    </Card>
  )
}

export default SectionCard
