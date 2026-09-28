/**
 * RAW INPUT — camera acquisition.
 * The MediaStream never leaves the sensor except as a preview for on-screen display.
 */
import { sensorError, type SensorError } from '../types'

export async function openCamera(): Promise<MediaStream> {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw sensorError('insecure-context', 'Camera access requires https:// or localhost.')
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw sensorError('unsupported', 'This browser does not expose a camera API.')
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
    })
  } catch (err) {
    throw mapCameraError(err)
  }
}

export function mapCameraError(err: unknown): SensorError {
  const name = (err as { name?: string })?.name ?? ''
  const message = (err as { message?: string })?.message ?? String(err)
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return sensorError('permission-denied', message)
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return sensorError('no-device', message)
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return sensorError('device-busy', message)
    default:
      return sensorError('unknown', message)
  }
}

export function releaseStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop())
}

export function describeCamera(stream: MediaStream): string {
  const label = stream.getVideoTracks()[0]?.label ?? ''
  // Strip USB vendor ids like "(046d:0825)" and ignore opaque labels.
  const clean = label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)/i, '').trim()
  return clean && clean.length <= 40 && /\s/.test(clean) ? clean : 'Webcam'
}
