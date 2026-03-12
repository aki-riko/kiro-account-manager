---
inclusion: always
---

# Dialog 组件封装规范

基于 Headless UI 和 Tailwind CSS 的最佳实践。

## 核心原则

### 1. Headless UI 组件模式

Headless UI 提供无样式的可访问组件，通过 Transition 组件实现动画效果。

**官方推荐结构**：
```jsx
<Transition show={open}>
  <Dialog onClose={onClose}>
    <Transition.Child>
      <div className="overlay" />
    </Transition.Child>
    <Transition.Child>
      <Dialog.Panel>
        <Dialog.Title />
        <Dialog.Description />
        {/* 内容 */}
      </Dialog.Panel>
    </Transition.Child>
  </Dialog>
</Transition>
```

### 2. 组件封装层次

**基础组件（Primitives）**：
- 基于 Headless UI 封装
- 添加样式和主题支持
- 内置动画效果（Transition）
- 保持灵活性

**完整组件（Composed）**：
- 封装常见用例
- 提供开箱即用的 API
- 简化使用方式
- 用于快速开发

---

## 组件结构规范

### 基础组件导出

```jsx
export {
  DialogRoot,        // Headless UI Dialog Root + Transition
  DialogOverlay,     // 遮罩层（带动画）
  DialogClose,       // 关闭按钮
  DialogContent,     // 内容容器（带动画，不带内边距）
  DialogHeader,      // 头部区域（px-6 pt-6 pb-2）
  DialogTitle,       // 标题
  DialogDescription, // 描述文本
  DialogBody,        // 内容区域（px-6 py-4）
  DialogFooter,      // 底部区域（px-6 py-4）
}
```

### 内边距规范

**关键原则**：DialogContent 不带内边距，由子组件控制

- **DialogContent**：无内边距（让子组件控制布局）
- **DialogHeader**：`px-6 pt-6 pb-2`
- **DialogBody**：`px-6 py-4`（新增组件）
- **DialogFooter**：`px-6 py-4`

**为什么这样设计？**
- 避免内边距叠加
- 更灵活的布局控制
- 符合 shadcn/ui 设计理念

---

## 组件实现规范

### 1. DialogContent（不带内边距）

```jsx
const DialogContent = React.forwardRef(({ 
  className, 
  children, 
  maxWidth = "400px",
  showClose = true,
  ...props 
}, ref) => {
  const { colors } = useApp()
  
  return (
    <>
      <DialogOverlay />
      
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <HeadlessDialog.Panel
              ref={ref}
              className={cn(
                "w-full shadow-2xl rounded-2xl border",
                "max-h-[90vh] flex flex-col relative",
                // ⚠️ 注意：不添加 padding
                colors.card,
                colors.cardBorder,
                className
              )}
              style={{ maxWidth }}
              {...props}
            >
              {children}
              {showClose && (
                <button className="absolute right-4 top-4 ...">
                  <X size={18} />
                </button>
              )}
            </HeadlessDialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </>
  )
})
```

### 2. DialogHeader（带内边距）

```jsx
const DialogHeader = React.forwardRef(({ 
  className, 
  icon: Icon, 
  iconColor, 
  iconBg, 
  children, 
  ...props 
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn("px-6 pt-6 pb-2", className)}
      {...props}
    >
      {Icon && (
        <div className="flex items-center gap-4 mb-2">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center",
            iconBg || "bg-gradient-to-br from-blue-500/20 to-indigo-500/10"
          )}>
            <Icon size={24} className={iconColor || "text-blue-400"} />
          </div>
        </div>
      )}
      {children}
    </div>
  )
})
```

### 3. DialogBody（新增，带内边距和间距控制）

```jsx
const DialogBody = React.forwardRef(({ 
  className, 
  gap = "md",      // 子元素间距：none | sm | md | lg | xl
  noPadding = false, // 是否移除内边距（特殊场景）
  ...props 
}, ref) => {
  const { colors } = useApp()
  
  const gapClasses = {
    none: "",
    sm: "space-y-3",
    md: "space-y-4",
    lg: "space-y-6",
    xl: "space-y-8",
  }
  
  return (
    <div
      ref={ref}
      className={cn(
        noPadding ? "" : "px-6 py-4",
        colors.text,
        gapClasses[gap],
        className
      )}
      {...props}
    />
  )
})
DialogBody.displayName = "DialogBody"
```

**参数说明**：
- `gap`: 子元素间距，默认 `"md"` (16px)
- `noPadding`: 移除内边距，用于特殊场景（如全宽图片）
- `className`: 额外的自定义样式

### 4. DialogDescription（仅用于描述文本）

