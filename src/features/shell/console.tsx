import { AnimatePresence, motion } from 'framer-motion'
import { Activity, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AccessEvent, SiteId } from '../../core/access/types'
import { useStore } from '../../state/store'
import { formatDateTime, formatTime, isSameDay, timeAgo } from '../../ui/format'
import { Avatar, Card, CardHeader, cx, EmptyState, Input, Select } from '../../ui/primitives'
import { OutcomeBadge } from './OutcomeBadge'

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: 'bad'
}) {
  return (
    <Card className="hairline px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10.5px] tracking-[0.16em] text-subtle uppercase">{label}</span>
        {icon && <span className={cx('flex size-7 items-center justify-center rounded-lg', tone === 'bad' ? 'bg-bad-soft text-bad' : 'bg-accent-soft text-accent')}>{icon}</span>}
      </div>
      <div className={cx('mt-3 font-mono text-[30px] leading-none font-medium tracking-tight tabular', tone === 'bad' ? 'text-bad' : 'text-ink')}>
        {value}
      </div>
      {hint && <div className="mt-2 text-[12px] text-subtle">{hint}</div>}
    </Card>
  )
}

/** Wall-clock "now" that ticks, so seeded history streams in as time passes. */
export function useNow(intervalMs = 20_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function useSiteEvents(site: SiteId) {
  const events = useStore((s) => s.events)
  const now = useNow()
  // Events just appended by a terminal can be a few ms "ahead" of the ticking clock.
  return useMemo(() => events.filter((e) => e.site === site && e.at <= Math.max(now, Date.now())), [events, site, now])
}

export function useTodayEvents(site: SiteId) {
  const events = useSiteEvents(site)
  return useMemo(() => {
    const now = Date.now()
    return events.filter((e) => isSameDay(e.at, now))
  }, [events])
}

/** Live activity feed: newest first, animated insertions. */
export function ActivityFeed({ events, limit = 9, title = 'Live activity' }: { events: AccessEvent[]; limit?: number; title?: string }) {
  const shown = events.slice(0, limit)
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {title}
            <span className="live-dot size-1.5 rounded-full bg-ok text-ok" />
          </span>
        }
        description="Every attempt is logged — granted or not"
      />
      {shown.length === 0 ? (
        <EmptyState icon={<Activity className="size-5" />} title="No activity yet" description="Access attempts will stream in here." />
      ) : (
        <ul className="border-t border-line" data-testid="activity-feed">
          <AnimatePresence initial={false}>
            {shown.map((e) => (
              <motion.li
                key={e.id}
                layout
                initial={{ opacity: 0, backgroundColor: 'var(--accent-soft)' }}
                animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)' }}
                transition={{ duration: 1.2 }}
                className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0"
              >
                <Avatar name={e.subjectName === 'Unknown person' ? '?' : e.subjectName} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] text-ink">
                    <span className="font-medium">{e.subjectName}</span>
                    <span className="text-subtle"> — </span>
                    <span className="text-muted">{e.resourceName}</span>
                  </div>
                  {e.outcome !== 'granted' && <div className="truncate text-[12px] text-subtle">{humanReason(e)}</div>}
                </div>
                <OutcomeBadge outcome={e.outcome} />
                <span className="w-[74px] shrink-0 text-right text-[12px] text-subtle tabular">{timeAgo(e.at)}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  )
}

export function humanReason(e: AccessEvent): string {
  switch (e.code) {
    case 'not-recognized':
      return 'Identity not recognized'
    case 'capture-failed':
      return 'Could not capture a clear scan'
    case 'no-grant':
      return 'Verified · no permission for this door'
    case 'outside-schedule':
      return 'Verified · outside permitted hours'
    case 'window-expired':
      return e.principalKind === 'visitor' ? 'Verified · visitor access expired' : 'Verified · access expired'
    case 'window-not-started':
      return 'Verified · access not yet active'
    case 'principal-ended':
      return 'Verified · stay has ended'
    case 'principal-pending':
      return 'Verified · not checked in yet'
    case 'principal-suspended':
      return 'Verified · access suspended'
    case 'no-principal':
      return 'Verified · not registered at this site'
    case 'resource-lockdown':
      return 'Door in lockdown'
    case 'resource-offline':
      return 'Door offline'
    default:
      return e.detail
  }
}

/** Events per hour for today — single series, hover for exact counts. */
export function HourlyChart({ events }: { events: AccessEvent[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const hours = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ h, total: 0, denied: 0 }))
    for (const e of events) {
      const b = buckets[new Date(e.at).getHours()]
      b.total++
      if (e.outcome !== 'granted') b.denied++
    }
    return buckets.slice(5, 24)
  }, [events])
  const max = Math.max(4, ...hours.map((b) => b.total))
  const nowHour = new Date().getHours()
  const label = (h: number) => (h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`)
  return (
    <Card>
      <CardHeader title="Access events today" description="By hour · hover a bar for detail" />
      <div className="relative px-5 pb-4">
        <div className="relative flex h-[150px] items-end gap-[2px] border-b border-line">
          {[0.5, 1].map((f) => (
            <div key={f} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${f * 100}%` }} />
          ))}
          {hours.map((b) => (
            <div
              key={b.h}
              className="relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHover(b.h)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className={cx('w-full rounded-t-[4px] transition-[height,opacity] duration-500', b.h > nowHour ? 'bg-line' : 'bg-gradient-to-t from-accent/35 to-accent shadow-[0_0_12px_-3px_var(--accent)]')}
                style={{ height: `${Math.max(b.total ? 3 : 0, (b.total / max) * 100)}%`, opacity: hover === null || hover === b.h ? 1 : 0.45 }}
              />
              {hover === b.h && (
                <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] whitespace-nowrap shadow-[var(--shadow-float)]">
                  <div className="font-medium text-ink">
                    {formatTime(new Date().setHours(b.h, 0, 0, 0))}
                  </div>
                  <div className="text-muted tabular">
                    {b.total} events · {b.denied} not granted
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-[2px]">
          {hours.map((b) => (
            <div key={b.h} className="flex-1 text-center text-[10.5px] text-subtle tabular">
              {b.h % 3 === 0 ? label(b.h) : ''}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

/** Full, filterable audit log. */
export function ActivityTable({ site, resources }: { site: SiteId; resources: { id: string; name: string }[] }) {
  const events = useSiteEvents(site)
  const [q, setQ] = useState('')
  const [outcome, setOutcome] = useState('')
  const [resource, setResource] = useState('')
  const filtered = events.filter(
    (e) =>
      (!q || e.subjectName.toLowerCase().includes(q.toLowerCase())) &&
      (!outcome || (outcome === 'denied' ? e.outcome !== 'granted' : e.outcome === outcome)) &&
      (!resource || e.resourceId === resource),
  )
  const exportCsv = () => {
    const rows = [['time', 'person', 'location', 'outcome', 'reason', 'confidence', 'sensor', 'demo']]
    for (const e of filtered)
      rows.push([new Date(e.at).toISOString(), e.subjectName, e.resourceName, e.outcome, e.code, e.confidence?.toFixed(3) ?? '', e.sensorKind, String(e.demo)])
    const blob = new Blob([rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `optic-access-${site}-activity.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="pl-9" />
        </div>
        <Select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="w-auto">
          <option value="">All outcomes</option>
          <option value="granted">Granted</option>
          <option value="denied">Not granted</option>
          <option value="denied-unrecognized">Unrecognized</option>
          <option value="denied-unauthorized">Verified · denied</option>
        </Select>
        <Select value={resource} onChange={(e) => setResource(e.target.value)} className="w-auto max-w-[200px]">
          <option value="">All locations</option>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <button onClick={exportCsv} className="h-9 rounded-lg px-3 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-ink">
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead className="bg-surface-2/60 text-[12px] text-muted">
            <tr>
              <th className="px-5 py-2.5 font-medium">Time</th>
              <th className="px-3 py-2.5 font-medium">Person</th>
              <th className="px-3 py-2.5 font-medium">Location</th>
              <th className="px-3 py-2.5 font-medium">Outcome</th>
              <th className="px-3 py-2.5 font-medium">Reason</th>
              <th className="px-5 py-2.5 text-right font-medium">Match</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.slice(0, 200).map((e) => (
              <tr key={e.id} className="hover:bg-surface-2/50">
                <td className="px-5 py-2.5 whitespace-nowrap text-muted tabular">{formatDateTime(e.at)}</td>
                <td className="px-3 py-2.5 font-medium text-ink">
                  {e.subjectName}
                  {e.demo && <span className="ml-1.5 text-[11px] font-normal text-warn">demo</span>}
                </td>
                <td className="px-3 py-2.5 text-muted">{e.resourceName}</td>
                <td className="px-3 py-2.5">
                  <OutcomeBadge outcome={e.outcome} />
                </td>
                <td className="px-3 py-2.5 text-muted">{e.outcome === 'granted' ? '—' : humanReason(e)}</td>
                <td className="px-5 py-2.5 text-right text-muted tabular">{e.confidence !== null ? `${Math.round(e.confidence * 100)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState icon={<Search className="size-5" />} title="No matching events" description="Try a different filter." />}
      </div>
    </Card>
  )
}
