import { AlertTriangle, ListChecks, ShieldAlert, ShieldCheck, Trash2, UserX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatDateTime, timeAgo } from '../../ui/format'
import { Badge, Button, Card, CardHeader, EmptyState } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'
import { clearBreakins, listBreakins, type Breakin } from './breakins'
import { useSuite } from './store'

/** Break-in log + stranger alerts: who was seen at your screen, and every refused attempt. */
export function SecurityApp() {
  const [breakins, setBreakins] = useState<Breakin[] | null>(null)
  const events = useSuite((s) => s.events)
  const refresh = () => listBreakins().then(setBreakins)
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [])

  // Security-relevant entries from the activity log: anything refused/locked.
  const refused = events.filter((e) => !e.ok || e.action === 'lock' || /lock|stranger|refus|denied|hidden/i.test(e.detail)).slice(0, 60)
  const strangers = breakins ?? []

  return (
    <>
      <PageHeader
        title="Optic Security"
        description="Optic watches who is actually at your screen. If it isn't you, it locks — and logs it here, with a snapshot."
        actions={
          strangers.length > 0 && (
            <Button
              variant="danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                await clearBreakins()
                refresh()
              }}
              data-testid="security-clear"
            >
              Clear log
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Stranger sightings" value={strangers.length} tone={strangers.length ? 'bad' : 'ok'} icon={<UserX className="size-4" />} />
        <Stat label="Refused attempts" value={refused.filter((e) => !e.ok).length} icon={<ShieldAlert className="size-4" />} />
        <Stat label="Protection" value="On" tone="ok" icon={<ShieldCheck className="size-4" />} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card data-testid="security-breakins">
          <CardHeader title="Stranger alerts" description="Someone who isn't you was seen while you were signed in." />
          {strangers.length === 0 ? (
            <EmptyState icon={<ShieldCheck className="size-5" />} title="All clear" description="No strangers have been caught at your screen." />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {strangers.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-5 py-3" data-testid="breakin">
                  {b.snapshot ? (
                    <img src={b.snapshot} alt="" className="size-14 shrink-0 rounded-lg object-cover ring-1 ring-bad/30" />
                  ) : (
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-bad-soft text-bad">
                      <UserX className="size-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                      Unknown person <Badge tone="bad">stranger</Badge>
                    </div>
                    <div className="text-[12.5px] text-muted">
                      at <span className="font-mono">{b.app}</span> · {formatDateTime(b.at)}
                    </div>
                  </div>
                  <span className="shrink-0 text-[12px] text-subtle tabular">{timeAgo(b.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Refused & locked" description="Every denied glance, lock and hidden view across your apps." />
          {refused.length === 0 ? (
            <EmptyState icon={<ListChecks className="size-5" />} title="Nothing refused" description="Denied attempts will appear here." />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {refused.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-2.5">
                  <AlertTriangle className={e.ok ? 'size-4 shrink-0 text-warn' : 'size-4 shrink-0 text-bad'} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] text-ink">{e.detail}</div>
                    <div className="truncate text-[12px] text-subtle">
                      {e.app} · {e.name}
                    </div>
                  </div>
                  <span className="shrink-0 text-[12px] text-subtle tabular">{timeAgo(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

function Stat({ label, value, tone, icon }: { label: string; value: number | string; tone?: 'ok' | 'bad'; icon: React.ReactNode }) {
  return (
    <Card className="hairline px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10.5px] tracking-[0.16em] text-subtle uppercase">{label}</span>
        <span className={tone === 'bad' ? 'text-bad' : tone === 'ok' ? 'text-ok' : 'text-accent'}>{icon}</span>
      </div>
      <div className={`mt-2 font-mono text-[28px] font-medium tracking-tight tabular ${tone === 'bad' ? 'text-bad' : 'text-ink'}`}>{value}</div>
    </Card>
  )
}