```jsx
const DialogDescription = React.forwardRef(({ className, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <HeadlessDialog.Description
      ref={ref}
      className={cn("text-sm mt-1", colors.textMuted, className)}
      {...props}
    />
  )
})
```

**⚠️ 重要**：DialogDescription 只用于描述文本，不是内容容器！

### 5. DialogFooter（带内边距）

```jsx
const DialogFooter = React.forwardRef(({ className, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <div
      ref={ref}
      className={cn(
        "px-6 py-4 flex justify-end gap-3",
        colors.dialogFooter,
        className
      )}
      {...props}
    />
  )
})
```

---

## 完整组件封装

### 推荐 API 设计

```jsx
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = '400px',
  icon: Icon,
  iconColor,
  iconBg,
  showClose = true,
}) {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth={maxWidth} showClose={showClose}>
        {(title || description || Icon) && (
          <DialogHeader icon={Icon} iconColor={iconColor} iconBg={iconBg}>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        
        {children && (
          <DialogBody>{children}</DialogBody>
        )}
        
        {footer && (
          <DialogFooter>{footer}</DialogFooter>
        )}
      </DialogContent>
    </DialogRoot>
  )
}
```

**关键改进**：
- 使用 `footer` prop 而非固定按钮
- 自动包裹 children 到 DialogBody
- DialogDescription 用于描述文本

---

## 使用示例

### 基础组件（灵活定制）

```jsx
<DialogRoot open={open} onOpenChange={setOpen}>
  <DialogContent maxWidth="600px">
    <DialogHeader>
      <DialogTitle>编辑账号</DialogTitle>
      <DialogDescription>修改账号备注信息</DialogDescription>
    </DialogHeader>
    
    <DialogBody gap="xl">
      <div>
        <label>备注</label>
        <input className="..." />
      </div>
      <div>
        <label>机器码</label>
        <input className="..." />
      </div>
    </DialogBody>
    
    <DialogFooter>
      <Button variant="secondary" onClick={() => setOpen(false)}>
        取消
      </Button>
      <Button onClick={handleSave}>
        保存
      </Button>
    </DialogFooter>
  </DialogContent>
</DialogRoot>
```

### 完整组件（快速开发）

```jsx
<Dialog
  open={open}
  onOpenChange={setOpen}
  title="确认删除"
  description="此操作无法撤销，确定要删除吗？"
  icon={AlertTriangle}
  iconColor="text-red-400"
  iconBg="bg-gradient-to-br from-red-500/20 to-rose-500/10"
  footer={
    <>
      <Button variant="secondary" onClick={() => setOpen(false)}>
        取消
      </Button>
      <Button variant="danger" onClick={handleDelete}>
        删除
      </Button>
    </>
  }
/>
```

---

## 样式规范

### 弹窗宽度

- **小弹窗**（确认/提示）：`max-w-[400px]`
- **中等弹窗**（表单）：`max-w-[480px]`
- **大弹窗**（复杂表单）：`max-w-[600px]`
- **超大弹窗**（编辑器）：`max-w-[800px]`

### 圆角规范

- **弹窗外框**：`rounded-2xl`
- **按钮**：`rounded-xl`
- **输入框**：`rounded-xl`
- **图标容器**：`rounded-2xl`

### 动画规范

```jsx
// 弹窗入场动画
style={{ animation: 'dialogSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}

// 背景遮罩动画
className="animate-fade-in"

// 按钮点击动画
className="active:scale-[0.98] transition-all duration-200"
```

### 图标规范

- **弹窗主图标**：`size={24}`
- **按钮图标**：`size={16}` 或 `size={14}`
- **关闭按钮图标**：`size={18}`

### 类型配色

- **确认（Confirm）**：`AlertTriangle` + `amber`
- **成功（Success）**：`CheckCircle` + `emerald`
- **错误（Error）**：`XCircle` + `red`
- **信息（Info）**：`Info` + `blue`

---

## 统一的 Dialog 组件

**项目已统一使用 Dialog 组件**，不再区分 Dialog 和 Modal。

### 特点

- **文件**：`src/components/ui/dialog.jsx`
- **基于**：Headless UI + Tailwind CSS
- **动画**：内置 Transition 组件
- **灵活性**：通过 `maxWidth` 参数控制大小
- **内边距**：DialogContent 无内边距，由子组件控制

### 使用方式

**小弹窗（确认/提示）**：
```jsx
<DialogRoot open={open} onOpenChange={setOpen}>
  <DialogContent maxWidth="400px">
    <DialogHeader icon={AlertTriangle} iconColor="text-amber-400">
      <DialogTitle>确认删除</DialogTitle>
      <DialogDescription>此操作无法撤销</DialogDescription>
    </DialogHeader>
    <DialogBody gap="sm">
      <p>确定要删除这个账号吗？</p>
    </DialogBody>
    <DialogFooter>
      <Button variant="secondary">取消</Button>
      <Button variant="danger">删除</Button>
    </DialogFooter>
  </DialogContent>
</DialogRoot>
```

