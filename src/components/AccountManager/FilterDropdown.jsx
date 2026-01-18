import { useState, useRef, useEffect } from 'react'
import { Filter, X } from 'lucide-react'
import { Select } from '@mantine/core'
import { useTheme } from '../../contexts/ThemeContext'
import { useTranslation } from 'react-i18next'
import SearchableTagSelect from './SearchableTagSelect'

const SUBSCRIPTION_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'FREE', label: 'FREE' },
  { value: 'KIRO FREE', label: 'KIRO FREE' },
  { value: 'KIRO PRO', label: 'KIRO PRO' },
  { value: 'KIRO PRO+', label: 'KIRO PRO+' },
  { value: 'KIRO ENTERPRISE', label: 'KIRO ENTERPRISE' },
]
const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'normal', label: '正常' },
  { value: 'banned', label: '封禁' },
  { value: 'expired', label: '过期' },
]
const PROVIDER_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'Google', label: 'Google' },
  { value: 'GitHub', label: 'GitHub' },
  { value: 'BuilderId', label: 'BuilderId' },
]
const USAGE_RANGE_OPTIONS = [
  { value: '', label: '全部' },
  { value: '0-25', label: '0-25%' },
  { value: '25-50', label: '25-50%' },
  { value: '50-75', label: '50-75%' },
  { value: '75-100', label: '75-100%' },
]

// 通用筛选下拉组件
function FilterSelect({ label, value, options, onChange, onClear, colors }) {
  const hasValue = value && value !== ''
  
  return (
    <div>
      <label className={`block text-xs font-semibold ${colors.text} mb-2`}>{label}</label>
      <Select
        value={value || null}
        onChange={(v) => {
          if (!v || v === '') {
            onClear?.()
          } else {
            onChange(v)
          }
        }}
        data={options}
        clearable={hasValue}
        classNames={{
          input: `${colors.input} ${colors.text} ${colors.inputFocus}`,
          dropdown: `${colors.card} border ${colors.cardBorder}`,
          option: `${colors.text}`
        }}
        styles={{
          input: {
            fontSize: '0.875rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            borderColor: hasValue ? '#3b82f6' : undefined,
            boxShadow: hasValue ? '0 0 0 1px rgba(59, 130, 246, 0.3)' : undefined
          }
        }}
      />
    </div>
  )
}

