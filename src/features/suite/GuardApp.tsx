import { Eye, Lock, Monitor, ShieldHalf, Timer, UserX, Users } from 'lucide-react'
import { useMemo } from 'react'
import { timeAgo } from '../../ui/format'
import { Badge, Card, CardHeader, cx, EmptyState, StatusDot, Toggle } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'
import { SensorViewport } from '../sensor/SensorViewport'
import { usePresence } from './presence'
import { useGuardState } from './SuiteLayout'
import { useSession, useSuite } from './store'

export function GuardApp() {
  const guard = useSuite((s) => s.guard)
  const setGuard = useSuite((s) => s.setGuard)
  const events = useSuite((s) => s.events)
  const session = useSession()
  const p = usePresence({ identify: true })
  const preview = useGuardState(p, session.identityId, true, false)
  const guardEvents = useMemo(() => events.filter((e) => e.app === 'guard').slice(0, 10), [events])

  const whoText = p.faces === 'none' ? 'No one' : p.faces === 'multiple' ? 'More than one person' : p.who === 'unknown' ? 'Unrecognized person' : p.who ? p.who.name : 'Identifying…'
  const verdict = preview.locked === 'away' ? 'Would lock · you’re away' : preview.locked === 'stranger' ? 'Would lock · not you' : preview.shield ? 'Would blur · shoulder-surfer' : 'Unlocked · all clear'

  return (
    <>
      <PageHeader
        title="Optic Guard"
        description="Your screen locks when you walk away and blurs when someone reads over your shoulder. Active on every Optic app page."
        actions={
          <label className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2 shadow-[var(--shadow-card)]">
            <span className="text-[13.5px] font-medium text-ink">{guard.enabled ? 'Guard is on' : 'Guard is off'}</span>
            <Toggle checked={guard.enabled} onChange={(enabled) => setGuard({ enabled })} label="Guard enabled" />
          </label>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader title="Live monitor" description="What Guard sees right now. Overlays are paused on this page so you can test." />
          <div className="border-t border-line p-4">
            <SensorViewport
              sensor={p.sensor}
              observation={p.observation}
              running={p.status.state === 'running'}
              tone={preview.locked ? 'denied' : preview.shield ? 'denied' : p.faces === 'one' ? 'tracking' : 'idle'}
              progress={0}
              scanning={false}
              className="aspect-[16/10] w-full rounded-2xl"
            />
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat icon={<Users className="size-4" />} label="At the screen" value={whoText} testId="guard-who" />
              <Stat icon={<Eye className="size-4" />} label="Looking" value={p.faces === 'none' ? '—' : p.looking ? 'Yes' : 'Looking away'} />
              <Stat icon={<Timer className="size-4" />} label="Last seen" value={p.lastFaceAt ? timeAgo(p.lastFaceAt) : '—'} />
            </div>
            <div
              className={cx(
                'mt-3 flex items-center gap-2 rounded-xl px-4 py-3 text-[13.5px] font-medium',
                preview.locked || preview.shield ? 'bg-bad-soft text-bad' : 'bg-ok-soft text-ok',
              )}
              data-testid="guard-verdict"
            >
              <StatusDot tone={preview.locked || preview.shield ? 'bad' : 'ok'} pulse /> {verdict}
            </div>
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Protection" />
            <div className="divide-y divide-line border-t border-line">
              <Setting
                icon={<Lock className="size-4" />}
                title="Walk-away lock"
                body={`Lock when no one is at the screen for ${guard.awaySeconds} seconds.`}
                checked={guard.awayLock}
                onChange={(awayLock) => setGuard({ awayLock })}
              >
                <input
                  type="range"
                  min={3}
                  max={60}
                  value={guard.awaySeconds}
                  onChange={(e) => setGuard({ awaySeconds: Number(e.target.value) })}
                  className="mt-2 w-full accent-[var(--accent)]"
                  disabled={!guard.awayLock}
                />
              </Setting>
              <Setting
                icon={<Users className="size-4" />}
                title="Shoulder-surf shield"
                body="Blur the screen while more than one person is looking."
                checked={guard.shoulderShield}
                onChange={(shoulderShield) => setGuard({ shoulderShield })}
              />
              <Setting
                icon={<UserX className="size-4" />}
                title="Stranger lock"
                body="Lock if someone other than you sits down."
                checked={guard.strangerLock}
                onChange={(strangerLock) => setGuard({ strangerLock })}
              />
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex gap-3">
              <Monitor className="mt-0.5 size-5 shrink-0 text-muted" />
              <p className="text-[13px] leading-relaxed text-muted">
                In the browser, Guard protects Optic app pages. The <b className="text-ink">Optic for Mac</b> agent would apply the same
                rules to the whole computer (lock screen, blur all windows). The camera light stays on while Guard is watching.
              </p>
            </div>
          </Card>
        </div>
      </div>
      <Card className="mt-4">
        <CardHeader title="Guard events" description="Locks, unlocks and shields" />
        {guardEvents.length === 0 ? (
          <EmptyState icon={<ShieldHalf className="size-5" />} title="No events yet" description="Turn Guard on and step away from the screen." className="py-8" />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {guardEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                <span className="text-ink">{e.detail}</span>
                <span className="flex items-center gap-2">
                  <Badge tone={e.ok ? 'ok' : 'warn'}>{e.action}</Badge>
                  <span className="w-[64px] text-right text-[12px] text-subtle">{timeAgo(e.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

function Stat({ icon, label, value, testId }: { icon: React.ReactNode; label: string; value: string; testId?: string }) {
  return (
    <div className="rounded-xl border border-line px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
        {icon} {label}
      </div>
      <div className="mt-1 truncate text-[13.5px] font-semibold text-ink" data-testid={testId}>
        {value}
      </div>
    </div>
  )
}

function Setting({
  icon,
  title,
  body,
  checked,
  onChange,
  children,
}: {
  icon: React.ReactNode
  title: string
  body: string
  checked: boolean
  onChange: (v: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-center gap-3">
        <span className="text-muted">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium text-ink">{title}</div>
          <div className="text-[12px] text-muted">{body}</div>
        </div>
        <Toggle checked={checked} onChange={onChange} label={title} />
      </div>
      {children}
    </div>
  )
}
