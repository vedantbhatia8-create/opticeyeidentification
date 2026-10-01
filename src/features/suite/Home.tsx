import { ArrowRight, Palette } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { isSameDay, timeAgo } from '../../ui/format'
import { Badge, Card, CardHeader, cx, EmptyState } from '../../ui/primitives'
import { inbox } from '../mail/store'
import { useIdentities } from '../sensor/hooks'
import { SUITE_APPS } from './apps'
import { listDocs, type OpticDoc } from './secure'
import { ACCENTS, dayKey, useSession, useSuite } from './store'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function SuiteHome() {
  const session = useSession()
  const suite = useSuite()
  const { identities } = useIdentities()
  const [docs, setDocs] = useState<Omit<OpticDoc, 'sealed'>[]>([])
  const [unreadMail, setUnreadMail] = useState(0)
  const me = session.identityId!
  useEffect(() => {
    listDocs().then(setDocs)
    if (me) inbox(me).then((msgs) => setUnreadMail(msgs.filter((m) => m.readAt === null).length))
  }, [me])
  const prefs = suite.prefs[me]
  const member = suite.family.find((m) => m.identityId === me)
  const accent = prefs?.accent ?? member?.accent ?? ACCENTS[0]
  const theme = prefs?.theme ?? member?.theme ?? 'dark'

  const stats = useMemo(() => {
    const sharedWithMe = docs.filter((d) => d.recipients.includes(me) && d.ownerId !== me && !d.revoked).length
    const todayFocus = suite.focus.filter((f) => f.identityId === me && isSameDay(f.startedAt, Date.now()))
    const focusMin = Math.round(todayFocus.reduce((a, f) => a + f.focusedSec, 0) / 60)
    const kids = suite.family.filter((m) => m.role === 'kid')
    const kidMin = Math.round(kids.reduce((a, k) => a + (suite.usage[dayKey(k.id)] ?? 0), 0) / 60)
    const nextEvent = suite.attendance.filter((e) => e.end > Date.now()).sort((a, b) => a.start - b.start)[0]
    return {
      vault: 'Glance + PIN to open',
      'eyes-only': `${unreadMail} unread · ${sharedWithMe} eyes-only docs shared with you`,
      guard: suite.guard.enabled ? 'On · protecting this session' : 'Off',
      family: `${kids.length} kids · ${kidMin} min screen time today`,
      focus: `${focusMin} focused min today`,
      attendance: nextEvent ? `Next: ${nextEvent.name}` : 'No upcoming events',
    } as Record<string, string>
  }, [docs, suite, me, unreadMail])

  const events = suite.events.slice(0, 8)
  const enrolledCount = identities.filter((i) => i.status === 'active').length

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] tracking-[0.2em] text-accent-text uppercase">Optic Apps</div>
          <h1 className="mt-1 text-[32px] leading-tight font-semibold tracking-[-0.03em] text-ink sm:text-[38px]" data-testid="suite-greeting">
            {greeting()}, {session.name?.split(' ')[0]}.
          </h1>
          <p className="mt-1 text-[14px] text-muted">One enrollment. Every app knows it’s you — and knows when it isn’t.</p>
        </div>
        <Badge tone="accent">{enrolledCount} enrolled {enrolledCount === 1 ? 'identity' : 'identities'} on this device</Badge>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SUITE_APPS.map((app) => (
          <Link
            key={app.id}
            to={app.to}
            data-testid={`tile-${app.id}`}
            className="group rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]"
          >
            <div className="flex items-start justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
                <app.icon className="size-5" />
              </span>
              <ArrowRight className="size-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-ink" />
            </div>
            <div className="mt-4 text-[16px] font-semibold tracking-tight text-ink">Optic {app.name}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{app.tagline}</p>
            <div className="mt-4 border-t border-line pt-3 text-[12px] text-subtle">{stats[app.id]}</div>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Palette className="size-4 text-subtle" /> Your profile
              </span>
            }
            description="Follows you to any Optic screen you sit down at."
          />
          <div className="space-y-4 border-t border-line px-5 py-4">
            <div>
              <div className="mb-2 text-[12.5px] font-medium text-muted">Accent</div>
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => suite.setPrefs(me, { accent: c, theme })}
                    className={cx('size-7 rounded-full ring-offset-2 ring-offset-surface transition', accent === c && 'ring-2 ring-ink')}
                    style={{ background: c }}
                    aria-label={`Accent ${c}`}
                  />
                ))}
              </div>
            </div>
            <p className="text-[12px] text-subtle">Light or dark: use the sun/moon button in the sidebar.</p>
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Recent activity"
            description="Sign-ins, approvals, locks and views across all Optic apps"
            action={
              <Link to="/apps/approvals" className="text-[12.5px] font-medium text-muted hover:text-ink">
                View all
              </Link>
            }
          />
          {events.length === 0 ? (
            <EmptyState icon={<ArrowRight className="size-5" />} title="Nothing yet" description="Open an app to get started." className="py-8" />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                  <div className="min-w-0">
                    <span className="font-medium text-ink">{e.name}</span>
                    <span className="text-muted"> · {e.detail}</span>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone={e.ok ? 'ok' : 'bad'}>{e.ok ? 'OK' : 'Blocked'}</Badge>
                    <span className="w-[64px] text-right text-[12px] text-subtle">{timeAgo(e.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
