import { ArrowUpRight, BedDouble, BrushCleaning, CalendarCheck2, Crown, DoorOpen, KeyRound, LogIn, LogOut, Plus, Search, Sparkles, Users, Wrench, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { clock } from '../../core/access/clock'
import { describeSchedule } from '../../core/authorization/engine'
import type { Guest, Room, RoomStatus } from '../../domains/hotel/model'
import { newId, useStore } from '../../state/store'
import { formatDate, fromLocalInput, isSameDay, startOfDay, timeAgo, toLocalInput } from '../../ui/format'
import { Drawer, Modal } from '../../ui/overlay'
import { Avatar, Badge, Button, buttonClass, Card, CardHeader, cx, EmptyState, Field, Input, SectionLabel, Select, Toggle, type Tone } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'
import { OutcomeBadge } from '../shell/OutcomeBadge'
import { ActivityFeed, HourlyChart, StatCard, useSiteEvents, useTodayEvents } from '../shell/console'
import { GUEST_STATUS, GuestDetail, stayRange } from './GuestDetail'

const ROOM_STATUS: Record<RoomStatus, { label: string; tone: Tone; cls: string }> = {
  occupied: { label: 'Occupied', tone: 'accent', cls: 'border-accent/30 bg-accent-soft/60' },
  vacant: { label: 'Vacant', tone: 'ok', cls: 'border-line bg-surface' },
  cleaning: { label: 'Cleaning', tone: 'warn', cls: 'border-warn/30 bg-warn-soft/60' },
  maintenance: { label: 'Maintenance', tone: 'bad', cls: 'border-bad/25 bg-bad-soft/60' },
}

function useCurrentGuest() {
  const guests = useStore((s) => s.hotel.guests)
  return (room: string) =>
    guests.find((g) => g.roomNumber === room && g.status === 'checked-in') ??
    guests.find((g) => g.roomNumber === room && g.status === 'reserved')
}

export function HotelOverview() {
  const hotel = useStore((s) => s.hotel)
  const events = useSiteEvents('hotel')
  const today = useTodayEvents('hotel')
  const now = clock.now()
  const occupied = hotel.rooms.filter((r) => r.status === 'occupied').length
  const inHouse = hotel.guests.filter((g) => g.status === 'checked-in')
  const arrivals = hotel.guests.filter((g) => g.status === 'reserved' && isSameDay(g.checkIn, now))
  const departures = inHouse.filter((g) => isSameDay(g.checkOut, now) || g.checkOut < now)

  return (
    <>
      <PageHeader
        title="Overview"
        description={hotel.propertyName}
        actions={
          <Link to="/terminal/hotel/room-814" className={buttonClass('secondary')}>
            Room 814 terminal <ArrowUpRight className="size-3.5" />
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Occupied rooms" value={`${occupied}/${hotel.rooms.length}`} hint={`${Math.round((occupied / hotel.rooms.length) * 100)}% occupancy`} icon={<BedDouble className="size-4" />} />
        <StatCard label="Checked-in guests" value={inHouse.length} hint={`${inHouse.reduce((a, g) => a + g.partySize, 0)} people in house`} icon={<Users className="size-4" />} />
        <StatCard label="Available rooms" value={hotel.rooms.filter((r) => r.status === 'vacant').length} hint="Clean & vacant" icon={<DoorOpen className="size-4" />} />
        <StatCard label="Need cleaning" value={hotel.rooms.filter((r) => r.status === 'cleaning').length} hint="Housekeeping queue" icon={<BrushCleaning className="size-4" />} />
        <StatCard label="Access events today" value={today.length} hint={`${today.filter((e) => e.outcome !== 'granted').length} not granted`} icon={<Zap className="size-4" />} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <ActivityFeed events={events} limit={10} />
        <div className="space-y-4">
          <HourlyChart events={today} />
          <Card>
            <CardHeader title="Today at the front desk" action={<Link to="/hotel/front-desk" className="text-[12.5px] font-medium text-muted hover:text-ink">Open</Link>} />
            <div className="grid grid-cols-2 border-t border-line">
              <div className="border-r border-line px-5 py-4">
                <div className="flex items-center gap-1.5 text-[12.5px] text-muted"><LogIn className="size-3.5" /> Arrivals</div>
                <div className="mt-1 text-[22px] font-semibold text-ink tabular">{arrivals.length}</div>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center gap-1.5 text-[12.5px] text-muted"><LogOut className="size-3.5" /> Departures</div>
                <div className="mt-1 text-[22px] font-semibold text-ink tabular">{departures.length}</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

export function GuestsPage() {
  const guests = useStore((s) => s.hotel.guests)
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const selected = guests.find((g) => g.id === params.get('open')) ?? null
  const rank = { 'checked-in': 0, reserved: 1, 'checked-out': 2 }
  const shown = guests
    .filter((g) => !q || `${g.name} ${g.roomNumber} ${g.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => rank[a.status] - rank[b.status] || a.roomNumber.localeCompare(b.roomNumber))

  return (
    <>
      <PageHeader
        title="Guests"
        description="Each stay links a guest’s Optic identity to one room for exactly the dates of the stay."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)} data-testid="add-guest">
            New guest
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <div className="border-b border-line p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guests or rooms" className="pl-9" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="bg-surface-2/60 text-[12px] text-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">Guest</th>
                <th className="px-3 py-2.5 font-medium">Room</th>
                <th className="px-3 py-2.5 font-medium">Stay</th>
                <th className="px-3 py-2.5 font-medium">Optic identity</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((g) => (
                <tr key={g.id} onClick={() => setParams({ open: g.id })} className="cursor-pointer hover:bg-surface-2/50" data-testid="guest-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={g.name} />
                      <div>
                        <div className="flex items-center gap-1.5 font-medium text-ink">
                          {g.name} {g.vip && <Crown className="size-3.5 text-warn" />}
                        </div>
                        <div className="text-[12px] text-muted">{g.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-semibold text-ink tabular">{g.roomNumber}</td>
                  <td className="px-3 py-3 text-muted">{stayRange(g)}</td>
                  <td className="px-3 py-3">{g.identityId ? <Badge tone="ok" dot>Linked</Badge> : <Badge tone="warn" dot>Not linked</Badge>}</td>
                  <td className="px-5 py-3">
                    <Badge tone={GUEST_STATUS[g.status].tone}>{GUEST_STATUS[g.status].label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <CreateGuestModal open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setParams({ open: id }) }} />
      <Drawer open={!!selected} onClose={() => setParams({})}>
        {selected && <GuestDetail guest={selected} />}
      </Drawer>
    </>
  )
}

function CreateGuestModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const rooms = useStore((s) => s.hotel.rooms)
  const upsert = useStore((s) => s.upsertGuest)
  const checkIn = useStore((s) => s.checkIn)
  const vacant = rooms.filter((r) => r.status === 'vacant')
  const today = startOfDay(clock.now())
  const [form, setForm] = useState({ name: '', email: '', room: '', checkIn: toLocalInput(today + 15 * 3_600_000), checkOut: toLocalInput(today + 3 * 86_400_000 + 11 * 3_600_000), vip: false, now: true })
  const [error, setError] = useState<string | null>(null)
  const submit = () => {
    const room = form.room || vacant[0]?.number
    if (!form.name.trim()) return setError('Guest name is required.')
    if (!room) return setError('No vacant rooms available.')
    const ci = fromLocalInput(form.checkIn)
    const co = fromLocalInput(form.checkOut)
    if (!(co > ci)) return setError('Check-out must be after check-in.')
    const id = newId('gst')
    const guest: Guest = { id, name: form.name.trim(), email: form.email.trim(), roomNumber: room, checkIn: ci, checkOut: co, status: 'reserved', identityId: null, vip: form.vip, partySize: 1, checkedOutAt: null, createdAt: Date.now() }
    upsert(guest)
    if (form.now) checkIn(id)
    setError(null)
    onCreated(id)
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={520}
      title="New guest"
      description="Assign a room and stay. Link the guest’s Optic identity next."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} data-testid="create-guest">
            Create stay
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Guest name">
            <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Emma Johnson" data-testid="guest-name" />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="emma@example.com" />
          </Field>
        </div>
        <Field label="Room" hint={`${vacant.length} vacant rooms`}>
          <Select value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}>
            {vacant.map((r) => (
              <option key={r.number} value={r.number}>
                {r.number} · {r.type}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in">
            <Input type="datetime-local" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
          </Field>
          <Field label="Check-out">
            <Input type="datetime-local" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
          <span className="text-[13px] text-ink">Check in now</span>
          <Toggle checked={form.now} onChange={(now) => setForm({ ...form, now })} label="Check in now" />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
          <span className="text-[13px] text-ink">VIP · Club Lounge access</span>
          <Toggle checked={form.vip} onChange={(vip) => setForm({ ...form, vip })} label="VIP" />
        </div>
        {error && <div className="text-[13px] text-bad">{error}</div>}
      </div>
    </Modal>
  )
}

export function RoomsPage() {
  const rooms = useStore((s) => s.hotel.rooms)
  const unlocked = useStore((s) => s.unlocked)
  const current = useCurrentGuest()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<RoomStatus | ''>('')
  const selected = rooms.find((r) => r.number === params.get('open')) ?? null
  const counts = Object.fromEntries((Object.keys(ROOM_STATUS) as RoomStatus[]).map((k) => [k, rooms.filter((r) => r.status === k).length]))

  return (
    <>
      <PageHeader title="Rooms" description="Floor 8 · every room lock is an Optic terminal." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip active={filter === ''} onClick={() => setFilter('')} label="All" count={rooms.length} />
        {(Object.keys(ROOM_STATUS) as RoomStatus[]).map((k) => (
          <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)} label={ROOM_STATUS[k].label} count={counts[k]} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {rooms.filter((r) => !filter || r.status === filter).map((room) => {
          const guest = current(room.number)
          const st = ROOM_STATUS[room.status]
          const open = (unlocked[`room-${room.number}`] ?? 0) > Date.now()
          return (
            <button
              key={room.number}
              onClick={() => setParams({ open: room.number })}
              className={cx('flex min-h-[132px] flex-col rounded-xl border p-3.5 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]', st.cls)}
              data-testid={`room-${room.number}`}
            >
              <div className="flex items-start justify-between">
                <span className="text-[20px] font-semibold tracking-tight text-ink tabular">{room.number}</span>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              <div className="text-[11.5px] text-muted">{room.type}</div>
              <div className="mt-auto pt-3">
                {room.status === 'occupied' && guest ? (
                  <>
                    <div className="truncate text-[13px] font-medium text-ink">{guest.name}</div>
                    <div className="flex items-center justify-between text-[11.5px] text-muted">
                      <span>Out {formatDate(guest.checkOut)}</span>
                      <span className={cx('flex items-center gap-1', guest.identityId ? 'text-ok' : 'text-warn')}>
                        <KeyRound className="size-3" /> {open ? 'Unlocked' : guest.identityId ? 'Optic' : 'No ID'}
                      </span>
                    </div>
                  </>
                ) : guest?.status === 'reserved' ? (
                  <div className="text-[12px] text-muted">Arriving · {guest.name.split(' ')[0]}</div>
                ) : (
                  <div className="text-[12px] text-subtle">{room.lastAccess ? `Last entry ${timeAgo(room.lastAccess.at)}` : '—'}</div>
                )}
              </div>
            </button>
          )
        })}
      </div>
      <Drawer open={!!selected} onClose={() => setParams({})}>
        {selected && <RoomDetail room={selected} />}
      </Drawer>
    </>
  )
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium transition',
        active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-muted hover:text-ink',
      )}
    >
      {label} <span className={cx('tabular', active ? 'text-bg/70' : 'text-subtle')}>{count}</span>
    </button>
  )
}

function RoomDetail({ room }: { room: Room }) {
  const current = useCurrentGuest()
  const setRoom = useStore((s) => s.setRoom)
  const events = useSiteEvents('hotel')
  const unlocked = useStore((s) => (s.unlocked[`room-${room.number}`] ?? 0) > Date.now())
  const guest = current(room.number)
  const history = events.filter((e) => e.resourceId === `room-${room.number}`).slice(0, 8)

  if (guest)
    return (
      <div className="flex h-full flex-col">
        <RoomHeader room={room} unlocked={unlocked} />
        <div className="min-h-0 flex-1">
          <GuestDetail guest={guest} />
        </div>
      </div>
    )

  return (
    <div className="flex h-full flex-col">
      <RoomHeader room={room} unlocked={unlocked} />
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <EmptyState icon={<BedDouble className="size-5" />} title="No guest assigned" description="This room is not linked to any stay, so no Optic identity can open it." className="py-8" />
        <section>
          <SectionLabel className="mb-2">Room status</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {(['vacant', 'cleaning', 'maintenance'] as RoomStatus[]).map((s) => (
              <FilterChip key={s} active={room.status === s} onClick={() => setRoom(room.number, { status: s })} label={ROOM_STATUS[s].label} count={0} />
            ))}
          </div>
        </section>
        <section>
          <SectionLabel className="mb-2">Access history</SectionLabel>
          {history.length === 0 ? <div className="text-[13px] text-muted">No entries.</div> : (
            <ul className="space-y-1.5">
              {history.map((e) => (
                <li key={e.id} className="flex items-center justify-between text-[13px]">
                  <span className="text-ink">{e.subjectName}</span>
                  <span className="flex items-center gap-2"><OutcomeBadge outcome={e.outcome} /><span className="w-[70px] text-right text-[12px] text-subtle">{timeAgo(e.at)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function RoomHeader({ room, unlocked }: { room: Room; unlocked: boolean }) {
  const setRoom = useStore((s) => s.setRoom)
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/50 px-6 py-3">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="font-semibold text-ink">Room {room.number}</span>
        <Badge tone={ROOM_STATUS[room.status].tone}>{ROOM_STATUS[room.status].label}</Badge>
        {room.mode === 'lockdown' ? <Badge tone="warn">Lockdown</Badge> : unlocked ? <Badge tone="ok">Unlocked</Badge> : <Badge>Locked</Badge>}
      </div>
      <div className="flex items-center gap-2 text-[12px] text-muted">
        Lockdown
        <Toggle checked={room.mode === 'lockdown'} onChange={(v) => setRoom(room.number, { mode: v ? 'lockdown' : 'normal' })} label="Lockdown" />
      </div>
    </div>
  )
}

export function FrontDeskPage() {
  const guests = useStore((s) => s.hotel.guests)
  const checkIn = useStore((s) => s.checkIn)
  const [params, setParams] = useSearchParams()
  const selected = guests.find((g) => g.id === params.get('open')) ?? null
  const now = clock.now()
  const arrivals = guests.filter((g) => g.status === 'reserved')
  const departures = guests.filter((g) => g.status === 'checked-in' && (isSameDay(g.checkOut, now) || g.checkOut < now || g.checkOut - now < 86_400_000 * 1.2))
  const inHouse = guests.filter((g) => g.status === 'checked-in')

  return (
    <>
      <PageHeader title="Front desk" description="Check guests in, link their Optic identity, and check them out. No key cards to encode or collect." />
      <div className="grid gap-4 lg:grid-cols-3">
        <GuestColumn
          onOpen={(id) => setParams({ open: id })}
          title="Arrivals"
          icon={<LogIn className="size-4 text-subtle" />}
          list={arrivals}
          action={(g) => <Button size="sm" variant="primary" onClick={() => checkIn(g.id)}>Check in</Button>}
        />
        <GuestColumn
          onOpen={(id) => setParams({ open: id })}
          title="Departing soon"
          icon={<LogOut className="size-4 text-subtle" />}
          list={departures}
          action={(g) => <Button size="sm" onClick={() => setParams({ open: g.id })}>Check out</Button>}
        />
        <GuestColumn
          onOpen={(id) => setParams({ open: id })}
          title="In house"
          icon={<CalendarCheck2 className="size-4 text-subtle" />}
          list={inHouse}
          action={(g) => (g.identityId ? <Badge tone="ok" dot>Optic</Badge> : <Badge tone="warn" dot>No ID</Badge>)}
        />
      </div>
      <Drawer open={!!selected} onClose={() => setParams({})}>
        {selected && <GuestDetail guest={selected} />}
      </Drawer>
    </>
  )
}

function GuestColumn({
  title,
  icon,
  list,
  action,
  onOpen,
}: {
  title: string
  icon: React.ReactNode
  list: Guest[]
  action?: (g: Guest) => React.ReactNode
  onOpen: (id: string) => void
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title={<span className="flex items-center gap-2">{icon}{title}</span>} description={`${list.length} guests`} />
      <ul className="divide-y divide-line border-t border-line">
        {list.length === 0 && <li className="px-5 py-6 text-center text-[13px] text-muted">Nothing here.</li>}
        {list.map((g) => (
          <li key={g.id} className="flex items-center gap-3 px-5 py-3">
            <Avatar name={g.name} size={30} />
            <button onClick={() => onOpen(g.id)} className="min-w-0 flex-1 text-left">
              <div className="truncate text-[13.5px] font-medium text-ink hover:underline">{g.name}</div>
              <div className="text-[12px] text-muted">Room {g.roomNumber} · {stayRange(g)}</div>
            </button>
            {action?.(g)}
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function HousekeepingPage() {
  const rooms = useStore((s) => s.hotel.rooms)
  const setRoom = useStore((s) => s.setRoom)
  const queue = rooms.filter((r) => r.status === 'cleaning')
  const maintenance = rooms.filter((r) => r.status === 'maintenance')
  return (
    <>
      <PageHeader title="Housekeeping" description="Rooms return to inventory once they are cleaned." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Cleaning queue" description={`${queue.length} rooms`} />
          <ul className="divide-y divide-line border-t border-line">
            {queue.length === 0 && <EmptyState icon={<Sparkles className="size-5" />} title="All clean" description="Nothing in the queue." />}
            {queue.map((r) => (
              <li key={r.number} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-[14px] font-semibold text-ink">Room {r.number}</div>
                  <div className="text-[12px] text-muted">{r.type}</div>
                </div>
                <Button size="sm" icon={<Sparkles className="size-3.5" />} onClick={() => setRoom(r.number, { status: 'vacant' })}>
                  Mark clean
                </Button>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="Maintenance" description={`${maintenance.length} rooms out of order`} />
          <ul className="divide-y divide-line border-t border-line">
            {maintenance.length === 0 && <li className="px-5 py-6 text-center text-[13px] text-muted">No rooms out of order.</li>}
            {maintenance.map((r) => (
              <li key={r.number} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-ink"><Wrench className="size-4 text-subtle" /> Room {r.number}</div>
                <Button size="sm" onClick={() => setRoom(r.number, { status: 'vacant' })}>Return to service</Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

export function HotelAccessPage() {
  const amenities = useStore((s) => s.hotel.amenities)
  return (
    <>
      <PageHeader title="Access" description="Guest access is derived from the stay — nothing to encode, nothing to collect at check-out." />
      <Card className="p-6">
        <div className="text-[13px] font-semibold text-ink">Guest access policy</div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
          {['Verified identity', 'Guest', 'Assigned room', 'Current stay', 'Not expired', 'Door opens'].map((s, i, a) => (
            <span key={s} className="flex items-center gap-2">
              <span className={cx('rounded-lg border px-3 py-1.5 font-medium', i === a.length - 1 ? 'border-ok/30 bg-ok-soft text-ok' : 'border-line bg-surface-2 text-ink')}>{s}</span>
              {i < a.length - 1 && <span className="text-subtle">→</span>}
            </span>
          ))}
        </div>
        <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-muted">
          The same Optic engine used at Meridian HQ evaluates every room. Checking a guest out ends the stay, so the next
          attempt is denied immediately — even though the guest’s identity is still recognized.
        </p>
      </Card>
      <h2 className="mt-8 mb-3 text-[15px] font-semibold text-ink">Amenities</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {amenities.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[14.5px] font-semibold text-ink">{a.name}</span>
              {a.vipOnly ? <Badge tone="accent"><Crown className="size-3" /> VIP</Badge> : <Badge>All guests</Badge>}
            </div>
            <div className="mt-2 text-[13px] text-muted">{describeSchedule(a.schedule)}</div>
            <Link to={`/terminal/hotel/${a.id}`} className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent-text hover:underline">
              Open terminal <ArrowUpRight className="size-3.5" />
            </Link>
          </Card>
        ))}
      </div>
    </>
  )
}
