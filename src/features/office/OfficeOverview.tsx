import { ArrowUpRight, DoorClosed, ShieldX, Users, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { visitorStatus } from '../../domains/office/model'
import { clock } from '../../core/access/clock'
import { useStore } from '../../state/store'
import { formatTime, timeAgo } from '../../ui/format'
import { Badge, buttonClass, Card, CardHeader, StatusDot } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'
import { ActivityFeed, HourlyChart, StatCard, useSiteEvents, useTodayEvents } from '../shell/console'

export function OfficeOverview() {
  const office = useStore((s) => s.office)
  const unlocked = useStore((s) => s.unlocked)
  const events = useSiteEvents('office')
  const today = useTodayEvents('office')
  const denied = today.filter((e) => e.outcome !== 'granted').length
  const active = office.employees.filter((e) => e.status === 'active')
  const enrolled = active.filter((e) => e.identityId).length
  const now = clock.now()
  const visitorsToday = office.visitors.filter((v) => ['active', 'scheduled'].includes(visitorStatus(v, now)) && v.start - now < 86_400_000)

  return (
    <>
      <PageHeader
        title="Overview"
        description={office.siteName}
        actions={
          <>
            <Link to="/terminal/office/door_main" className={buttonClass('secondary')}>
              Main Entrance terminal <ArrowUpRight className="size-3.5" />
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active employees" value={active.length} hint={`${enrolled} with Optic identity`} icon={<Users className="size-4" />} />
        <StatCard label="Doors" value={office.doors.length} hint={`${office.doors.filter((d) => d.online).length} online`} icon={<DoorClosed className="size-4" />} />
        <StatCard label="Access events today" value={today.length} hint="Granted and denied" icon={<Zap className="size-4" />} />
        <StatCard label="Denied attempts" value={denied} hint={`${today.filter((e) => e.outcome === 'denied-unrecognized').length} unrecognized`} icon={<ShieldX className="size-4" />} tone={denied ? 'bad' : undefined} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4">
          <ActivityFeed events={events} limit={10} />
        </div>
        <div className="space-y-4">
          <HourlyChart events={today} />
          <Card>
            <CardHeader
              title="Doors"
              action={
                <Link to="/office/doors" className="text-[12.5px] font-medium text-muted hover:text-ink">
                  Manage
                </Link>
              }
            />
            <ul className="border-t border-line">
              {office.doors.map((d) => {
                const open = (unlocked[d.id] ?? 0) > Date.now()
                return (
                  <li key={d.id} className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0">
                    <StatusDot tone={!d.online ? 'bad' : d.mode === 'lockdown' ? 'warn' : 'ok'} pulse={d.online} />
                    <Link to={`/terminal/office/${d.id}`} className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink hover:underline">
                      {d.name}
                    </Link>
                    {d.mode === 'lockdown' ? <Badge tone="warn">Lockdown</Badge> : open ? <Badge tone="ok">Unlocked</Badge> : <Badge>Locked</Badge>}
                    <span className="w-[70px] text-right text-[12px] text-subtle">{d.lastAccess ? timeAgo(d.lastAccess.at) : '—'}</span>
                  </li>
                )
              })}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Visitors today" action={<Link to="/office/visitors" className="text-[12.5px] font-medium text-muted hover:text-ink">All visitors</Link>} />
            <ul className="border-t border-line">
              {visitorsToday.length === 0 && <li className="px-5 py-4 text-[13px] text-muted">No visitors expected.</li>}
              {visitorsToday.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 border-b border-line px-5 py-2.5 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium text-ink">{v.name}</div>
                    <div className="text-[12px] text-muted">
                      {v.company} · {formatTime(v.start)}–{formatTime(v.end)}
                    </div>
                  </div>
                  <Badge tone={visitorStatus(v, now) === 'active' ? 'ok' : 'neutral'}>{visitorStatus(v, now) === 'active' ? 'On site window' : 'Scheduled'}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}
