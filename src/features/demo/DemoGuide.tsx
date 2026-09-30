import { AppWindow, Camera, Play, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { personaIdentity } from '../../domains/personas'
import { useStore } from '../../state/store'
import { Backdrop } from '../../ui/Backdrop'
import { startOfDay } from '../../ui/format'
import { Logo } from '../../ui/Logo'
import { Badge, Button, Card, cx } from '../../ui/primitives'
import { useIdentities } from '../sensor/hooks'
import { ThemeToggle } from '../shell/ThemeToggle'
import { DemoControls, DemoPeopleToggle } from './DemoPanel'

const HOUR = 3_600_000
const todayAt = (hour: number) => startOfDay(Date.now()) + hour * HOUR - Date.now()

interface Step {
  title: string
  /** Expected decision, when the step ends in one. */
  expect?: 'granted' | 'denied'
  body: ReactNode
  subject: string | null
  clockOffset: number | null
  to: string
}

/** Guided walkthrough of Optic with your own eyes: identity first, then every app. */
export function DemoGuide() {
  const navigate = useNavigate()
  const setDemo = useStore((s) => s.setDemo)
  const demoPeople = useStore((s) => s.settings.demoPeople)
  const { identities } = useIdentities()
  const me = identities.find((i) => !i.synthetic && i.status === 'active') ?? null

  const run = (step: Step) => {
    setDemo({ enabled: step.subject !== null, subject: step.subject, clockOffsetMs: step.clockOffset ?? 0 })
    navigate(step.to)
  }

  const identity: Step[] = [
    { title: 'Enroll your own eyes', body: 'Guided five-look capture with your webcam. Name the scan when you’re done.', subject: null, clockOffset: null, to: '/lab/enroll?return=/apps/signin' },
    { title: 'Authenticate yourself', expect: 'granted', body: <>Look at the sensor. Expect <b>ACCESS GRANTED · Welcome, you</b>.</>, subject: null, clockOffset: null, to: '/lab/authenticate' },
    { title: 'Someone who never enrolled', expect: 'denied', body: <>Ask a friend to try, or use the Unknown Person subject. Expect <b>Identity could not be verified</b>.</>, subject: 'unknown', clockOffset: null, to: '/lab/authenticate' },
    { title: 'Tell look-alikes apart', body: 'Scan yourself, then a sibling or look-alike. Optic tightens the match limit to just above your own scores.', subject: null, clockOffset: null, to: '/lab/lookalike' },
  ]
  const apps: Step[] = [
    { title: 'Sign in with a glance', expect: 'granted', body: 'No password: look at the camera and you’re in.', subject: null, clockOffset: null, to: '/apps/signin' },
    { title: 'Vault', body: 'Save a password, then reveal it. Every reveal asks for a fresh glance.', subject: null, clockOffset: null, to: '/apps/vault' },
    { title: 'Eyes-Only', body: 'Seal a document for yourself. It disappears the moment someone else looks.', subject: null, clockOffset: null, to: '/apps/eyes-only' },
    { title: 'Guard', body: 'Turn it on and walk away: the screen locks. Someone else sits down: it locks too.', subject: null, clockOffset: null, to: '/apps/guard' },
    { title: 'Family', body: 'Create profiles with daily limits and allowed hours. The shared screen switches to whoever sits down.', subject: null, clockOffset: null, to: '/apps/family' },
    { title: 'Focus', body: 'Start a session: only real eyes-on-screen time counts.', subject: null, clockOffset: null, to: '/apps/focus' },
    { title: 'Attendance', body: 'Make a roster and open the check-in kiosk.', subject: null, clockOffset: null, to: '/apps/attendance' },
  ]
  const cast: Step[] = [
    { title: 'Maya sits down at the family screen', expect: 'granted', body: 'The shared screen switches to Maya’s kids launcher and her screen-time budget.', subject: personaIdentity('maya'), clockOffset: todayAt(16), to: '/apps/family/screen' },
    { title: 'Maya after bedtime (9 PM)', expect: 'denied', body: 'Outside her allowed hours (7 AM–7:30 PM): the screen stays locked.', subject: personaIdentity('maya'), clockOffset: todayAt(21), to: '/apps/family/screen' },
    { title: 'Maya checks in to CS 101', expect: 'granted', body: 'She is on the roster, and check-in is open.', subject: personaIdentity('maya'), clockOffset: todayAt(13.08), to: '/apps/attendance/kiosk/att_cs101' },
    { title: 'A stranger at the kiosk', expect: 'denied', body: 'Not enrolled: not on any roster.', subject: 'unknown', clockOffset: todayAt(14), to: '/apps/attendance/kiosk/att_cs101' },
  ]

  return (
    <div className="relative isolate min-h-screen bg-bg">
      <Backdrop />
      <nav className="sticky top-3 z-30 px-3">
        <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl pr-2 pl-4">
          <Link to="/"><Logo product="Demo" /></Link>
          <div className="flex items-center gap-1.5 text-[13px]">
            <Link to="/lab" className="hidden px-3 text-muted hover:text-ink sm:inline">Sensor Lab</Link>
            <ThemeToggle />
            <Link to="/apps" className="btn-glow flex h-9 items-center rounded-xl px-4 font-semibold">Open apps</Link>
          </div>
        </div>
      </nav>
      <div className="mx-auto grid max-w-6xl gap-8 px-5 pt-12 pb-16 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="font-mono text-[11px] tracking-[0.2em] text-accent-text uppercase">Guided demo</div>
          <h1 className="mt-3 text-[36px] leading-tight font-semibold tracking-[-0.03em] text-ink sm:text-[44px]">
            Getting <span className="text-gradient">started</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
            Walk through Optic with your own eyes: enroll once, then try every app. The real matcher and policy engine make
            every decision.
          </p>
          {!me && <p className="mt-3 max-w-2xl text-[13px] text-warn">Start with step 01: the apps need your identity.</p>}
          <Card className="hairline mt-6 max-w-2xl p-4">
            <DemoPeopleToggle />
          </Card>
          <StepGroup icon={<Camera className="size-4" />} title="Your optic identity" steps={identity} onRun={run} offset={0} />
          <StepGroup icon={<AppWindow className="size-4" />} title="Optic Apps" steps={apps} onRun={run} offset={identity.length} />
          {demoPeople && (
            <StepGroup icon={<Users className="size-4" />} title="With the demo people" steps={cast} onRun={run} offset={identity.length + apps.length} />
          )}
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <DemoControls compact />
          </Card>
        </div>
      </div>
    </div>
  )
}

function StepGroup({ icon, title, steps, onRun, offset }: { icon: ReactNode; title: string; steps: Step[]; onRun: (s: Step) => void; offset: number }) {
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent">{icon}</span> {title}
      </h2>
      <div className="mt-4 space-y-2.5">
        {steps.map((s, i) => (
          <Card key={s.title} className="hairline flex items-center gap-4 px-5 py-4">
            <span className="w-6 font-mono text-[12px] text-accent">{String(offset + i + 1).padStart(2, '0')}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14.5px] font-semibold text-ink">{s.title}</span>
                {s.expect && <Badge tone={s.expect === 'granted' ? 'ok' : 'bad'}>Expect {s.expect}</Badge>}
              </div>
              <p className="mt-0.5 text-[13px] text-muted">{s.body}</p>
            </div>
            <Button variant="primary" size="sm" onClick={() => onRun(s)} icon={<Play className="size-3.5" />} className={cx('shrink-0')} data-testid={`run-step-${offset + i + 1}`}>
              {s.expect ? 'Run' : 'Open'}
            </Button>
          </Card>
        ))}
      </div>
    </section>
  )
}
