---
inclusion: always
---

# Dialog 和 Modal 组件封装规范

基于 Radix UI 和 shadcn/ui 官方文档的最佳实践。

## 核心原则

### 1. Radix UI 复合组件模式

Radix UI 使用复合组件模式，通过 Root 组件提供 Context，所有子组件共享状态。

**官方推荐结构**：
```jsx
<Dialog.Root>
  <Dialog.Trigger />
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>
      <Dialog.Title />
      <Dialog.Description />
      <Dialog.Close />
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

### 2. 两种封装层次

**基础组件（Primitives）**：
- 直接导出 Radix UI 的原始组件
- 添加样式和主题支持
- 保持最大灵活性
- 用于高级定制场景

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
  DialogRoot,        // Radix UI Root
  DialogTrigger,     // 触发器
  DialogPortal,      // Portal 容器
  DialogOverlay,     // 遮罩层
  DialogClose,       // 关闭按钮
  DialogContent,     // 内容容器（不带内边距）
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
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50",
          "translate-x-[-50%] translate-y-[-50%]",
          "w-full shadow-2xl rounded-2xl border",
          // ⚠️ 注意：不添加 padding
          colors.card,
          colors.cardBorder,
          "duration-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          className
        )}
        style={{ maxWidth }}
        {...props}
      >
        <DialogPrimitive.Description className="sr-only">
          弹窗内容
        </DialogPrimitive.Description>
        {children}
        {showClose && (
          <DialogPrimitive.Close className="absolute right-4 top-4 ...">
            <X size={18} />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
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
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm mt-2", colors.textMuted, className)}
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

## Dialog vs Modal 语义化区分

虽然 Radix UI 底层使用同一个组件，但我们**语义化区分**两种用途：

### Dialog（通知类）

**文件**：`src/components/ui/dialog.jsx`

**特点**：
- **默认宽度**：400px（小）
- **背景模糊**：`backdrop-blur-sm`（轻度）
- **Header**：简单图标 + 标题 + 描述
- **Body**：支持 gap 参数控制间距
- **Footer**：右对齐按钮
- **动画**：`slide-in-from-top`
- **内边距**：`px-5 py-3`（紧凑）

**用途**：
- 确认对话框
- 警告提示
- 错误通知
- 简单信息展示

**示例**：
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

### Modal（表单类）

**文件**：`src/components/ui/modal.jsx`

**特点**：
- **默认宽度**：600px（大）
- **背景模糊**：`backdrop-blur-md`（强烈）
- **Header**：支持完全自定义（头像、徽章、状态等）
- **Body**：支持 noPadding，完全自定义布局
- **Footer**：左右布局（状态显示 + 按钮）
- **动画**：`slide-in-from-bottom`
- **内边距**：`px-6 py-4`（宽松）

**用途**：
- 编辑表单
- 详情展示
- 复杂内容
- 多区域布局

**示例**：
```jsx
<ModalRoot open={open} onOpenChange={setOpen}>
  <ModalContent maxWidth="800px">
    {/* 自定义复杂头部 */}
    <div className="border-b px-6 py-4">
      <div className="flex items-center gap-3">
        <Avatar />
        <div>
          <h2>账号详情</h2>
          <Badge>PRO</Badge>
        </div>
      </div>
    </div>
    
    {/* 使用 noPadding 自己控制布局 */}
    <ModalBody noPadding>
      <div className="px-6 py-4">配额卡片</div>
      <div className="px-6 py-4">表单字段</div>
      <TokenJsonView />
    </ModalBody>
    
    {/* 左右布局的 Footer */}
    <ModalFooter>
      <div className="flex items-center gap-2">
        <Shield />
        <span>账号正常</span>
      </div>
      <Button>关闭</Button>
    </ModalFooter>
  </ModalContent>
</ModalRoot>
```

### 组件对比表

| 特性 | Dialog（通知类） | Modal（表单类） |
|------|-----------------|----------------|
| 默认宽度 | 400px | 600px |
| 背景模糊 | backdrop-blur-sm | backdrop-blur-md |
| Header | 简单（图标+标题） | 复杂（自定义） |
| Body padding | px-5 py-3 | px-6 py-4 |
| Body gap | 支持 gap 参数 | 无 gap，完全自定义 |
| Footer | 右对齐按钮 | 左右布局 |
| 动画 | slide-in-from-top | slide-in-from-bottom |
| 用途 | 确认、警告、提示 | 表单、详情、复杂内容 |

### 使用指南

**何时用 Dialog**：
- ✅ 确认删除操作
- ✅ 显示错误信息
- ✅ 简单的是/否选择
- ✅ 快速提示信息

**何时用 Modal**：
- ✅ 编辑账号表单
- ✅ 查看账号详情
- ✅ 复杂的多步骤表单
- ✅ 需要自定义头部/底部布局

### 实际应用

**项目中的使用**：
- `ConfirmDialog.jsx` → 使用 **Dialog**
- `EditAccountModal.jsx` → 使用 **Modal**
- `AccountDetailModal.jsx` → 使用 **Modal**
- `AddAccountModal.jsx` → 使用 **Modal**

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

- [x] DialogContent 移除 `p-4`
- [x] 新增 DialogBody 组件
- [x] DialogBody 支持 gap 参数
- [x] DialogBody 支持 noPadding 参数
- [x] DialogDescription 只用于描述文本
- [x] 移除所有 Stack/Mantine 容器嵌套
- [x] 完整组件使用 `footer` prop
- [x] 更新所有使用 Dialog 的地方
- [ ] 删除 modal.jsx（如果决定统一）
- [x] 测试所有弹窗功能

---

## 参考资料

- [Radix UI Dialog 官方文档](https://www.radix-ui.com/primitives/docs/components/dialog)
- [shadcn/ui Dialog 实现](https://ui.shadcn.com/docs/components/dialog)
- [完整最佳实践文档](../docs/dialog-modal-best-practices.md)

---

## 相关文件

- `src/components/ui/dialog.jsx` - Dialog 组件实现
- `src/components/ui/modal.jsx` - Modal 组件实现（待统一）
- `src/components/ui/button.jsx` - Button 组件
- `docs/dialog-modal-best-practices.md` - 详细最佳实践文档
