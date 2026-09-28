import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { cx } from './primitives'

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 480,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  useEscape(open, onClose)
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            className="relative w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-float)]"
            style={{ maxWidth: width }}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-5">
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
                {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
              </div>
              <button onClick={onClose} className="-mr-2 rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-ink">
                <X className="size-4" />
              </button>
            </div>
            <div className="px-6 py-5">{children}</div>
            {footer && (
              <div className="flex justify-end gap-2 border-t border-line bg-surface-2/60 px-6 py-3.5">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function Drawer({
  open,
  onClose,
  children,
  width = 520,
  className,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  width?: number
  className?: string
}) {
  useEscape(open, onClose)
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40">
          <motion.div
            className="absolute inset-0 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className={cx(
              'absolute top-0 right-0 flex h-full w-full flex-col border-l border-line bg-surface shadow-[var(--shadow-float)]',
              className,
            )}
            style={{ maxWidth: width }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
          >
            {children}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
