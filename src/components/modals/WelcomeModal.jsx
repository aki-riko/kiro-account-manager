import { useState, useEffect } from 'react'
import { Sparkles, Coffee, X } from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import alipayQR from '../../assets/donate/alipay.jpg'
import wechatQR from '../../assets/donate/wechat.jpg'

function WelcomeModal() {
  const { t, colors } = useApp()
  const [open, setOpen] = useState(false)
  const [previewImg, setPreviewImg] = useState(null)
  const [isFirstTime, setIsFirstTime] = useState(false)

  useEffect(() => {
    const hasShownBefore = localStorage.getItem('welcome_shown')
    
    if (!hasShownBefore) {
      // 首次使用，显示完整版（免费声明 + 赞助）
      setIsFirstTime(true)
      setOpen(true)
      localStorage.setItem('welcome_shown', 'true')
    } else {
      // 之后每次启动，只显示免费声明
      setIsFirstTime(false)
      setOpen(true)
    }
  }, [])

  const handleClose = () => {
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${colors.card} rounded-2xl w-full max-w-[520px] shadow-2xl border ${colors.cardBorder} relative`}>
        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className={`absolute right-4 top-4 w-8 h-8 rounded-full flex items-center justify-center hover:scale-110 transition-transform ${colors.cardHover}`}
        >
          <X size={18} className={colors.text} />
        </button>

        {/* 头部 */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl blur-lg opacity-40" />
              <div className="relative w-14 h-14 bg-gradient-to-br from-[#4361ee] to-[#7c3aed] rounded-2xl flex items-center justify-center shadow-lg">
                <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
                  <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="white"/>
                </svg>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shadow-md">
                <Sparkles size={12} className="text-white" />
              </div>
            </div>

            <div>
              <h2 className={`text-xl font-semibold ${colors.text}`}>
                {isFirstTime ? '🎉 欢迎使用 Kiro Account Manager' : '⚠️ 重要提示'}
              </h2>
              <p className={`text-sm ${colors.textMuted} mt-1`}>
                {isFirstTime ? '完全免费开源的 Kiro IDE 账号管理工具' : '本软件永久免费'}
              </p>
            </div>
          </div>
        </div>

        {/* 内容 */}
        <div className="px-6 py-4 space-y-4">
          {/* 免费声明（重要提示） */}
          <div className={`border-l-4 border-red-500 ${colors.cardSecondary} rounded-r-xl p-3`}>
            <p className={`text-sm font-semibold ${colors.text} mb-2`}>
              ⚠️ 重要提示：本软件永久免费
            </p>
            <div className={`text-xs ${colors.textMuted} space-y-1`}>
              <p>• 本软件完全开源免费，任何人不得以任何形式收费</p>
              <p>• 所有功能完全开放，无任何限制</p>
              <p>• 如有人向您收费，请立即举报</p>
            </div>
          </div>

          {/* 赞助信息（仅首次显示） */}
          {isFirstTime && (
            <div>
              <p className={`text-sm font-medium ${colors.text} mb-2`}>
                <Coffee size={16} className="inline text-amber-500 mr-1" />
                💖 支持开源项目持续维护
              </p>
              <div className={`${colors.cardSecondary} rounded-xl p-3 space-y-2`}>
                <p className={`text-sm ${colors.textMuted}`}>如果这个工具帮到了你，可以请我喝杯咖啡 ☕</p>
                <p className={`text-sm ${colors.textMuted}`}>赞助用户将获得：</p>
                <div className="space-y-1">
                  <p className={`text-sm ${colors.text}`}>⚡ 闪电响应：Issues 24小时内回复</p>
                  <p className={`text-sm ${colors.text}`}>🎯 优先开发：你的建议优先实现</p>
                  <p className={`text-sm ${colors.text}`}>🔧 加急修复：Bug 1-3天内解决</p>
                </div>
                
                {/* 二维码 */}
                <div className="flex justify-center gap-6 pt-3">
                  <div 
                    className="flex flex-col items-center gap-2 cursor-pointer group"
                    onClick={() => setPreviewImg(alipayQR)}
                  >
                    <div className="relative">
                      <div className="absolute inset-0 bg-blue-500 rounded-lg blur-md opacity-0 group-hover:opacity-30 transition-opacity" />
                      <img 
                        src={alipayQR} 
                        alt="支付宝" 
                        className="relative w-20 h-20 rounded-lg shadow-md hover:scale-105 transition-transform"
                      />
                    </div>
                    <p className={`text-xs ${colors.text}`}>支付宝</p>
                  </div>
                  <div 
                    className="flex flex-col items-center gap-2 cursor-pointer group"
                    onClick={() => setPreviewImg(wechatQR)}
                  >
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-500 rounded-lg blur-md opacity-0 group-hover:opacity-30 transition-opacity" />
                      <img 
                        src={wechatQR} 
                        alt="微信支付" 
                        className="relative w-20 h-20 rounded-lg shadow-md hover:scale-105 transition-transform"
                      />
                    </div>
                    <p className={`text-xs ${colors.text}`}>微信支付</p>
                  </div>
                </div>
                <p className={`text-xs ${colors.textMuted} text-center pt-1`}>点击图片可放大查看</p>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className={`px-6 py-4 ${colors.dialogFooter} flex justify-end gap-3`}>
          <button
            onClick={handleClose}
            className="px-5 py-2.5 text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98]"
          >
            {isFirstTime ? '开始使用' : '我知道了'}
          </button>
        </div>
      </div>

      {/* 图片预览弹窗 */}
      {previewImg && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setPreviewImg(null)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img 
              src={previewImg} 
              alt="预览" 
              className="max-w-[320px] max-h-[320px] rounded-xl shadow-2xl"
            />
            <button 
              className={`absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform ${colors.card}`}
              onClick={() => setPreviewImg(null)}
            >
              <X size={16} className={colors.text} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default WelcomeModal
