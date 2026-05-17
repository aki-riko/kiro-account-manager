import { useState, useEffect, useMemo, useCallback } from 'react'
import { Github, Heart, Coffee, ExternalLink, Code2, Palette, Cpu, RefreshCw, X, Link2, Gift, Sparkles, Info } from 'lucide-react'
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { check } from '@tauri-apps/plugin-updater'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useApp } from '../../../hooks/useApp'
import { useDialog } from '../../../contexts/DialogContext'
import alipayQR from '../../../assets/donate/alipay.jpg'
import wechatQR from '../../../assets/donate/wechat.jpg'
import { isLightTheme as checkIsLightTheme } from '../../../utils/themeMode'
import { getThemeAccent } from '../KiroConfig/themeAccent'
import SectionCard from '../Settings/SectionCard'

const CURRENT_YEAR = new Date().getFullYear()

const LINKS = {
  website: 'https://kiro-website-six.vercel.app',
  github: 'https://github.com/hj01857655/kiro-account-manager',
  qqGroup1: 'https://qm.qq.com/q/Vh7mUrNpa8',
  qqGroup2: 'https://qm.qq.com/q/xi0AglEqGs',
}

// QQ 图标
const QQIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.003 2c-2.265 0-6.29 1.364-6.29 7.325v1.195S3.55 14.96 3.55 17.474c0 .665.17 1.025.281 1.025.114 0 .902-.484 1.748-2.072 0 0-.18 2.197 1.904 3.967 0 0-1.77.495-1.77 1.182 0 .686 4.078.43 6.29.43 2.213 0 6.29.256 6.29-.43 0-.687-1.77-1.182-1.77-1.182 2.085-1.77 1.905-3.967 1.905-3.967.845 1.588 1.634 2.072 1.746 2.072.111 0 .283-.36.283-1.025 0-2.514-2.166-6.954-2.166-6.954V9.325C18.29 3.364 14.268 2 12.003 2z" />
  </svg>
)

// Logo（紧凑版，不再 80x80）
const AppLogo = ({ accent }: { accent: any }) => (
  <div className="relative">
    <div className={`absolute inset-0 bg-gradient-to-br ${accent.gradientFrom} ${accent.gradientTo} rounded-2xl blur-md opacity-50`} />
    <div className={`relative w-14 h-14 bg-gradient-to-br ${accent.gradientFrom} ${accent.gradientTo} rounded-2xl flex items-center justify-center shadow-md`}>
      <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
        <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="white" />
      </svg>
    </div>
  </div>
)

// 链接行：图标 + 标题 + 副标题 + 外链小箭头
interface LinkRowProps {
  href: string
  icon: React.ReactNode
  label: string
  desc?: string
  accent: 'primary' | 'github' | 'qq'
}

function LinkRow({ href, icon, label, desc, accent }: LinkRowProps) {
  const accentClass = accent === 'github'
    ? 'text-foreground bg-foreground/5'
    : accent === 'qq'
      ? 'text-blue-500 bg-blue-500/10'
      : 'text-primary bg-primary/10'
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors"
    >
      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${accentClass}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{label}</div>
        {desc && <div className="text-[11px] text-muted-foreground truncate">{desc}</div>}
      </div>
      <ExternalLink size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </a>
  )
}

