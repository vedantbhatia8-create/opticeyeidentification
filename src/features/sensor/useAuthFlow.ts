import { useCallback, useEffect, useRef, useState } from 'react'
import type { AccessDecision, SiteAdapter } from '../../core/access/types'
import { DEFAULT_MATCH_POLICY } from '../../core/biometric/matcher'
import { collectSamples } from '../../core/sensor/capture'
import type { BiometricSensor, SensorObservation, SensorStatus } from '../../core/sensor/types'
import { accessController } from '../../state/services'
import { useStore } from '../../state/store'

export type AuthPhase =
  | 'initializing'
  | 'error'
  | 'searching'
  | 'face'
  | 'eyes'
  | 'analyzing'
  | 'verifying'
  | 'authorizing'
  | 'result'

const SAMPLE_TARGET = 6
const LOCK_MS = 700
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Options {
  sensor: BiometricSensor
  status: SensorStatus
  observation: SensorObservation | null
  adapter?: SiteAdapter
  resourceId?: string
  demo: boolean
  /** Return to "ready" automatically after a result (door terminals). */
  autoResetMs?: number | null
  onDecision?: (d: AccessDecision) => void
}

export function useAuthFlow(opts: Options) {
  const { sensor, status, observation } = opts
  const [phase, setPhaseState] = useState<AuthPhase>('initializing')
  const [progress, setProgress] = useState(0)
  const [decision, setDecision] = useState<AccessDecision | null>(null)
  const [recognizedName, setRecognizedName] = useState<string | null>(null)
  const acceptDistance = useStore((s) => s.settings.acceptDistance)

  const phaseRef = useRef(phase)
  const setPhase = (p: AuthPhase) => {
    phaseRef.current = p
    setPhaseState(p)
  }
  const optsRef = useRef(opts)
  optsRef.current = opts
  const lockStart = useRef<number | null>(null)
  const lastPresence = useRef<SensorObservation['presence']>('none')
  const abortRef = useRef<AbortController | null>(null)
  const resetTimer = useRef(0)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    clearTimeout(resetTimer.current)
    lockStart.current = null
    setProgress(0)
    setDecision(null)
    setRecognizedName(null)
    setPhase(optsRef.current.status.state === 'running' ? 'searching' : 'initializing')
  }, [])

  // Sensor lifecycle → phase
  useEffect(() => {
    if (status.state === 'error') {
      abortRef.current?.abort()
      setPhase('error')
    } else if (status.state === 'running' && (phaseRef.current === 'initializing' || phaseRef.current === 'error')) {
      setPhase('searching')
    } else if (status.state === 'starting' || status.state === 'idle') {
      setPhase('initializing')
    }
  }, [status])

  // A new sensor (e.g. demo subject changed) restarts the flow.
  useEffect(() => reset, [sensor, reset])
  useEffect(() => () => {
    abortRef.current?.abort()
    clearTimeout(resetTimer.current)
  }, [])

  const capture = useCallback(async () => {
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setPhase('analyzing')
    setProgress(0)
    const samples = await collectSamples(sensor, {
      count: SAMPLE_TARGET,
      timeoutMs: 8000,
      signal: ctrl.signal,
      onSample: (n) => setProgress(n / SAMPLE_TARGET),
    })
    if (ctrl.signal.aborted) return
    // Person walked away mid-scan: quietly return to ready.
    if (samples.length < DEFAULT_MATCH_POLICY.minProbeSamples && lastPresence.current === 'none') {
      lockStart.current = null
      setProgress(0)
      setPhase('searching')
      return
    }
    setPhase('verifying')
    await sleep(650)
    if (ctrl.signal.aborted) return
    const { adapter, resourceId, demo } = optsRef.current
    const result = await accessController.attempt({
      samples,
      adapter,
      resourceId,
      demo,
      sensorKind: samples[0]?.sensorKind ?? sensor.descriptor.kind,
      policy: { ...DEFAULT_MATCH_POLICY, acceptDistance },
      onIdentity: async (v) => {
        if (v.status === 'verified' && adapter && resourceId) {
          setRecognizedName(v.identity.name)
          setPhase('authorizing')
          await sleep(1300)
        }
      },
    })
    if (ctrl.signal.aborted) return
    if (import.meta.env.DEV) {
      const v = result.identity
      console.info('[optic] decision', JSON.stringify({
        outcome: result.outcome,
        code: result.authorization?.code ?? null,
        name: v.status === 'verified' ? v.identity.name : null,
        distance: v.status === 'unable' ? null : v.distance,
        components: v.status === 'verified' ? v.components : null,
        samples: v.probeCount,
      }))
    }
    setDecision(result)
    setPhase('result')
    optsRef.current.onDecision?.(result)
    const ms = optsRef.current.autoResetMs
    if (ms) resetTimer.current = window.setTimeout(reset, ms)
  }, [sensor, acceptDistance, reset])

  // Tracking → phase, and auto-start capture once the eyes are held steady.
  useEffect(() => {
    if (!observation) return
    lastPresence.current = observation.presence
    const p = phaseRef.current
    if (p !== 'searching' && p !== 'face' && p !== 'eyes') return
    const ready = observation.presence === 'eyes' && observation.quality.score >= 0.35
    if (observation.presence === 'eyes') setPhase('eyes')
    else if (observation.presence === 'face') setPhase('face')
    else setPhase('searching')
    if (!ready) {
      lockStart.current = null
      return
    }
    lockStart.current ??= performance.now()
    if (performance.now() - lockStart.current >= LOCK_MS) {
      lockStart.current = null
      void capture()
    }
  }, [observation, capture])

  return { phase, progress, decision, recognizedName, reset }
}
