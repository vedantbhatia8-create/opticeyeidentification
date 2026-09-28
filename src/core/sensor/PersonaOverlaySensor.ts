/**
 * Demo Mode decorator: runs a real sensor (live camera, real face/eye
 * tracking and quality gating) but substitutes the extracted features with
 * the selected demo persona's synthetic biometric. This lets one presenter
 * demonstrate "Sarah Chen" or "Emma Johnson" at a real terminal. Every access
 * event produced this way is flagged as a demo event.
 */
import { syntheticSample } from '../biometric/synthetic'
import type { BiometricSample } from '../biometric/types'
import type { SimulatedSubject } from './simulated/SimulatedSensor'
import type { BiometricSensor, SensorObservation, SensorStatus, Unsubscribe } from './types'

export class PersonaOverlaySensor implements BiometricSensor {
  private readonly inner: BiometricSensor
  private readonly subject: SimulatedSubject

  constructor(inner: BiometricSensor, subject: SimulatedSubject) {
    this.inner = inner
    this.subject = subject
  }

  get descriptor() {
    return { ...this.inner.descriptor, name: `${this.inner.descriptor.name} · demo persona` }
  }
  getStatus(): SensorStatus {
    return this.inner.getStatus()
  }
  start() {
    return this.inner.start()
  }
  stop() {
    return this.inner.stop()
  }
  getPreviewStream() {
    return this.inner.getPreviewStream()
  }
  onStatus(l: (s: SensorStatus) => void): Unsubscribe {
    return this.inner.onStatus(l)
  }
  onObservation(l: (o: SensorObservation) => void): Unsubscribe {
    return this.inner.onObservation(l)
  }

  async captureSample(): Promise<BiometricSample | null> {
    const real = await this.inner.captureSample()
    if (!real) return null
    // Discard the real features immediately; keep only capture metadata.
    const persona = syntheticSample(this.subject.seed)
    return { ...persona, quality: real.quality, pose: real.pose, sensorKind: `${real.sensorKind}+persona` }
  }
}
