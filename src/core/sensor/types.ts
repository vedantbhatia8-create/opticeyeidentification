/**
 * Sensor layer — the hardware abstraction.
 *
 * Everything above this layer (enrollment, identification, authorization,
 * door control, UI) talks to a `BiometricSensor` and never to a camera API.
 * Swapping the webcam prototype for dedicated iris hardware means providing a
 * new implementation of this interface — nothing else changes.
 */
import type { BiometricModality, BiometricSample, HeadPose } from '../biometric/types'

export type SensorKind = 'webcam' | 'simulated' | 'iris-hardware'

export interface SensorDescriptor {
  kind: SensorKind
  /** Human-readable, e.g. "FaceTime HD Camera" or "Optic IR-1 (serial 0042)". */
  name: string
  modality: BiometricModality
  /** Whether a live preview stream is available for the UI to render. */
  providesPreview: boolean
  /** Whether the sensor can report gaze / head pose (needed for guided enrollment). */
  supportsPoseGuidance: boolean
}

export type SensorStatus =
  | { state: 'idle' }
  | { state: 'starting'; detail: string }
  | { state: 'running' }
  | { state: 'stopped' }
  | { state: 'error'; error: SensorError }

export type SensorErrorCode =
  | 'permission-denied'
  | 'no-device'
  | 'device-busy'
  | 'insecure-context'
  | 'unsupported'
  | 'model-load-failed'
  | 'hardware-disconnected'
  | 'unknown'

export interface SensorError {
  code: SensorErrorCode
  message: string
}

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** All coordinates are normalised 0..1 in *display* space (already mirrored for selfie view). */
export interface EyeObservation {
  /** Iris centre. */
  center: Point
  /** Iris radius as a fraction of frame width. */
  irisRadius: number
  /** Outer and inner eye corners. */
  corners: [Point, Point]
  /** Eyelid contour, for drawing. */
  contour: Point[]
  /** 0 = closed, 1 = wide open. */
  openness: number
}

export type QualityIssue =
  | 'no-face'
  | 'multiple-faces'
  | 'too-far'
  | 'too-close'
  | 'off-center'
  | 'too-dark'
  | 'too-bright'
  | 'eyes-closed'
  | 'motion'
  | 'head-turned'

export interface SensorQuality {
  /** 0..1 overall suitability of the current frame for capture. */
  score: number
  issues: QualityIssue[]
  brightness: number
}

export type Presence = 'none' | 'face' | 'eyes' | 'multiple'

/** Real-time tracking state, emitted every processed frame. Drives the sensor UI. */
export interface SensorObservation {
  timestamp: number
  presence: Presence
  faceBox?: Rect
  eyes?: { left: EyeObservation; right: EyeObservation }
  pose?: HeadPose
  /** Gaze direction estimate, each axis -1..1 (+x = subject's left in display, +y = up). */
  gaze?: Point
  quality: SensorQuality
  /** Frame aspect ratio (width / height) so overlays can be laid out correctly. */
  aspect: number
}

export type Unsubscribe = () => void

export interface BiometricSensor {
  readonly descriptor: SensorDescriptor
  getStatus(): SensorStatus
  /** Acquire the device and begin tracking. Rejects with a SensorError-shaped error. */
  start(): Promise<void>
  /** Release the device. Must be safe to call repeatedly. */
  stop(): Promise<void>
  /** Live preview, if the sensor offers one. Hardware sensors may return null. */
  getPreviewStream(): MediaStream | null
  onStatus(listener: (status: SensorStatus) => void): Unsubscribe
  onObservation(listener: (observation: SensorObservation) => void): Unsubscribe
  /**
   * Capture one biometric sample from the current moment.
   * Returns null when the current frame is not good enough.
   * Raw imagery used to compute the sample must be discarded before returning.
   */
  captureSample(): Promise<BiometricSample | null>
}

export function isSensorError(value: unknown): value is SensorError {
  return typeof value === 'object' && value !== null && 'code' in value && 'message' in value
}

export function sensorError(code: SensorErrorCode, message: string): SensorError {
  return { code, message }
}

export const SENSOR_ERROR_COPY: Record<SensorErrorCode, { title: string; hint: string }> = {
  'permission-denied': {
    title: 'Camera access was blocked',
    hint: 'Allow camera access in your browser’s site settings, then try again.',
  },
  'no-device': {
    title: 'No camera found',
    hint: 'Connect a camera, or switch to Demo Mode to use the simulated sensor.',
  },
  'device-busy': {
    title: 'Camera is in use',
    hint: 'Another app or tab is using the camera. Close it and try again.',
  },
  'insecure-context': {
    title: 'Secure connection required',
    hint: 'Browsers only allow camera access on https:// or http://localhost.',
  },
  unsupported: {
    title: 'This browser can’t run the sensor',
    hint: 'Use a recent version of Chrome, Edge, Safari or Firefox.',
  },
  'model-load-failed': {
    title: 'Sensor models failed to load',
    hint: 'Run `npm install` to provision the on-device models, then reload.',
  },
  'hardware-disconnected': {
    title: 'Optic hardware not connected',
    hint: 'Dedicated iris hardware is not attached to this terminal.',
  },
  unknown: { title: 'Sensor error', hint: 'Something went wrong starting the sensor. Try again.' },
}