**大弹窗（表单/详情）**：
```jsx
<DialogRoot open={open} onOpenChange={setOpen}>
  <DialogContent maxWidth="800px">
    <DialogHeader icon={User} iconColor="text-blue-400">
      <DialogTitle>账号详情</DialogTitle>
      <DialogDescription>查看和编辑账号信息</DialogDescription>
    </DialogHeader>
    
    <DialogBody noPadding>
      <div className="px-6 py-4">配额卡片</div>
      <div className="px-6 py-4">表单字段</div>
      <TokenJsonView />
    </DialogBody>
    
    <DialogFooter>
      <Button>关闭</Button>
    </DialogFooter>
  </DialogContent>
</DialogRoot>
```

### 实际应用

**项目中的使用**：
- `ConfirmModal.jsx` → Dialog（400px）
- `AddAccountModal.jsx` → Dialog（480px）
- `ImportAccountModal.jsx` → Dialog（700px）
- `EditAccountModal.jsx` → Dialog（480px）
- `BatchTagModal.jsx` → Dialog（480px）
- `AccountDetailModal.jsx` → Dialog（800px）

---

## 常见错误

### ❌ 错误 1：全局 CSS 重置覆盖 Tailwind 类

```css
/* ❌ 错误 - 覆盖所有元素的 padding */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

**问题**：这会导致 Tailwind 的 `px-6 py-4` 等 padding 类被覆盖，弹窗内容贴边。

**解决方案**：
```css
/* ✅ 正确 - 只重置必要的元素 */
* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
}

h1, h2, h3, h4, h5, h6, p, ul, ol, li, figure, blockquote, dl, dd {
  margin: 0;
  padding: 0;
}
```

### ❌ 错误 2：DialogContent 带内边距

```jsx
<DialogPrimitive.Content className="p-4">  // ❌ 错误
  <DialogHeader className="px-6 pt-6 pb-2">  // 内边距叠加
```

### ❌ 错误 2：DialogContent 带内边距

```jsx
<DialogPrimitive.Content className="p-4">  // ❌ 错误
  <DialogHeader className="px-6 pt-6 pb-2">  // 内边距叠加
```

### ❌ 错误 3：DialogDescription 作为容器

```jsx
<DialogDescription>
  <form>...</form>  // ❌ 错误：应该用 DialogBody
</DialogDescription>
```

### ❌ 错误 3：DialogDescription 作为容器

```jsx
<DialogDescription>
  <form>...</form>  // ❌ 错误：应该用 DialogBody
</DialogDescription>
```

### ❌ 错误 4：在 DialogBody 内嵌套容器组件

```jsx
<DialogBody>
  <Stack gap="xl">  // ❌ 不必要的嵌套
    <div>字段</div>
  </Stack>
</DialogBody>
```

### ✅ 正确做法

```jsx
<DialogContent>  // 无内边距
  <DialogHeader>...</DialogHeader>  // 自带 px-6 pt-6 pb-2
  <DialogBody gap="xl">内容</DialogBody>  // 自带 px-6 py-4 + 间距控制
  <DialogFooter>...</DialogFooter>  // 自带 px-6 py-4
</DialogContent>
```

---

## 迁移检查清单

- [x] 从 Radix UI 迁移到 Headless UI
- [x] DialogContent 移除 `p-4`
- [x] 新增 DialogBody 组件
- [x] DialogBody 支持 gap 参数
- [x] DialogBody 支持 noPadding 参数
- [x] DialogDescription 只用于描述文本
- [x] 移除所有 Stack/Mantine 容器嵌套
- [x] 完整组件使用 `footer` prop
- [x] 更新所有使用 Dialog 的地方
- [x] 删除 modal.jsx（已统一）
- [x] 卸载 @radix-ui/react-dialog
- [x] 测试所有弹窗功能

---

## 参考资料

- [Headless UI Dialog 官方文档](https://headlessui.com/react/dialog)
- [Headless UI Transition 文档](https://headlessui.com/react/transition)
- [Tailwind CSS 官方文档](https://tailwindcss.com)

---

## 相关文件

- `src/components/ui/dialog.jsx` - Dialog 组件实现（基于 Headless UI）
- `src/components/ui/button.jsx` - Button 组件
- `src/components/features/AccountManager/ConfirmModal.jsx` - 确认弹窗示例
- `src/components/features/AccountManager/AddAccountModal.jsx` - 表单弹窗示例
- `src/components/modals/AccountDetailModal.jsx` - 详情弹窗示例
