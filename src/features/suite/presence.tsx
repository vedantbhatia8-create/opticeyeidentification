/**
 * Presence engine for the Optic apps.
 *
 * One shared sensor answers, continuously:
 *   • who is at the screen (1:N identification every ~2 s, debounced)
 *   • how many faces are visible
 *   • whether the person is actually looking at the screen
 *
 * Apps subscribe with `usePresence()`; the camera only runs while at least
 * one app needs it. `useGlance().verify()` provides step-up "glance to
 * approve" checks on top of the same sensor.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ScanEye, X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_MATCH_POLICY } from '../../core/biometric/matcher'
import { identityService } from '../../core/identity/IdentityService'
import { collectSamples } from '../../core/sensor/capture'
import type { BiometricSensor, SensorObservation, SensorStatus } from '../../core/sensor/types'
import { SENSOR_ERROR_COPY } from '../../core/sensor/types'
import { useStore } from '../../state/store'
import { cx } from '../../ui/primitives'
import { guidanceFor } from '../sensor/copy'
import { useSensor, useSensorConfig } from '../sensor/hooks'
import { SensorViewport } from '../sensor/SensorViewport'
import { captureSnapshot, recordBreakin } from './breakins'
import { useSession, useSuite, type AppId } from './store'

export type Who = { identityId: string; name: string; confidence: number } | 'unknown' | null

export interface PresenceState {
  status: SensorStatus
  observation: SensorObservation | null
  who: Who
  faces: 'none' | 'one' | 'multiple'
  looking: boolean
  eyesClosed: boolean
  lastFaceAt: number
  sensor: BiometricSensor
  demoLabel: string | null
  retry: () => void
}

interface GlanceRequest {
  reason: string
  app: AppId
  /** Require this identity (e.g. the signed-in user). */
  expectIdentityId?: string | null
  /** Reuse a successful glance from the last 30 s. */
  allowRecent?: boolean
  /** Restrict to a set of identities (e.g. document recipients). Empty = anyone enrolled. */
  allowed?: string[]
}

export interface GlanceResult {
  ok: boolean
  identityId: string | null
  name: string | null
  reason?: 'cancelled' | 'not-recognized' | 'wrong-person' | 'unable'
}

interface Ctx {
  state: PresenceState
  register: (identify: boolean) => () => void
  verify: (req: GlanceRequest) => Promise<GlanceResult>
}

const PresenceContext = createContext<Ctx | null>(null)

