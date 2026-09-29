import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, CircleSlash, Cpu, RotateCcw, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { AccessDecision, SiteAdapter } from '../../core/access/types'
import { SENSOR_ERROR_COPY, type SensorStatus } from '../../core/sensor/types'
import { formatDateRange, formatTime, isSameDay } from '../../ui/format'
import { cx } from '../../ui/primitives'
import { useStore } from '../../state/store'
import { authCopy } from './copy'
import { useSensor, useSensorConfig } from './hooks'
import { SensorViewport, type ViewportTone } from './SensorViewport'
import { useAuthFlow, type AuthPhase } from './useAuthFlow'

interface Props {
  /** Location shown on the terminal, e.g. "MAIN ENTRANCE" or "ROOM 814". */
  location?: string
  adapter?: SiteAdapter
  resourceId?: string
  autoResetMs?: number | null
  onDecision?: (d: AccessDecision) => void
  /** Rendered beside the viewport (e.g. the virtual door). */
  aside?: (state: { phase: AuthPhase; decision: AccessDecision | null }) => ReactNode
  /** Text shown while authorization runs, e.g. "Checking room access…". */
  authorizingText?: string
  className?: string
}

export function OpticTerminal({
  location,
  adapter,
  resourceId,
  autoResetMs = null,
  onDecision,
  aside,
  authorizingText = 'Checking access…',
  className,
}: Props) {
  const config = useSensorConfig()
  const demo = useStore((s) => s.demo)
  const showDiagnostics = useStore((s) => s.settings.showDiagnostics)
  const { sensor, status, observation, retry } = useSensor(config)
  const flow = useAuthFlow({
    sensor,
    status,
    observation,
    adapter,
    resourceId,
    demo: !!config.demoSubject,
    autoResetMs,
    onDecision,
  })
  const { phase, progress, decision, recognizedName, reset } = flow
  const copy = authCopy(phase, observation, decision, recognizedName)

  const tone: ViewportTone =
    phase === 'result'
      ? decision?.outcome === 'granted'
        ? 'granted'
        : 'denied'
      : phase === 'authorizing'
        ? 'granted'
        : phase === 'analyzing' || phase === 'verifying'
          ? 'active'
          : phase === 'eyes' || phase === 'face'
            ? 'tracking'
            : 'idle'

  const labelColor =
    tone === 'granted' ? 'text-granted' : tone === 'denied' ? (decision?.outcome === 'unable' ? 'text-[#f5b454]' : 'text-denied') : 'text-scan-accent'

  return (
    <div className={cx('flex w-full flex-col items-center', className)}>
      <div className="flex w-full flex-col items-stretch gap-6 lg:flex-row lg:items-center lg:justify-center">
        <div className="relative w-full max-w-[860px] flex-1">
          <SensorViewport
            sensor={sensor}
            observation={observation}
            running={status.state === 'running'}
            tone={tone}
            progress={phase === 'analyzing' || phase === 'verifying' || phase === 'authorizing' || phase === 'result' ? (phase === 'analyzing' ? progress : 1) : 0}
            scanning={phase === 'analyzing'}
            dimmed={phase === 'result' || phase === 'error'}
            className="aspect-[16/10] w-full rounded-[28px] ring-1 ring-white/[0.07]"
          >
            {phase === 'initializing' && <InitializingOverlay status={status} />}
            <AnimatePresence>
              {phase === 'result' && decision && (
                <ResultCard key={decision.id} decision={decision} showDiagnostics={showDiagnostics} onReset={reset} />
              )}
            </AnimatePresence>
            {phase === 'error' && status.state === 'error' && (
              <ErrorCard status={status} onRetry={retry} />
            )}
            {config.demoSubject && (
              <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full border border-[#f5b454]/30 bg-black/60 px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] text-[#f5b454] uppercase backdrop-blur">
                <span className="size-1.5 rounded-full bg-[#f5b454]" /> Demo mode · {config.subjectLabel}
              </div>
            )}
          </SensorViewport>
        </div>
        {aside?.({ phase, decision })}
      </div>

      {/* Status */}
      <div className="mt-8 flex min-h-[112px] flex-col items-center text-center" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.div
            key={copy.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            className={cx('flex items-center gap-2 font-mono text-[12px] tracking-[0.28em] uppercase', labelColor)}
            data-testid="sensor-label"
          >
            {(phase === 'initializing' || phase === 'analyzing' || phase === 'verifying' || phase === 'authorizing') && (
              <span className="size-1.5 animate-[optic-pulse_1s_ease-in-out_infinite] rounded-full bg-current" />
            )}
            {copy.label}
          </motion.div>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div
            key={copy.instruction + phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={cx(
              'mt-3 text-[28px] font-light tracking-tight text-white/90 sm:text-[32px]',
              phase === 'authorizing' && 'font-medium tracking-[0.06em] uppercase',
            )}
            data-testid="sensor-instruction"
          >
            {phase === 'result' ? ' ' : copy.instruction}
          </motion.div>
        </AnimatePresence>
        {phase === 'authorizing' && (
          <div className="mt-2 text-[15px] text-white/50">
            {location ? `${authorizingText.replace('…', '')} · ${location}` : authorizingText}
          </div>
        )}
      </div>

      <PipelineStepper phase={phase} decision={decision} />

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">
        <span className="flex items-center gap-1.5">
          <Cpu className="size-3" /> {sensor.descriptor.name}
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3" /> On-device processing · no video stored
        </span>
        {demo.clockOffsetMs !== 0 && <span className="text-[#f5b454]/70">Simulated clock</span>}
      </div>
    </div>
  )
}

function InitializingOverlay({ status }: { status: SensorStatus }) {
  const detail = status.state === 'starting' ? status.detail : 'Preparing sensor'
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <svg viewBox="0 0 120 120" className="size-28 text-scan">
        <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
        <g style={{ animation: 'optic-spin 2.4s linear infinite', transformOrigin: '60px 60px' }}>
          <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="40 236" strokeLinecap="round" />
        </g>
        <g style={{ animation: 'optic-spin-rev 5s linear infinite', transformOrigin: '60px 60px' }}>
          <circle cx="60" cy="60" r="32" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.8" strokeDasharray="2 6" />
        </g>
        <circle cx="60" cy="60" r="12" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1" />
        <circle cx="60" cy="60" r="2" fill="currentColor" />
      </svg>
      <div className="mt-4 font-mono text-[10px] tracking-[0.22em] text-scan/50 uppercase">{detail}</div>
    </div>
  )
}

const STEPS = ['Sensor', 'Eye', 'Iris', 'Identity', 'Access'] as const

function PipelineStepper({ phase, decision }: { phase: AuthPhase; decision: AccessDecision | null }) {
  const reached: Record<AuthPhase, number> = {
    initializing: 0,
    error: 0,
    searching: 1,
    face: 1,
    eyes: 2,
    analyzing: 2,
    verifying: 3,
    authorizing: 4,
    result: 5,
  }
  const at = reached[phase]
  const failedAt =
    phase === 'error'
      ? 0
      : phase === 'result' && decision
        ? decision.outcome === 'unable'
          ? 2
          : decision.outcome === 'denied-unrecognized'
            ? 3
            : decision.outcome === 'denied-unauthorized'
              ? 4
              : -1
        : -1
  return (
    <div className="mt-6 flex items-center gap-2" aria-hidden>
      {STEPS.map((step, i) => {
        const failed = i === failedAt
        const done = !failed && (i < at || (phase === 'result' && failedAt === -1))
        const active = !failed && !done && i === at
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={cx(
                'flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase transition-colors duration-300',
                failed ? 'text-denied' : done ? 'text-white/75' : active ? 'text-scan-accent' : 'text-white/25',
              )}
            >
              <span
                className={cx(
                  'flex size-3.5 items-center justify-center rounded-full border transition-colors duration-300',
                  failed ? 'border-denied bg-denied/15' : done ? 'border-white/60 bg-white/10' : active ? 'border-scan-accent' : 'border-white/20',
                )}
              >
                {done && <Check className="size-2" strokeWidth={3} />}
                {failed && <X className="size-2" strokeWidth={3} />}
                {active && <span className="size-1 animate-[optic-pulse_1s_ease-in-out_infinite] rounded-full bg-scan-accent" />}
              </span>
              <span className="hidden sm:inline">{step}</span>
            </div>
            {i < STEPS.length - 1 && <span className="h-px w-5 bg-white/15 sm:w-8" />}
          </div>
        )
      })}
    </div>
  )
}

function ResultCard({
  decision,
  showDiagnostics,
  onReset,
}: {
  decision: AccessDecision
  showDiagnostics: boolean
  onReset: () => void
}) {
  const granted = decision.outcome === 'granted'
  const unable = decision.outcome === 'unable'
  const verified = decision.identity.status === 'verified' ? decision.identity : null
  const color = granted ? 'text-granted' : unable ? 'text-[#f5b454]' : 'text-denied'
  const window = decision.authorization?.principal?.window
  const principalKind = decision.authorization?.principal?.kind
  const generic = ['ACCESS DENIED', 'NOT AUTHORIZED', 'Identity not recognized', 'Scan incomplete'].includes(decision.title)

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      data-testid="result-card"
      data-outcome={decision.outcome}
    >
      <motion.div
        initial={{ scale: 0.96, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="flex w-full max-w-[460px] flex-col items-center rounded-3xl border border-white/10 bg-black/55 px-8 py-8 text-center backdrop-blur-xl"
      >
        <div
          className={cx(
            'mb-5 flex size-14 items-center justify-center rounded-full border',
            granted ? 'border-granted/40 bg-granted/10' : unable ? 'border-[#f5b454]/40 bg-[#f5b454]/10' : 'border-denied/40 bg-denied/10',
            color,
          )}
        >
          {granted ? <Check className="size-6" strokeWidth={2.2} /> : unable ? <AlertTriangle className="size-6" /> : verified ? <CircleSlash className="size-6" /> : <X className="size-6" strokeWidth={2.2} />}
        </div>
        <div className="font-mono text-[11px] tracking-[0.26em] text-white/55 uppercase">
          {verified ? 'Identity verified' : unable ? 'Unable to authenticate' : 'Identity not recognized'}
        </div>
        {verified && <div className="mt-2 text-[26px] font-semibold tracking-tight text-white" data-testid="result-name">{verified.identity.name}</div>}
        {decision.resource && (
          <div className="mt-1 text-[13px] font-medium tracking-[0.2em] text-white/60 uppercase">{decision.resource.name}</div>
        )}
        <div className={cx('mt-5 text-[22px] font-semibold tracking-[0.16em]', color)} data-testid="result-headline">
          {decision.headline}
        </div>
        {!granted && !generic && (
          <div className={cx('mt-1 text-[13px] font-semibold tracking-[0.14em] uppercase', color)}>{decision.title}</div>
        )}
        <div className="mt-2 max-w-[340px] text-[14px] leading-relaxed text-white/65">
          {granted && verified && !decision.resource
            ? `Welcome, ${verified.identity.name}. ${decision.detail}`
            : granted && decision.resource && decision.detail !== decision.resource.name
              ? decision.detail
              : granted
                ? `Welcome, ${verified?.identity.name.split(' ')[0]}.`
                : decision.detail}
        </div>
        {window && (principalKind === 'guest' || principalKind === 'visitor') && (
          <div className="mt-4 rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] tracking-[0.1em] text-white/60">
            {principalKind === 'guest' ? 'STAY ' : 'VISIT '}
            {isSameDay(window.from, window.until)
              ? `${formatTime(window.from)}–${formatTime(window.until)}`
              : formatDateRange(window.from, window.until)}
          </div>
        )}
        {showDiagnostics && <Diagnostics decision={decision} />}
        <button
          onClick={onReset}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] text-white/50 transition hover:bg-white/5 hover:text-white/80"
        >
          <RotateCcw className="size-3" /> Scan again
        </button>
      </motion.div>
    </motion.div>
  )
}

function Diagnostics({ decision }: { decision: AccessDecision }) {
  const id = decision.identity
  const rows: [string, string][] = [['samples', String(id.probeCount)]]
  if (id.status === 'verified') {
    rows.push(['confidence', id.confidence.toFixed(3)], ['embed Δ', id.distance.toFixed(3)])
    if (id.components.irisHamming !== null) rows.push(['iris HD', id.components.irisHamming.toFixed(3)])
    if (id.components.geometryDeviation !== null) rows.push(['geom σ', id.components.geometryDeviation.toFixed(2)])
  } else if (id.status === 'not-recognized') {
    rows.push(['best conf', id.confidence.toFixed(3)], ['best Δ', id.distance?.toFixed(3) ?? '—'])
  }
  if (decision.authorization) rows.push(['policy', decision.authorization.code])
  return (
    <div className="mt-5 grid w-full grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left font-mono text-[10.5px] text-white/55">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2">
          <span className="text-white/35">{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  )
}

function ErrorCard({ status, onRetry }: { status: Extract<SensorStatus, { state: 'error' }>; onRetry: () => void }) {
  const copy = SENSOR_ERROR_COPY[status.error.code]
  const setDemo = useStore((s) => s.setDemo)
  const setSettings = useStore((s) => s.setSettings)
  const [details, setDetails] = useState(false)
  useEffect(() => setDetails(false), [status])
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6" data-testid="sensor-error">
      <div className="flex max-w-[420px] flex-col items-center rounded-3xl border border-white/10 bg-black/60 px-8 py-8 text-center backdrop-blur-xl">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-[#f5b454]/40 bg-[#f5b454]/10 text-[#f5b454]">
          <AlertTriangle className="size-5" />
        </div>
        <div className="text-[18px] font-semibold text-white">{copy.title}</div>
        <p className="mt-2 text-[14px] leading-relaxed text-white/60">{copy.hint}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={onRetry} className="h-9 rounded-lg bg-white px-4 text-[13px] font-medium text-black hover:bg-white/90">
            Try again
          </button>
          <button
            onClick={() => {
              setSettings({ sensorKind: 'simulated' })
              setDemo({ enabled: true })
            }}
            className="h-9 rounded-lg border border-white/15 px-4 text-[13px] font-medium text-white/80 hover:bg-white/5"
          >
            Use simulated sensor
          </button>
        </div>
        <button onClick={() => setDetails((d) => !d)} className="mt-4 text-[11px] text-white/35 hover:text-white/60">
          {details ? status.error.message : 'Technical details'}
        </button>
      </div>
    </div>
  )
}
