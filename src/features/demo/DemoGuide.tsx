import { Building2, Camera, Hotel, Play, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clock } from '../../core/access/clock'
import { personaIdentity } from '../../domains/personas'
import { useStore } from '../../state/store'
import { startOfDay } from '../../ui/format'
import { Logo } from '../../ui/Logo'
import { Badge, Button, Card, cx } from '../../ui/primitives'
import { ThemeToggle } from '../shell/ThemeToggle'
import { DemoControls } from './DemoPanel'

const HOUR = 3_600_000

/** Clock offset that lands on a weekday at the given hour (office rules are Mon–Fri). */
function weekdayAt(hour: number) {
  let day = startOfDay(Date.now())
  while ([0, 6].includes(new Date(day).getDay())) day += 24 * HOUR
  return day + hour * HOUR - Date.now()
}
const todayAt = (hour: number) => startOfDay(Date.now()) + hour * HOUR - Date.now()

interface Step {
  title: string
  expect: 'granted' | 'denied'
  body: ReactNode
  subject: string | null
  clockOffset: number | null
  to: string
  before?: () => void
}

export function DemoGuide() {
  const navigate = useNavigate()
  const setDemo = useStore((s) => s.setDemo)
  const emma = useStore((s) => s.hotel.guests.find((g) => g.id === 'gst_emma'))
  const checkOut = useStore((s) => s.checkOut)
  const checkIn = useStore((s) => s.checkIn)

  const run = (step: Step) => {
    step.before?.()
    setDemo({ enabled: step.subject !== null, subject: step.subject, clockOffsetMs: step.clockOffset ?? 0 })
    navigate(step.to)
  }

  const phase1: Step[] = [
    { title: 'Enroll your own eyes', expect: 'granted', body: 'Guided five-look capture with your webcam. Name the scan when you’re done.', subject: null, clockOffset: null, to: '/lab/enroll' },
    { title: 'Authenticate yourself', expect: 'granted', body: <>Look at the sensor. Expect <b>ACCESS GRANTED · Welcome, you</b>.</>, subject: null, clockOffset: null, to: '/lab/authenticate' },
    { title: 'Someone who never enrolled', expect: 'denied', body: <>Ask a friend to try — or use the Unknown Person persona. Expect <b>Identity could not be verified</b>.</>, subject: 'unknown', clockOffset: null, to: '/lab/authenticate' },
  ]
  const office: Step[] = [
    { title: 'Sarah Chen · Main Entrance', expect: 'granted', body: 'Employee during office hours. Watch the door unlock.', subject: personaIdentity('sarah'), clockOffset: weekdayAt(10), to: '/terminal/office/door_main' },
    { title: 'Sarah Chen · Server Room', expect: 'denied', body: <>Same verified identity, different door. <b>IDENTITY VERIFIED · ACCESS DENIED</b> — authentication and authorization are separate.</>, subject: personaIdentity('sarah'), clockOffset: weekdayAt(10), to: '/terminal/office/door_server' },
    { title: 'Michael Patel · Server Room', expect: 'granted', body: 'Infrastructure group, 8 AM–6 PM on weekdays.', subject: personaIdentity('michael'), clockOffset: weekdayAt(10), to: '/terminal/office/door_server' },
    { title: 'Sarah Chen · Main Entrance at 11 PM', expect: 'denied', body: 'Outside the Employees schedule (7 AM–8 PM).', subject: personaIdentity('sarah'), clockOffset: weekdayAt(23), to: '/terminal/office/door_main' },
    { title: 'David Kim (visitor) · 3:00 PM', expect: 'granted', body: 'Acme visitor, Conference Room A, 2:00–4:00 PM today.', subject: personaIdentity('david'), clockOffset: todayAt(15), to: '/terminal/office/door_confA' },
    { title: 'David Kim (visitor) · 5:00 PM', expect: 'denied', body: <>Still recognized — but <b>VISITOR ACCESS EXPIRED</b>.</>, subject: personaIdentity('david'), clockOffset: todayAt(17), to: '/terminal/office/door_confA' },
    { title: 'Unknown person · Main Entrance', expect: 'denied', body: 'Not enrolled anywhere: identity not recognized.', subject: 'unknown', clockOffset: weekdayAt(10), to: '/terminal/office/door_main' },
  ]
  const hotel: Step[] = [
    {
      title: 'Emma Johnson · Room 814',
      expect: 'granted',
      body: 'Checked-in guest during her stay. Room unlocks.',
      subject: personaIdentity('emma'),
      clockOffset: null,
      to: '/terminal/hotel/room-814',
      before: () => emma?.status === 'checked-out' && checkIn('gst_emma'),
    },
    { title: 'Emma Johnson · Room 816', expect: 'denied', body: 'Recognized, but it is not her room.', subject: personaIdentity('emma'), clockOffset: null, to: '/terminal/hotel/room-816' },
    {
      title: 'Check Emma out, then try Room 814',
      expect: 'denied',
      body: <>Staff clicks “Check out guest”. Access is revoked instantly: <b>Your hotel stay has ended.</b></>,
      subject: personaIdentity('emma'),
      clockOffset: null,
      to: '/terminal/hotel/room-814',
      before: () => emma?.status === 'checked-in' && checkOut('gst_emma', clock.now()),
    },
  ]

  return (
    <div className="min-h-screen bg-bg">
      <nav className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link to="/"><Logo product="Demo" /></Link>
          <div className="flex items-center gap-3 text-[13px]">
            <Link to="/office" className="text-muted hover:text-ink">Office</Link>
            <Link to="/hotel" className="text-muted hover:text-ink">Hotel</Link>
            <Link to="/lab" className="text-muted hover:text-ink">Sensor Lab</Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[1fr_360px]">
        <div>
          <Badge tone="warn">DEMO MODE</Badge>
          <h1 className="mt-4 text-[32px] font-semibold tracking-tight text-ink">Guided demo</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
            Walk through the whole system on one laptop. Start with your real eyes; then use demo personas so one
            presenter can play several people. With a persona, the camera still tracks your eyes live — only the
            biometric features are substituted, and the real matcher and policy engine make every decision.
          </p>
          <StepGroup icon={<Camera className="size-4" />} title="1 · The optic sensor" steps={phase1} onRun={run} offset={0} />
          <StepGroup icon={<Building2 className="size-4" />} title="2 · Office access" steps={office} onRun={run} offset={phase1.length} />
          <StepGroup icon={<Hotel className="size-4" />} title="3 · Hotel access" steps={hotel} onRun={run} offset={phase1.length + office.length} />
          {emma?.status === 'checked-out' && (
            <Button className="mt-4" size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => checkIn('gst_emma')}>
              Restore Emma’s stay
            </Button>
          )}
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="p-5">
            <DemoControls compact />
          </Card>
          <p className="mt-3 text-[12px] leading-relaxed text-subtle">
            Tip: link your own enrolled identity to Sarah Chen (Office → People → Sarah → Link existing) to run the office
            steps with your real eyes and no persona.
          </p>
        </div>
      </div>
    </div>
  )
}

function StepGroup({ icon, title, steps, onRun, offset }: { icon: ReactNode; title: string; steps: Step[]; onRun: (s: Step) => void; offset: number }) {
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <span className="text-subtle">{icon}</span> {title}
      </h2>
      <div className="mt-3 space-y-2">
        {steps.map((s, i) => (
          <Card key={s.title} className="flex items-center gap-4 px-5 py-4">
            <span className="w-6 font-mono text-[12px] text-subtle">{String(offset + i + 1).padStart(2, '0')}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14.5px] font-semibold text-ink">{s.title}</span>
                <Badge tone={s.expect === 'granted' ? 'ok' : 'bad'}>Expect {s.expect === 'granted' ? 'granted' : 'denied'}</Badge>
              </div>
              <p className="mt-0.5 text-[13px] text-muted">{s.body}</p>
            </div>
            <Button variant="primary" size="sm" onClick={() => onRun(s)} icon={<Play className="size-3.5" />} className={cx('shrink-0')} data-testid={`run-step-${offset + i + 1}`}>
              Run
            </Button>
          </Card>
        ))}
      </div>
    </section>
  )
}
