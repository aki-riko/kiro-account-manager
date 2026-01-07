import { useState, useRef, useEffect } from 'react'
import { Search, X, ChevronDown, Tag } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

/**
 * 可搜索的标签选择下拉框
 * @param {Array} tags - 标签列表 [{id, name, color}]
 * @param {string} value - 当前选中的标签ID
 * @param {function} onChange - 选中回调 (tagId) => void
 * @param {string} placeholder - 占位文本
 * @param {boolean} showAllOption - 是否显示"全部"选项
 * @param {boolean} showNoneOption - 是否显示"无标签"选项
 * @param {string} allLabel - "全部"选项的文本
 * @param {string} noneLabel - "无标签"选项的文本
 * @param {boolean} fillInput - 选择后是否填充到输入框（用于TagSelector）
 * @param {function} onFillInput - 填充输入框回调 (tagName) => void
 */
function SearchableTagSelect({
  tags = [],
  value,
  onChange,
  placeholder = '搜索标签...',
  showAllOption = false,
  showNoneOption = false,
  allLabel = '全部',
  noneLabel = '无标签',
  fillInput = false,
  onFillInput,
  className = '',
}) {
  const { colors, theme } = useTheme()
  const isLightTheme = theme === 'light'
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 打开时聚焦搜索框
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  // 过滤标签
  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(search.toLowerCase())
  )

  // 获取当前选中的标签
  const selectedTag = tags.find(t => t.id === value)

  // 选择标签
  const handleSelect = (tagId, tagName) => {
    if (fillInput && onFillInput) {
      onFillInput(tagName || '')
    } else {
      onChange(tagId)
    }
    setOpen(false)
    setSearch('')
  }

  // 显示文本
  const displayText = value === '__none__' ? noneLabel : (selectedTag?.name || placeholder)

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all text-left`}
      >
        <span className={`flex items-center gap-2 ${!selectedTag && value !== '__none__' ? colors.textMuted : ''}`}>
          {selectedTag && (
            <span 
              className="w-3 h-3 rounded-full flex-shrink-0" 
              style={{ backgroundColor: selectedTag.color }}
            />
          )}
          {displayText}
        </span>
        <ChevronDown size={14} className={`${colors.textMuted} transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* 下拉面板 */}
      {open && (
        <div className={`absolute left-0 right-0 top-full mt-1 ${colors.card} border ${colors.cardBorder} rounded-lg shadow-xl z-50 overflow-hidden`}>
          {/* 搜索框 */}
          <div className={`p-2 border-b ${colors.cardBorder}`}>
            <div className="relative">
              <Search size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${colors.textMuted}`} />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className={`w-full pl-8 pr-8 py-1.5 border ${colors.cardBorder} rounded text-sm ${colors.input} ${colors.text} focus:outline-none focus:ring-1 focus:ring-blue-500/30`}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 ${colors.textMuted} hover:text-red-500`}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* 选项列表 */}
          <div className="max-h-48 overflow-y-auto">
            {/* 全部选项 */}
            {showAllOption && !search && (
              <button
                type="button"
                onClick={() => handleSelect(null, '')}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                  !value ? 'bg-blue-500/10 text-blue-500' : `${colors.text} ${isLightTheme ? 'hover:bg-gray-50' : 'hover:bg-white/5'}`
                }`}
              >
                <Tag size={14} className={colors.textMuted} />
                {allLabel}
              </button>
            )}

            {/* 无标签选项 */}
            {showNoneOption && !search && (
              <button
                type="button"
                onClick={() => handleSelect('__none__', '')}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                  value === '__none__' ? 'bg-blue-500/10 text-blue-500' : `${colors.text} ${isLightTheme ? 'hover:bg-gray-50' : 'hover:bg-white/5'}`
                }`}
              >
                <span className={`w-3 h-3 rounded-full border-2 border-dashed ${colors.cardBorder}`} />
                {noneLabel}
              </button>
            )}

            {/* 标签列表 */}
            {filteredTags.length > 0 ? (
              filteredTags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleSelect(tag.id, tag.name)}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                    value === tag.id ? 'bg-blue-500/10 text-blue-500' : `${colors.text} ${isLightTheme ? 'hover:bg-gray-50' : 'hover:bg-white/5'}`
                  }`}
                >
                  <span 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              ))
            ) : (
              <div className={`px-3 py-4 text-center text-sm ${colors.textMuted}`}>
                {search ? '未找到匹配的标签' : '暂无标签'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchableTagSelect
