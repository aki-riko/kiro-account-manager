# 项目样式系统架构

## 样式系统概览

本项目采用**三层样式系统**：

```
┌─────────────────────────────────────────────────────────┐
│  1. Tailwind CSS (工具类)                                │
│     - 快速布局和样式                                      │
│     - 响应式设计                                          │
│     - 动画和过渡效果                                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  2. ThemeContext (主题变量)                              │
│     - 定义 4 种主题的颜色变量                             │
│     - 通过 colors.xxx 提供 Tailwind 类名                 │
│     - 组件通过 className={colors.text} 使用              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  3. Mantine 全局样式 (组件库默认样式)                     │
│     - 为 Mantine 组件设置全局默认样式                     │
│     - 确保 Mantine 组件与 Tailwind 协同工作              │
│     - 设置颜色继承规则                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Tailwind CSS 层

### 作用
- 提供原子化 CSS 类，用于快速构建 UI
- 处理布局、间距、尺寸、响应式等

### 使用方式
```jsx
<div className="flex items-center gap-4 p-6 rounded-xl">
  <span className="text-sm font-medium">文字</span>
</div>
```

### 特点
- 直接在 JSX 中使用类名
- 不需要写 CSS 文件
- 支持响应式（sm:、md:、lg: 等前缀）

---

## 2. ThemeContext 层（核心）

### 作用
- **统一管理主题颜色**
- 提供 4 种主题：light、dark、purple、green
- 每个主题定义一套完整的颜色变量

### 颜色变量结构
```javascript
// src/contexts/ThemeContext.jsx
export const themes = {
  dark: {
    // 主要颜色
    main: 'bg-[#0f0f1a]',           // 页面背景
    card: 'bg-[#1a1a2e]',           // 卡片背景
    text: 'text-gray-100',          // 主文字颜色
    textMuted: 'text-gray-400',     // 次要文字颜色
    
    // 边框和分隔线
    cardBorder: 'border-gray-800',
    divider: 'border-white/10',
    
    // 交互状态
    cardHover: 'hover:bg-white/10',
    
    // 输入框
    input: 'bg-[#252540] border-gray-700',
    inputFocus: 'focus:ring-blue-500/30 focus:border-blue-500',
    
    // 按钮
    btnPrimary: 'bg-blue-500 hover:bg-blue-600 text-white',
    btnSecondary: 'bg-[#1a1a1a] hover:bg-[#252525] border-[#333] text-gray-300',
    
    // 状态徽章
    badgeInfo: 'bg-blue-500/20 text-blue-400',
    badgeSuccess: 'bg-green-500/20 text-green-400',
    badgeWarning: 'bg-orange-500/20 text-orange-400',
    
    // ... 更多变量
  },
  light: { /* 浅色主题变量 */ },
  purple: { /* 紫色主题变量 */ },
  green: { /* 绿色主题变量 */ },
}
```

### 使用方式
```jsx
import { useApp } from '../hooks/useApp'

