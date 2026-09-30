import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, Lock, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildTemplate, TemplateError } from '../../core/biometric/template'
import type { BiometricSample, OpticTemplate } from '../../core/biometric/types'
import type { Identity, IdentityOrigin, OpticScan } from '../../core/identity/types'
import {
  baselineFrom,
  collectSamples,
  ENROLLMENT_STEPS,
  lookVector,
  poseProgress,
  type PoseBaseline,
} from '../../core/sensor/capture'
import { SimulatedSensor } from '../../core/sensor/simulated/SimulatedSensor'
import { SENSOR_ERROR_COPY } from '../../core/sensor/types'
import { identityService } from '../../state/services'
import { useStore } from '../../state/store'
import { formatBytes } from '../../ui/format'
import { cx } from '../../ui/primitives'
import { guidanceFor } from './copy'
import { useSensor } from './hooks'
import { SensorViewport } from './SensorViewport'

export interface EnrollmentSubject {
  identityId?: string
  name: string
  email?: string
  externalId?: string
  origin: IdentityOrigin
}

type Stage =
  | { kind: 'position' }
  | { kind: 'step'; index: number; capturing: boolean }
  | { kind: 'processing' }
  | { kind: 'review'; template: OpticTemplate; duplicate: Identity | null }
  | { kind: 'saving' }
  | { kind: 'done'; identity: Identity; scan: OpticScan }
  | { kind: 'failed'; message: string }