export function lookingAtScreen(o: SensorObservation | null) {
  if (!o || o.presence !== 'eyes' || !o.pose) return false
  return Math.abs(o.pose.yaw) < 28 && Math.abs(o.pose.pitch) < 24 && Math.min(o.eyes?.left.openness ?? 0, o.eyes?.right.openness ?? 0) > 0.18
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState({ total: 0, identify: 0 })
  const [glance, setGlance] = useState<(GlanceRequest & { resolve: (r: GlanceResult) => void }) | null>(null)
  const wanted = counts.total > 0 || !!glance
  // Keep the camera on briefly between consumers (e.g. glance → viewer) so it
  // doesn't flicker off and on.
  const [enabled, setEnabled] = useState(wanted)
  useEffect(() => {
    if (wanted) {
      setEnabled(true)
      return
    }
    const t = setTimeout(() => setEnabled(false), 2500)
    return () => clearTimeout(t)
  }, [wanted])
  const config = useSensorConfig()
  const { sensor, status, observation, retry } = useSensor(config, enabled)
  const acceptDistance = useStore((s) => s.settings.acceptDistance)

  const [who, setWho] = useState<Who>(null)
  const [lastFaceAt, setLastFaceAt] = useState(0)
  const obsRef = useRef(observation)
  obsRef.current = observation
  const busy = useRef(false)
  const pending = useRef<{ key: string; streak: number }>({ key: '', streak: 0 })
  const lastBreakin = useRef(0)
  /**
   * Identity continuity: while the same face is tracked continuously we keep
   * its identity and only re-confirm periodically. Any break (face lost,
   * a second face, or a jump in position/size) forces re-identification.
   */
  const track = useRef({ generation: 0, identifiedGen: -1, identifiedAt: 0, box: null as null | { x: number; y: number; w: number } })

  useEffect(() => {
    if (observation && observation.presence !== 'none') setLastFaceAt(Date.now())
    const tr = track.current
    if (!observation || observation.presence === 'none' || observation.presence === 'multiple') {
      if (tr.box) tr.generation++
      tr.box = null
      if (observation?.presence === 'none') {
        pending.current = { key: '', streak: 0 }
        setWho(null)
      }
      return
    }
    const b = observation.faceBox
    if (b) {
      const box = { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width }
      if (!tr.box || Math.hypot(box.x - tr.box.x, box.y - tr.box.y) > 0.12 || Math.abs(box.w - tr.box.w) / tr.box.w > 0.2) tr.generation++
      tr.box = box
    }
  }, [observation])

  // Periodic identification while any consumer needs to know *who*.
  useEffect(() => {
    if (counts.identify === 0 || status.state !== 'running') return
    let alive = true
    const tick = async () => {
      if (busy.current || !alive) return
      const o = obsRef.current
      if (!o || o.presence === 'none' || o.presence === 'multiple') return
      const tr = track.current
      const continuous = tr.identifiedGen === tr.generation && Date.now() - tr.identifiedAt < 4000
      if (continuous) return
      const gen = tr.generation
      busy.current = true
      try {
        const samples = await collectSamples(sensor, { count: 2, timeoutMs: 1600, intervalMs: 60 })
        if (!alive || samples.length < 2) return
        const v = await identityService.verify(samples, { ...DEFAULT_MATCH_POLICY, acceptDistance, minProbeSamples: 2 })
        const next: Who =
          v.status === 'verified'
            ? { identityId: v.identity.id, name: v.identity.name, confidence: v.confidence }
            : v.status === 'not-recognized'
              ? 'unknown'
              : null
        if (next === null) return
        tr.identifiedGen = gen
        tr.identifiedAt = Date.now()
        const key = next === 'unknown' ? 'unknown' : next.identityId
        // Break-in: a stranger at the screen while you're signed in. Record once, with a snapshot.
        if (next === 'unknown') {
          const owner = useSession.getState()
          if (owner.identityId && Date.now() - lastBreakin.current > 25_000) {
            lastBreakin.current = Date.now()
            const snapshot = await captureSnapshot(sensor.getPreviewStream?.() ?? null)
            void recordBreakin({
              at: Date.now(),
              reason: 'stranger',
              app: (typeof location !== 'undefined' ? location.pathname.replace(/^\/apps\/?/, '') : '') || 'apps',
              ownerId: owner.identityId,
              ownerName: owner.name,
              snapshot,
            })
          }
        }
        pending.current = pending.current.key === key ? { key, streak: pending.current.streak + 1 } : { key, streak: 1 }
        setWho((prev) => {
          const prevKey = prev === null ? '' : prev === 'unknown' ? 'unknown' : prev.identityId
          if (prevKey === key) return next
          // First sighting commits immediately; switching people needs two agreeing reads.
          return prev === null || pending.current.streak >= 2 ? next : prev
        })
      } finally {
        busy.current = false
      }
    }
    void tick()
    const t = setInterval(tick, 700)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [counts.identify, status.state, sensor, acceptDistance])

  const register = useCallback((identify: boolean) => {
    setCounts((c) => ({ total: c.total + 1, identify: c.identify + (identify ? 1 : 0) }))
    return () => setCounts((c) => ({ total: c.total - 1, identify: c.identify - (identify ? 1 : 0) }))
  }, [])

  const session = useSession()
  const log = useSuite((s) => s.log)
  const verify = useCallback(
    (req: GlanceRequest) =>
      new Promise<GlanceResult>((resolve) => {
        const s = useSession.getState()
        if (req.allowRecent && s.identityId && identityService.isSameAccount(req.expectIdentityId, s.identityId) && Date.now() - s.lastVerifiedAt < 30_000) {
          resolve({ ok: true, identityId: s.identityId, name: s.name })
          return
        }
        setGlance({
          ...req,
          resolve: (r) => {
            setGlance(null)
            log({
              app: req.app,
              action: 'approve',
              detail: req.reason,
              identityId: r.identityId,
              name: r.name ?? 'Unknown person',
              ok: r.ok,
            })
            if (r.ok && identityService.isSameAccount(r.identityId, useSession.getState().identityId)) useSession.getState().touch()
            resolve(r)
          },
        })
      }),
    [log],
  )
  void session

  const state = useMemo<PresenceState>(
    () => ({
      status,
      observation,
      who,
      faces: !observation || observation.presence === 'none' ? 'none' : observation.presence === 'multiple' ? 'multiple' : 'one',
      looking: lookingAtScreen(observation),
      eyesClosed: observation?.quality.issues.includes('eyes-closed') ?? false,
      lastFaceAt,
      sensor,
      demoLabel: config.subjectLabel,
      retry,
    }),
    [status, observation, who, lastFaceAt, sensor, config.subjectLabel, retry],
  )

  return (
    <PresenceContext.Provider value={{ state, register, verify }}>
      {children}
      <AnimatePresence>
        {glance && (
          <GlanceModal
            key="glance"
            request={glance}
            state={state}
            acceptDistance={acceptDistance}
            pauseIdentify={(v) => (busy.current = v)}
          />
        )}
      </AnimatePresence>
    </PresenceContext.Provider>
  )
}

export function usePresence({ identify = false, enabled = true }: { identify?: boolean; enabled?: boolean } = {}) {
  const ctx = useContext(PresenceContext)
  if (!ctx) throw new Error('usePresence must be used inside PresenceProvider')
  const { register } = ctx
  useEffect(() => (enabled ? register(identify) : undefined), [register, identify, enabled])
  return ctx.state
}

export function useGlance() {
  const ctx = useContext(PresenceContext)
  if (!ctx) throw new Error('useGlance must be used inside PresenceProvider')
  return ctx.verify
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function GlanceModal({
  request,
  state,
  acceptDistance,
  pauseIdentify,
}: {
  request: GlanceRequest & { resolve: (r: GlanceResult) => void }
  state: PresenceState
  acceptDistance: number
  pauseIdentify: (v: boolean) => void
}) {
  const [phase, setPhase] = useState<'waiting' | 'scanning' | 'ok' | 'fail'>('waiting')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const lock = useRef<number | null>(null)
  const started = useRef(false)
  const o = state.observation

  const run = useCallback(async () => {
    started.current = true
    pauseIdentify(true)
    setPhase('scanning')
    const samples = await collectSamples(state.sensor, { count: 4, timeoutMs: 7000, onSample: (n) => setProgress(n / 4) })
    const v = await identityService.verify(samples, { ...DEFAULT_MATCH_POLICY, acceptDistance })
    pauseIdentify(false)
    let result: GlanceResult
    if (v.status === 'verified') {
      const allowedList = request.allowed && request.allowed.length ? request.allowed : null
      const wrong =
        (request.expectIdentityId && !identityService.isSameAccount(v.identity.id, request.expectIdentityId)) ||
        (allowedList && !allowedList.some((id) => identityService.isSameAccount(v.identity.id, id)))
      result = wrong
        ? { ok: false, identityId: v.identity.id, name: v.identity.name, reason: 'wrong-person' }
        : { ok: true, identityId: v.identity.id, name: v.identity.name }
      setMessage(wrong ? `${v.identity.name} isn’t allowed to do this` : `Verified · ${v.identity.name}`)
    } else {
      result = { ok: false, identityId: null, name: null, reason: v.status === 'unable' ? 'unable' : 'not-recognized' }
      setMessage(v.status === 'unable' ? 'Couldn’t get a clear look' : 'Identity not recognized')
    }
    setPhase(result.ok ? 'ok' : 'fail')
    await sleep(result.ok ? 650 : 1400)
    request.resolve(result)
  }, [state.sensor, acceptDistance, request, pauseIdentify])

  useEffect(() => {
    if (started.current || state.status.state !== 'running' || !o) return
    const ready = o.presence === 'eyes' && o.quality.score >= 0.35
    if (!ready) {
      lock.current = null
      return
    }
    lock.current ??= performance.now()
    if (performance.now() - lock.current > 450) void run()
  }, [o, state.status.state, run])

  const error = state.status.state === 'error' ? SENSOR_ERROR_COPY[state.status.error.code] : null
  const tone = phase === 'ok' ? 'granted' : phase === 'fail' ? 'denied' : phase === 'scanning' ? 'active' : o?.presence === 'eyes' ? 'tracking' : 'idle'
  const label =
    error?.title ??
    (phase === 'ok' ? 'Approved' : phase === 'fail' ? 'Not approved' : phase === 'scanning' ? 'Verifying' : state.status.state !== 'running' ? 'Starting sensor' : 'Look at the screen')

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" data-testid="glance-modal">
      <motion.div className="absolute inset-0 bg-black/65" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="relative w-full max-w-[420px] overflow-hidden rounded-3xl border border-white/10 bg-term text-white shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.24em] text-white/60 uppercase">
            <ScanEye className="size-3.5" /> Glance to approve
          </div>
          <button
            onClick={() => {
              pauseIdentify(false)
              request.resolve({ ok: false, identityId: null, name: null, reason: 'cancelled' })
            }}
            className="rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white"
            aria-label="Cancel"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 pt-2 text-[15px] font-medium text-white/90">{request.reason}</div>
        <div className="p-5">
          <SensorViewport
            sensor={state.sensor}
            observation={o}
            running={state.status.state === 'running'}
            tone={tone}
            progress={phase === 'scanning' ? progress : phase === 'waiting' ? 0 : 1}
            scanning={phase === 'scanning'}
            dimmed={phase === 'ok' || phase === 'fail'}
            className="aspect-[4/3] w-full rounded-2xl ring-1 ring-white/10"
          >
            {(phase === 'ok' || phase === 'fail') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div
                  className={cx(
                    'flex size-12 items-center justify-center rounded-full border',
                    phase === 'ok' ? 'border-granted/40 bg-granted/10 text-granted' : 'border-denied/40 bg-denied/10 text-denied',
                  )}
                >
                  {phase === 'ok' ? <Check className="size-5" /> : <X className="size-5" />}
                </div>
                <div className="mt-3 text-[14px] text-white/80" data-testid="glance-message">{message}</div>
              </div>
            )}
            {state.demoLabel && (
              <div className="absolute top-3 left-3 rounded-full border border-[#f5b454]/30 bg-black/60 px-2.5 py-1 font-mono text-[9.5px] tracking-[0.14em] text-[#f5b454] uppercase">
                Demo · {state.demoLabel}
              </div>
            )}
          </SensorViewport>
          <div className="mt-4 text-center">
            <div className={cx('font-mono text-[11px] tracking-[0.24em] uppercase', phase === 'fail' ? 'text-denied' : phase === 'ok' ? 'text-granted' : 'text-scan-accent')}>
              {label}
            </div>
            <div className="mt-1 h-5 text-[13px] text-white/50">
              {error ? error.hint : phase === 'waiting' ? (guidanceFor(o) ?? (o?.presence === 'eyes' ? 'Hold still' : 'Position yourself in front of the camera')) : ''}
            </div>
            {error && (
              <button onClick={state.retry} className="mt-3 h-8 rounded-lg bg-white px-3 text-[12.5px] font-medium text-black">
                Try again
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
