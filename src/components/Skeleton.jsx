import { useTheme } from '../contexts/ThemeContext'

// 基础骨架元素
export function SkeletonBox({ className = '' }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  
  return (
    <div 
      className={`animate-pulse rounded ${isDark ? 'bg-white/10' : 'bg-gray-200'} ${className}`}
    />
  )
}

// 账号卡片骨架屏
export function AccountCardSkeleton() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className={`relative rounded-2xl border ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white'} p-4 pt-10`}>
      {/* 选择框占位 */}
      <div className="absolute top-3 left-3">
        <SkeletonBox className="w-4 h-4 rounded" />
      </div>

      {/* 状态标签占位 */}
      <div className="absolute top-3 right-3">
        <SkeletonBox className="w-12 h-5 rounded" />
      </div>

      {/* 头像和邮箱 */}
      <div className="flex items-start gap-3 mb-3">
        <SkeletonBox className="w-10 h-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <SkeletonBox className="h-4 w-3/4 mb-2" />
          <SkeletonBox className="h-3 w-1/2" />
        </div>
      </div>

      {/* 订阅类型 */}
      <div className="flex items-center gap-2 mb-3">
        <SkeletonBox className="h-6 w-16 rounded-lg" />
        <SkeletonBox className="h-6 w-14 rounded-lg" />
      </div>

      {/* 配额进度 */}
      <div className={`p-3 rounded-xl mb-3 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between mb-2">
          <SkeletonBox className="h-3 w-12" />
          <SkeletonBox className="h-3 w-8" />
        </div>
        <SkeletonBox className="h-2 w-full rounded-full mb-2" />
        <div className="flex items-center justify-between">
          <SkeletonBox className="h-3 w-20" />
          <SkeletonBox className="h-3 w-16" />
        </div>
      </div>
    </div>
  )
}

// 账号列表骨架屏
export function AccountListSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
      {[...Array(count)].map((_, i) => (
        <AccountCardSkeleton key={i} />
      ))}
    </div>
  )
}

// 首页统计卡片骨架屏
export function StatCardSkeleton() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className={`rounded-2xl p-5 border ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-2 mb-2">
        <SkeletonBox className="w-8 h-8 rounded-lg" />
        <SkeletonBox className="h-4 w-20" />
      </div>
      <SkeletonBox className="h-8 w-16" />
    </div>
  )
}

export default { SkeletonBox, AccountCardSkeleton, AccountListSkeleton, StatCardSkeleton }
