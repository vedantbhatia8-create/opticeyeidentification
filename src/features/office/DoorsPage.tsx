import { ArrowUpRight, DoorClosed, LockOpen, ShieldAlert, WifiOff } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authorize, describeSchedule } from '../../core/authorization/engine'
import { clock } from '../../core/access/clock'
import { doorResource, employeePrincipal, type Door } from '../../domains/office/model'
import { useStore } from '../../state/store'
import { timeAgo } from '../../ui/format'
import { Drawer } from '../../ui/overlay'
import { Avatar, Badge, buttonClass, Card, SectionLabel, Toggle } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'
import { OutcomeBadge } from '../shell/OutcomeBadge'
import { useSiteEvents } from '../shell/console'

export function useDoorAccessList(door: Door | null) {
  const office = useStore((s) => s.office)
  return useMemo(() => {
    if (!door) return []
    return office.employees
      .map((e) => ({ employee: e, principal: employeePrincipal(office, e) }))
      .filter(({ principal }) => principal.grants.some((g) => g.resourceId === door.id))
  }, [office, door])
}

export function DoorsPage() {
  const office = useStore((s) => s.office)
  const unlocked = useStore((s) => s.unlocked)
  const [params, setParams] = useSearchParams()
  const selected = office.doors.find((d) => d.id === params.get('open')) ?? null

  return (
    <>
      <PageHeader title="Doors" description="Every door is protected by an Optic terminal. Click a door to manage who can open it." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {office.doors.map((door) => (
          <DoorCard key={door.id} door={door} open={(unlocked[door.id] ?? 0) > Date.now()} onClick={() => setParams({ open: door.id })} />
        ))}
      </div>
      <Drawer open={!!selected} onClose={() => setParams({})}>
        {selected && <DoorDetail door={selected} />}
      </Drawer>
    </>
  )
}

function DoorCard({ door, open, onClick }: { door: Door; open: boolean; onClick: () => void }) {
  const people = useDoorAccessList(door)
  return (
    <Card className="group cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]" onClick={onClick} data-testid="door-card">
      <div className="flex items-start justify-between">
        <div className="flex size-10 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted">
          {open ? <LockOpen className="size-[18px] text-ok" /> : <DoorClosed className="size-[18px]" />}
        </div>
        <div className="flex gap-1.5">
          {door.online ? (
            <Badge tone="ok" dot>Online</Badge>
          ) : (
            <Badge tone="bad" dot>Offline</Badge>
          )}
          {door.mode === 'lockdown' ? <Badge tone="warn">Lockdown</Badge> : open ? <Badge tone="ok">Unlocked</Badge> : <Badge>Locked</Badge>}
        </div>
      </div>
      <div className="mt-4 text-[15px] font-semibold tracking-tight text-ink">{door.name}</div>
      <div className="text-[12.5px] text-muted">{door.zone}</div>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[12.5px]">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {people.slice(0, 4).map(({ employee }) => (
              <Avatar key={employee.id} name={employee.name} size={22} className="ring-2 ring-surface" />
            ))}
          </div>
          <span className="text-muted">{people.length} with access</span>
        </div>
        <span className="text-subtle">{door.lastAccess ? `${door.lastAccess.name.split(' ')[0]} · ${timeAgo(door.lastAccess.at)}` : 'No access yet'}</span>
      </div>
    </Card>
  )
}

function DoorDetail({ door }: { door: Door }) {
  const office = useStore((s) => s.office)
  const setDoor = useStore((s) => s.setDoor)
  const people = useDoorAccessList(door)
  const events = useSiteEvents('office')
  const doorEvents = useMemo(() => events.filter((e) => e.resourceId === door.id).slice(0, 8), [events, door.id])
  const rules = office.rules.filter((r) => r.doorIds.includes(door.id))
  const now = clock.now()

  return (
    <div className="flex h-full flex-col" data-testid="door-detail">
      <div className="border-b border-line px-6 pt-6 pb-5">
        <div className="text-[18px] font-semibold tracking-tight text-ink">{door.name}</div>
        <div className="text-[13px] text-muted">
          {door.zone} · Terminal {door.device.serial}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to={`/terminal/office/${door.id}`} className={buttonClass('primary', 'sm')} data-testid="door-terminal">
            Open terminal <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <section className="space-y-3">
          <SectionLabel>Door controls</SectionLabel>
          <ControlRow
            icon={<ShieldAlert className="size-4" />}
            title="Lockdown"
            body="Deny every attempt, even for authorized people."
            checked={door.mode === 'lockdown'}
            onChange={(v) => setDoor(door.id, { mode: v ? 'lockdown' : 'normal' })}
          />
          <ControlRow
            icon={<WifiOff className="size-4" />}
            title="Controller online"
            body="Simulate a network outage at this door."
            checked={door.online}
            onChange={(v) => setDoor(door.id, { online: v })}
          />
        </section>

        <section>
          <SectionLabel className="mb-2">Rules granting access</SectionLabel>
          <div className="space-y-1.5">
            {rules.length === 0 && <div className="text-[13px] text-muted">No rules include this door.</div>}
            {rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[13px]">
                <span className="font-medium text-ink">{office.groups.find((g) => g.id === r.groupId)?.name}</span>
                <span className="text-muted">{describeSchedule(r.schedule)}</span>
              </div>
            ))}
            <Link to="/office/access" className="inline-block pt-1 text-[12.5px] font-medium text-accent-text hover:underline">
              Edit access rules →
            </Link>
          </div>
        </section>

        <section>
          <SectionLabel className="mb-2">People with access · {people.length}</SectionLabel>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {people.map(({ employee, principal }) => {
              const result = authorize(principal, doorResource(door), now)
              return (
                <li key={employee.id} className="flex items-center gap-3 px-3 py-2">
                  <Avatar name={employee.name} size={26} />
                  <Link to={`/office/people?open=${employee.id}`} className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink hover:underline">
                    {employee.name}
                  </Link>
                  {result.allowed ? (
                    <Badge tone="ok">Allowed now</Badge>
                  ) : (
                    <Badge tone={result.code === 'outside-schedule' ? 'neutral' : 'warn'}>
                      {result.code === 'outside-schedule' ? 'Outside hours' : result.code === 'principal-suspended' ? 'Suspended' : 'Blocked'}
                    </Badge>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        <section>
          <SectionLabel className="mb-2">Recent attempts</SectionLabel>
          <ul className="space-y-1.5">
            {doorEvents.length === 0 && <li className="text-[13px] text-muted">No attempts yet.</li>}
            {doorEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate text-ink">{e.subjectName}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <OutcomeBadge outcome={e.outcome} />
                  <span className="w-[70px] text-right text-[12px] text-subtle">{timeAgo(e.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

function ControlRow({
  icon,
  title,
  body,
  checked,
  onChange,
}: {
  icon: React.ReactNode
  title: string
  body: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
      <span className="text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium text-ink">{title}</div>
        <div className="text-[12px] text-muted">{body}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  )
}

