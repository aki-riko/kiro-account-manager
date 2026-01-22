import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"
import { useApp } from "../../hooks/useApp"

const DialogRoot = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

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
          "max-h-[90vh] flex flex-col",
          // ⚠️ 移除 p-4，让子组件控制内边距
          colors.card,
          colors.cardBorder,
          "duration-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%]",
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
          <DialogPrimitive.Close 
            className={cn(
              "absolute right-4 top-4 p-2 rounded-xl",
              "transition-all duration-200",
              colors.cardHover,
              "hover:scale-110",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            )}
          >
            <X size={18} className={colors.textMuted} />
            <span className="sr-only">关闭</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = React.forwardRef(({ className, icon: Icon, iconColor, iconBg, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("px-5 pt-5 pb-2", className)}
      {...props}
    >
      {Icon && (
        <div className="flex items-center gap-3 mb-2">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shadow-md",
            iconBg || "bg-gradient-to-br from-blue-500/20 to-indigo-500/10"
          )}>
            <Icon size={20} className={iconColor || "text-blue-400"} strokeWidth={2} />
          </div>
        </div>
      )}
      {children}
    </div>
  )
})
DialogHeader.displayName = "DialogHeader"

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "text-base font-semibold leading-tight",
        colors.text,
        className
      )}
      {...props}
    />
  )
})
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-xs mt-1.5", colors.textMuted, className)}
      {...props}
    />
  )
})
DialogDescription.displayName = DialogPrimitive.Description.displayName

const DialogBody = React.forwardRef(({ 
  className, 
  gap = "sm",
  noPadding = false,
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
        noPadding ? "" : "px-5 py-3",
        "overflow-y-auto flex-1",
        colors.text,
        gapClasses[gap],
        className
      )}
      {...props}
    />
  )
})
DialogBody.displayName = "DialogBody"

const DialogFooter = React.forwardRef(({ className, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <div
      ref={ref}
      className={cn(
        "px-5 py-3 flex justify-end gap-2.5",
        colors.dialogFooter,
        className
      )}
      {...props}
    />
  )
})
DialogFooter.displayName = "DialogFooter"

/**
 * Dialog - 完整的对话框组件
 * 
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onOpenChange - 状态改变回调
 * @param {string} props.title - 标题
 * @param {string} props.description - 描述文本
 * @param {ReactNode} props.children - 内容区域
 * @param {ReactNode} props.footer - 底部按钮区域
 * @param {string} props.maxWidth - 最大宽度
 * @param {Component} props.icon - 图标组件
 * @param {string} props.iconColor - 图标颜色
 * @param {string} props.iconBg - 图标背景
 * @param {boolean} props.showClose - 是否显示关闭按钮
 */
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

export {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogBody,
}
