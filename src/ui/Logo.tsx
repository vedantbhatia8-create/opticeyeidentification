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
      <LogoMark className="text-accent drop-shadow-[0_0_10px_color-mix(in_srgb,var(--accent)_45%,transparent)] [--logo-fg:var(--bg)]" />
      <span className="text-[15px] font-semibold tracking-tight text-ink">Optic</span>
      {product && (
        <span className="rounded-full border border-accent/25 bg-accent-soft px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.14em] text-accent-text uppercase">
          {product}
        </span>
      )}
    </span>
  )
}