function MyComponent() {
  const { colors } = useApp()
  
  return (
    <div className={`${colors.card} border ${colors.cardBorder}`}>
      <h1 className={colors.text}>标题</h1>
      <p className={colors.textMuted}>描述</p>
    </div>
  )
}
```

### 优势
- **主题切换自动生效**：切换主题时，所有使用 `colors.xxx` 的地方自动更新
- **类型安全**：通过 Context 提供，避免拼写错误
- **集中管理**：所有颜色定义在一个地方，易于维护

---

## 3. Mantine 全局样式层

### 作用
- 为 Mantine 组件库设置全局默认样式
- 确保 Mantine 组件与 Tailwind 颜色系统协同工作
- 解决 Mantine 组件在深色主题下的颜色问题

### 配置位置
```javascript
// src/contexts/ThemeContext.jsx
const mantineTheme = {
  colorScheme: isLightTheme ? 'light' : 'dark',
  components: {
    // Card 组件全局样式
    Card: {
      styles: {
        root: {
          backgroundColor: isLightTheme ? '#ffffff' : 'rgba(30, 30, 50, 0.8)',
          borderColor: isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)',
          color: isLightTheme ? '#1f2937' : '#e5e7eb', // 关键：设置基础文字颜色
        },
      },
    },
    // Text/Group/Stack 继承父元素颜色
    Text: {
      styles: {
        root: {
          color: 'inherit',
        },
      },
    },
    Group: {
      styles: {
        root: {
          color: 'inherit',
        },
      },
    },
    Stack: {
      styles: {
        root: {
          color: 'inherit',
        },
      },
    },
    // Select 组件样式
    Select: {
      styles: (theme) => ({
        input: {
          backgroundColor: 'transparent',
          color: isLightTheme ? '#1f2937' : '#e5e7eb',
        },
        option: {
          color: isLightTheme ? '#1f2937' : '#e5e7eb',
        },
      }),
    },
  },
}
```

### 颜色继承机制
```
Card (color: #e5e7eb 浅色) ← Mantine 全局样式设置
  ├─ Text (color: inherit) → 继承 Card 的 #e5e7eb
  ├─ Group (color: inherit) → 继承 Card 的 #e5e7eb
  └─ Stack (color: inherit) → 继承 Card 的 #e5e7eb
      └─ Text className={colors.textMuted} → Tailwind 覆盖为 #9ca3af
```

### 为什么需要这一层？
1. **Mantine 有自己的颜色系统**：不会自动适配 Tailwind
2. **深色主题问题**：Mantine 默认在深色主题下使用深色文字
3. **统一体验**：确保 Mantine 组件与项目整体风格一致

---

## 样式优先级

```
Mantine 全局样式 (最低优先级)
    ↓
ThemeContext colors (中等优先级)
    ↓
组件内联 styles (最高优先级)
```

### 示例
```jsx
<Card
  className={colors.card}  // ThemeContext 提供的 Tailwind 类
  styles={{ root: { backgroundColor: 'transparent' } }}  // 内联样式覆盖
>
  <Text className={colors.text}>  // ThemeContext 提供的颜色
    文字
  </Text>
</Card>
```

**结果**：
- Card 背景：`transparent`（内联样式覆盖了 Mantine 全局样式）
- Card 文字颜色：`#e5e7eb`（Mantine 全局样式设置的 color）
- Text 文字颜色：`#e5e7eb`（继承 Card 的 color）
- 如果 Text 有 `className={colors.textMuted}`，则覆盖为 `#9ca3af`

---

## 最佳实践

### ✅ 推荐做法

1. **使用 ThemeContext 颜色变量**
```jsx
<div className={`${colors.card} ${colors.text}`}>
  <span className={colors.textMuted}>次要文字</span>
</div>
```

2. **Mantine 组件使用 className 而非 c 属性**
```jsx
// ❌ 错误
<Text c="dimmed">文字</Text>

// ✅ 正确
<Text className={colors.textMuted}>文字</Text>
```

3. **Card 组件依赖 Mantine 全局样式**
```jsx
// ✅ 正确：依赖 Mantine 全局样式提供的 color
<Card>
  <Text>文字会自动继承正确的颜色</Text>
</Card>

// ⚠️ 特殊情况：需要透明背景时
<Card styles={{ root: { backgroundColor: 'transparent' } }}>
  <Text className={colors.text}>需要手动设置颜色</Text>
</Card>
```

### ❌ 避免的做法

1. **不要硬编码颜色**
```jsx
// ❌ 错误
<div className="bg-gray-800 text-white">

// ✅ 正确
<div className={`${colors.card} ${colors.text}`}>
```

2. **不要使用 Mantine 的颜色属性**
```jsx
// ❌ 错误
<Text c="dimmed">
<Badge color="gray">

// ✅ 正确
<Text className={colors.textMuted}>
<Badge className={colors.badgeInfo}>
```

3. **不要在组件内定义主题相关的颜色**
```jsx
// ❌ 错误
const bgColor = theme === 'dark' ? '#1a1a2e' : '#ffffff'

// ✅ 正确
const { colors } = useApp()
// 使用 colors.card
```

---

## 主题切换流程

```
用户点击主题切换按钮
    ↓
setTheme('dark')
    ↓
ThemeContext 更新 theme 状态
    ↓
colors 变量自动更新为 themes.dark
    ↓
Mantine 全局样式重新计算（isLightTheme 变化）
    ↓
所有使用 colors.xxx 的组件自动重新渲染
    ↓
页面主题切换完成
```

---

## 调试技巧

### 1. 检查 ThemeContext 是否生效
```jsx
const { theme, colors } = useApp()
console.log('当前主题:', theme)
console.log('颜色变量:', colors)
```

### 2. 检查 Mantine 全局样式
- 打开浏览器开发者工具
- 检查 Card 元素的 computed styles
- 查看 `color` 属性是否正确

### 3. 深色主题文字不可读？
- 99% 是 Card 没有设置 color
- 检查 ThemeContext 中 Card 的全局样式配置
- 确保 `color: isLightTheme ? '#1f2937' : '#e5e7eb'` 存在

---

## 常见问题

### Q: 为什么有些 Card 设置了 backgroundColor: 'transparent'？
A: 这是为了让背景透明，显示页面的渐变背景。但 Mantine 全局样式设置的 `color` 仍然生效，所以文字颜色是正确的。

### Q: 什么时候用 Tailwind，什么时候用 ThemeContext？
A: 
- **布局、间距、尺寸**：直接用 Tailwind（`flex`、`p-4`、`w-full`）
- **颜色、主题相关**：用 ThemeContext（`colors.card`、`colors.text`）

### Q: 为什么不直接用 Tailwind 的 dark: 前缀？
A: 
- Tailwind 的 dark: 只支持 light/dark 两种模式
- 我们有 4 种主题（light、dark、purple、green）
- ThemeContext 更灵活，可以自定义任意主题

### Q: 新增主题需要做什么？
A:
1. 在 `themes` 对象中添加新主题配置
2. 定义所有颜色变量（参考现有主题）
3. 在主题选择器中添加新选项
4. 无需修改组件代码，自动生效

---

## 相关文件

- `src/contexts/ThemeContext.jsx` - 主题系统核心
- `src/hooks/useApp.js` - 提供 `colors` 访问
- `.kiro/steering/mantine-theme.md` - Mantine 主题规范
- `tailwind.config.js` - Tailwind 配置

---

## 总结

本项目的样式系统设计原则：

1. **分层清晰**：Tailwind（工具）→ ThemeContext（主题）→ Mantine（组件库）
2. **主题驱动**：所有颜色通过 ThemeContext 管理，切换主题自动生效
3. **灵活扩展**：新增主题只需添加配置，无需修改组件
4. **类型安全**：通过 Context 提供，避免拼写错误
5. **性能优化**：Tailwind 类名在构建时生成，运行时无性能损耗

**核心理念**：用 Tailwind 写布局，用 ThemeContext 管理颜色，用 Mantine 全局样式确保组件库协同工作。
