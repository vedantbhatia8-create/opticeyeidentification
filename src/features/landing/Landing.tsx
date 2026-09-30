import { motion, useInView } from 'framer-motion'
import { AppWindow, ArrowRight, BadgeX, Building2, Check, CreditCard, Hotel, KeyRound, ListChecks, ScanEye, ShieldCheck, Smartphone, UserCog, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo, LogoMark } from '../../ui/Logo'
import { buttonClass, cx } from '../../ui/primitives'
import { PRINCIPLES } from '../shell/SharedPages'
import { SUITE_APPS } from '../suite/apps'
import { useSession } from '../suite/store'
import { ThemeToggle } from '../shell/ThemeToggle'

const SIGN_UP = '/lab/enroll?return=/apps/signin'
const LOG_IN = '/apps/signin'

export function Landing() {
  const session = useSession()
  const signedIn = !!session.identityId
  return (
    <div className="min-h-screen bg-bg">
      <nav className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Logo />
          <div className="hidden items-center gap-6 text-[13.5px] text-muted md:flex">
            <a href="#platform" className="hover:text-ink">Platform</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#offices" className="hover:text-ink">Offices</a>
            <a href="#hotels" className="hover:text-ink">Hotels</a>
            <a href="#apps" className="hover:text-ink">Apps</a>
            <a href="#security" className="hover:text-ink">Security</a>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {signedIn ? (
              <Link to="/apps" className={buttonClass('primary', 'sm')} data-testid="nav-open-apps">
                {session.name?.split(' ')[0] ?? 'My'} · Open apps
              </Link>
            ) : (
              <>
                <Link to={LOG_IN} className={buttonClass('ghost', 'sm')} data-testid="nav-login">
                  Log in
                </Link>
                <Link to={SIGN_UP} className={buttonClass('primary', 'sm')} data-testid="nav-signup">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-16 pb-20 md:pt-24 lg:grid-cols-[1.05fr_1fr]">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-medium text-muted shadow-[var(--shadow-card)]">
              <span className="size-1.5 rounded-full bg-ok" /> One identity for doors, rooms and apps
            </span>
            <h1 className="mt-6 text-[44px] leading-[1.02] font-semibold tracking-[-0.035em] text-ink sm:text-[64px]">
              One look.
              <br />
              Everything unlocks.
            </h1>
            <p className="mt-5 max-w-[480px] text-[18px] leading-relaxed text-muted">
              Optic turns your eyes into a single account. It opens office doors and hotel rooms, and signs you in to
              a suite of apps: passwords, private documents, screen guard, family screen time, focus and attendance.
              No badges, cards, keys or passwords.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {signedIn ? (
                <Link to="/apps" className={buttonClass('primary', 'lg')} data-testid="hero-open-apps">
                  Open my apps <ArrowRight className="size-4" />
                </Link>
              ) : (
                <>
                  <Link to={SIGN_UP} className={buttonClass('primary', 'lg')} data-testid="hero-signup">
                    Create your account <ArrowRight className="size-4" />
                  </Link>
                  <Link to={LOG_IN} className={buttonClass('secondary', 'lg')} data-testid="hero-login">
                    <ScanEye className="size-4" /> Log in with a glance
                  </Link>
                </>
              )}
            </div>
            <p className="mt-3 text-[13px] text-subtle">
              Sign up takes about 20 seconds with your webcam. Want the walkthrough first?{' '}
              <Link to="/demo" className="text-accent-text hover:underline" data-testid="try-demo">Open the guided demo</Link>.
            </p>
            <div className="mt-8 flex items-center gap-5 text-[12.5px] text-subtle">
              <span className="flex items-center gap-1.5"><Check className="size-3.5" /> No video stored</span>
              <span className="flex items-center gap-1.5"><Check className="size-3.5" /> Revocable instantly</span>
              <span className="flex items-center gap-1.5"><Check className="size-3.5" /> Every attempt logged</span>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.1 }}>
            <HeroTerminal />
          </motion.div>
        </div>
      </section>

      {/* Platform */}
      <Section id="platform" eyebrow="The platform" title="One Optic account. Three ways to use it.">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { icon: Building2, title: 'Optic for Offices', body: 'Employees and visitors walk in with a glance. Groups, schedules, time-boxed visits, lockdown and a full audit trail.', to: '/office', cta: 'Office console' },
            { icon: Hotel, title: 'Optic for Hotels', body: 'Check-in links a guest to their room for the exact dates of the stay. Check-out revokes access instantly.', to: '/hotel', cta: 'Hotel console' },
            { icon: AppWindow, title: 'Optic Apps', body: `${SUITE_APPS.map((a) => a.name).join(', ')}. Everyday software that knows who is at the screen.`, to: '/apps', cta: 'Open apps' },
          ].map((c) => (
            <Link key={c.title} to={c.to} className="group rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
                <c.icon className="size-5" />
              </span>
              <div className="mt-4 text-[16px] font-semibold text-ink">{c.title}</div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{c.body}</p>
              <span className="mt-4 flex items-center gap-1 text-[13px] font-medium text-accent-text">
                {c.cta} <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ['Sign up once', 'Enroll your eyes with a webcam and your email. That is your whole account.'],
            ['Everything in one place', 'Scans, door access, stays, vault items and app data all live under that one account.'],
            ['Private by design', 'Encrypted templates stay on your device. No video is stored and no data leaves the browser.'],
          ].map(([t, b]) => (
            <div key={t} className="rounded-2xl border border-line p-5">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-ink"><Check className="size-4 text-ok" /> {t}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{b}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Problem */}
      <Section id="problem" eyebrow="The problem" title="Credentials that can be lost can be used by someone else.">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { icon: CreditCard, title: 'Badges get shared', body: 'Lent, cloned, tailgated, forgotten at home.' },
            { icon: KeyRound, title: 'Keys get copied', body: 'Re-keying a door after a lost key is slow and costly.' },
            { icon: Smartphone, title: 'Codes get passed on', body: 'A PIN knows nothing about who typed it.' },
            { icon: BadgeX, title: 'Cards outlive stays', body: 'Hotel key cards still work until someone re-encodes the lock.' },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <c.icon className="size-5 text-muted" />
              <div className="mt-4 text-[15px] font-semibold text-ink">{c.title}</div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{c.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* How */}
      <Section id="how" eyebrow="How Optic works" title="Look. Verify. Authorize. Open.">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
          {[
            ['01', 'Sensor', 'The terminal locates your eyes and captures a few samples. Frames are processed on the device and discarded.'],
            ['02', 'Identity', 'Samples become a numeric representation, compared against enrolled templates. Who is this?'],
            ['03', 'Authorization', 'A separate policy engine checks who → where → when, validity windows and status. May they enter?'],
            ['04', 'Access', 'The door unlocks — or explains why not. Either way, the attempt is logged.'],
          ].map(([n, t, b]) => (
            <div key={n} className="bg-surface p-6">
              <div className="font-mono text-[12px] text-subtle">{n}</div>
              <div className="mt-6 text-[17px] font-semibold tracking-tight text-ink">{t}</div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{b}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-subtle">
          The sensor is a replaceable module. This prototype uses a webcam; production terminals would use dedicated
          near-infrared iris hardware behind the same interface.
        </p>
      </Section>

      {/* Offices */}
      <Section id="offices" eyebrow="For offices" title="Employees walk in. Nobody carries a badge.">
        <SplitFeature
          icon={<Building2 className="size-5" />}
          points={['Access groups and schedules: who → where → when', 'Visitors with time-boxed access that expires on its own', 'Lockdown any door in one click', 'Live activity and denied-attempt monitoring']}
          cta={<Link to="/office" className={buttonClass('primary')}>Open office console <ArrowRight className="size-4" /></Link>}
        >
          <DecisionCard name="Employee" place="Main Entrance" granted />
          <DecisionCard name="Employee" place="Server Room" reason="You do not have permission to access this area." />
        </SplitFeature>
      </Section>

      {/* Hotels */}
      <Section id="hotels" eyebrow="For hotels" title="The stay is the key. Check-out is the revocation.">
        <SplitFeature
          icon={<Hotel className="size-5" />}
          points={['Link a guest’s identity to a room at check-in', 'Access follows the exact dates of the stay', 'Check-out revokes access instantly — no cards to collect', 'Amenities by stay type: fitness, pool, club lounge']}
          cta={<Link to="/hotel" className={buttonClass('primary')}>Open hotel console <ArrowRight className="size-4" /></Link>}
        >
          <DecisionCard name="Hotel guest" place="Room 814" granted detail="Stay · Sep 27 – Sep 30" />
          <DecisionCard name="Hotel guest" place="Room 814" reason="Your hotel stay has ended." />
        </SplitFeature>
      </Section>

      {/* Apps */}
      <Section id="apps" eyebrow="Optic Apps" title="The same identity engine, in software. No new hardware.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SUITE_APPS.map((a) => (
            <Link
              key={a.id}
              to={a.to}
              className="group rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
                <a.icon className="size-5" />
              </span>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[15.5px] font-semibold text-ink">Optic {a.name}</span>
                <ArrowRight className="size-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-ink" />
              </div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{a.tagline}</p>
              <p className="mt-3 text-[12px] text-subtle">{a.combines}</p>
            </Link>
          ))}
        </div>
        <div className="mt-6">
          <Link to="/apps" className={buttonClass('primary')} data-testid="open-apps">
            Open Optic Apps <ArrowRight className="size-4" />
          </Link>
        </div>
      </Section>

      {/* Security */}
      <Section id="security" eyebrow="Security" title="Designed around what not to keep.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <p.icon className="size-5 text-ink" />
              <div className="mt-4 text-[14.5px] font-semibold text-ink">{p.title}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{p.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 max-w-3xl text-[13px] leading-relaxed text-subtle">
          Honest note: this is a prototype. A consumer webcam cannot capture iris detail like dedicated hardware, and the
          prototype has no spoof detection. It demonstrates the product and architecture — not production-grade
          biometric security.
        </p>
      </Section>

      {/* Admin */}
      <Section id="admin" eyebrow="Admin control" title="Every decision is visible. Every permission is revocable.">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { icon: UserCog, title: 'People & permissions', body: 'Add people, enroll their Optic identity, and assign access groups in seconds.' },
            { icon: ListChecks, title: 'Complete audit trail', body: 'Granted, denied and unrecognized — each with a reason. Export as CSV.' },
            { icon: ShieldCheck, title: 'Instant revocation', body: 'Suspend, end a visit, check out, lock down. Effective on the very next attempt.' },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
              <c.icon className="size-5 text-muted" />
              <div className="mt-4 text-[15px] font-semibold text-ink">{c.title}</div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{c.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <section className="px-5 pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[#07080a] px-8 py-14 text-center text-white">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(50% 80% at 50% 0%, rgba(124,192,255,0.14), transparent 70%)' }} />
          <LogoMark className="relative mx-auto size-10 text-white [--logo-fg:#07080a]" />
          <h2 className="relative mt-6 text-[32px] font-semibold tracking-tight">Your eyes are your account.</h2>
          <p className="relative mt-2 text-[15px] text-white/60">Sign up with your webcam in 20 seconds. Log in any time with a glance.</p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3">
            <Link to={SIGN_UP} className="flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-[15px] font-medium text-black hover:bg-white/90">
              Sign up <ArrowRight className="size-4" />
            </Link>
            <Link to={LOG_IN} className="flex h-11 items-center rounded-lg border border-white/15 px-5 text-[15px] font-medium text-white/85 hover:bg-white/5">
              Log in
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-6xl items-center justify-between text-[12px] text-subtle">
          <span>Optic · prototype</span>
          <span className="flex gap-4">
            <Link to="/demo" className="hover:text-ink">Guided demo</Link>
            <Link to="/lab" className="hover:text-ink">Sensor Lab</Link>
            <Link to="/lab/architecture" className="hover:text-ink">Architecture</Link>
          </span>
        </div>
      </section>
    </div>
  )
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <section id={id} className="scroll-mt-16 px-5 py-16 md:py-20">
      <motion.div
        ref={ref}
        className="mx-auto max-w-6xl"
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="text-[12.5px] font-semibold tracking-wide text-accent-text">{eyebrow}</div>
        <h2 className="mt-2 max-w-2xl text-[30px] leading-tight font-semibold tracking-[-0.02em] text-ink sm:text-[36px]">{title}</h2>
        <div className="mt-10">{children}</div>
      </motion.div>
    </section>
  )
}

function SplitFeature({ icon, points, cta, children }: { icon: ReactNode; points: string[]; cta: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2">
      <div>
        <div className="flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-ink shadow-[var(--shadow-card)]">{icon}</div>
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-[15px] text-ink">
              <Check className="mt-1 size-4 shrink-0 text-ok" /> {p}
            </li>
          ))}
        </ul>
        <div className="mt-8">{cta}</div>
      </div>
      <div className="grid gap-3 rounded-3xl bg-[#07080a] p-5 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function DecisionCard({ name, place, granted, reason, detail }: { name: string; place: string; granted?: boolean; reason?: string; detail?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-7 text-center">
      <div className={cx('flex size-11 items-center justify-center rounded-full border', granted ? 'border-granted/40 bg-granted/10 text-granted' : 'border-denied/40 bg-denied/10 text-denied')}>
        {granted ? <Check className="size-5" /> : <X className="size-5" />}
      </div>
      <div className="mt-4 font-mono text-[10px] tracking-[0.24em] text-white/45 uppercase">Identity verified</div>
      <div className="mt-1 text-[18px] font-semibold text-white">{name}</div>
      <div className="text-[11px] tracking-[0.2em] text-white/50 uppercase">{place}</div>
      <div className={cx('mt-4 text-[14px] font-semibold tracking-[0.14em]', granted ? 'text-granted' : 'text-denied')}>
        {granted ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
      </div>
      {(reason || detail) && <div className="mt-1.5 text-[12px] text-white/55">{reason ?? detail}</div>}
    </div>
  )
}

/** Animated, self-running illustration of the terminal (no camera). */
function HeroTerminal() {
  const stages = ['LOCATING EYE', 'EYE DETECTED', 'ANALYZING IRIS', 'VERIFYING IDENTITY', 'ACCESS GRANTED'] as const
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % (stages.length + 1)), 1300)
    return () => clearInterval(t)
  }, [stages.length])
  const stage = stages[Math.min(i, stages.length - 1)]
  const done = stage === 'ACCESS GRANTED'
  const color = done ? '#3ddc97' : '#8cc8ff'
  const progress = Math.min(1, Math.max(0, (i - 1) / 2))
  return (
    <div className="relative mx-auto aspect-[4/3.4] w-full max-w-[520px] overflow-hidden rounded-[32px] bg-[#07080a] p-6 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.5)] ring-1 ring-black/10 dark:ring-white/10">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 50% 40%, rgba(124,192,255,0.10), transparent 70%)' }} />
      <div className="relative flex items-center justify-between font-mono text-[10px] tracking-[0.3em] text-white/60">
        <span className="flex items-center gap-2">
          <LogoMark className="size-4 text-white [--logo-fg:#07080a]" /> OPTIC ACCESS
        </span>
        <span>MAIN ENTRANCE</span>
      </div>
      <svg viewBox="0 0 400 220" className="relative mt-6 w-full">
        {[
          { cx: 132, flip: false },
          { cx: 268, flip: true },
        ].map(({ cx: x, flip }) => (
          <g key={x} transform={`translate(${x},110)`}>
            <path d="M-50,0 C-26,-30 26,-30 50,0 C26,30 -26,30 -50,0 Z" fill="none" stroke="rgba(207,233,255,0.18)" strokeWidth="1" />
            <circle r="22" fill="rgba(124,192,255,0.06)" stroke={color} strokeOpacity={0.9} strokeWidth="1.2" style={{ transition: 'stroke 400ms' }} />
            <circle r="8" fill="rgba(207,233,255,0.12)" />
            <circle r="2" fill={color} />
            <g style={{ animation: `${flip ? 'optic-spin-rev' : 'optic-spin'} ${i >= 2 && !done ? 3 : 10}s linear infinite`, transformOrigin: '0 0' }}>
              <circle r="46" fill="none" stroke={color} strokeWidth="1" strokeDasharray="44 16" opacity="0.55" />
            </g>
            {Array.from({ length: 40 }, (_, k) => {
              const a = (k / 40) * Math.PI * 2 - Math.PI / 2
              const on = k < progress * 40
              return (
                <line key={k} x1={Math.cos(a) * 52} y1={Math.sin(a) * 52} x2={Math.cos(a) * (on ? 60 : 56)} y2={Math.sin(a) * (on ? 60 : 56)} stroke={color} strokeWidth={on ? 1.5 : 1} opacity={on ? 1 : 0.2} />
              )
            })}
          </g>
        ))}
      </svg>
      <div className="relative mt-4 text-center">
        <div className="font-mono text-[11px] tracking-[0.28em]" style={{ color }}>{stage}</div>
        <div className="mt-2 text-[22px] font-light text-white/85">{done ? 'Welcome back' : i === 0 ? 'Look at the sensor' : 'Hold still'}</div>
      </div>
      <div className="relative mt-5 flex justify-center gap-1.5">
        {stages.map((s, k) => (
          <span key={s} className="h-1 w-8 rounded-full transition-colors duration-300" style={{ background: k <= Math.min(i, stages.length - 1) ? color : 'rgba(255,255,255,0.12)' }} />
        ))}
      </div>
      <div className="relative mt-5 flex items-center justify-center gap-1.5 font-mono text-[9.5px] tracking-[0.18em] text-white/30">
        <ScanEye className="size-3" /> ON-DEVICE · NO VIDEO STORED
      </div>
    </div>
  )
}
