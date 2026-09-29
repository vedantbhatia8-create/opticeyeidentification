import { AnimatePresence, motion } from 'framer-motion'
import { Camera, EyeOff, Lock, LogOut, Menu, ScanEye, UserX } from 'lucide-react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Logo } from '../../ui/Logo'
import { Avatar, cx } from '../../ui/primitives'
import { DemoLauncher } from '../demo/DemoPanel'
import { ThemeToggle } from '../shell/ThemeToggle'
import { SUITE_NAV } from './apps'
import { usePresence, type PresenceState } from './presence'
import { useSession, useSuite } from './store'
import { lockAllVaults } from './VaultApp'

/** Applies the signed-in person's profile (accent + theme) while inside the apps. */
function useProfileTheme(identityId: string | null) {
  const prefs = useSuite((s) => (identityId ? s.prefs[identityId] : undefined))
  const member = useSuite((s) => s.family.find((m) => identityId && m.identityId === identityId))
  const accent = prefs?.accent ?? member?.accent
  const theme = prefs?.theme ?? member?.theme
  useLayoutEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    if (accent) {
      root.style.setProperty('--accent', accent)
      root.style.setProperty('--accent-text', accent)
      root.style.setProperty('--accent-soft', `color-mix(in srgb, ${accent} 12%, var(--surface))`)
    }
    if (theme) root.classList.toggle('dark', theme === 'dark')
    return () => {
      root.style.removeProperty('--accent')
      root.style.removeProperty('--accent-text')
      root.style.removeProperty('--accent-soft')
      root.classList.toggle('dark', hadDark)
    }
  }, [accent, theme])
}

export function SuiteLayout() {
  const session = useSession()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => setMobileOpen(false), [location.pathname])
  useProfileTheme(session.identityId)

  if (!session.identityId) return <Navigate to={`/apps/signin?next=${encodeURIComponent(location.pathname)}`} replace />

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 pb-2">
        <Link to="/" className="block px-1">
          <Logo product="Apps" />
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {SUITE_NAV.map((item) => (
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
            <item.icon className="size-4 text-subtle group-hover:text-muted" />
            {item.label}
          </NavLink>
        ))}
        <div className="px-2.5 pt-5 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-subtle uppercase">Optic Access</div>
        {[
          { to: '/office', label: 'Office console' },
          { to: '/hotel', label: 'Hotel console' },
          { to: '/lab', label: 'Sensor Lab' },
        ].map((l) => (
          <Link key={l.to} to={l.to} className="flex h-8 items-center rounded-lg px-2.5 text-[13px] text-muted hover:bg-surface-2/70 hover:text-ink">
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="space-y-2 border-t border-line p-3">
        <CameraPill />
        <div className="flex items-center gap-2.5 px-1">
          <Link to="/apps/account" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg hover:opacity-80" data-testid="account-link">
          <Avatar name={session.name ?? '?'} size={30} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-medium text-ink" data-testid="session-name">{session.name}</div>
            <div className="flex items-center gap-1 text-[11px] text-subtle">
              <ScanEye className="size-3" /> Glance sign-in
            </div>
          </div>
          </Link>
          <ThemeToggle />
          <button onClick={() => { lockAllVaults(); session.signOut() }} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Sign out" data-testid="sign-out">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] border-r border-line bg-surface lg:block">{sidebar}</aside>
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
      <div className="lg:pl-[240px]">
        <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur-md lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-muted" aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <Logo product="Apps" />
          <ThemeToggle />
        </div>
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mx-auto max-w-[1160px] px-4 py-7 sm:px-8"
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>
      <GuardLayer />
      <DemoLauncher />
    </div>
  )
}

function CameraPill() {
  const guard = useSuite((s) => s.guard.enabled)
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-2/70 px-2.5 py-1.5 text-[11.5px] text-muted">
      <span className="flex items-center gap-1.5">
        <Camera className="size-3.5" /> {guard ? 'Guard watching' : 'Camera on only when needed'}
      </span>
      <span className={cx('size-1.5 rounded-full', guard ? 'live-dot bg-ok text-ok' : 'bg-subtle')} />
    </div>
  )
}

// ── Guard: walk-away lock + shoulder-surf shield, active on every app page ──

