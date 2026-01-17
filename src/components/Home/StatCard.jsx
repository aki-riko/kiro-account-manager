// 统计卡片组件 - 紧凑版
function StatCard({ icon: Icon, iconBg, value, label, delay, isLightTheme, onClick, warning }) {
  const cardClass = onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''
  const warningClass = warning ? 'ring-2 ring-orange-500/50' : ''
  
  return (
    <div 
      onClick={onClick}
      className={`card-glow rounded-xl p-3 shadow-sm border animate-scale-in ${delay} ${cardClass} ${warningClass}`}
      style={{ 
        background: isLightTheme ? 'white' : 'rgba(30, 30, 50, 0.8)',
        borderColor: isLightTheme ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)'
      }}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center relative`}>
          <Icon size={18} className={!isLightTheme ? 'text-current' : ''} />
          {warning && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse" />
          )}
        </div>
        <div>
          <span className={`text-xl font-bold stat-number ${isLightTheme ? 'text-gray-900' : 'text-white'}`}>{value}</span>
          <div className={`text-xs ${isLightTheme ? 'text-gray-500' : 'text-gray-400'}`}>{label}</div>
        </div>
      </div>
    </div>
  )
}

export default StatCard