const STEP_TIMEOUT_MS = 9000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function EnrollmentSession({
  subject,
  defaultLabel,
  onComplete,
  onCancel,
}: {
  subject: EnrollmentSubject
  defaultLabel?: string
  onComplete?: (r: { identity: Identity; scan: OpticScan }) => void
  onCancel?: () => void
}) {
  const demo = useStore((s) => s.demo)
  const sensorKind = useStore((s) => s.settings.sensorKind)
  // One account per email: enrolling with a known email adds a scan to that account.
  const plannedId = useMemo(
    () =>
      subject.identityId ??
      identityService.findAccountByEmail(subject.email)?.id ??
      `idn_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
    [subject.identityId, subject.email],
  )
  // Enrollment always uses the live camera. Only an explicit simulated sensor enrolls a synthetic identity.
  const simulated = demo.enabled && sensorKind === 'simulated'
  const demoSeed = simulated ? `identity:${plannedId}` : undefined
  const config = useMemo(
    () => ({
      kind: simulated ? ('simulated' as const) : ('webcam' as const),
      demoSubject: simulated ? { seed: demoSeed!, label: subject.name } : null,
      key: `enroll:${simulated}:${plannedId}`,
    }),
    [simulated, demoSeed, plannedId, subject.name],
  )
  const { sensor, status, observation, retry } = useSensor(config)

  const [stage, setStage] = useState<Stage>({ kind: 'position' })
  const [stepProgress, setStepProgress] = useState(0)
  const [captured, setCaptured] = useState(0)
  const [label, setLabel] = useState(defaultLabel ?? `Primary scan · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`)
  const samples = useRef<{ sample: BiometricSample; pose: string }[]>([])
  const baseline = useRef<PoseBaseline>({ yaw: 0, pitch: 0, gazeX: 0, gazeY: 0 })
  const stageRef = useRef(stage)
  stageRef.current = stage
  const obsRef = useRef(observation)
  obsRef.current = observation
  const holdStart = useRef<number | null>(null)
  const stepStart = useRef(0)
  const busy = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const total = ENROLLMENT_STEPS.reduce((a, s) => a + s.samples, 0)

  const runCapture = useCallback(
    async (index: number) => {
      if (busy.current) return
      busy.current = true
      const step = ENROLLMENT_STEPS[index]
      setStage({ kind: 'step', index, capturing: true })
      const got = await collectSamples(sensor, {
        count: step.samples,
        timeoutMs: 5000,
        onSample: () => setCaptured((c) => c + 1),
      })
      if (!alive.current) return
      samples.current.push(...got.map((sample) => ({ sample, pose: step.pose })))
      if (step.pose === 'center' && obsRef.current) baseline.current = baselineFrom(obsRef.current)
      await sleep(350)
      busy.current = false
      holdStart.current = null
      if (index + 1 < ENROLLMENT_STEPS.length) {
        stepStart.current = performance.now()
        setStage({ kind: 'step', index: index + 1, capturing: false })
      } else {
        finish()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sensor],
  )

  const finish = async () => {
    setStage({ kind: 'processing' })
    if (sensor instanceof SimulatedSensor) sensor.follow({ x: 0, y: 0 })
    await sleep(900)
    try {
      const template = buildTemplate(
        samples.current.map((s) => s.sample),
        samples.current.map((s) => s.pose),
      )
      // Duplicate check: does this eye already belong to someone else?
      const check = await identityService.verify(samples.current.map((s) => s.sample))
      // Same eyes already on a different real account → offer to add this scan to it instead.
      const duplicate =
        check.status === 'verified' && check.identity.id !== plannedId && !check.identity.synthetic ? check.identity : null
      if (alive.current) setStage({ kind: 'review', template, duplicate })
    } catch (err) {
      const message = err instanceof TemplateError ? err.message : 'Enrollment failed.'
      if (alive.current) setStage({ kind: 'failed', message })
    }
  }

  // Drive the guided steps from live observations.
  useEffect(() => {
    const st = stageRef.current
    const o = observation
    if (!o || status.state !== 'running' || busy.current) return
    const steady = o.presence === 'eyes' && o.quality.score >= 0.35
    if (st.kind === 'position') {
      if (!steady) {
        holdStart.current = null
        return
      }
      holdStart.current ??= performance.now()
      if (performance.now() - holdStart.current > 700) {
        holdStart.current = null
        stepStart.current = performance.now()
        setStage({ kind: 'step', index: 0, capturing: false })
      }
      return
    }
    if (st.kind !== 'step' || st.capturing) return
    const step = ENROLLMENT_STEPS[st.index]
    const p = step.pose === 'center' ? (steady ? 1 : 0) : o.presence === 'eyes' ? poseProgress(step.pose, lookVector(o, baseline.current)) : 0
    setStepProgress(p)
    const timedOut = performance.now() - stepStart.current > STEP_TIMEOUT_MS
    if (p >= 0.95 || (timedOut && o.presence === 'eyes')) {
      holdStart.current ??= performance.now()
      if (performance.now() - holdStart.current > (step.pose === 'center' ? 400 : 250) || timedOut) void runCapture(st.index)
    } else holdStart.current = null
  }, [observation, status.state, runCapture])

  // Simulated subject follows the instructions.
  useEffect(() => {
    if (!(sensor instanceof SimulatedSensor) || stage.kind !== 'step') return
    const step = ENROLLMENT_STEPS[stage.index]
    const t = setTimeout(() => sensor.follow({ x: -step.arrow.x, y: step.arrow.y }), 700)
    return () => clearTimeout(t)
  }, [sensor, stage])

  const save = async (template: OpticTemplate, into?: Identity) => {
    setStage({ kind: 'saving' })
    const result = await identityService.enroll(
      into
        ? { ...subject, identityId: into.id, name: into.name, email: into.email, label: label.trim() || 'Optic scan' }
        : { ...subject, identityId: plannedId, label: label.trim() || 'Optic scan', demoSeed },
      template,
    )
    samples.current = [] // drop in-memory samples
    await sensor.stop()
    setStage({ kind: 'done', ...result })
    onComplete?.(result)
  }

  const restart = () => {
    samples.current = []
    setCaptured(0)
    holdStart.current = null
    busy.current = false
    setStage({ kind: 'position' })
    if (sensor.getStatus().state !== 'running') retry()
  }

  const step = stage.kind === 'step' ? ENROLLMENT_STEPS[stage.index] : null
  const hint = guidanceFor(observation)
  const instruction =
    status.state === 'error'
      ? SENSOR_ERROR_COPY[status.error.code].title
      : status.state !== 'running' && stage.kind === 'position'
        ? 'Starting sensor…'
        : stage.kind === 'position'
          ? observation?.presence === 'eyes'
            ? 'Hold still'
            : 'Position yourself in front of the sensor'
          : step
            ? stage.kind === 'step' && stage.capturing
              ? 'Hold it there'
              : step.instruction
            : stage.kind === 'processing'
              ? 'Building optic template'
              : ''
  const labelText =
    status.state !== 'running' && stage.kind === 'position'
      ? 'Initializing sensor'
      : stage.kind === 'position'
        ? observation?.presence === 'eyes'
          ? 'Eye detected'
          : 'Locating eye'
        : step
          ? `Step ${ENROLLMENT_STEPS.indexOf(step) + 1} of ${ENROLLMENT_STEPS.length} · ${stage.kind === 'step' && stage.capturing ? 'Capturing' : 'Guidance'}`
          : stage.kind === 'processing'
            ? 'Processing'
            : ''

  const showSensor = stage.kind === 'position' || stage.kind === 'step' || stage.kind === 'processing'

  return (
    <div className="flex w-full flex-col items-center" data-testid="enrollment">
      {showSensor ? (
        <>
          <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-center">
            <div className="relative w-full max-w-[820px] flex-1">
              <SensorViewport
                sensor={sensor}
                observation={observation}
                running={status.state === 'running'}
                tone={stage.kind === 'processing' ? 'granted' : stage.kind === 'step' ? 'active' : observation?.presence === 'eyes' ? 'tracking' : 'idle'}
                progress={captured / total}
                scanning={stage.kind === 'step' && stage.capturing}
                guide={step && !(stage.kind === 'step' && stage.capturing) ? step.arrow : null}
                dimmed={status.state === 'error'}
                className="aspect-[16/10] w-full rounded-[28px] ring-1 ring-white/[0.07]"
              >
                {status.state === 'error' && (
                  <div className="absolute inset-0 flex items-center justify-center p-6">
                    <div className="max-w-sm rounded-2xl border border-white/10 bg-black/60 p-6 text-center backdrop-blur">
                      <AlertTriangle className="mx-auto mb-3 size-5 text-[#f5b454]" />
                      <div className="font-semibold text-white">{SENSOR_ERROR_COPY[status.error.code].title}</div>
                      <p className="mt-1.5 text-[13px] text-white/60">{SENSOR_ERROR_COPY[status.error.code].hint}</p>
                      <button onClick={retry} className="mt-4 h-9 rounded-lg bg-white px-4 text-[13px] font-medium text-black">
                        Try again
                      </button>
                    </div>
                  </div>
                )}
              </SensorViewport>
            </div>
            <StepList stageIndex={step ? ENROLLMENT_STEPS.indexOf(step) : stage.kind === 'processing' ? ENROLLMENT_STEPS.length : -1} capturing={stage.kind === 'step' && stage.capturing} progress={stepProgress} />
          </div>
          <div className="mt-8 flex min-h-[100px] flex-col items-center text-center" aria-live="polite">
            <div className="font-mono text-[12px] tracking-[0.26em] text-scan-accent uppercase" data-testid="enroll-label">{labelText}</div>
            <AnimatePresence mode="wait">
              <motion.div
                key={instruction}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="mt-3 text-[30px] font-light tracking-tight text-white/90"
                data-testid="enroll-instruction"
              >
                {instruction}
              </motion.div>
            </AnimatePresence>
            <div className="mt-2 h-5 text-[14px] text-white/45">
              {hint && hint !== 'Hold still' && status.state === 'running' ? hint : step && !stage.kind.startsWith('p') ? `${captured} of ${total} samples` : ''}
            </div>
          </div>
          {onCancel && (
            <button onClick={onCancel} className="mt-4 text-[13px] text-white/40 hover:text-white/70">
              Cancel enrollment
            </button>
          )}
        </>
      ) : (
        <div className="w-full max-w-[520px]">
          {stage.kind === 'review' && (
            <ReviewCard
              template={stage.template}
              duplicate={stage.duplicate}
              subjectName={subject.name}
              label={label}
              setLabel={setLabel}
              onSave={() => save(stage.template)}
              onSaveInto={(identity) => save(stage.template, identity)}
              existingAccount={identityService.getIdentity(plannedId) ?? null}
              onRestart={restart}
            />
          )}
          {stage.kind === 'saving' && <Panel><div className="py-10 text-center text-white/60">Sealing template…</div></Panel>}
          {stage.kind === 'done' && <DoneCard identity={stage.identity} scan={stage.scan} />}
          {stage.kind === 'failed' && (
            <Panel>
              <div className="text-center">
                <AlertTriangle className="mx-auto mb-3 size-6 text-[#f5b454]" />
                <div className="text-[18px] font-semibold text-white">Enrollment incomplete</div>
                <p className="mt-2 text-[14px] text-white/60">{stage.message} Make sure your face is well lit and centered.</p>
                <button onClick={restart} className="mt-5 h-10 rounded-lg bg-white px-5 text-[14px] font-medium text-black">
                  Start over
                </button>
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  )
}

function StepList({ stageIndex, capturing, progress }: { stageIndex: number; capturing: boolean; progress: number }) {
  return (
    <div className="flex w-full flex-row gap-2 overflow-x-auto lg:w-[220px] lg:flex-col lg:justify-center">
      {ENROLLMENT_STEPS.map((s, i) => {
        const done = i < stageIndex
        const active = i === stageIndex
        return (
          <div
            key={s.pose}
            className={cx(
              'flex min-w-[150px] items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-300',
              active ? 'border-scan-accent/40 bg-scan-accent/[0.06]' : 'border-white/[0.06]',
            )}
          >
            <span
              className={cx(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px]',
                done ? 'border-granted/50 bg-granted/10 text-granted' : active ? 'border-scan-accent text-scan-accent' : 'border-white/15 text-white/30',
              )}
            >
              {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className={cx('truncate text-[13px]', done || active ? 'text-white/85' : 'text-white/35')}>{s.instruction}</div>
              {active && (
                <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-scan-accent transition-[width] duration-200"
                    style={{ width: `${(capturing ? 1 : progress) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur"
    >
      {children}
    </motion.div>
  )
}

function ReviewCard({
  template,
  duplicate,
  subjectName,
  label,
  setLabel,
  onSave,
  onSaveInto,
  existingAccount,
  onRestart,
}: {
  template: OpticTemplate
  duplicate: Identity | null
  subjectName: string
  label: string
  setLabel: (v: string) => void
  onSave: () => void
  onSaveInto: (identity: Identity) => void
  existingAccount: Identity | null
  onRestart: () => void
}) {
  const norm = (x: string) => x.trim().toLowerCase().replace(/\s+/g, ' ')
  const lookAlike = !!duplicate && !!subjectName.trim() && norm(subjectName) !== norm(duplicate.name)
  const size = new TextEncoder().encode(JSON.stringify(template)).length
  return (
    <Panel>
      <div className="font-mono text-[11px] tracking-[0.24em] text-granted uppercase">Capture complete</div>
      <div className="mt-2 text-[24px] font-semibold tracking-tight text-white">Name this optic scan</div>
      <p className="mt-1 text-[14px] text-white/55">for {subjectName}. You can rename it later.</p>
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSave()}
        className="mt-5 h-11 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-[15px] text-white outline-none placeholder:text-white/30 focus:border-scan-accent/60"
        placeholder="e.g. Office desk · daylight"
        data-testid="scan-label"
      />
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[
          ['Samples', String(template.sampleCount)],
          ['Quality', `${Math.round(template.quality * 100)}%`],
          ['Poses', `${template.poses.length}/5`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-white/[0.07] bg-white/[0.02] py-3">
            <div className="text-[18px] font-semibold text-white tabular">{v}</div>
            <div className="mt-0.5 text-[11px] tracking-wide text-white/40 uppercase">{k}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-2 rounded-xl border border-white/[0.07] bg-black/20 p-4 text-[13px]">
        <div className="flex items-start gap-2.5 text-white/75">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-granted" />
          <span>
            <b className="font-medium text-white">Stored:</b> one encrypted template ({formatBytes(size)}) of numeric features.
          </span>
        </div>
        <div className="flex items-start gap-2.5 text-white/75">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-granted" />
          <span>
            <b className="font-medium text-white">Not stored:</b> video, photos or eye images. Frames were discarded after processing.
          </span>
        </div>
      </div>
      {existingAccount && !duplicate && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-[13px] text-white/70">
          This scan will be added to your existing account, <b className="text-white">{existingAccount.name}</b>.
        </div>
      )}
      {duplicate && lookAlike && (
        <div className="mt-4 rounded-xl border border-[#f5b454]/30 bg-[#f5b454]/[0.07] p-3.5 text-[13px] text-[#f5d49a]" data-testid="enroll-duplicate">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              These eyes look a lot like <b>{duplicate.name}</b>. If you are a different person (siblings often look alike),
              save this as your own account. Once you are both enrolled, Optic tells you apart.
            </span>
          </div>
        </div>
      )}
      {duplicate && !lookAlike && (
        <div className="mt-4 rounded-xl border border-[#f5b454]/30 bg-[#f5b454]/[0.07] p-3.5 text-[13px] text-[#f5d49a]" data-testid="enroll-duplicate">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              These eyes already belong to the account <b>{duplicate.name}</b>
              {duplicate.email ? ` (${duplicate.email})` : ''}. Add this scan there so everything stays in one account.
            </span>
          </div>
          <button
            onClick={() => onSaveInto(duplicate)}
            className="mt-3 h-10 w-full rounded-lg bg-[#f5b454] text-[13.5px] font-semibold text-black hover:bg-[#f5b454]/90"
            data-testid="save-into-existing"
          >
            Add to {duplicate.name}’s account
          </button>
        </div>
      )}
      <div className="mt-6 flex gap-2">
        <button onClick={onRestart} className="h-11 flex-1 rounded-xl border border-white/15 text-[14px] font-medium text-white/80 hover:bg-white/5">
          Retake
        </button>
        <button
          onClick={onSave}
          className={
            duplicate && !lookAlike
              ? 'h-11 flex-[2] rounded-xl border border-white/15 text-[14px] font-medium text-white/70 hover:bg-white/5'
              : 'h-11 flex-[2] rounded-xl bg-white text-[14px] font-semibold text-black hover:bg-white/90'
          }
          data-testid="save-scan"
        >
          {duplicate ? (lookAlike ? `Create ${subjectName.split(' ')[0] || 'my'}’s own account` : 'Keep as a separate account') : existingAccount ? 'Add to my account' : 'Save optic identity'}
        </button>
      </div>
      {duplicate && lookAlike && (
        <button
          onClick={() => onSaveInto(duplicate)}
          className="mt-3 w-full text-center text-[12.5px] text-white/50 underline-offset-2 hover:text-white/80 hover:underline"
          data-testid="save-into-existing"
        >
          Actually, I am {duplicate.name}. Add this scan to that account
        </button>
      )}
    </Panel>
  )
}

function DoneCard({ identity, scan }: { identity: Identity; scan: OpticScan }) {
  return (
    <Panel>
      <div className="flex flex-col items-center text-center" data-testid="enroll-done">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="mb-5 flex size-14 items-center justify-center rounded-full border border-granted/40 bg-granted/10 text-granted"
        >
          <Check className="size-6" strokeWidth={2.4} />
        </motion.div>
        <div className="font-mono text-[11px] tracking-[0.24em] text-granted uppercase">Identity enrolled</div>
        <div className="mt-2 text-[26px] font-semibold tracking-tight text-white">{identity.name}</div>
        <div className="mt-1 text-[14px] text-white/55">“{scan.label}”</div>
        <div className="mt-4 rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] text-white/50">
          template {scan.fingerprint}
        </div>
      </div>
    </Panel>
  )
}
