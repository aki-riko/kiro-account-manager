import { Sun, Moon, Palette, Check } from 'lucide-react'
import { Card, CardContent } from '../../ui/card'
import { buildThemeOptions } from './settingsConstants'
import React from 'react'

interface SettingsAppearanceProps {
  theme: string;
  setTheme: (theme: string) => void;
  t: (key: string) => string;
}

function SettingsAppearance({ theme, setTheme, t }: SettingsAppearanceProps) {
  const themeIconMap: Record<string, any> = { Sun, Moon, Palette }
  const themeOptions = buildThemeOptions(t)

  return (
    <Card className="card-glow animate-slide-in-left delay-100 mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          <div className="w-full text-left">
            <p className="text-sm font-semibold text-foreground">{t('settings.theme')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('settings.themeDesc')}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
            {themeOptions.map((opt: any) => {
              const Icon = themeIconMap[opt.iconName]
              const isActive = theme === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => setTheme(opt.key)}
                  className={`relative min-h-[44px] flex items-center justify-center gap-2.5 px-3 py-2 rounded-xl border-2 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 ${isActive
                    ? "border-primary shadow-md bg-primary/5"
                    : "border-border hover:bg-muted/50 bg-card"
                    }`}
                >
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${opt.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={14} className="text-white" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{opt.name}</span>
                  {isActive && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center bg-primary">
                      <Check size={10} className="text-white" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default SettingsAppearance
