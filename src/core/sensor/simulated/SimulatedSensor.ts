/**
 * SimulatedSensor — a camera-free BiometricSensor for Demo Mode and for
 * terminals without a camera. It emits realistic tracking observations and
 * synthetic samples for the selected demo subject. Everything downstream
 * (matcher, identity, authorization, door control) is the real pipeline.
 */
import { syntheticSample } from '../../biometric/synthetic'
import type { BiometricSample } from '../../biometric/types'
import type {
  BiometricSensor,
  EyeObservation,
  SensorDescriptor,
  SensorObservation,
  SensorStatus,
  Unsubscribe,
} from '../types'

export interface SimulatedSubject {
  /** Seed of the synthetic biometric; unknown persons use a random seed. */
  seed: string
  label: string
}

function eye(cx: number, cy: number, open: number): EyeObservation {
  const w = 0.045
  const contour = Array.from({ length: 16 }, (_, i) => {
    const t = (i / 16) * Math.PI * 2
    return { x: cx + Math.cos(t) * w, y: cy + Math.sin(t) * w * 0.42 * open }
  })
  return {
    center: { x: cx, y: cy },
    irisRadius: 0.012,
    corners: [
      { x: cx - w, y: cy },
      { x: cx + w, y: cy },
    ],
    contour,
    openness: open,
  }
}

export class SimulatedSensor implements BiometricSensor {
  readonly descriptor: SensorDescriptor = {
    kind: 'simulated',
    name: 'Simulated optic sensor',
    modality: 'webcam-ocular-v1',
    providesPreview: false,
    supportsPoseGuidance: true,
  }

  private status: SensorStatus = { state: 'idle' }
  private subject: SimulatedSubject | null
  private timer = 0
  private startedAt = 0
  private readonly statusListeners = new Set<(s: SensorStatus) => void>()
  private readonly observationListeners = new Set<(o: SensorObservation) => void>()
  /** Guided-enrollment direction the simulated subject is currently following. */
  private lookTarget = { x: 0, y: 0 }

  constructor(subject: SimulatedSubject | null) {
    this.subject = subject
  }

  setSubject(subject: SimulatedSubject | null) {
    this.subject = subject
    this.startedAt = performance.now()
  }

  /** Lets guided enrollment steer the simulated subject's gaze. */
  follow(direction: { x: number; y: number }) {
    this.lookTarget = direction
  }

  getStatus() {
    return this.status
  }
  getPreviewStream() {
    return null
  }
  onStatus(l: (s: SensorStatus) => void): Unsubscribe {
    this.statusListeners.add(l)
    return () => this.statusListeners.delete(l)
  }
  onObservation(l: (o: SensorObservation) => void): Unsubscribe {
    this.observationListeners.add(l)
    return () => this.observationListeners.delete(l)
  }
  private setStatus(s: SensorStatus) {
    this.status = s
    this.statusListeners.forEach((l) => l(s))
  }

  async start() {
    if (this.status.state === 'running') return
    this.setStatus({ state: 'starting', detail: 'Initialising simulated sensor' })
    await new Promise((r) => setTimeout(r, 450))
    this.startedAt = performance.now()
    this.setStatus({ state: 'running' })
    this.timer = window.setInterval(() => this.tick(), 50)
  }

  async stop() {
    clearInterval(this.timer)
    if (this.status.state !== 'idle') this.setStatus({ state: 'stopped' })
  }

  private current(): SensorObservation {
    const t = (performance.now() - this.startedAt) / 1000
    if (!this.subject || t < 0.9) {
      return { timestamp: Date.now(), presence: 'none', quality: { score: 0, issues: ['no-face'], brightness: 0.5 }, aspect: 16 / 9 }
    }
    const sway = { x: Math.sin(t * 0.9) * 0.012, y: Math.cos(t * 0.7) * 0.008 }
    const gx = this.lookTarget.x
    const gy = this.lookTarget.y
    const cx = 0.5 + sway.x - gx * 0.03
    const cy = 0.46 + sway.y - gy * 0.03
    const blink = t % 4.2 < 0.12 ? 0.1 : 1
    const approaching = t < 1.5
    const faceW = approaching ? 0.2 : 0.3
    return {
      timestamp: Date.now(),
      presence: approaching ? 'face' : 'eyes',
      faceBox: { x: cx - faceW / 2, y: cy - 0.2, width: faceW, height: faceW * 1.45 },
      eyes: { right: eye(cx - 0.055 - gx * 0.006, cy, blink), left: eye(cx + 0.055 - gx * 0.006, cy, blink) },
      pose: { yaw: gx * 22, pitch: gy * 18, roll: sway.x * 40 },
      gaze: { x: gx, y: gy },
      quality: { score: approaching ? 0.3 : 0.86, issues: approaching ? ['too-far'] : [], brightness: 0.55 },
      aspect: 16 / 9,
    }
  }

  private tick() {
    const o = this.current()
    this.observationListeners.forEach((l) => l(o))
  }

  async captureSample(): Promise<BiometricSample | null> {
    if (this.status.state !== 'running' || !this.subject) return null
    const o = this.current()
    if (o.presence !== 'eyes') return null
    await new Promise((r) => setTimeout(r, 60))
    return { ...syntheticSample(this.subject.seed), pose: o.pose }
  }
}
