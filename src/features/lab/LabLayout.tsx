import { Outlet, NavLink, Link } from 'react-router-dom'
import { Logo } from '../../ui/Logo'
import { cx } from '../../ui/primitives'
import { ThemeToggle } from '../shell/ThemeToggle'

const tabs = [
  { to: '/lab', label: 'Overview', end: true },
  { to: '/lab/scans', label: 'Optic scans' },
  { to: '/lab/architecture', label: 'Architecture' },
]

export function LabLayout() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-6">
            <Link to="/">
              <Logo product="Sensor Lab" />
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {tabs.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    cx(
                      'rounded-md px-2.5 py-1.5 text-[13px] font-medium transition',
                      isActive ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink',
                    )
                  }
                >
                  {t.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/office" className="hidden text-[13px] text-muted hover:text-ink md:inline">
              Office
            </Link>
            <Link to="/hotel" className="hidden px-2 text-[13px] text-muted hover:text-ink md:inline">
              Hotel
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
