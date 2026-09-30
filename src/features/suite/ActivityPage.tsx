import { ListChecks } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatDateTime } from '../../ui/format'
import { Badge, Card, cx, EmptyState } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'
import { SUITE_APPS } from './apps'
import { useSuite, type AppId } from './store'

export function SuiteActivity() {
  const events = useSuite((s) => s.events)
  const [app, setApp] = useState<AppId | 'all' | 'approve'>('all')
  const rows = useMemo(() => events.filter((e) => app === 'all' || (app === 'approve' ? e.action === 'approve' : e.app === app)), [events, app])
  const filters: { id: AppId | 'all' | 'approve'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'approve', label: 'Glance approvals' },
    ...SUITE_APPS.map((a) => ({ id: a.id, label: a.name })),
  ]
  return (
    <>
      <PageHeader title="Activity" description="Every sign-in, glance approval, lock, view and check-in across Optic Apps. Never any biometric data." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setApp(f.id)}
            className={cx('h-8 rounded-lg border px-3 text-[12.5px] font-medium', app === f.id ? 'border-accent/50 bg-accent-soft text-accent-text shadow-[var(--glow)]' : 'border-line bg-surface text-muted hover:text-ink')}
          >
            {f.label}
          </button>
        ))}
      </div>
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={<ListChecks className="size-5" />} title="No activity" description="Use an app and it will be recorded here." />
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface-2/60 text-[12px] text-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">Time</th>
                <th className="px-3 py-2.5 font-medium">App</th>
                <th className="px-3 py-2.5 font-medium">Person</th>
                <th className="px-3 py-2.5 font-medium">What</th>
                <th className="px-5 py-2.5 text-right font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.slice(0, 200).map((e) => (
                <tr key={e.id}>
                  <td className="px-5 py-2.5 whitespace-nowrap text-muted tabular">{formatDateTime(e.at)}</td>
                  <td className="px-3 py-2.5 text-ink capitalize">{e.action === 'approve' ? `${e.app} · approve` : e.app}</td>
                  <td className="px-3 py-2.5 font-medium text-ink">{e.name}</td>
                  <td className="px-3 py-2.5 text-muted">{e.detail}</td>
                  <td className="px-5 py-2.5 text-right">
                    <Badge tone={e.ok ? 'ok' : 'bad'}>{e.ok ? 'OK' : 'Blocked'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}
