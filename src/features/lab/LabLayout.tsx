import { Outlet, NavLink, Link } from 'react-router-dom'
import { Backdrop } from '../../ui/Backdrop'
import { Logo } from '../../ui/Logo'
import { cx } from '../../ui/primitives'
import { ThemeToggle } from '../shell/ThemeToggle'

const tabs = [
  { to: '/lab', label: 'Overview', end: true },
  { to: '/lab/scans', label: 'Optic scans' },
  { to: '/lab/lookalike', label: 'Look-alikes' },
  { to: '/lab/architecture', label: 'Architecture' },
]

export function LabLayout() {
  return (
    <div className="relative isolate min-h-screen bg-bg">
      <Backdrop />
      <header className="sticky top-3 z-30 px-3">
        <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-2xl pr-2 pl-4">
          <div className="flex min-w-0 items-center gap-5">
            <Link to="/" className="shrink-0">
              <Logo product="Lab" />
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {tabs.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    cx(
                      'rounded-xl px-3 py-1.5 text-[13px] font-medium transition',
                      isActive ? 'bg-accent-soft text-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_25%,transparent)]' : 'text-muted hover:text-ink',
                    )
                  }
                >
                  {t.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link to="/apps" className="btn-glow flex h-9 items-center rounded-xl px-4 text-[13px] font-semibold">
              Open apps
            </Link>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
