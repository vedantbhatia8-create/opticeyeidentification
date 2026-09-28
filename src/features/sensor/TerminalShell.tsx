import { X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { clock } from '../../core/access/clock'
import { LogoMark } from '../../ui/Logo'

export function TerminalClock() {
  const [now, setNow] = useState(clock.now())
  useEffect(() => {
    const t = setInterval(() => setNow(clock.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="tabular font-mono text-[12px] tracking-[0.18em] text-white/50">
      {new Date(now).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
    </span>
  )
}

/** Full-screen physical-terminal chrome. Always dark, regardless of app theme. */
export function TerminalShell({
  location,
  exitTo,
  children,
  topRight,
}: {
  location?: string
  exitTo: string
  children: ReactNode
  topRight?: ReactNode
}) {
  return (
    <div className="min-h-screen bg-term text-white" style={{ colorScheme: 'dark' }}>
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(124,192,255,0.06), transparent 70%)' }}
      />
      <header className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center px-5 py-4 sm:px-8 sm:py-6">
        <div className="flex items-center gap-3">
          <LogoMark className="size-6 text-white [--logo-fg:#050607]" />
          <span className="font-mono text-[12px] font-medium tracking-[0.34em] text-white/85">OPTIC ACCESS</span>
        </div>
        <div className="font-mono text-[12px] tracking-[0.3em] text-white/60 uppercase" data-testid="terminal-location">
          {location}
        </div>
        <div className="flex items-center justify-end gap-4">
          {topRight}
          <TerminalClock />
          <Link
            to={exitTo}
            className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-white/55 transition hover:border-white/25 hover:text-white"
          >
            <X className="size-3.5" /> Exit
          </Link>
        </div>
      </header>
      <main className="relative z-10 flex flex-col items-center px-4 pt-2 pb-12 sm:px-8">{children}</main>
    </div>
  )
}
