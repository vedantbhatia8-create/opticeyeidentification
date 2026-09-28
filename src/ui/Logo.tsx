import { cx } from './primitives'

/** Optic Access mark: an aperture with an iris. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx('size-6', className)} fill="none" aria-hidden>
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M5.5 16c2.8-4.6 6.3-6.9 10.5-6.9s7.7 2.3 10.5 6.9c-2.8 4.6-6.3 6.9-10.5 6.9S8.3 20.6 5.5 16Z"
        stroke="var(--logo-fg, white)"
        strokeWidth="1.6"
      />
      <circle cx="16" cy="16" r="3.6" stroke="var(--logo-fg, white)" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="1.2" fill="var(--logo-fg, white)" />
    </svg>
  )
}

export function Logo({ className, product }: { className?: string; product?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="text-ink [--logo-fg:var(--bg)]" />
      <span className="text-[15px] font-semibold tracking-tight text-ink">
        Optic<span className="text-muted"> Access</span>
      </span>
      {product && (
        <span className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
          {product}
        </span>
      )}
    </span>
  )
}