function FilterDropdown({ 
  filters, 
  onFiltersChange,
  allGroups = [],
  selectedGroup,
  onGroupFilter,
  allTags = [],
  selectedTag,
  onTagFilter,
  selectedStatus,
  onStatusFilter,
}) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeCount = [
    filters.subscriptions?.length || 0,
    filters.statuses?.length || 0,
    filters.providers?.length || 0,
    filters.usageRange ? 1 : 0,
    selectedGroup ? 1 : 0,
    selectedTag ? 1 : 0,
    selectedStatus ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  const clearAll = () => {
    onFiltersChange({ subscriptions: [], statuses: [], providers: [], usageRange: null })
    onGroupFilter?.(null)
    onTagFilter(null)
    onStatusFilter(null)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 ${colors.card} border ${colors.cardBorder} rounded-lg ${colors.cardHover} transition-all ${activeCount > 0 ? 'border-blue-500/50 shadow-sm shadow-blue-500/20' : ''}`}
      >
        <Filter size={16} className={activeCount > 0 ? 'text-blue-500' : colors.textMuted} />
        <span className={`text-sm ${activeCount > 0 ? 'text-blue-500 font-medium' : colors.textMuted}`}>
          {t('filter.title')}
        </span>
        {activeCount > 0 && (
          <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] rounded-full font-medium min-w-[18px] text-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-2 w-80 ${colors.card} border ${colors.cardBorder} rounded-lg shadow-2xl z-50 overflow-hidden backdrop-blur-sm`}>
          {/* 头部 */}
          <div className={`px-5 py-4 border-b ${colors.cardBorder} bg-gradient-to-r from-blue-500/5 to-purple-500/5`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Filter size={14} className="text-white" />
                </div>
                <span className={`text-sm font-semibold ${colors.text}`}>{t('filter.title')}</span>
              </div>
              {activeCount > 0 && (
                <button 
                  onClick={clearAll} 
                  className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-all font-medium"
                >
                  <X size={12} />
                  {t('filter.clearAll')}
                </button>
              )}
            </div>
          </div>

          {/* 筛选项 */}
          <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
            {/* 分组 */}
            {allGroups.length > 0 && (
              <div className={`p-3.5 rounded-lg ${colors.cardSecondary} border ${colors.cardBorder}`}>
                <label className={`block text-xs font-semibold ${colors.text} mb-2.5`}>{t('groups.title') || '分组'}</label>
                <SearchableTagSelect
                  tags={allGroups}
                  value={selectedGroup}
                  onChange={onGroupFilter}
                  placeholder={t('groups.searchPlaceholder') || '搜索分组...'}
                  showAllOption={true}
                  showNoneOption={true}
                  allLabel={t('groups.all') || '全部'}
                  noneLabel={t('groups.noGroup') || '无分组'}
                  hasLabel={t('groups.hasGroup') || '有分组'}
                />
              </div>
            )}

            {/* 标签 */}
            {allTags.length > 0 && (
              <div className={`p-3.5 rounded-lg ${colors.cardSecondary} border ${colors.cardBorder}`}>
                <label className={`block text-xs font-semibold ${colors.text} mb-2.5`}>{t('tags.title')}</label>
                <SearchableTagSelect
                  tags={allTags}
                  value={selectedTag}
                  onChange={onTagFilter}
                  placeholder={t('tags.searchPlaceholder') || '搜索标签...'}
                  showAllOption={true}
                  showNoneOption={true}
                  allLabel={t('tags.all')}
                  noneLabel={t('tags.noTags')}
                  hasLabel={t('tags.hasTags') || '有标签'}
                />
              </div>
            )}

            {/* 订阅类型 */}
            <div className={`p-3.5 rounded-lg ${colors.cardSecondary} border ${colors.cardBorder}`}>
              <FilterSelect
                label={t('filter.subscription')}
                value={filters.subscriptions?.length > 0 ? filters.subscriptions[0] : ''}
                options={SUBSCRIPTION_OPTIONS}
                onChange={(v) => onFiltersChange({ ...filters, subscriptions: v ? [v] : [] })}
                onClear={() => onFiltersChange({ ...filters, subscriptions: [] })}
                colors={colors}
              />
            </div>

            {/* 账号状态 */}
            <div className={`p-3.5 rounded-lg ${colors.cardSecondary} border ${colors.cardBorder}`}>
              <FilterSelect
                label={t('filter.status')}
                value={filters.statuses?.length > 0 ? filters.statuses[0] : ''}
                options={STATUS_OPTIONS}
                onChange={(v) => onFiltersChange({ ...filters, statuses: v ? [v] : [] })}
                onClear={() => onFiltersChange({ ...filters, statuses: [] })}
                colors={colors}
              />
            </div>

            {/* 登录方式 */}
            <div className={`p-3.5 rounded-lg ${colors.cardSecondary} border ${colors.cardBorder}`}>
              <FilterSelect
                label={t('filter.provider')}
                value={filters.providers?.length > 0 ? filters.providers[0] : ''}
                options={PROVIDER_OPTIONS}
                onChange={(v) => onFiltersChange({ ...filters, providers: v ? [v] : [] })}
                onClear={() => onFiltersChange({ ...filters, providers: [] })}
                colors={colors}
              />
            </div>

            {/* 使用率 */}
            <div className={`p-3.5 rounded-lg ${colors.cardSecondary} border ${colors.cardBorder}`}>
              <FilterSelect
                label={t('filter.usageRange')}
                value={filters.usageRange || ''}
                options={USAGE_RANGE_OPTIONS}
                onChange={(v) => onFiltersChange({ ...filters, usageRange: v || null })}
                onClear={() => onFiltersChange({ ...filters, usageRange: null })}
                colors={colors}
              />
            </div>
          </div>

          {/* 底部统计 */}
          {activeCount > 0 && (
            <div className={`px-5 py-3 border-t ${colors.cardBorder} bg-gradient-to-r from-blue-500/10 to-purple-500/10`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-blue-600">
                  {t('common.selected')}: {activeCount} {t('common.filter').toLowerCase()}
                </p>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(activeCount, 5) }).map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default FilterDropdown
