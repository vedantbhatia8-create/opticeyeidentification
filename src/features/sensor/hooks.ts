import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { identityService } from '../../core/identity/IdentityService'
import { createSensor, type SensorConfig } from '../../core/sensor/registry'
import type { SimulatedSubject } from '../../core/sensor/simulated/SimulatedSensor'
import type { BiometricSensor, SensorObservation, SensorStatus } from '../../core/sensor/types'
import { unknownSeed } from '../../domains/personas'
import { useStore } from '../../state/store'

export function useIdentities() {
  return useSyncExternalStore(identityService.subscribe, identityService.getSnapshot)
}

/** Resolve which sensor terminals should use, from settings + Demo Mode. */
export function useSensorConfig(): SensorConfig & { key: string; subjectLabel: string | null } {
  const sensorKind = useStore((s) => s.settings.sensorKind)
  const demo = useStore((s) => s.demo)
  const { identities } = useIdentities()
  const active = demo.enabled && demo.subject ? demo.subject : null
  const identity = active && active !== 'unknown' ? identities.find((i) => i.id === active) : undefined
  // A fresh unknown seed per selection, stable across re-renders.
  const strangerSeed = useMemo(() => (active === 'unknown' ? unknownSeed() : null), [active])
  const seed = strangerSeed ?? identity?.demoSeed ?? null
  const label = strangerSeed ? 'Unknown person' : (identity?.name ?? null)
  // Demo Mode without a subject uses the real webcam with real biometrics.
  const kind = sensorKind === 'simulated' && demo.enabled ? 'simulated' : 'webcam'
  return useMemo(() => {
    const subject: SimulatedSubject | null = seed ? { seed, label: label ?? '' } : null
    return { kind, demoSubject: subject, key: `${kind}:${seed ?? 'live'}`, subjectLabel: label }
  }, [kind, seed, label])
}

/**
 * Owns a sensor's lifecycle for a component: creates it from config, starts
 * it, stops it cleanly on unmount or config change, and exposes status and
 * the latest observation (throttled to animation frames).
 */
export function useSensor(config: SensorConfig & { key: string }, enabled = true) {
  const configRef = useRef(config)
  configRef.current = config
  const [attempt, setAttempt] = useState(0)
  const sensor = useMemo<BiometricSensor>(
    () => createSensor(configRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.key, attempt],
  )
  const [status, setStatus] = useState<SensorStatus>(sensor.getStatus())
  const [observation, setObservation] = useState<SensorObservation | null>(null)

  useEffect(() => {
    if (!enabled) return
    let frame = 0
    let latest: SensorObservation | null = null
    setStatus(sensor.getStatus())
    setObservation(null)
    const offStatus = sensor.onStatus(setStatus)
    const offObs = sensor.onObservation((o) => {
      latest = o
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0
          setObservation(latest)
        })
    })
    sensor.start().catch(() => {
      /* surfaced through status */
    })
    return () => {
      cancelAnimationFrame(frame)
      offStatus()
      offObs()
      void sensor.stop()
    }
  }, [sensor, enabled])

  return { sensor, status, observation, retry: () => setAttempt((a) => a + 1) }
}
