import { AnimatePresence, motion } from 'framer-motion'
import { Camera, Clock, FlaskConical, Sparkles, UserRound, Users, UserX, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { clock } from '../../core/access/clock'
import { DEMO_PERSONAS, personaIdentity } from '../../domains/personas'
import { setDemoPeople } from '../../state/services'
import { useStore } from '../../state/store'
import { startOfDay } from '../../ui/format'
import { Avatar, cx, Select, Toggle } from '../../ui/primitives'
import { useIdentities } from '../sensor/hooks'

const CLOCK_PRESETS = [
  { label: 'Live', hour: null },
  { label: '9:00 AM', hour: 9 },
  { label: '3:00 PM', hour: 15 },
  { label: '5:00 PM', hour: 17 },
  { label: '11:00 PM', hour: 23 },
]

export function useDemoClock() {
  const demo = useStore((s) => s.demo)
  const setDemo = useStore((s) => s.setDemo)
  const setHour = (hour: number | null) =>
    setDemo({ clockOffsetMs: hour === null ? 0 : startOfDay(Date.now()) + hour * 3_600_000 - Date.now() })
  const activeHour = demo.clockOffsetMs === 0 ? null : new Date(clock.now()).getHours()
  return { setHour, activeHour, offset: demo.clockOffsetMs }
}

/** Shows or hides the demo cast (Sarah Chen, the Chen family, hotel guests…) everywhere. */
export function DemoPeopleToggle({ className }: { className?: string }) {
  const on = useStore((s) => s.settings.demoPeople)
  const [busy, setBusy] = useState(false)
  const toggle = async (next: boolean) => {
    setBusy(true)
    try {
      await setDemoPeople(next)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={cx('flex items-center justify-between gap-3', className)} data-testid="demo-people">
      <div>
        <div className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
          <Users className="size-4 text-muted" /> Demo people
        </div>
        <div className="text-[12px] leading-snug text-muted">
          {on
            ? `Showing ${DEMO_PERSONAS.length} made-up people (the Chen family and others) next to real accounts.`
            : 'Off: only people who actually signed up. Turn on to add Sarah Chen, Maya Chen and the rest of the demo cast.'}
        </div>
      </div>
      <Toggle checked={on} onChange={(v) => !busy && void toggle(v)} label="Demo people" />
    </div>
  )
}

export function DemoControls({ compact }: { compact?: boolean }) {
  const demo = useStore((s) => s.demo)
  const setDemo = useStore((s) => s.setDemo)
  const sensorKind = useStore((s) => s.settings.sensorKind)
  const setSettings = useStore((s) => s.setSettings)
  const { identities } = useIdentities()
  const synthetic = identities.filter((i) => i.synthetic && i.demoSeed)
  const { setHour, activeHour, offset } = useDemoClock()

  const demoPeople = useStore((s) => s.settings.demoPeople)
  const featured = [
    { id: null, label: 'My real eyes', sub: 'Live webcam biometrics', icon: <Camera className="size-4" /> },
    ...(demoPeople
      ? [
          { id: personaIdentity('maya'), label: 'Maya Chen', sub: 'Family · kid, 9' },
          { id: personaIdentity('sarah'), label: 'Sarah Chen', sub: 'Family · parent' },
        ]
      : []),
    { id: 'unknown', label: 'Unknown Person', sub: 'Never enrolled', icon: <UserX className="size-4" /> },
  ]
  const others = synthetic.filter((i) => !featured.some((f) => f.id === i.id))

  return (
    <div className="space-y-5">
      <DemoPeopleToggle className="border-b border-line pb-4" />
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[14px] font-semibold text-ink">Demo Mode</div>
          <div className="text-[12px] text-muted">Present several people without needing them in the room.</div>
        </div>
        <Toggle checked={demo.enabled} onChange={(enabled) => setDemo({ enabled })} label="Demo mode" />
      </div>

      <div className={cx('space-y-5 transition-opacity', !demo.enabled && 'pointer-events-none opacity-40')}>
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted">
            <UserRound className="size-3.5" /> Who is at the sensor
          </div>
          <div className={cx('grid gap-1.5', compact ? 'grid-cols-1' : 'grid-cols-2')}>
            {featured.map((f) => {
              const active = demo.subject === f.id
              return (
                <button
                  key={f.label}
                  onClick={() => setDemo({ subject: f.id })}
                  data-testid={`demo-subject-${f.label.split(' ')[0].toLowerCase()}`}
                  className={cx(
                    'flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition',
                    active ? 'border-accent/50 bg-accent-soft' : 'border-line hover:border-line-strong hover:bg-surface-2',
                  )}
                >
                  {f.icon ? (
                    <span className="flex size-7 items-center justify-center rounded-full bg-surface-3 text-muted">{f.icon}</span>
                  ) : (
                    <Avatar name={f.label} size={28} />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-ink">{f.label}</span>
                    <span className="block truncate text-[11px] text-muted">{f.sub}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {others.length > 0 && (
            <Select
              className="mt-2 h-8 text-[13px]"
              value={others.some((o) => o.id === demo.subject) ? demo.subject! : ''}
              onChange={(e) => e.target.value && setDemo({ subject: e.target.value })}
            >
              <option value="">More demo people…</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          )}
          <p className="mt-2 text-[11.5px] leading-relaxed text-subtle">
            With a demo person selected, the webcam still tracks your face live, but the biometric features come from
            that person’s synthetic template (Unknown Person: a never-enrolled stranger) and the real engine decides.
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted">
            <UserRound className="size-3.5" /> Test as account
          </div>
          <Select
            className="h-8 text-[13px]"
            value={demo.overrideIdentityId ?? ''}
            onChange={(e) => setDemo({ overrideIdentityId: e.target.value || null })}
            data-testid="demo-override"
          >
            <option value="">Me — real scan match</option>
            {identities
              .filter((i) => !i.synthetic && i.status === 'active')
              .map((i) => (
                <option key={i.id} value={i.id}>
                  Act as {i.name}
                  {i.email ? ` · ${i.email}` : ''}
                </option>
              ))}
          </Select>
          {demo.overrideIdentityId && (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-warn">
              Testing override on: a real scan will sign you in as this account. Turn off for real use.
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted">
            <Camera className="size-3.5" /> Sensor source
          </div>
          <div className="inline-flex w-full rounded-lg border border-line bg-surface-2 p-0.5">
            {(
              [
                ['webcam', 'Webcam'],
                ['simulated', 'Simulated (no camera)'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSettings({ sensorKind: k })}
                className={cx(
                  'flex-1 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition',
                  sensorKind === k ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-muted hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted">
            <Clock className="size-3.5" /> Access clock
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CLOCK_PRESETS.map((p) => {
              const active = p.hour === null ? offset === 0 : activeHour === p.hour && offset !== 0
              return (
                <button
                  key={p.label}
                  onClick={() => setHour(p.hour)}
                  className={cx(
                    'rounded-lg border px-2.5 py-1 text-[12px] font-medium transition',
                    active ? 'border-accent/50 bg-accent-soft text-accent-text' : 'border-line text-muted hover:text-ink',
                  )}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[11.5px] text-subtle">Shift time to test schedules: screen-time hours, check-in windows.</p>
        </div>
      </div>
    </div>
  )
}

export function DemoLauncher() {
  const [open, setOpen] = useState(false)
  const demo = useStore((s) => s.demo)
  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        data-testid="demo-launcher"
        className={cx(
          'fixed right-5 bottom-5 z-30 flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-medium shadow-[var(--shadow-float)] transition',
          demo.enabled ? 'border-warn/30 bg-warn-soft text-warn' : 'border-line bg-surface text-ink hover:border-line-strong',
        )}
      >
        <FlaskConical className="size-4" /> {demo.enabled ? 'Demo mode on' : 'Demo mode'}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="fixed right-5 bottom-18 z-30 w-[min(380px,calc(100vw-2.5rem))] rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-float)]"
          >
            <button onClick={() => setOpen(false)} className="absolute top-3 right-3 rounded-md p-1 text-subtle hover:bg-surface-2 hover:text-ink">
              <X className="size-4" />
            </button>
            <DemoControls compact />
            <Link
              to="/demo"
              onClick={() => setOpen(false)}
              className="mt-5 flex items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-[13px] font-medium text-ink hover:bg-surface-2"
            >
              <Sparkles className="size-3.5" /> Guided demo script
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
