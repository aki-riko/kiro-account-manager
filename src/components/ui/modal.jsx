import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"
import { useApp } from "../../hooks/useApp"

// Modal 使用相同的 Radix UI Dialog 原语，但针对表单场景优化
const ModalRoot = DialogPrimitive.Root
const ModalTrigger = DialogPrimitive.Trigger
const ModalPortal = DialogPrimitive.Portal
const ModalClose = DialogPrimitive.Close

const ModalOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/70 backdrop-blur-md",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
ModalOverlay.displayName = "ModalOverlay"

const ModalContent = React.forwardRef(({ 
  className, 
  children, 
  maxWidth = "600px",
  showClose = true,
  ...props 
}, ref) => {
  const { colors } = useApp()
  
  return (
    <ModalPortal>
      <ModalOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50",
          "translate-x-[-50%] translate-y-[-50%]",
          "w-full shadow-2xl rounded-2xl border",
          "max-h-[90vh] flex flex-col",
          colors.card,
          colors.cardBorder,
          "duration-300",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4",
          className
        )}
        style={{ maxWidth }}
        {...props}
      >
        <DialogPrimitive.Description className="sr-only">
          模态框内容
        </DialogPrimitive.Description>
        {children}
        {showClose && (
          <DialogPrimitive.Close 
            className={cn(
              "absolute right-4 top-4 p-2 rounded-lg z-10",
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
    </ModalPortal>
  )
})
ModalContent.displayName = "ModalContent"

const ModalHeader = React.forwardRef(({ className, children, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <div
      ref={ref}
      className={cn(
        "relative border-b",
        colors.cardBorder,
        "px-6 py-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
ModalHeader.displayName = "ModalHeader"

const ModalTitle = React.forwardRef(({ className, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "text-lg font-semibold leading-tight",
        colors.text,
        className
      )}
      {...props}
    />
  )
})
ModalTitle.displayName = "ModalTitle"

const ModalDescription = React.forwardRef(({ className, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm mt-1", colors.textMuted, className)}
      {...props}
    />
  )
})
ModalDescription.displayName = "ModalDescription"

const ModalBody = React.forwardRef(({ 
  className, 
  noPadding = false,
  ...props 
}, ref) => {
  const { colors } = useApp()
  
  return (
    <div
      ref={ref}
      className={cn(
        noPadding ? "" : "px-6 py-4",
        "overflow-y-auto flex-1",
        colors.text,
        className
      )}
      style={{ scrollbarWidth: 'thin' }}
      {...props}
    />
  )
})
ModalBody.displayName = "ModalBody"

const ModalFooter = React.forwardRef(({ className, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <div
      ref={ref}
      className={cn(
        "relative flex justify-between items-center border-t",
        colors.cardBorder,
        "px-6 py-4",
        className
      )}
      {...props}
    />
  )
})
ModalFooter.displayName = "ModalFooter"

/**
 * Modal - 完整的模态框组件（表单类）
 * 
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onOpenChange - 状态改变回调
 * @param {ReactNode} props.header - 自定义头部内容
 * @param {ReactNode} props.children - 内容区域
 * @param {ReactNode} props.footer - 底部区域
 * @param {string} props.maxWidth - 最大宽度
 * @param {boolean} props.showClose - 是否显示关闭按钮
 */
export function Modal({
  open,
  onOpenChange,
  header,
  children,
  footer,
  maxWidth = '600px',
  showClose = true,
}) {
  return (
    <ModalRoot open={open} onOpenChange={onOpenChange}>
      <ModalContent maxWidth={maxWidth} showClose={showClose}>
        {header && <ModalHeader>{header}</ModalHeader>}
        {children && <ModalBody>{children}</ModalBody>}
        {footer && <ModalFooter>{footer}</ModalFooter>}
      </ModalContent>
    </ModalRoot>
  )
}

export {
  ModalRoot,
  ModalPortal,
  ModalOverlay,
  ModalClose,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
  ModalBody,
}
