import { AnimatePresence, motion } from 'framer-motion'
import { ChevronsUpDown, Menu, MonitorSmartphone, X, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Logo } from '../../ui/Logo'
import { buttonClass, cx } from '../../ui/primitives'
import { useStore } from '../../state/store'
import { DemoLauncher } from '../demo/DemoPanel'
import { ThemeToggle } from './ThemeToggle'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export function ConsoleLayout({
  product,
  nav,
  siteName,
  terminalTo,
}: {
  product: 'office' | 'hotel'
  nav: NavItem[]
  siteName: string
  terminalTo: string
}) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => setMobileOpen(false), [location.pathname])

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 pb-3">
        <Link to="/" className="block px-1">
          <Logo />
        </Link>
        <SiteSwitcher product={product} siteName={siteName} />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cx(
                'group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition',
                isActive ? 'bg-surface-2 text-ink shadow-[inset_0_0_0_1px_var(--border)]' : 'text-muted hover:bg-surface-2/70 hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cx('size-4', isActive ? 'text-ink' : 'text-subtle group-hover:text-muted')} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-3 border-t border-line p-3">
        <Link to={terminalTo} className={buttonClass('primary', 'md', 'w-full')} data-testid="open-terminal">
          <MonitorSmartphone className="size-4" /> Open access terminal
        </Link>
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold text-muted">
              AD
            </span>
            <div className="leading-tight">
              <div className="text-[12.5px] font-medium text-ink">Admin</div>
              <div className="text-[11px] text-subtle">Security operator</div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line bg-surface lg:block">{sidebar}</aside>
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside
              className="absolute inset-y-0 left-0 w-[260px] border-r border-line bg-surface"
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            >
              {sidebar}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
      <div className="lg:pl-[248px]">
        <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur-md lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-muted" aria-label="Open navigation">
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <Logo />
          <ThemeToggle />
        </div>
        <DemoBanner />
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="mx-auto max-w-[1240px] px-4 py-7 sm:px-8"
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>
      <DemoLauncher />
    </div>
  )
}

function SiteSwitcher({ product, siteName }: { product: 'office' | 'hotel'; siteName: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative mt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface-2/60 px-2.5 py-2 text-left transition hover:border-line-strong"
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-ink text-[11px] font-bold text-bg">
          {product === 'office' ? 'M' : 'L'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-ink">{siteName.split(' · ')[0]}</span>
          <span className="block truncate text-[11px] text-muted">{product === 'office' ? 'Office access' : 'Hotel access'}</span>
        </span>
        <ChevronsUpDown className="size-3.5 text-subtle" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-float)]"
          >
            {[
              { to: '/office', label: 'Meridian HQ', sub: 'Office access', key: 'office' },
              { to: '/hotel', label: 'The Linden', sub: 'Hotel access', key: 'hotel' },
              { to: '/lab', label: 'Optic Sensor Lab', sub: 'Enroll & authenticate', key: 'lab' },
              { to: '/apps', label: 'Optic Apps', sub: 'Vault, Eyes-Only, Guard, Family…', key: 'apps' },
            ].map((s) => (
              <Link
                key={s.key}
                to={s.to}
                onClick={() => setOpen(false)}
                className={cx('block rounded-lg px-2.5 py-2 hover:bg-surface-2', s.key === product && 'bg-surface-2')}
              >
                <div className="text-[13px] font-medium text-ink">{s.label}</div>
                <div className="text-[11px] text-muted">{s.sub}</div>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DemoBanner() {
  const demo = useStore((s) => s.demo)
  if (!demo.enabled) return null
  return (
    <div className="border-b border-warn/20 bg-warn-soft px-4 py-1.5 text-center text-[12px] font-medium text-warn sm:px-8">
      DEMO MODE is on — terminals may use demo personas or a simulated sensor.
      {demo.clockOffsetMs !== 0 && ' The access clock is simulated.'}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[24px] font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[14px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
