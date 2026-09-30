import clsx from 'clsx'
import { Loader2 } from 'lucide-react'
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'

export { clsx as cx }

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
type ButtonSize = 'sm' | 'md' | 'lg'

const buttonBase =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap rounded-lg transition-[background,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-bg hover:bg-ink/85 shadow-[var(--shadow-card)]',
  accent: 'bg-accent text-accent-contrast hover:bg-accent/90 shadow-[var(--shadow-card),var(--glow)]',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong shadow-[var(--shadow-card)]',
  ghost: 'text-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-surface text-bad border border-line hover:bg-bad-soft hover:border-bad/30',
}
const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-11 px-5 text-[15px]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
})

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string) {
  return clsx(buttonBase, buttonVariants[variant], buttonSizes[size], className)
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]', className)}
      {...rest}
    />
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex items-start justify-between gap-4 px-5 pt-4 pb-3', className)}>
      <div className="min-w-0">
        <h3 className="text-[14px] font-semibold tracking-tight text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export type Tone = 'neutral' | 'ok' | 'bad' | 'warn' | 'accent'
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-line',
  ok: 'bg-ok-soft text-ok border-ok/15',
  bad: 'bg-bad-soft text-bad border-bad/15',
  warn: 'bg-warn-soft text-warn border-warn/20',
  accent: 'bg-accent-soft text-accent-text border-accent/15',
}

export function Badge({
  tone = 'neutral',
  dot,
  children,
  className,
}: {
  tone?: Tone
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex h-[22px] items-center gap-1.5 rounded-md border px-1.5 text-[12px] font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={clsx(
        'h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-subtle shadow-[var(--shadow-card)] transition outline-none focus:border-accent/60 focus:ring-3 focus:ring-accent/15',
        className,
      )}
      {...rest}
    />
  )
})

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        'h-9 w-full appearance-none rounded-lg border border-line bg-surface bg-[length:16px] bg-[right_10px_center] bg-no-repeat px-3 pr-8 text-sm text-ink shadow-[var(--shadow-card)] outline-none focus:border-accent/60 focus:ring-3 focus:ring-accent/15',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239a9da3' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-[12px] text-bad">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-[12px] text-muted">{hint}</span>
      )}
    </label>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-surface-3 border border-line',
      )}
    >
      <span
        className={clsx(
          'inline-block size-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

const AVATAR_TONES = [
  'bg-[#e8eefc] text-[#2f4fb8]',
  'bg-[#e6f4ee] text-[#17714a]',
  'bg-[#fbeee4] text-[#a2531b]',
  'bg-[#f2eafb] text-[#6b3fb0]',
  'bg-[#e6f2f6] text-[#1d6a84]',
  'bg-[#fbe9ee] text-[#a8304f]',
]

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold dark:brightness-90 dark:saturate-150',
        AVATAR_TONES[h % AVATAR_TONES.length],
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name) || '?'}
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  description: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function StatusDot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
  const color = { neutral: 'text-subtle', ok: 'text-ok', bad: 'text-bad', warn: 'text-warn', accent: 'text-accent' }[tone]
  return (
    <span className={clsx('inline-block size-2 rounded-full bg-current', color, pulse && 'live-dot')} aria-hidden />
  )
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('text-[11px] font-semibold tracking-[0.08em] text-subtle uppercase', className)}>
      {children}
    </div>
  )
}
