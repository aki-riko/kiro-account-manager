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
      <SectionCard title={t('settings.theme')} desc={t('settings.themeDesc')}>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {themeOptions.map((opt: any) => {
            const Icon = themeIconMap[opt.iconName]
            const isActive = theme === opt.key
            return (
              <button
                key={opt.key}
                onClick={() => setTheme(opt.key)}
                className={`relative flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 ${isActive
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:bg-muted/40 bg-card'
                  }`}
              >
                <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${opt.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={12} className="text-white" />
                </div>
                <span className="text-xs font-medium text-foreground truncate">{opt.name}</span>
                {isActive && (
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center bg-primary ring-2 ring-background">
                    <Check size={8} className="text-white" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}

export default SettingsAppearance
