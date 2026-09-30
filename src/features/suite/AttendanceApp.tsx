import { ArrowUpRight, CalendarClock, Download, MapPin, Plus, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { identityService } from '../../core/identity/IdentityService'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { SiteAdapter } from '../../core/access/types'
import type { Principal } from '../../core/authorization/types'
import { formatDateTime, formatTime, fromLocalInput, toLocalInput } from '../../ui/format'
import { Drawer, Modal } from '../../ui/overlay'
import { Avatar, Badge, Button, buttonClass, Card, cx, EmptyState, Field, Input, Select, type Tone } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'
import { useIdentities } from '../sensor/hooks'
import { OpticTerminal } from '../sensor/OpticTerminal'
import { TerminalShell } from '../sensor/TerminalShell'
import { newSuiteId, useSuite, type AttendanceEvent } from './store'

const OPEN_BEFORE_MS = 30 * 60_000

export function eventStatus(e: AttendanceEvent, now = Date.now()): { label: string; tone: Tone } {
  if (now < e.start - OPEN_BEFORE_MS) return { label: 'Upcoming', tone: 'neutral' }
  if (now < e.end) return { label: 'Check-in open', tone: 'ok' }
  return { label: 'Closed', tone: 'bad' }
}

/** Attendance plugs into the shared access engine: the event is the resource, the roster holds grants. */
export function attendanceAdapter(eventId: string): SiteAdapter {
  let lastIdentityId: string | null = null
  const event = () => useSuite.getState().attendance.find((e) => e.id === eventId)
  return {
    site: 'attendance',
    resolvePrincipal(identityId) {
      lastIdentityId = identityId
      const e = event()
      if (!e || !e.roster.some((id) => identityService.isSameAccount(identityId, id))) return null
      const p: Principal = {
        id: identityId,
        kind: 'member',
        displayName: identityId,
        status: 'active',
        window: { from: e.start - OPEN_BEFORE_MS, until: e.end },
        grants: [{ resourceId: e.id, schedule: { type: 'always' }, source: { kind: 'rule', id: e.id, label: 'Roster' } }],
      }
      return p
    },
    getResource(id) {
      const e = event()
      return e && e.id === id ? { id: e.id, name: e.name, online: true, mode: 'normal' } : null
    },
    describeDenial(result) {
      const e = event()
      switch (result.code) {
        case 'no-principal':
          return { title: 'NOT ON THE ROSTER', detail: 'You’re not registered for this session.' }
        case 'window-not-started':
          return { title: 'CHECK-IN NOT OPEN', detail: `Check-in opens at ${formatTime(result.boundary!)}.` }
        case 'window-expired':
          return { title: 'CHECK-IN CLOSED', detail: e ? `This session ended at ${formatTime(e.end)}.` : 'This session has ended.' }
        default:
          return { title: 'CHECK-IN REFUSED', detail: 'Please see the organizer.' }
      }
    },
    describeGrant(name, _resource, at) {
      const e = event()!
      const already = useSuite.getState().checkins.find((c) => c.eventId === e.id && c.identityId === lastIdentityId)
      if (already) return { headline: 'ALREADY CHECKED IN', title: name, detail: `Checked in at ${formatTime(already.at)}.` }
      const late = at > e.start + e.graceMin * 60_000
      return { headline: late ? 'CHECKED IN · LATE' : 'CHECKED IN', title: name, detail: `${late ? 'Late' : 'On time'} · ${formatTime(at)}` }
    },
    unlock(_id, name, at) {
      const e = event()
      if (!e || !lastIdentityId) return
      useSuite.getState().checkIn({ eventId: e.id, identityId: lastIdentityId, name, at, late: at > e.start + e.graceMin * 60_000 })
      useSuite.getState().log({ app: 'attendance', action: 'check-in', detail: `Checked in · ${e.name}`, identityId: lastIdentityId, name, ok: true, ref: e.id })
    },
  }
}

export function AttendanceApp() {
  const events = useSuite((s) => s.attendance)
  const checkins = useSuite((s) => s.checkins)
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const selected = events.find((e) => e.id === params.get('open')) ?? null
  const sorted = [...events].sort((a, b) => a.start - b.start)

  return (
    <>
      <PageHeader
        title="Optic Attendance"
        description="Check in to classes and meetings with a glance. No sign-in sheets, no buddy check-ins."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)} data-testid="att-new">
            New session
          </Button>
        }
      />
      {sorted.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarClock className="size-5" />} title="No sessions" description="Create a class or meeting and add its roster." />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sorted.map((e) => {
            const st = eventStatus(e)
            const present = checkins.filter((c) => c.eventId === e.id)
            return (
              <Card key={e.id} className="cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]" onClick={() => setParams({ open: e.id })} data-testid="att-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-semibold text-ink">{e.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">
                      <MapPin className="size-3.5" /> {e.location}
                    </div>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <div className="mt-4 flex items-center justify-between text-[12.5px] text-muted">
                  <span>{formatDateTime(e.start)}</span>
                  <span className="text-ink tabular">
                    {present.length}/{e.roster.length} present
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(present.length / Math.max(1, e.roster.length)) * 100}%` }} />
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <CreateEventModal open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setParams({ open: id }) }} />
      <Drawer open={!!selected} onClose={() => setParams({})} width={560}>
        {selected && <EventDetail e={selected} onClose={() => setParams({})} />}
      </Drawer>
    </>
  )
}

function EventDetail({ e, onClose }: { e: AttendanceEvent; onClose: () => void }) {
  const checkins = useSuite((s) => s.checkins)
  const remove = useSuite((s) => s.removeAttendance)
  const { identities } = useIdentities()
  const rows = useMemo(
    () =>
      e.roster.map((id) => {
        const c = checkins.find((x) => x.eventId === e.id && x.identityId === id)
        return { id, name: identities.find((i) => i.id === id)?.name ?? c?.name ?? 'Unknown', c }
      }),
    [e, checkins, identities],
  )
  const closed = Date.now() >= e.end
  const exportCsv = () => {
    const lines = [['name', 'status', 'time'], ...rows.map((r) => [r.name, r.c ? (r.c.late ? 'late' : 'present') : closed ? 'absent' : 'not yet', r.c ? new Date(r.c.at).toISOString() : ''])]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([lines.map((l) => l.map((x) => `"${x}"`).join(',')).join('\n')], { type: 'text/csv' }))
    a.download = `${e.name.replace(/\W+/g, '-').toLowerCase()}-attendance.csv`
    a.click()
  }
  return (
    <div className="flex h-full flex-col" data-testid="att-detail">
      <div className="border-b border-line px-6 py-5">
        <div className="text-[18px] font-semibold text-ink">{e.name}</div>
        <div className="text-[13px] text-muted">
          {e.location} · {formatDateTime(e.start)} – {formatTime(e.end)} · {e.graceMin} min grace
        </div>
        <div className="mt-4 flex gap-2">
          <Link to={`/apps/attendance/kiosk/${e.id}`} className={buttonClass('primary', 'sm')} data-testid="att-kiosk">
            Open check-in kiosk <ArrowUpRight className="size-3.5" />
          </Link>
          <Button size="sm" icon={<Download className="size-3.5" />} onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>
      <ul className="flex-1 divide-y divide-line overflow-y-auto">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-6 py-3">
            <Avatar name={r.name} size={30} />
            <span className="flex-1 text-[13.5px] font-medium text-ink">{r.name}</span>
            {r.c ? (
              <span className="flex items-center gap-2">
                <span className="text-[12px] text-muted">{formatTime(r.c.at)}</span>
                <Badge tone={r.c.late ? 'warn' : 'ok'}>{r.c.late ? 'Late' : 'Present'}</Badge>
              </span>
            ) : (
              <Badge tone={closed ? 'bad' : 'neutral'}>{closed ? 'Absent' : 'Not yet'}</Badge>
            )}
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-line px-6 py-3.5">
        <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={() => { remove(e.id); onClose() }}>
          Delete session
        </Button>
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}

function CreateEventModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const upsert = useSuite((s) => s.upsertAttendance)
  const { identities } = useIdentities()
  const soon = Math.ceil(Date.now() / 900_000) * 900_000
  const [form, setForm] = useState({ name: '', location: '', start: toLocalInput(soon), end: toLocalInput(soon + 3_600_000), grace: 10, roster: [] as string[] })
  const [error, setError] = useState<string | null>(null)
  const submit = () => {
    const start = fromLocalInput(form.start)
    const end = fromLocalInput(form.end)
    if (!form.name.trim()) return setError('Name the session.')
    if (!(end > start)) return setError('End must be after start.')
    if (form.roster.length === 0) return setError('Add at least one person to the roster.')
    const id = newSuiteId('att')
    upsert({ id, name: form.name.trim(), location: form.location.trim() || 'Anywhere', start, end, graceMin: form.grace, roster: form.roster })
    setError(null)
    onCreated(id)
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      title="New session"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} data-testid="att-create">
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Design review" data-testid="att-name" />
          </Field>
          <Field label="Location">
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Room 2B" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Start">
            <Input type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          </Field>
          <Field label="End">
            <Input type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </Field>
          <Field label="Grace">
            <Select value={form.grace} onChange={(e) => setForm({ ...form, grace: Number(e.target.value) })}>
              {[0, 5, 10, 15].map((g) => (
                <option key={g} value={g}>
                  {g} min
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <Users className="size-4 text-subtle" /> Roster
          </div>
          <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
            {identities
              .filter((i) => i.status === 'active')
              .map((i) => {
                const on = form.roster.includes(i.id)
                return (
                  <button
                    key={i.id}
                    onClick={() => setForm((f) => ({ ...f, roster: on ? f.roster.filter((x) => x !== i.id) : [...f.roster, i.id] }))}
                    className={cx('inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[12.5px] font-medium', on ? 'border-accent/40 bg-accent-soft text-accent-text' : 'border-line text-muted')}
                    data-testid="att-roster"
                  >
                    <Avatar name={i.name} size={18} /> {i.name}
                  </button>
                )
              })}
          </div>
        </div>
        {error && <div className="text-[13px] text-bad">{error}</div>}
      </div>
    </Modal>
  )
}

export function AttendanceKiosk() {
  const { eventId } = useParams()
  const e = useSuite((s) => s.attendance.find((x) => x.id === eventId))
  const count = useSuite((s) => s.checkins.filter((c) => c.eventId === eventId).length)
  const adapter = useMemo(() => attendanceAdapter(eventId ?? ''), [eventId])
  if (!e) return <TerminalShell location="Check-in" exitTo="/apps/attendance"><div className="mt-20 text-white/60">Session not found.</div></TerminalShell>
  return (
    <TerminalShell location={`Check-in · ${e.name}`} exitTo={`/apps/attendance?open=${e.id}`} topRight={<span className="hidden font-mono text-[11px] tracking-[0.2em] text-white/50 md:inline">{count}/{e.roster.length} IN</span>}>
      <OpticTerminal location={e.name} adapter={adapter} resourceId={e.id} autoResetMs={6000} authorizingText="Checking roster…" className="mt-2" />
    </TerminalShell>
  )
}
