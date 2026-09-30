import { Ban, Building2, CalendarClock, Plus, TimerOff, UserRoundPlus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { clock } from '../../core/access/clock'
import { visitorStatus, type Visitor } from '../../domains/office/model'
import { newId, useStore } from '../../state/store'
import { formatDate, formatTime, fromLocalInput, isSameDay, startOfDay, toLocalInput } from '../../ui/format'
import { Drawer, Modal } from '../../ui/overlay'
import { Avatar, Badge, Button, Card, cx, EmptyState, Field, Input, SectionLabel, type Tone } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'
import { OpticIdentityCard } from '../shell/OpticIdentityCard'

const STATUS: Record<ReturnType<typeof visitorStatus>, { label: string; tone: Tone }> = {
  scheduled: { label: 'Scheduled', tone: 'neutral' },
  active: { label: 'Active', tone: 'ok' },
  expired: { label: 'Expired', tone: 'bad' },
  revoked: { label: 'Revoked', tone: 'bad' },
}

export const visitWindow = (v: Visitor) =>
  isSameDay(v.start, v.end)
    ? `${formatDate(v.start)} · ${formatTime(v.start)}–${formatTime(v.end)}`
    : `${formatDate(v.start)} ${formatTime(v.start)} – ${formatDate(v.end)} ${formatTime(v.end)}`

export function VisitorsPage() {
  const office = useStore((s) => s.office)
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const selected = office.visitors.find((v) => v.id === params.get('open')) ?? null
  const now = clock.now()
  const sorted = [...office.visitors].sort((a, b) => b.start - a.start)

  return (
    <>
      <PageHeader
        title="Visitors"
        description="Temporary, time-boxed access. When a visit ends, authentication still recognizes the person — authorization says no."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)} data-testid="add-visitor">
            New visitor
          </Button>
        }
      />
      <Card className="overflow-hidden">
        {sorted.length === 0 ? (
          <EmptyState icon={<UserRoundPlus className="size-5" />} title="No visitors" description="Register a visitor to give them temporary access." />
        ) : (
          <ul className="divide-y divide-line">
            {sorted.map((v) => {
              const st = STATUS[visitorStatus(v, now)]
              return (
                <li key={v.id} onClick={() => setParams({ open: v.id })} className="flex cursor-pointer flex-wrap items-center gap-4 px-5 py-3.5 transition hover:bg-surface-2/50" data-testid="visitor-row">
                  <Avatar name={v.name} />
                  <div className="min-w-[180px] flex-1">
                    <div className="text-[14px] font-medium text-ink">{v.name}</div>
                    <div className="text-[12.5px] text-muted">
                      {v.company} · host {v.hostName}
                    </div>
                  </div>
                  <div className="min-w-[200px] text-[13px] text-muted">
                    <div className="text-ink">{v.doorIds.map((id) => office.doors.find((d) => d.id === id)?.name).join(', ')}</div>
                    <div>{visitWindow(v)}</div>
                  </div>
                  {v.identityId ? <Badge tone="ok" dot>Enrolled</Badge> : <Badge tone="warn" dot>Not enrolled</Badge>}
                  <Badge tone={st.tone}>{st.label}</Badge>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <CreateVisitorModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false)
          setParams({ open: id })
        }}
      />
      <Drawer open={!!selected} onClose={() => setParams({})}>
        {selected && <VisitorDetail visitor={selected} />}
      </Drawer>
    </>
  )
}

function CreateVisitorModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const office = useStore((s) => s.office)
  const upsert = useStore((s) => s.upsertVisitor)
  const today = startOfDay(clock.now())
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    hostName: '',
    doorIds: ['door_main', 'door_confA'],
    start: toLocalInput(today + 14 * 3_600_000),
    end: toLocalInput(today + 16 * 3_600_000),
  })
  const [error, setError] = useState<string | null>(null)
  const submit = () => {
    if (!form.name.trim() || !form.company.trim()) return setError('Name and company are required.')
    const start = fromLocalInput(form.start)
    const end = fromLocalInput(form.end)
    if (!(end > start)) return setError('End time must be after the start time.')
    if (form.doorIds.length === 0) return setError('Choose at least one location.')
    const id = newId('vis')
    upsert({ id, name: form.name.trim(), company: form.company.trim(), email: form.email.trim(), hostName: form.hostName, doorIds: form.doorIds, start, end, revoked: false, identityId: null, createdAt: Date.now() })
    setError(null)
    onCreated(id)
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={540}
      title="New visitor"
      description="Access is valid only inside the visit window."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} data-testid="create-visitor">
            Create visitor
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" data-testid="visitor-name" />
          </Field>
          <Field label="Company">
            <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Acme" data-testid="visitor-company" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="david@acme.com" />
          </Field>
          <Field label="Host">
            <Input value={form.hostName} onChange={(e) => setForm({ ...form, hostName: e.target.value })} />
          </Field>
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-ink">Location</div>
          <div className="flex flex-wrap gap-1.5">
            {office.doors.map((d) => {
              const on = form.doorIds.includes(d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setForm({ ...form, doorIds: on ? form.doorIds.filter((x) => x !== d.id) : [...form.doorIds, d.id] })}
                  className={cx(
                    'inline-flex h-8 items-center rounded-lg border px-2.5 text-[12.5px] font-medium transition',
                    on ? 'border-accent/40 bg-accent-soft text-accent-text' : 'border-line text-muted hover:text-ink',
                  )}
                >
                  {d.name}
                </button>
              )
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start time">
            <Input type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          </Field>
          <Field label="End time">
            <Input type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </Field>
        </div>
        {error && <div className="text-[13px] text-bad">{error}</div>}
      </div>
    </Modal>
  )
}

