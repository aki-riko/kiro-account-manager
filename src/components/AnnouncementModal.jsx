import { useState, useEffect } from 'react'
import { AlertTriangle, ExternalLink, MessageCircle, Download } from 'lucide-react'
import { useApp } from '../hooks/useApp'

// 公告 API 地址
const ANNOUNCEMENT_API = 'https://vercel-api-hj01857655s-projects-fa88a766.vercel.app/api/announcement'
const CURRENT_VERSION = __APP_VERSION__ || '0.0.0'

// 版本比较
const compareVersions = (v1, v2) => {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number)
  const parts2 = v2.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 < p2) return -1
    if (p1 > p2) return 1
  }
  return 0
}

export default function AnnouncementModal() {
  const { t, theme, colors } = useApp()
  const isLightTheme = theme === 'light' || theme === 'purple'
  const [show, setShow] = useState(false)
  const [announcement, setAnnouncement] = useState(null)
  const [forceUpdate, setForceUpdate] = useState(null)
  const [agreed, setAgreed] = useState(false)

  useEffect(() => {
    fetchAnnouncement()
  }, [])

  const fetchAnnouncement = async () => {
    try {
      const res = await fetch(ANNOUNCEMENT_API)
      if (!res.ok) return
      
      const data = await res.json()
      
      // 检查强制更新
      if (data.forceUpdate?.enabled) {
        const needUpdate = compareVersions(CURRENT_VERSION, data.forceUpdate.minVersion) < 0
        if (needUpdate) {
          setForceUpdate(data.forceUpdate)
          setShow(true)
          return
        }
      }
      
      // 处理公告（兼容新旧格式）
      const list = data.announcements || (Array.isArray(data) ? data : [data])
      const readIds = JSON.parse(localStorage.getItem('announcement_read_ids') || '[]')
      
      // 找到第一个未读的启用公告
      const unread = list.find(a => a.enabled && !readIds.includes(a.id))
      if (!unread) return
      
      setAnnouncement(unread)
      setShow(true)
    } catch (e) {
      console.log('[Announcement] 获取公告失败:', e)
    }
  }

  const handleClose = () => {
    // 强制更新不允许关闭
    if (forceUpdate) return
    
    if (announcement?.id) {
      const readIds = JSON.parse(localStorage.getItem('announcement_read_ids') || '[]')
      if (!readIds.includes(announcement.id)) {
        readIds.push(announcement.id)
        localStorage.setItem('announcement_read_ids', JSON.stringify(readIds))
      }
    }
    setShow(false)
  }

  const handleDownload = () => {
    window.open('https://github.com/hj01857655/kiro-account-manager/releases/latest', '_blank')
  }

  if (!show) return null

  // 强制更新弹窗
  if (forceUpdate) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className={`relative w-[420px] max-w-[90vw] rounded-2xl shadow-2xl border ${
          isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-900 border-gray-700'
        } overflow-hidden`}>
          <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4 flex items-center gap-3">
            <AlertTriangle size={24} className="text-white" />
            <span className="text-white font-bold text-lg">需要更新</span>
          </div>
          <div className="p-6">
            <p className={`text-base mb-4 ${colors.text}`}>{forceUpdate.message}</p>
            <p className={`text-sm ${colors.textMuted}`}>
              当前版本: v{CURRENT_VERSION} → 最低要求: v{forceUpdate.minVersion}
            </p>
          </div>
          <div className="px-6 pb-6">
            <button
              onClick={handleDownload}
              className="w-full py-3 rounded-xl font-medium bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90 flex items-center justify-center gap-2"
            >
              <Download size={18} />
              前往下载最新版本
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 普通公告需要有内容才显示
  if (!announcement) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`relative w-[480px] max-w-[90vw] rounded-2xl shadow-2xl border ${
        isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-900 border-gray-700'
      } overflow-hidden animate-fade-in-up`}>
        {/* 顶部警告条 */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4 flex items-center gap-3">
          <AlertTriangle size={24} className="text-white" />
          <span className="text-white font-bold text-lg">{announcement.title || t('announcement.title')}</span>
        </div>

        {/* 内容 */}
        <div className="p-6">
          <div className={`text-base leading-relaxed ${colors.text}`}>
            {announcement.content?.map((text, i) => (
              <p key={i} className={i === 0 ? 'mb-4 font-medium text-red-500' : 'mb-3'}>
                {i === 0 && '⚠️ '}{text}
              </p>
            ))}
          </div>

          {/* 官方开源信息 */}
          {(announcement.officialUrl || announcement.qqGroup) && (
            <div className={`mt-5 p-4 rounded-xl ${isLightTheme ? 'bg-gray-50' : 'bg-white/5'}`}>
              <p className={`text-sm font-medium mb-3 ${colors.text}`}>{t('announcement.official')}</p>
              <div className="space-y-2">
                {announcement.officialUrl && (
                  <a 
                    href={announcement.officialUrl}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-500 hover:text-blue-400 text-sm"
                  >
                    <ExternalLink size={14} className="shrink-0" />
                    <span>{announcement.officialUrl.replace('https://', '')}</span>
                  </a>
                )}
                {announcement.tutorialUrl && (
                  <a 
                    href={announcement.tutorialUrl}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-500 hover:text-blue-400 text-sm"
                  >
                    <ExternalLink size={14} className="shrink-0" />
                    <span>使用教程</span>
                  </a>
                )}
                {announcement.qqGroup && (
                  <a 
                    href={announcement.qqGroupUrl || '#'}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-500 hover:text-blue-400 text-sm"
                  >
                    <MessageCircle size={14} className="shrink-0" />
                    <span>{t('announcement.qqGroup')} {announcement.qqGroup}</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* 续杯交流群 */}
          {announcement.buyGroup && (
            <div className={`mt-3 p-4 rounded-xl ${isLightTheme ? 'bg-gray-50' : 'bg-white/5'}`}>
              <p className={`text-sm font-medium mb-3 ${colors.text}`}>账号购买需求：</p>
              <div className="space-y-2">
                {announcement.buyUrl && (
                  <a 
                    href={announcement.buyUrl}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-500 hover:text-blue-400 text-sm"
                  >
                    <ExternalLink size={14} className="shrink-0" />
                    <span>在线购买</span>
                  </a>
                )}
                {announcement.refillTutorialUrl && (
                  <a 
                    href={announcement.refillTutorialUrl}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-500 hover:text-blue-400 text-sm"
                  >
                    <ExternalLink size={14} className="shrink-0" />
                    <span>Kiro续杯教程</span>
                  </a>
                )}
                <a 
                  href={announcement.buyGroupUrl || '#'}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-500 hover:text-blue-400 text-sm"
                >
                  <MessageCircle size={14} className="shrink-0" />
                  <span>{announcement.buyGroup}</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="px-6 pb-6">
          <label className={`flex items-center gap-2 mb-4 cursor-pointer select-none ${colors.text}`}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm">我已阅读并知晓以上内容</span>
          </label>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className={`flex-1 py-3 rounded-xl border ${
                isLightTheme ? 'border-gray-300 text-gray-600 hover:bg-gray-50' : 'border-gray-600 text-gray-300 hover:bg-white/5'
              } font-medium transition-colors`}
            >
              {t('announcement.dontRemind')}
            </button>
            <button
              onClick={handleClose}
              disabled={!agreed}
              className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                agreed 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {t('announcement.understand')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
