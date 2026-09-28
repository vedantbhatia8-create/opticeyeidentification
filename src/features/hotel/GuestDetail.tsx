import { ArrowUpRight, CalendarRange, Crown, LogIn, LogOut, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { clock } from '../../core/access/clock'
import type { Guest } from '../../domains/hotel/model'
import { useStore } from '../../state/store'
import { formatDate, formatDateTime, timeAgo } from '../../ui/format'
import { Modal } from '../../ui/overlay'
import { Avatar, Badge, Button, buttonClass, SectionLabel, type Tone } from '../../ui/primitives'
import { OpticIdentityCard } from '../shell/OpticIdentityCard'
import { OutcomeBadge } from '../shell/OutcomeBadge'
import { useSiteEvents } from '../shell/console'

export const GUEST_STATUS: Record<Guest['status'], { label: string; tone: Tone }> = {
  reserved: { label: 'Reserved', tone: 'neutral' },
  'checked-in': { label: 'Checked in', tone: 'ok' },
  'checked-out': { label: 'Checked out', tone: 'bad' },
}

export function stayRange(g: Guest) {
  return `${formatDate(g.checkIn)} – ${formatDate(g.checkOut)}`
}

export function GuestDetail({ guest }: { guest: Guest }) {
  const upsert = useStore((s) => s.upsertGuest)
  const checkIn = useStore((s) => s.checkIn)
  const checkOut = useStore((s) => s.checkOut)
  const events = useSiteEvents('hotel')
  const [confirm, setConfirm] = useState(false)
  const history = useMemo(
    () => events.filter((e) => guest.identityId && e.identityId === guest.identityId).slice(0, 8),
    [events, guest.identityId],
  )
  const st = GUEST_STATUS[guest.status]

  return (
    <div className="flex h-full flex-col" data-testid="guest-detail">
      <div className="border-b border-line px-6 pt-6 pb-5">
        <div className="flex items-start gap-4">
          <Avatar name={guest.name} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[18px] font-semibold tracking-tight text-ink">{guest.name}</span>
              <Badge tone={st.tone}>{st.label}</Badge>
              {guest.vip && (
                <Badge tone="accent">
                  <Crown className="size-3" /> VIP
                </Badge>
              )}
            </div>
            <div className="text-[13px] text-muted">{guest.email}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Fact label="Room" value={guest.roomNumber} />
          <Fact label="Stay" value={stayRange(guest)} />
          <Fact label="Guests" value={<span className="inline-flex items-center gap-1"><Users className="size-3.5" />{guest.partySize}</span>} />
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <section>
          <SectionLabel className="mb-2">Stay</SectionLabel>
          <div className="rounded-xl border border-line p-4">
            <div className="flex items-center gap-2 text-[13.5px] text-ink">
              <CalendarRange className="size-4 text-subtle" />
              Check-in {formatDateTime(guest.checkIn)} · Check-out {formatDateTime(guest.checkOut)}
            </div>
            <p className="mt-2 text-[12.5px] text-muted">
              {guest.status === 'checked-in'
                ? `Room ${guest.roomNumber} and amenities open for this guest until check-out.`
                : guest.status === 'reserved'
                  ? 'Access activates at check-in.'
                  : `Checked out ${guest.checkedOutAt ? formatDateTime(guest.checkedOutAt) : ''}. All access revoked.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {guest.status === 'reserved' && (
                <Button size="sm" variant="primary" icon={<LogIn className="size-3.5" />} onClick={() => checkIn(guest.id)} data-testid="check-in">
                  Check in
                </Button>
              )}
              {guest.status === 'checked-in' && (
                <Button size="sm" variant="danger" icon={<LogOut className="size-3.5" />} onClick={() => setConfirm(true)} data-testid="check-out">
                  Check out guest
                </Button>
              )}
              <Link to={`/terminal/hotel/room-${guest.roomNumber}`} className={buttonClass('secondary', 'sm')}>
                Room {guest.roomNumber} terminal <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </section>
        <section>
          <SectionLabel className="mb-2">Optic identity</SectionLabel>
          <OpticIdentityCard
            identityId={guest.identityId}
            forParam={`guest:${guest.id}`}
            onLink={(identityId) => upsert({ ...guest, identityId })}
            enrollLabel="Enroll / Link Optic Identity"
          />
        </section>
        <section>
          <SectionLabel className="mb-2">Access history</SectionLabel>
          {history.length === 0 ? (
            <div className="text-[13px] text-muted">No access attempts yet.</div>
          ) : (
            <ul className="space-y-1.5">
              {history.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-ink">{e.resourceName}</span>
                  <span className="flex items-center gap-2">
                    <OutcomeBadge outcome={e.outcome} />
                    <span className="w-[70px] text-right text-[12px] text-subtle">{timeAgo(e.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Check out ${guest.name}?`}
        description={`Room ${guest.roomNumber} access is revoked immediately. The room moves to housekeeping.`}
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                checkOut(guest.id, clock.now())
                setConfirm(false)
              }}
              data-testid="confirm-check-out"
            >
              Check out & revoke access
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-muted">
          If {guest.name.split(' ')[0]} looks at the sensor afterwards, they will be recognized — and told their stay has ended.
        </p>
      </Modal>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-[13.5px] font-semibold text-ink">{value}</div>
    </div>
  )
}
