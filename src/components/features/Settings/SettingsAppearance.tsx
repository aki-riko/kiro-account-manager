import { Sun, Moon, Palette, Check } from 'lucide-react'
import { buildThemeOptions } from './settingsConstants'
import SectionCard from './SectionCard'

interface SettingsAppearanceProps {
  theme: string
  setTheme: (theme: string) => void
  t: (key: string) => string
}

function SettingsAppearance({ theme, setTheme, t }: SettingsAppearanceProps) {
  const themeIconMap: Record<string, any> = { Sun, Moon, Palette }
  const themeOptions = buildThemeOptions(t)

  return (
    <div className="space-y-3">
      <SectionCard
        title={t('settings.theme')}
        accent="violet"
        icon={<Palette size={14} className="text-violet-500" />}
        desc={t('settings.themeDesc')}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
          {themeOptions.map((opt: any) => {
            const Icon = themeIconMap[opt.iconName]
            const isActive = theme === opt.key
            return (
              <button
                key={opt.key}
                onClick={() => setTheme(opt.key)}
                className={`group relative overflow-hidden rounded-xl border transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                  isActive
                    ? 'border-primary ring-1 ring-primary/30 shadow-md'
                    : 'border-border hover:border-primary/50 hover:shadow-sm'
                }`}
              >
                {/* 主题色预览条 */}
                <div className={`h-10 bg-gradient-to-br ${opt.color} flex items-center justify-center`}>
                  <Icon size={16} className="text-white drop-shadow" />
                </div>
                {/* 名称 */}
                <div className="px-2.5 py-1.5 bg-card flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground truncate">{opt.name}</span>
                  {isActive && (
                    <div className="w-4 h-4 rounded-full flex items-center justify-center bg-primary flex-shrink-0">
                      <Check size={10} className="text-white" />
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}

export default SettingsAppearance
