/**
 * The only place that knows concrete sensor classes. Application code asks
 * for a sensor by configuration and receives a `BiometricSensor`.
 */
import { FutureIrisHardwareSensor } from './hardware/FutureIrisHardwareSensor'
import { PersonaOverlaySensor } from './PersonaOverlaySensor'
import { SimulatedSensor, type SimulatedSubject } from './simulated/SimulatedSensor'
import type { BiometricSensor, SensorKind } from './types'
import { WebcamSensor } from './webcam/WebcamSensor'

export interface SensorConfig {
  kind: SensorKind
  /** Demo Mode subject. With `webcam`, the live camera is used for tracking but features come from the persona. */
  demoSubject?: SimulatedSubject | null
}

export function createSensor(config: SensorConfig): BiometricSensor {
  switch (config.kind) {
    case 'webcam': {
      const webcam = new WebcamSensor()
      return config.demoSubject ? new PersonaOverlaySensor(webcam, config.demoSubject) : webcam
    }
    case 'simulated':
      return new SimulatedSensor(config.demoSubject ?? null)
    case 'iris-hardware':
      return new FutureIrisHardwareSensor()
  }
}

export const SENSOR_KIND_LABEL: Record<SensorKind, string> = {
  webcam: 'Webcam (prototype)',
  simulated: 'Simulated sensor',
  'iris-hardware': 'Optic IR iris module',
}