function VisitorDetail({ visitor }: { visitor: Visitor }) {
  const office = useStore((s) => s.office)
  const upsert = useStore((s) => s.upsertVisitor)
  const now = clock.now()
  const status = visitorStatus(visitor, now)
  const st = STATUS[status]
  return (
    <div className="flex h-full flex-col" data-testid="visitor-detail">
      <div className="border-b border-line px-6 pt-6 pb-5">
        <div className="flex items-start gap-4">
          <Avatar name={visitor.name} size={48} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-semibold tracking-tight text-ink">{visitor.name}</span>
              <Badge tone={st.tone}>{st.label}</Badge>
            </div>
            <div className="flex items-center gap-1.5 text-[13px] text-muted">
              <Building2 className="size-3.5" /> {visitor.company} · hosted by {visitor.hostName}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <section>
          <SectionLabel className="mb-2">Visit</SectionLabel>
          <div className="rounded-xl border border-line p-4">
            <div className="flex items-center gap-2 text-[14px] font-medium text-ink">
              <CalendarClock className="size-4 text-subtle" /> {visitWindow(visitor)}
            </div>
            <div className="mt-2 text-[13px] text-muted">
              Access to {visitor.doorIds.map((id) => office.doors.find((d) => d.id === id)?.name).join(', ')}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {status === 'active' && (
                <Button size="sm" icon={<TimerOff className="size-3.5" />} onClick={() => upsert({ ...visitor, end: now })} data-testid="end-visit">
                  End visit now
                </Button>
              )}
              {status !== 'revoked' ? (
                <Button size="sm" variant="danger" icon={<Ban className="size-3.5" />} onClick={() => upsert({ ...visitor, revoked: true })}>
                  Revoke access
                </Button>
              ) : (
                <Button size="sm" onClick={() => upsert({ ...visitor, revoked: false })}>
                  Restore access
                </Button>
              )}
            </div>
          </div>
        </section>
        <section>
          <SectionLabel className="mb-2">Optic identity</SectionLabel>
          <OpticIdentityCard identityId={visitor.identityId} forParam={`visitor:${visitor.id}`} onLink={(identityId) => upsert({ ...visitor, identityId })} />
        </section>
        {status === 'expired' && (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-muted">
            The visit has ended. If {visitor.name.split(' ')[0]} looks at a sensor, they will be <b className="text-ink">recognized</b> but
            the door will show <b className="text-bad">VISITOR ACCESS EXPIRED</b>.
          </p>
        )}
      </div>
    </div>
  )
}
