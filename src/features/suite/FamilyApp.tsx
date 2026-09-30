import { ArrowUpRight, Clock, Hourglass, Monitor, Moon, Pause, Play, Plus, ScanEye, Sun, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { identityService } from '../../core/identity/IdentityService'
import { Link, useSearchParams } from 'react-router-dom'
import { authorize, describeSchedule, formatClock } from '../../core/authorization/engine'
import type { Schedule } from '../../core/authorization/types'
import { Drawer } from '../../ui/overlay'
import { Avatar, Badge, Button, buttonClass, Card, cx, Field, Input, SectionLabel, Select } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'
import { useIdentities } from '../sensor/hooks'
import { TerminalClock } from '../sensor/TerminalShell'
import { usePresence } from './presence'
import { ACCENTS, dayKey, KID_APPS, newSuiteId, useSession, useSuite, type FamilyMember } from './store'

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function useMemberToday(m: FamilyMember) {
  const used = useSuite((s) => s.usage[dayKey(m.id)] ?? 0)
  const bonus = useSuite((s) => s.bonus[dayKey(m.id)] ?? 0)
  const limitSec = (m.dailyMinutes + bonus) * 60
  return { used, bonus, limitSec, remaining: Math.max(0, limitSec - used) }
}

/** Screen time is a resource guarded by the same policy engine as the doors. */
export function screenAccess(m: FamilyMember, at = Date.now()) {
  if (m.role === 'parent') return { allowed: true, code: 'granted' as const }
  const r = authorize(
    {
      id: m.id,
      kind: 'member',
      displayName: m.name,
      status: m.paused ? 'suspended' : 'active',
      grants: [{ resourceId: 'screen', schedule: m.schedule, source: { kind: 'rule', id: m.id, label: 'Screen time' } }],
    },
    { id: 'screen', name: 'Screen', online: true, mode: 'normal' },
    at,
  )
  return { allowed: r.allowed, code: r.code }
}

const fmtMin = (sec: number) => {
  const m = Math.round(sec / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

export function FamilyApp() {
  const family = useSuite((s) => s.family)
  const upsert = useSuite((s) => s.upsertMember)
  const session = useSession()
  const [params, setParams] = useSearchParams()
  const selected = family.find((m) => m.id === params.get('open')) ?? null
  const isParent = family.some((m) => m.role === 'parent' && identityService.isSameAccount(m.identityId, session.identityId))

  return (
    <>
      <PageHeader
        title="Optic Family"
        description="Screen time, profiles and a kids’ launcher that follow whoever actually sits down — not whoever is logged in."
        actions={
          <>
            {isParent && (
              <Button
                icon={<Plus className="size-4" />}
                onClick={() => {
                  const id = newSuiteId('fam')
                  upsert({ id, name: 'New member', role: 'kid', identityId: null, accent: ACCENTS[3], theme: 'light', dailyMinutes: 60, schedule: { type: 'weekly', days: [0, 1, 2, 3, 4, 5, 6], start: '08:00', end: '19:00' }, apps: ['khan', 'pbs'], paused: false })
                  setParams({ open: id })
                }}
                data-testid="family-add"
              >
                Add member
              </Button>
            )}
            <Link to="/apps/family/screen" className={buttonClass('primary')} data-testid="family-screen">
              <Monitor className="size-4" /> Open shared screen
            </Link>
          </>
        }
      />
      {!isParent && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-accent/25 bg-accent-soft/40 px-5 py-4">
          <div className="text-[13.5px] text-ink">
            Only parents can change rules. You’re signed in as <b>{session.name}</b>.
          </div>
          <Button
            size="sm"
            variant="primary"
            icon={<UserPlus className="size-3.5" />}
            onClick={() =>
              upsert({ id: newSuiteId('fam'), name: session.name?.split(' ')[0] ?? 'Parent', role: 'parent', identityId: session.identityId, accent: ACCENTS[0], theme: 'light', dailyMinutes: 0, schedule: { type: 'always' }, apps: [], paused: false })
            }
            data-testid="family-join"
          >
            Add me as a parent
          </Button>
        </Card>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {family.map((m) => (
          <MemberCard key={m.id} m={m} onOpen={() => isParent && setParams({ open: m.id })} editable={isParent} />
        ))}
      </div>
      <Drawer open={!!selected} onClose={() => setParams({})}>
        {selected && <MemberEditor m={selected} onClose={() => setParams({})} />}
      </Drawer>
    </>
  )
}

function MemberCard({ m, onOpen, editable }: { m: FamilyMember; onOpen: () => void; editable: boolean }) {
  const t = useMemberToday(m)
  const access = screenAccess(m)
  const pct = t.limitSec ? Math.min(1, t.used / t.limitSec) : 0
  return (
    <Card className={cx('p-5', editable && 'cursor-pointer transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]')} onClick={onOpen} data-testid="family-member">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full text-[16px] font-semibold text-white" style={{ background: m.accent }}>
            {m.name.slice(0, 1)}
          </span>
          <div>
            <div className="text-[15px] font-semibold text-ink">{m.name}</div>
            <div className="text-[12.5px] text-muted">{m.role === 'parent' ? 'Parent' : 'Kid'} · {m.identityId ? 'Optic linked' : 'Not linked'}</div>
          </div>
        </div>
        {m.role === 'kid' && (m.paused ? <Badge tone="warn">Paused</Badge> : access.allowed ? <Badge tone="ok">Allowed now</Badge> : <Badge>Outside hours</Badge>)}
      </div>
      {m.role === 'kid' ? (
        <>
          <div className="mt-5 flex items-baseline justify-between text-[12.5px]">
            <span className="text-muted">Today</span>
            <span className="text-ink tabular">
              {fmtMin(t.used)} / {fmtMin(t.limitSec)}
              {t.bonus > 0 && <span className="text-subtle"> (+{t.bonus}m)</span>}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full transition-[width]" style={{ width: `${pct * 100}%`, background: pct >= 1 ? 'var(--bad)' : m.accent }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-[12px] text-muted">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" /> {describeSchedule(m.schedule)}
            </span>
            <span>{m.apps.length} apps</span>
          </div>
        </>
      ) : (
        <p className="mt-5 text-[12.5px] text-muted">No limits. Can add time and pause kids from the shared screen.</p>
      )}
    </Card>
  )
}

function MemberEditor({ m, onClose }: { m: FamilyMember; onClose: () => void }) {
  const upsert = useSuite((s) => s.upsertMember)
  const remove = useSuite((s) => s.removeMember)
  const addBonus = useSuite((s) => s.addBonus)
  const { identities } = useIdentities()
  const set = (patch: Partial<FamilyMember>) => upsert({ ...m, ...patch })
  const weekly = m.schedule.type === 'weekly' ? m.schedule : null
  const setSchedule = (s: Schedule) => set({ schedule: s })
  return (
    <div className="flex h-full flex-col" data-testid="family-editor">
      <div className="flex items-center gap-4 border-b border-line px-6 py-5">
        <span className="flex size-12 items-center justify-center rounded-full text-[18px] font-semibold text-white" style={{ background: m.accent }}>
          {m.name.slice(0, 1)}
        </span>
        <Input value={m.name} onChange={(e) => set({ name: e.target.value })} className="h-10 text-[16px] font-semibold" data-testid="family-name" />
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <section className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <Select value={m.role} onChange={(e) => set({ role: e.target.value as FamilyMember['role'] })}>
              <option value="kid">Kid</option>
              <option value="parent">Parent</option>
            </Select>
          </Field>
          <Field label="Optic identity" hint={<Link to="/lab/enroll?return=/apps/family" className="text-accent-text hover:underline">Enroll a new person</Link>}>
            <Select value={m.identityId ?? ''} onChange={(e) => set({ identityId: e.target.value || null })} data-testid="family-identity">
              <option value="">Not linked</option>
              {identities.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                  {i.synthetic ? ' (demo)' : ''}
                </option>
              ))}
            </Select>
          </Field>
        </section>
        <section>
          <SectionLabel className="mb-2">Profile</SectionLabel>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((c) => (
              <button key={c} onClick={() => set({ accent: c })} className={cx('size-7 rounded-full ring-offset-2 ring-offset-surface', m.accent === c && 'ring-2 ring-ink')} style={{ background: c }} aria-label={c} />
            ))}
            <div className="ml-auto inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
              {(['light', 'dark'] as const).map((t) => (
                <button key={t} onClick={() => set({ theme: t })} className={cx('rounded-md px-2.5 py-1 text-[12px]', m.theme === t ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-muted')}>
                  {t === 'light' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                </button>
              ))}
            </div>
          </div>
        </section>
        {m.role === 'kid' && (
          <>
            <section>
              <SectionLabel className="mb-2">Daily limit · {m.dailyMinutes} min</SectionLabel>
              <input type="range" min={15} max={240} step={15} value={m.dailyMinutes} onChange={(e) => set({ dailyMinutes: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />
              <div className="mt-2 flex gap-2">
                <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => addBonus(m.id, 15)}>
                  15 min today
                </Button>
                <Button size="sm" icon={m.paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />} onClick={() => set({ paused: !m.paused })}>
                  {m.paused ? 'Resume' : 'Pause now'}
                </Button>
              </div>
            </section>
            <section>
              <SectionLabel className="mb-2">Allowed hours</SectionLabel>
              {weekly && (
                <div className="space-y-3">
                  <div className="flex gap-1.5">
                    {DAYS.map((d, i) => {
                      const on = weekly.days.includes(i)
                      return (
                        <button
                          key={i}
                          onClick={() => setSchedule({ ...weekly, days: on ? weekly.days.filter((x) => x !== i) : [...weekly.days, i] })}
                          className={cx('size-8 rounded-lg border text-[12px] font-semibold', on ? 'border-ink bg-ink text-bg' : 'border-line text-muted')}
                        >
                          {d}
                        </button>
                      )
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="From">
                      <Input type="time" value={weekly.start} onChange={(e) => setSchedule({ ...weekly, start: e.target.value })} />
                    </Field>
                    <Field label="Until">
                      <Input type="time" value={weekly.end} onChange={(e) => setSchedule({ ...weekly, end: e.target.value })} />
                    </Field>
                  </div>
                </div>
              )}
            </section>
            <section>
              <SectionLabel className="mb-2">Approved apps & sites</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {KID_APPS.map((a) => {
                  const on = m.apps.includes(a.id)
                  return (
                    <button
                      key={a.id}
                      onClick={() => set({ apps: on ? m.apps.filter((x) => x !== a.id) : [...m.apps, a.id] })}
                      className={cx('flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition', on ? 'border-accent/40 bg-accent-soft' : 'border-line')}
                    >
                      <span className="size-6 shrink-0 rounded-md" style={{ background: a.color }} />
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-medium text-ink">{a.name}</span>
                        <span className="block text-[11px] text-muted">{a.blurb}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </div>
      <div className="flex justify-between border-t border-line px-6 py-3.5">
        <Button
          size="sm"
          variant="danger"
          icon={<Trash2 className="size-3.5" />}
          onClick={() => {
            remove(m.id)
            onClose()
          }}
        >
          Remove
        </Button>
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}

// ── Shared screen: switches to whoever sits down ───────────────────────────

export function FamilyScreen() {
  const p = usePresence({ identify: true })
  const family = useSuite((s) => s.family)
  const addUsage = useSuite((s) => s.addUsage)
  const log = useSuite((s) => s.log)
  const member = p.who && p.who !== 'unknown' ? family.find((m) => identityService.isSameAccount(m.identityId, (p.who as { identityId: string }).identityId)) : undefined
  const stranger = p.faces !== 'none' && (p.who === 'unknown' || (p.who && !member))

  // Count screen time only while an allowed kid is present and looking.
  const memberRef = useRef(member)
  memberRef.current = member
  const lookingRef = useRef(p.looking)
  lookingRef.current = p.looking
  useEffect(() => {
    const t = setInterval(() => {
      const m = memberRef.current
      if (!m || m.role !== 'kid' || !lookingRef.current) return
      const s = useSuite.getState()
      const used = s.usage[dayKey(m.id)] ?? 0
      const limit = (m.dailyMinutes + (s.bonus[dayKey(m.id)] ?? 0)) * 60
      if (screenAccess(m).allowed && used < limit) addUsage(m.id, 5)
    }, 5000)
    return () => clearInterval(t)
  }, [addUsage])

  const lastMember = useRef<string | null>(null)
  useEffect(() => {
    const id = member?.id ?? null
    if (id && id !== lastMember.current) log({ app: 'family', action: 'switch', detail: `Shared screen switched to ${member!.name}`, identityId: member!.identityId, name: member!.name, ok: true })
    lastMember.current = id
  }, [member, log])

  const accentStyle = member
    ? ({ ['--accent' as string]: member.accent, ['--accent-text' as string]: member.accent, ['--accent-soft' as string]: `color-mix(in srgb, ${member.accent} 14%, var(--surface))` } as React.CSSProperties)
    : undefined

  return (
    <div className={cx('min-h-screen bg-bg transition-colors duration-500', member?.theme === 'dark' && 'dark')} style={accentStyle} data-testid="family-screen-root">
      <div className="min-h-screen bg-bg text-ink">
        <header className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <ScanEye className="size-4" /> Optic Family · shared screen
          </div>
          <div className="flex items-center gap-4">
            {p.demoLabel && <Badge tone="warn">Demo · {p.demoLabel}</Badge>}
            <TerminalClock className="tabular text-[13px] font-medium text-muted" />
            <Link to="/apps/family" className="rounded-full border border-line px-3 py-1 text-[12px] text-muted hover:text-ink">
              Exit
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 pb-16" data-testid="family-screen-state" data-member={member?.name ?? (stranger ? 'guest' : 'none')}>
          {p.status.state !== 'running' ? (
            <Center title="Starting sensor…" body="Allow camera access to use the shared screen." />
          ) : !member && !stranger ? (
            <Center title="Sit down to start" body="The screen recognizes each family member and switches to their space." big />
          ) : stranger ? (
            <Center title="Hi there!" body="This screen belongs to the family. Ask a parent to set you up." />
          ) : member!.role === 'parent' ? (
            <ParentView member={member!} />
          ) : (
            <KidView member={member!} />
          )}
        </main>
      </div>
    </div>
  )
}

function Center({ title, body, big }: { title: string; body: string; big?: boolean }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className={cx('font-semibold tracking-tight text-ink', big ? 'text-[40px]' : 'text-[30px]')}>{title}</div>
      <p className="mt-2 max-w-md text-[15px] text-muted">{body}</p>
    </div>
  )
}

function KidView({ member }: { member: FamilyMember }) {
  const t = useMemberToday(member)
  const access = screenAccess(member)
  const apps = KID_APPS.filter((a) => member.apps.includes(a.id))
  const pct = t.limitSec ? t.remaining / t.limitSec : 0
  const blocked = !access.allowed || t.remaining <= 0
  const sched = member.schedule.type === 'weekly' ? member.schedule : null

  return (
    <div data-testid="kid-view">
      <div className="flex flex-wrap items-center justify-between gap-6 py-6">
        <div>
          <div className="text-[15px] font-medium text-muted">Hi</div>
          <div className="text-[44px] leading-tight font-semibold tracking-tight text-ink">{member.name}! 👋</div>
        </div>
        <TimeRing pct={pct} label={fmtMin(t.remaining)} color={member.accent} />
      </div>
      {blocked ? (
        <Card className="flex flex-col items-center px-8 py-14 text-center" data-testid="kid-blocked">
          <Hourglass className="size-8 text-muted" />
          <div className="mt-4 text-[26px] font-semibold text-ink">
            {member.paused ? 'Screen time is paused' : !access.allowed ? 'Not right now' : 'Time’s up for today'}
          </div>
          <p className="mt-2 text-[15px] text-muted">
            {member.paused
              ? 'A parent paused screen time.'
              : !access.allowed && sched
                ? `Screen time is ${formatClock(sched.start)} – ${formatClock(sched.end)}.`
                : 'Great job! Ask a parent if you need a little more time.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {apps.map((a) => (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="group rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-float)]"
            >
              <span className="flex size-14 items-center justify-center rounded-2xl text-[22px] font-bold text-white" style={{ background: a.color }}>
                {a.name.slice(0, 1)}
              </span>
              <div className="mt-4 text-[16px] font-semibold text-ink">{a.name}</div>
              <div className="text-[13px] text-muted">{a.blurb}</div>
            </a>
          ))}
        </div>
      )}
      <p className="mt-8 text-center text-[12px] text-subtle">Time counts only while {member.name} is here and looking at the screen.</p>
    </div>
  )
}

function TimeRing({ pct, label, color }: { pct: number; label: string; color: string }) {
  const r = 44
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-[120px]">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, pct)))} style={{ transition: 'stroke-dashoffset 600ms ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[20px] font-semibold text-ink tabular" data-testid="kid-remaining">{label}</div>
        <div className="text-[11px] text-muted">left today</div>
      </div>
    </div>
  )
}

function ParentView({ member }: { member: FamilyMember }) {
  const family = useSuite((s) => s.family)
  const kids = useMemo(() => family.filter((m) => m.role === 'kid'), [family])
  return (
    <div data-testid="parent-view">
      <div className="py-6">
        <div className="text-[15px] font-medium text-muted">Welcome back</div>
        <div className="text-[40px] leading-tight font-semibold tracking-tight text-ink">{member.name}</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {kids.map((k) => (
          <ParentKidCard key={k.id} kid={k} />
        ))}
      </div>
      <div className="mt-6 text-center">
        <Link to="/apps/family" className={buttonClass('secondary')}>
          Family settings <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  )
}

function ParentKidCard({ kid }: { kid: FamilyMember }) {
  const t = useMemberToday(kid)
  const addBonus = useSuite((s) => s.addBonus)
  const upsert = useSuite((s) => s.upsertMember)
  const log = useSuite((s) => s.log)
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={kid.name} size={36} />
          <div>
            <div className="text-[15px] font-semibold text-ink">{kid.name}</div>
            <div className="text-[12.5px] text-muted">
              {fmtMin(t.used)} used · {fmtMin(t.remaining)} left
            </div>
          </div>
        </div>
        {kid.paused && <Badge tone="warn">Paused</Badge>}
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          icon={<Plus className="size-3.5" />}
          onClick={() => {
            addBonus(kid.id, 15)
            log({ app: 'family', action: 'bonus', detail: `+15 min for ${kid.name} (parent present)`, identityId: null, name: kid.name, ok: true })
          }}
          data-testid={`bonus-${kid.name}`}
        >
          15 min
        </Button>
        <Button size="sm" icon={kid.paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />} onClick={() => upsert({ ...kid, paused: !kid.paused })}>
          {kid.paused ? 'Resume' : 'Pause'}
        </Button>
      </div>
    </Card>
  )
}
