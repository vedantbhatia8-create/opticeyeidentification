/**
 * Sensor-agnostic capture orchestration used by enrollment and authentication.
 */
import type { BiometricSample } from '../biometric/types'
import type { BiometricSensor, Point, SensorObservation } from './types'

export interface CollectOptions {
  count: number
  timeoutMs: number
  intervalMs?: number
  signal?: AbortSignal
  onSample?: (collected: number, sample: BiometricSample) => void
}

export async function collectSamples(sensor: BiometricSensor, opts: CollectOptions): Promise<BiometricSample[]> {
  const samples: BiometricSample[] = []
  const deadline = performance.now() + opts.timeoutMs
  while (samples.length < opts.count && performance.now() < deadline) {
    if (opts.signal?.aborted) break
    const sample = await sensor.captureSample()
    if (opts.signal?.aborted) break
    if (sample) {
      samples.push(sample)
      opts.onSample?.(samples.length, sample)
    }
    await new Promise((r) => setTimeout(r, opts.intervalMs ?? 110))
  }
  return samples
}

// ── Guided enrollment ──────────────────────────────────────────────────────

export type EnrollmentPose = 'center' | 'left' | 'right' | 'up' | 'down'

export interface EnrollmentStep {
  pose: EnrollmentPose
  instruction: string
  /** Direction on screen (mirrored selfie view): +x = screen right, +y = up. */
  arrow: Point
  samples: number
}

export const ENROLLMENT_STEPS: EnrollmentStep[] = [
  { pose: 'center', instruction: 'Look directly at the sensor', arrow: { x: 0, y: 0 }, samples: 5 },
  { pose: 'left', instruction: 'Slowly look left', arrow: { x: -1, y: 0 }, samples: 3 },
  { pose: 'right', instruction: 'Slowly look right', arrow: { x: 1, y: 0 }, samples: 3 },
  { pose: 'up', instruction: 'Look up', arrow: { x: 0, y: 1 }, samples: 3 },
  { pose: 'down', instruction: 'Look down', arrow: { x: 0, y: -1 }, samples: 3 },
]

export interface PoseBaseline {
  yaw: number
  pitch: number
  gazeX: number
  gazeY: number
}

export function baselineFrom(o: SensorObservation): PoseBaseline {
  return { yaw: o.pose?.yaw ?? 0, pitch: o.pose?.pitch ?? 0, gazeX: o.gaze?.x ?? 0, gazeY: o.gaze?.y ?? 0 }
}

/**
 * Combined head + eye direction relative to the baseline, in screen terms:
 * x > 0 → user looking toward screen-left (their left), y > 0 → up.
 */
export function lookVector(o: SensorObservation, base: PoseBaseline): Point {
  const yaw = (o.pose?.yaw ?? 0) - base.yaw
  const pitch = (o.pose?.pitch ?? 0) - base.pitch
  const gx = (o.gaze?.x ?? 0) - base.gazeX
  const gy = (o.gaze?.y ?? 0) - base.gazeY
  return { x: yaw / 18 + gx * 0.9, y: pitch / 14 + gy * 0.9 }
}

/** 0..1 progress toward the requested pose. */
export function poseProgress(pose: EnrollmentPose, look: Point): number {
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  switch (pose) {
    case 'center':
      return clamp(1 - (Math.hypot(look.x, look.y) - 0.25) / 0.5)
    case 'left':
      return clamp(look.x / 0.55)
    case 'right':
      return clamp(-look.x / 0.55)
    case 'up':
      return clamp(look.y / 0.5)
    case 'down':
      return clamp(-look.y / 0.5)
  }
}