// 二维码卡片
const QRCodeCard = ({ src, label, onClick }: { src: string; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="group flex flex-col items-center gap-1.5 p-2 rounded-lg border border-border bg-card hover:bg-muted/40 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
    aria-label={label}
  >
    <img src={src} alt={label} className="w-[120px] h-[120px] rounded-md transition-transform duration-200 group-hover:scale-[1.02]" />
    <span className="text-xs font-medium text-foreground">{label}</span>
  </button>
)

function About() {
  const { t, theme } = useApp()
  const { showUpdate, showInfo } = useDialog()
  const [version, setVersion] = useState('')
  const [checking, setChecking] = useState(false)
  const [previewImg, setPreviewImg] = useState<string | null>(null)

  const accent = useMemo(() => getThemeAccent(theme), [theme])

  const heartClass = useMemo(() => {
    const isLight = checkIsLightTheme(theme)
    return isLight ? 'text-red-500 fill-red-500' : 'text-red-400 fill-red-400'
  }, [theme])

  const techStack = useMemo(() => [
    { icon: Code2, value: 'React + Vite' },
    { icon: Palette, value: 'TailwindCSS' },
    { icon: Cpu, value: 'Tauri + Rust' },
  ], [])

  const sponsorBenefits = useMemo(() => [
    t('about.benefit1'),
    t('about.benefit2'),
    t('about.benefit3'),
  ], [t])

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(''))
  }, [])

  const checkUpdate = useCallback(async () => {
    setChecking(true)
    try {
      const result = await invoke<any>('check_update')
      if (result.has_update && result.latest_version) {
        const updateResult = await check()
        if (updateResult) {
          showUpdate(
            { version: result.latest_version, body: result.notes },
            updateResult,
          )
        } else {
          showInfo(t('about.checkUpdate'), t('about.updateFailed'))
        }
      } else {
        showInfo(t('about.checkUpdate'), t('about.upToDate'))
      }
    } catch (e) {
      console.error('Check update failed:', e)
      showInfo(t('about.checkUpdate'), t('about.updateFailed'))
    } finally {
      setChecking(false)
    }
  }, [showUpdate, showInfo, t])

  return (
    <div className="h-full glass-main overflow-auto p-5">
      <div className="max-w-3xl mx-auto space-y-3">
        {/* === 1. 应用介绍卡（横向布局：logo 左，标题/版本/技术栈右）=== */}
        <Card className="card-glow">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <AppLogo accent={accent} />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-semibold text-foreground">{t('about.appName')}</h1>
                  <Badge variant="default" className="px-2 py-0 h-5 text-[11px] font-mono">
                    v{version || '...'}
                  </Badge>
                  <Button
                    onClick={checkUpdate}
                    disabled={checking}
                    variant="outline"
                    size="sm"
                    className="ml-auto h-7 text-xs gap-1"
                  >
                    <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
                    {checking ? t('about.checking') : t('about.checkUpdate')}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('about.appDesc')}
                </p>

                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {techStack.map(({ icon: Icon, value }) => (
                    <span
                      key={value}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-muted-foreground border border-border bg-muted/30"
                    >
                      <Icon size={11} />
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* === 2. 链接卡 === */}
        <SectionCard
          title={t('about.links')}
          accent="blue"
          icon={<Link2 size={14} className="text-blue-500" />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <LinkRow
              href={LINKS.website}
              icon={<ExternalLink size={15} />}
              label={t('about.website')}
              desc="kiro-website-six.vercel.app"
              accent="primary"
            />
            <LinkRow
              href={LINKS.github}
              icon={<Github size={15} />}
              label="GitHub"
              desc="hj01857655/kiro-account-manager"
              accent="github"
            />
            <LinkRow
              href={LINKS.qqGroup1}
              icon={<QQIcon size={15} />}
              label={t('about.qqGroup1')}
              accent="qq"
            />
            <LinkRow
              href={LINKS.qqGroup2}
              icon={<QQIcon size={15} />}
              label={t('about.qqGroup2')}
              accent="qq"
            />
          </div>
        </SectionCard>

        {/* === 3. 赞赏卡 === */}
        <SectionCard
          title={t('about.donate')}
          accent="amber"
          icon={<Coffee size={14} className="text-amber-500" />}
          desc={t('about.donateDesc')}
        >
          {/* 福利列表 */}
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Gift size={13} className="text-amber-500" />
              <span className="text-xs font-medium text-foreground">{t('about.sponsorBenefits')}</span>
            </div>
            <ul className="space-y-1">
              {sponsorBenefits.map((b, i) => (
                <li key={i} className="text-xs text-muted-foreground leading-relaxed">{b}</li>
              ))}
            </ul>
          </div>

          {/* 提示条 */}
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/5">
            <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-foreground leading-relaxed">{t('about.sponsorNote')}</p>
          </div>

          {/* 二维码两栏 */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <QRCodeCard src={alipayQR} label={t('about.alipay')} onClick={() => setPreviewImg(alipayQR)} />
            <QRCodeCard src={wechatQR} label={t('about.wechat')} onClick={() => setPreviewImg(wechatQR)} />
          </div>
          <p className="text-[11px] text-center text-muted-foreground">{t('about.clickToEnlarge')}</p>
        </SectionCard>

        {/* === 4. 底部署名 === */}
        <div className="flex items-center justify-center gap-1.5 py-3 text-xs text-muted-foreground">
          <Sparkles size={12} className="text-primary/70" />
          <span>{t('about.madeWith')}</span>
          <Heart size={12} className={heartClass} />
          <span>{t('about.by')} hj01857655</span>
          <span className="opacity-50">·</span>
          <span>© {CURRENT_YEAR}</span>
        </div>
      </div>

      {/* 二维码预览弹窗 */}
      <Dialog open={!!previewImg} onOpenChange={(open) => !open && setPreviewImg(null)}>
        <DialogContent className="max-w-fit p-0 bg-transparent border-none shadow-none">
          <div className="relative">
            {previewImg && <img src={previewImg} alt="预览" className="max-w-[320px] max-h-[320px] rounded-xl shadow-xl" />}
            <button
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full glass-card flex items-center justify-center shadow-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
              onClick={() => setPreviewImg(null)}
              aria-label="关闭预览"
            >
              <X size={16} className="text-foreground" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default About
