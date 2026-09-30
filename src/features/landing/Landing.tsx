import { motion, useInView } from 'framer-motion'
import { ArrowRight, ArrowUpRight, Check, EyeOff, KeyRound, ListChecks, ScanEye, ShieldCheck, Smartphone, UserCog, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { seededRandom } from '../../core/biometric/math'
import { Backdrop } from '../../ui/Backdrop'
import { LogoMark } from '../../ui/Logo'
import { cx } from '../../ui/primitives'
import { PRINCIPLES } from '../shell/SharedPages'
import { SUITE_APPS } from '../suite/apps'
import { useSession } from '../suite/store'

const SIGN_UP = '/lab/enroll?return=/apps/signin'
const LOG_IN = '/apps/signin'
const EASE = [0.2, 0.8, 0.2, 1] as const

/** The public home page. Always rendered in the dark, futuristic look. */
export function Landing() {
  const session = useSession()
  const signedIn = !!session.identityId
  return (
    <div className="dark relative min-h-screen overflow-x-clip bg-bg text-ink">
      <Backdrop variant="hero" />

      <nav className="sticky top-3 z-40 px-3 sm:top-4">
        <div className="glass mx-auto flex h-14 max-w-5xl items-center justify-between rounded-2xl pr-2 pl-4">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoMark className="size-7 text-accent [--logo-fg:var(--bg)]" />
            <span className="text-[15px] font-semibold tracking-tight">Optic</span>
          </Link>
          <div className="hidden items-center gap-7 text-[13px] text-muted md:flex">
            <a href="#apps" className="transition hover:text-ink">Apps</a>
            <a href="#how" className="transition hover:text-ink">How it works</a>
            <a href="#glance" className="transition hover:text-ink">Glance</a>
            <a href="#security" className="transition hover:text-ink">Security</a>
            <Link to="/demo" className="transition hover:text-ink">Demo</Link>
          </div>
          <div className="flex items-center gap-1.5">
            {signedIn ? (
              <Link to="/apps" className="btn-glow flex h-9 items-center rounded-xl px-4 text-[13px] font-semibold" data-testid="nav-open-apps">
                {session.name?.split(' ')[0] ?? 'My'} · Open apps
              </Link>
            ) : (
              <>
                <Link to={LOG_IN} className="flex h-9 items-center rounded-xl px-3.5 text-[13px] font-medium text-muted transition hover:text-ink" data-testid="nav-login">
                  Log in
                </Link>
                <Link to={SIGN_UP} className="btn-glow flex h-9 items-center rounded-xl px-4 text-[13px] font-semibold" data-testid="nav-signup">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-5 pt-16 pb-10 sm:pt-24">
        <motion.div
          className="mx-auto max-w-4xl text-center"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-mono text-[10px] tracking-[0.1em] whitespace-nowrap text-muted uppercase sm:text-[11px] sm:tracking-[0.18em]">
            <span className="live-dot size-1.5 rounded-full bg-accent text-accent" /> One look · six apps
          </span>
          <h1 className="mt-7 text-[46px] leading-[0.98] font-semibold tracking-[-0.045em] sm:text-[80px]">
            <span className="text-gradient">One look.</span>
            <br />
            Everything unlocks.
          </h1>
          <p className="mx-auto mt-6 max-w-[600px] text-[16.5px] leading-relaxed text-muted sm:text-[18px]">
            Optic turns your eyes into a single account for your apps: passwords, private documents, a screen that
            guards itself, family screen time, focus and attendance. Nothing to remember, nothing to type.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            {signedIn ? (
              <Link to="/apps" className="btn-glow flex h-12 items-center gap-2 rounded-2xl px-6 text-[15px] font-semibold" data-testid="hero-open-apps">
                Open my apps <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link to={SIGN_UP} className="btn-glow flex h-12 items-center gap-2 rounded-2xl px-6 text-[15px] font-semibold" data-testid="hero-signup">
                  Create your account <ArrowRight className="size-4" />
                </Link>
                <Link to={LOG_IN} className="glass flex h-12 items-center gap-2 rounded-2xl px-6 text-[15px] font-medium text-ink transition hover:bg-surface-2" data-testid="hero-login">
                  <ScanEye className="size-4 text-accent" /> Log in with a glance
                </Link>
              </>
            )}
          </div>
          <p className="mt-4 text-[13px] text-subtle">
            Sign up takes about 20 seconds with your webcam.{' '}
            <Link to="/demo" className="text-accent-text underline-offset-4 hover:underline" data-testid="try-demo">
              Or take the guided demo
            </Link>
          </p>
        </motion.div>

        <motion.div
          className="relative mx-auto mt-14 max-w-5xl"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.15, ease: EASE }}
        >
          <IrisHud />
        </motion.div>
      </section>

      {/* Stats strip */}
      <section className="relative px-5">
        <div className="glass mx-auto grid max-w-5xl grid-cols-2 divide-line rounded-2xl md:grid-cols-4 md:divide-x">
          {[
            ['0', 'video frames stored'],
            ['128-D', 'on-device template'],
            ['AES-GCM', 'sealed at rest'],
            ['< 2 s', 'look to decision'],
          ].map(([v, l]) => (
            <div key={l} className="px-5 py-5 text-center">
              <div className="font-mono text-[22px] font-medium tracking-tight text-ink">{v}</div>
              <div className="mt-1 text-[11.5px] tracking-[0.14em] text-subtle uppercase">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Apps */}
      <Section id="apps" index="01" eyebrow="Optic Apps" title="Six apps. One account. Unlocked with a look.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SUITE_APPS.map((a) => (
            <Link key={a.id} to={a.to} className="glass hairline group rounded-3xl p-5 transition duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <IconChip icon={<a.icon className="size-5" />} />
                <ArrowUpRight className="size-4 text-subtle transition group-hover:text-accent" />
              </div>
              <div className="mt-5 text-[16px] font-semibold">Optic {a.name}</div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{a.tagline}</p>
              <p className="mt-4 font-mono text-[10.5px] tracking-[0.08em] text-subtle uppercase">{a.combines}</p>
            </Link>
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            ['Sign up once', 'Enroll your eyes with a webcam and your email. That is your whole account.'],
            ['Everything in one place', 'Scans, vault items, documents, profiles and history all live under that one account.'],
            ['Private by design', 'Encrypted templates stay on your device. No video is stored and no data leaves the browser.'],
          ].map(([t, b]) => (
            <div key={t} className="rounded-3xl border border-line/80 p-5">
              <div className="flex items-center gap-2 text-[14px] font-semibold"><Check className="size-4 text-accent" /> {t}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{b}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Problem */}
      <Section id="problem" index="02" eyebrow="The problem" title="Passwords and PINs prove what you know, not who you are.">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {[
            { icon: KeyRound, title: 'Passwords get reused', body: 'One leak and every account with the same password is open.' },
            { icon: Smartphone, title: 'PINs get passed on', body: 'A code knows nothing about who typed it.' },
            { icon: EyeOff, title: 'Screens get seen', body: 'Private messages and documents, read over a shoulder.' },
            { icon: Users, title: 'Shared devices blur people', body: 'Kids, parents and guests all use the same laptop and the same settings.' },
          ].map((c) => (
            <div key={c.title} className="glass rounded-3xl p-5">
              <c.icon className="size-5 text-subtle" />
              <div className="mt-5 text-[15px] font-semibold">{c.title}</div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{c.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* How */}
      <Section id="how" index="03" eyebrow="How Optic works" title="Look. Verify. Decide. Unlock.">
        <div className="relative grid gap-8 md:grid-cols-4 md:gap-4">
          <div className="pointer-events-none absolute top-[34px] right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent md:block" />
          {[
            ['01', 'Look', 'Your webcam finds your eyes and captures a few samples. Frames are processed on the device and discarded.'],
            ['02', 'Verify', 'Samples become a numeric template, compared against every enrolled account. Who is this?'],
            ['03', 'Decide', 'A policy engine checks whether this person may do this, right now: allowed readers, screen-time windows, check-in times.'],
            ['04', 'Unlock', 'The app opens, reveals or approves, or explains why not. Either way, it is logged.'],
          ].map(([n, t, b]) => (
            <div key={n} className="relative">
              <div className="glass relative z-10 flex size-[68px] items-center justify-center rounded-2xl font-mono text-[15px] text-accent shadow-[var(--glow)]">{n}</div>
              <div className="mt-5 text-[17px] font-semibold tracking-tight">{t}</div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{b}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Glance moments */}
      <Section id="glance" index="04" eyebrow="Glance to approve" title="The apps know who is looking, every moment.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MomentCard app="Vault" action="Reveal password" verdict="Approved" who="Verified · you" ok />
          <MomentCard app="Eyes-Only" action="Board memo" verdict="Hidden" who="Someone else is looking" />
          <MomentCard app="Guard" action="You walked away" verdict="Locked" who="Screen locked in 8 s" />
          <MomentCard app="Family" action="Maya sat down" verdict="Switched" who="Kids launcher · 42 min left" ok />
        </div>
      </Section>

      {/* Security */}
      <Section id="security" index="05" eyebrow="Security" title="Designed around what not to keep.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="glass rounded-3xl p-5">
              <p.icon className="size-5 text-accent" />
              <div className="mt-5 text-[14.5px] font-semibold">{p.title}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{p.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { icon: UserCog, title: 'You decide who', body: 'Choose readers for each document and profiles for each person. Nothing is shared by default.' },
            { icon: ListChecks, title: 'Complete audit trail', body: 'Every sign-in, approval and refusal, each with a reason.' },
            { icon: ShieldCheck, title: 'Instant revocation', body: 'Revoke a document, pause a profile or delete your account. Effective on the very next look.' },
          ].map((c) => (
            <div key={c.title} className="rounded-3xl border border-line/80 p-5">
              <c.icon className="size-5 text-subtle" />
              <div className="mt-4 text-[14.5px] font-semibold">{c.title}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{c.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-[12.5px] leading-relaxed text-subtle">
          Honest note: this is a prototype. A consumer webcam cannot capture iris detail like dedicated hardware, and there
          is no spoof detection. It demonstrates the product and architecture, not production-grade biometric security.
        </p>
      </Section>

      {/* CTA */}
      <section className="relative px-5 pt-8 pb-16">
        <div className="glass hairline relative mx-auto max-w-5xl overflow-hidden rounded-[36px] px-8 py-16 text-center">
          <div
            className="pointer-events-none absolute -top-40 left-1/2 size-[520px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
            style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 40%, transparent), transparent 65%)' }}
          />
          <LogoMark className="relative mx-auto size-12 text-accent [--logo-fg:var(--bg)]" />
          <h2 className="relative mt-7 text-[34px] leading-tight font-semibold tracking-[-0.03em] sm:text-[44px]">
            Your eyes are <span className="text-gradient">your account.</span>
          </h2>
          <p className="relative mt-3 text-[15px] text-muted">Sign up with your webcam in 20 seconds. Log in any time with a glance.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link to={SIGN_UP} className="btn-glow flex h-12 items-center gap-2 rounded-2xl px-6 text-[15px] font-semibold">
              Sign up <ArrowRight className="size-4" />
            </Link>
            <Link to={LOG_IN} className="glass flex h-12 items-center rounded-2xl px-6 text-[15px] font-medium transition hover:bg-surface-2">
              Log in
            </Link>
          </div>
        </div>
        <footer className="mx-auto mt-10 flex max-w-5xl flex-wrap items-center justify-between gap-4 font-mono text-[11px] tracking-[0.12em] text-subtle uppercase">
          <span>Optic · prototype</span>
          <span className="flex gap-5">
            <Link to="/demo" className="hover:text-ink">Guided demo</Link>
            <Link to="/lab" className="hover:text-ink">Sensor lab</Link>
            <Link to="/lab/architecture" className="hover:text-ink">Architecture</Link>
          </span>
        </footer>
      </section>
    </div>
  )
}

function IconChip({ icon }: { icon: ReactNode }) {
  return (
    <span className="flex size-11 items-center justify-center rounded-2xl border border-accent/25 bg-accent-soft text-accent shadow-[var(--glow)]">{icon}</span>
  )
}

function Section({ id, index, eyebrow, title, children }: { id: string; index: string; eyebrow: string; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <section id={id} className="relative scroll-mt-24 px-5 py-16 md:py-24">
      <motion.div
        ref={ref}
        className="mx-auto max-w-5xl"
        initial={{ opacity: 0, y: 18 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <div className="flex items-center gap-3 font-mono text-[11px] tracking-[0.2em] text-accent-text uppercase">
          <span className="text-subtle">[{index}]</span> {eyebrow}
          <span className="h-px w-16 bg-gradient-to-r from-accent/60 to-transparent" />
        </div>
        <h2 className="mt-4 max-w-3xl text-[32px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[44px]">{title}</h2>
        <div className="mt-12">{children}</div>
      </motion.div>
    </section>
  )
}

function MomentCard({ app, action, verdict, who, ok }: { app: string; action: string; verdict: string; who: string; ok?: boolean }) {
  return (
    <div className="glass hairline flex flex-col items-center rounded-3xl px-4 py-7 text-center">
      <div
        className={cx(
          'flex size-11 items-center justify-center rounded-full border',
          ok ? 'border-granted/40 bg-granted/10 text-granted shadow-[0_0_24px_-4px_rgba(61,220,151,0.6)]' : 'border-accent/40 bg-accent-soft text-accent shadow-[var(--glow)]',
        )}
      >
        {ok ? <Check className="size-5" /> : <ScanEye className="size-5" />}
      </div>
      <div className="mt-4 font-mono text-[10px] tracking-[0.24em] text-subtle uppercase">Optic {app}</div>
      <div className="mt-1 text-[15.5px] font-semibold">{action}</div>
      <div className={cx('mt-3 font-mono text-[12px] font-medium tracking-[0.18em] uppercase', ok ? 'text-granted' : 'text-accent')}>{verdict}</div>
      <div className="mt-1 text-[12px] text-muted">{who}</div>
    </div>
  )
}

const HUD_STAGES = [
  { key: 'locate', label: 'LOCATING EYES' },
  { key: 'capture', label: 'CAPTURING SAMPLES' },
  { key: 'match', label: 'MATCHING TEMPLATE' },
  { key: 'granted', label: 'UNLOCKED' },
] as const

/** Self-running scanner illustration: a large iris with rotating rings and live readouts (no camera). */
function IrisHud() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 5), 1500)
    return () => clearInterval(t)
  }, [])
  const stageIndex = Math.min(step, HUD_STAGES.length - 1)
  const stage = HUD_STAGES[stageIndex]
  const done = stage.key === 'granted'
  const color = done ? '#3ddc97' : '#54d6ff'
  const progress = Math.min(1, step / 3)

  // Iris fibres, generated once from a fixed seed so they never jump.
  const fibres = useMemo(() => {
    const rand = seededRandom('landing-iris')
    return Array.from({ length: 150 }, (_, k) => {
      const a = (k / 150) * Math.PI * 2 + rand() * 0.03
      return { a, r1: 30 + rand() * 12, r2: 70 + rand() * 30, o: 0.15 + rand() * 0.4 }
    })
  }, [])

  const readouts = [
    ['QUALITY', step >= 1 ? '0.94' : '—'],
    ['SAMPLES', `${Math.min(4, step * 2)}/4`],
    ['DISTANCE', step >= 3 ? '0.031' : step === 2 ? 'computing' : '—'],
    ['TEMPLATE', '128-D · AES-GCM'],
  ]

  return (
    <div className="glass hairline relative overflow-hidden rounded-[36px] px-4 py-8 sm:px-10 sm:py-10">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(45% 55% at 50% 50%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)' }} />
      <div className="relative flex items-center justify-between font-mono text-[10px] tracking-[0.28em] text-muted uppercase">
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} /> Optic sensor · live
        </span>
        <span className="hidden sm:inline">Optic Vault · unlock</span>
      </div>

      <div className="relative mt-6 grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
        <Readouts items={readouts.slice(0, 2)} align="right" />

        <div className="relative mx-auto aspect-square w-full max-w-[380px] md:w-[380px]">
          <svg viewBox="-200 -200 400 400" className="absolute inset-0 size-full" aria-hidden>
            <defs>
              <radialGradient id="iris-fill" r="1">
                <stop offset="0.2" stopColor="#0b1a26" />
                <stop offset="0.55" stopColor="#0f3547" />
                <stop offset="0.8" stopColor="#123c52" />
                <stop offset="1" stopColor="#061019" />
              </radialGradient>
              <linearGradient id="scan-grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity="0" />
                <stop offset="0.5" stopColor={color} stopOpacity="0.5" />
                <stop offset="1" stopColor={color} stopOpacity="0" />
              </linearGradient>
              <clipPath id="iris-clip">
                <circle r="104" />
              </clipPath>
            </defs>

            {/* Outer tick ring */}
            <g style={{ animation: 'optic-spin 60s linear infinite' }}>
              {Array.from({ length: 120 }, (_, k) => {
                const a = (k / 120) * Math.PI * 2
                const long = k % 10 === 0
                return (
                  <line
                    key={k}
                    x1={Math.cos(a) * 186}
                    y1={Math.sin(a) * 186}
                    x2={Math.cos(a) * (long ? 172 : 180)}
                    y2={Math.sin(a) * (long ? 172 : 180)}
                    stroke="var(--muted)"
                    strokeOpacity={long ? 0.6 : 0.25}
                  />
                )
              })}
            </g>
            {/* Progress ring */}
            <circle r="160" fill="none" stroke="var(--border-strong)" strokeWidth="2" />
            <circle
              r="160"
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={`${progress * 2 * Math.PI * 160} ${2 * Math.PI * 160}`}
              transform="rotate(-90)"
              style={{ transition: 'stroke-dasharray 900ms cubic-bezier(.2,.8,.2,1), stroke 400ms', filter: `drop-shadow(0 0 6px ${color})` }}
            />
            {/* Counter-rotating dashed rings */}
            <g style={{ animation: `optic-spin ${done ? 20 : 8}s linear infinite` }}>
              <circle r="140" fill="none" stroke={color} strokeOpacity="0.45" strokeDasharray="60 22 6 22" />
            </g>
            <g style={{ animation: `optic-spin-rev ${done ? 26 : 12}s linear infinite` }}>
              <circle r="124" fill="none" stroke={color} strokeOpacity="0.3" strokeDasharray="2 8" />
            </g>

            {/* Iris */}
            <circle r="104" fill="url(#iris-fill)" stroke={color} strokeOpacity="0.7" strokeWidth="1.2" />
            <g clipPath="url(#iris-clip)">
              {fibres.map((f, k) => (
                <line key={k} x1={Math.cos(f.a) * f.r1} y1={Math.sin(f.a) * f.r1} x2={Math.cos(f.a) * f.r2} y2={Math.sin(f.a) * f.r2} stroke="#7fdcff" strokeOpacity={f.o * 0.55} strokeWidth="0.8" />
              ))}
              {!done && <rect x="-104" y="-104" width="208" height="208" fill="url(#scan-grad)" style={{ animation: 'optic-scanline 1.5s ease-in-out infinite' }} />}
            </g>
            <circle r="34" fill="#020508" />
            <circle r="34" fill="none" stroke={color} strokeOpacity="0.5" />
            <circle cx="-11" cy="-12" r="7" fill="white" opacity="0.8" />
            <circle cx="9" cy="10" r="2.5" fill="white" opacity="0.35" />

            {/* Corner brackets */}
            {[0, 90, 180, 270].map((r) => (
              <path key={r} d="M -196 -150 L -196 -196 L -150 -196" fill="none" stroke={color} strokeWidth="1.5" transform={`rotate(${r})`} strokeOpacity="0.8" />
            ))}
          </svg>
        </div>

        <Readouts items={readouts.slice(2)} align="left" />
      </div>

      <div className="relative mt-6 text-center">
        <div className="font-mono text-[12px] tracking-[0.3em]" style={{ color, textShadow: `0 0 18px ${color}` }} data-testid="hud-stage">
          {stage.label}
        </div>
        <div className="mt-2 text-[22px] font-light tracking-tight text-ink/90">{done ? 'Welcome back' : step === 0 ? 'Look at the sensor' : 'Hold still'}</div>
      </div>
      <div className="relative mt-5 flex justify-center gap-1.5">
        {HUD_STAGES.map((s, k) => (
          <span
            key={s.key}
            className="h-1 w-10 rounded-full transition-all duration-500"
            style={{ background: k <= stageIndex ? color : 'color-mix(in srgb, var(--text) 12%, transparent)', boxShadow: k <= stageIndex ? `0 0 10px ${color}` : 'none' }}
          />
        ))}
      </div>
    </div>
  )
}

function Readouts({ items, align }: { items: string[][]; align: 'left' | 'right' }) {
  return (
    <div className={cx('hidden flex-col gap-3 md:flex', align === 'right' ? 'items-end text-right' : 'items-start text-left')}>
      {items.map(([k, v]) => (
        <div key={k} className="glass min-w-[150px] rounded-xl px-4 py-3">
          <div className="font-mono text-[9.5px] tracking-[0.24em] text-subtle">{k}</div>
          <div className="mt-1 font-mono text-[15px] text-ink tabular">{v}</div>
        </div>
      ))}
    </div>
  )
}