type LockReason = 'away' | 'stranger' | null

export function useGuardState(p: PresenceState, sessionId: string | null, active: boolean, logEvents = true) {
  const guard = useSuite((s) => s.guard)
  const log = useSuite((s) => s.log)
  const [locked, setLocked] = useState<LockReason>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [active])

  const running = p.status.state === 'running'
  const away = active && running && guard.awayLock && p.faces === 'none' && now - p.lastFaceAt > guard.awaySeconds * 1000 && p.lastFaceAt > 0
  const stranger =
    active && running && guard.strangerLock && p.faces === 'one' && (p.who === 'unknown' || (p.who !== null && p.who.identityId !== sessionId))
  const owner = p.who !== null && p.who !== 'unknown' && p.who.identityId === sessionId

  useEffect(() => {
    if (!active) {
      setLocked(null)
      return
    }
    if (!locked && (away || stranger)) {
      const reason: LockReason = stranger ? 'stranger' : 'away'
      setLocked(reason)
      if (logEvents) lockAllVaults()
      if (logEvents) log({
        app: 'guard',
        action: 'lock',
        detail: reason === 'away' ? 'Locked — owner walked away' : `Locked — ${p.who === 'unknown' ? 'unknown person' : (p.who as { name: string }).name} at the screen`,
        identityId: reason === 'away' ? sessionId : p.who && p.who !== 'unknown' ? p.who.identityId : null,
        name: reason === 'away' ? (useSession.getState().name ?? 'Owner') : p.who && p.who !== 'unknown' ? p.who.name : 'Unknown person',
        ok: false,
      })
    } else if (locked && owner && p.faces === 'one') {
      setLocked(null)
      if (logEvents) log({ app: 'guard', action: 'unlock', detail: 'Unlocked — owner is back', identityId: sessionId, name: (p.who as { name: string }).name, ok: true })
    }
  }, [active, away, stranger, owner, locked, p.faces, p.who, sessionId, log, logEvents])

  const shield = active && running && guard.shoulderShield && p.faces === 'multiple'
  return { locked, shield }
}

function GuardLayer() {
  const enabled = useSuite((s) => s.guard.enabled)
  const session = useSession()
  const location = useLocation()
  // The Guard settings page shows its own live view; everything else is protected.
  const active = enabled && !location.pathname.startsWith('/apps/guard')
  const p = usePresence({ identify: true, enabled })
  const { locked, shield } = useGuardState(p, session.identityId, active)

  return (
    <AnimatePresence>
      {locked && (
        <motion.div
          key="lock"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#050607]/95 p-6"
          data-testid="guard-lock"
          data-reason={locked}
        >
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-term/90 p-8 text-center text-white">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-white/15 bg-white/5">
              {locked === 'away' ? <Lock className="size-6" /> : <UserX className="size-6 text-denied" />}
            </div>
            <div className="mt-5 font-mono text-[11px] tracking-[0.26em] text-white/50 uppercase">Optic Guard</div>
            <div className="mt-2 text-[22px] font-semibold tracking-tight">{locked === 'away' ? 'Locked while you were away' : 'Someone else is at the screen'}</div>
            <p className="mt-2 text-[14px] text-white/60">Look at the screen to unlock, {session.name?.split(' ')[0]}.</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] text-white/50">
              <span className={cx('size-1.5 rounded-full', p.faces === 'none' ? 'bg-white/30' : 'bg-scan-accent')} />
              {p.faces === 'none' ? 'No one detected' : p.who === 'unknown' ? 'Unrecognized person' : p.who ? p.who.name : 'Checking…'}
            </div>
            <button onClick={() => { lockAllVaults(); session.signOut() }} className="mt-6 block w-full text-[13px] text-white/45 hover:text-white/80">
              Sign out instead
            </button>
          </div>
        </motion.div>
      )}
      {!locked && shield && (
        <motion.div
          key="shield"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/95 p-6"
          data-testid="guard-shield"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4 shadow-[var(--shadow-float)]">
            <EyeOff className="size-5 text-warn" />
            <div>
              <div className="text-[14px] font-semibold text-ink">Privacy shield on</div>
              <div className="text-[12.5px] text-muted">Another person is looking at your screen.</div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
