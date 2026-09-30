import { cx } from './primitives'

/**
 * Ambient background shared by every page: a faint blueprint grid plus cyan
 * and violet glows. `hero` (home page only) uses blurred, drifting glows.
 * `page` is fixed behind app content and deliberately cheap: plain radial
 * gradients with no filter or animation, because blurred animated layers
 * behind live camera video break video compositing and cost frames.
 * The parent needs `isolate` so the backdrop sits behind its content.
 */
export function Backdrop({ variant = 'page', className }: { variant?: 'page' | 'hero'; className?: string }) {
  if (variant === 'page') {
    return (
      <div className={cx('pointer-events-none fixed inset-0 -z-10', className)} aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(38% 42% at 28% -6%, color-mix(in srgb, var(--accent) 13%, transparent), transparent 70%),' +
              'radial-gradient(34% 40% at 100% 18%, color-mix(in srgb, var(--accent-2) 10%, transparent), transparent 70%)',
          }}
        />
        <div className="grid-bg absolute inset-x-0 top-0 h-[900px] opacity-60" />
      </div>
    )
  }
  return (
    <div className={cx('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      <div className="grid-bg absolute inset-x-0 top-0 h-[1100px]" />
      <div
        className="absolute -top-[260px] left-[8%] size-[620px] rounded-full opacity-40 blur-[120px]"
        style={{ background: 'var(--accent)', animation: 'optic-drift 18s ease-in-out infinite' }}
      />
      <div
        className="absolute top-[120px] right-[2%] size-[520px] rounded-full opacity-30 blur-[130px]"
        style={{ background: 'var(--accent-2)', animation: 'optic-drift 22s ease-in-out infinite reverse' }}
      />
    </div>
  )
}
