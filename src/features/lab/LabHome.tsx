import { motion } from 'framer-motion'
import { ArrowRight, Fingerprint, ScanEye, ShieldAlert, UserPlus } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../../state/store'
import { timeAgo } from '../../ui/format'
import { Avatar, Badge, buttonClass, Card, CardHeader, EmptyState } from '../../ui/primitives'
import { useIdentities } from '../sensor/hooks'
import { OutcomeBadge } from '../shell/OutcomeBadge'

export function LabHome() {
  const { identities, scans, persistent } = useIdentities()
  const allEvents = useStore((s) => s.events)
  const events = useMemo(() => allEvents.filter((e) => e.site === 'lab').slice(0, 8), [allEvents])
  const real = identities.filter((i) => !i.synthetic)
  const realScans = scans.filter((s) => !s.synthetic)

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2">
          <Badge tone="accent">Phase 1</Badge>
          <Badge>Webcam prototype</Badge>
        </div>
        <h1 className="mt-4 text-[32px] font-semibold tracking-tight text-ink">Optic Sensor Lab</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
          Enroll an eye with your webcam, then authenticate against it. Everything runs on this device — frames are
          processed in memory and only an encrypted numeric template is stored.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <ActionCard
          to="/lab/enroll"
          icon={<UserPlus className="size-5" />}
          title="Enroll identity"
          body="Guided capture: look at the sensor, then left, right, up and down. Name the resulting optic scan."
          cta="Start enrollment"
          testId="lab-enroll"
        />
        <ActionCard
          to="/lab/authenticate"
          icon={<ScanEye className="size-5" />}
          title="Authenticate"
          body="Look at the sensor. The system compares your eyes against every enrolled identity (1:N)."
          cta="Open sensor"
          dark
          testId="lab-authenticate"
        />
      </div>
      <Link
        to="/lab/lookalike"
        className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-4 text-[13.5px] shadow-[var(--shadow-card)] hover:border-line-strong"
        data-testid="lab-lookalike"
      >
        <span>
          <span className="font-semibold text-ink">Someone else gets recognized as you?</span>{' '}
          <span className="text-muted">Look-alike tuning measures you and them, and tightens the match limit.</span>
        </span>
        <span className="shrink-0 text-accent-text">Tune →</span>
      </Link>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Your enrolled identities" value={real.length} />
        <Stat label="Optic scans stored" value={realScans.length} hint={`+ ${scans.length - realScans.length} demo personas`} />
        <Stat label="Lab authentications" value={events.length} hint={events[0] ? `Last ${timeAgo(events[0].at)}` : 'None yet'} />
      </div>

      {!persistent && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-warn/20 bg-warn-soft px-4 py-3 text-[13px] text-warn">
          <ShieldAlert className="size-4" /> This browser blocks IndexedDB, so enrollments last only until you reload.
        </div>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Enrolled identities"
            description="Real webcam enrollments on this device"
            action={
              <Link to="/lab/scans" className={buttonClass('ghost', 'sm')}>
                All scans <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {real.length === 0 ? (
            <EmptyState
              icon={<Fingerprint className="size-5" />}
              title="No one enrolled yet"
              description="Enroll yourself to create your first optic identity. It takes about 20 seconds."
              action={
                <Link to="/lab/enroll" className={buttonClass('primary', 'sm')}>
                  Enroll identity
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {real.slice(0, 6).map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={i.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-ink">{i.name}</div>
                    <div className="truncate text-[12px] text-muted">
                      {scans.filter((s) => s.identityId === i.id).length} scan(s) · {i.email || i.externalId || 'No email'}
                    </div>
                  </div>
                  <Badge tone={i.status === 'active' ? 'ok' : 'bad'} dot>
                    {i.status === 'active' ? 'Active' : 'Revoked'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Recent authentications" description="Attempts made from the Lab sensor" />
          {events.length === 0 ? (
            <EmptyState icon={<ScanEye className="size-5" />} title="No attempts yet" description="Authenticate to see results here." />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-ink">{e.subjectName}</div>
                    <div className="text-[12px] text-muted">
                      {timeAgo(e.at)}
                      {e.confidence !== null && ` · ${Math.round(e.confidence * 100)}% match`}
                      {e.demo && ' · demo'}
                    </div>
                  </div>
                  <OutcomeBadge outcome={e.outcome} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="mt-8 text-[12px] leading-relaxed text-subtle">
        Prototype notice: consumer webcams cannot resolve iris texture at the fidelity dedicated near-infrared iris
        sensors provide. This lab demonstrates the product flow and architecture; it is not production-grade biometric
        security and has no presentation-attack (spoof) detection.
      </p>
    </div>
  )
}

function ActionCard({
  to,
  icon,
  title,
  body,
  cta,
  dark,
  testId,
}: {
  to: string
  icon: React.ReactNode
  title: string
  body: string
  cta: string
  dark?: boolean
  testId?: string
}) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className={
        dark
          ? 'group relative overflow-hidden rounded-2xl border border-black bg-[#0b0d10] p-6 text-white shadow-[var(--shadow-float)] transition hover:-translate-y-0.5'
          : 'group relative overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]'
      }
    >
      {dark && (
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full opacity-60"
          style={{ background: 'radial-gradient(circle, rgba(124,192,255,0.18), transparent 70%)' }}
        />
      )}
      <div className={dark ? 'flex size-10 items-center justify-center rounded-xl bg-white/10' : 'flex size-10 items-center justify-center rounded-xl bg-surface-2 text-ink'}>
        {icon}
      </div>
      <h2 className="mt-5 text-[18px] font-semibold tracking-tight">{title}</h2>
      <p className={dark ? 'mt-1.5 text-[14px] leading-relaxed text-white/60' : 'mt-1.5 text-[14px] leading-relaxed text-muted'}>{body}</p>
      <div className={dark ? 'mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-white' : 'mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink'}>
        {cta} <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-[12px] font-medium text-muted">{label}</div>
      <div className="mt-1 text-[26px] font-semibold tracking-tight text-ink tabular">{value}</div>
      {hint && <div className="mt-0.5 text-[12px] text-subtle">{hint}</div>}
    </Card>
  )
}
