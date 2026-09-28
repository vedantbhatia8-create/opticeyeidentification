/**
 * WebcamSensor — prototype BiometricSensor backed by a consumer webcam.
 *
 *   camera.ts      RAW INPUT         MediaStream frames (never persisted)
 *   analysis.ts    TRACKING          landmarks → SensorObservation for the UI
 *   processing.ts  TEMPORARY         frame → face chip / iris bands → features
 *   models.ts      ON-DEVICE MODELS  MediaPipe Face Landmarker + embedding net
 *
 * Only the numeric BiometricSample leaves this class.
 */
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import type { BiometricSample, SampleFeatures } from '../../biometric/types'
import {
  isSensorError,
  sensorError,
  type BiometricSensor,
  type Point,
  type SensorDescriptor,
  type SensorObservation,
  type SensorStatus,
  type Unsubscribe,
} from '../types'
import { analyzeFrame } from './analysis'
import { describeCamera, openCamera, releaseStream } from './camera'
import type { LandmarkPoint } from './landmarks'
import { loadEmbedder, loadLandmarker, type FaceEmbedder } from './models'
import { computeGeometry, extractIrisCode, renderFaceChip, wipeCanvas } from './processing'

/** Minimum frame quality for a frame to be turned into a biometric sample. */
export const CAPTURE_MIN_QUALITY = 0.35

export class WebcamSensor implements BiometricSensor {
  descriptor: SensorDescriptor = {
    kind: 'webcam',
    name: 'Webcam',
    modality: 'webcam-ocular-v1',
    providesPreview: true,
    supportsPoseGuidance: true,
  }

  private status: SensorStatus = { state: 'idle' }
  private stream: MediaStream | null = null
  private video: HTMLVideoElement | null = null
  private landmarker: FaceLandmarker | null = null
  private embedder: FaceEmbedder | null = null
  private raf = 0
  private lastVideoTime = -1
  private lastTimestamp = 0
  private frameCount = 0
  private brightness = 0.5
  private previousCenter: Point | null = null
  private startToken = 0
  private readonly statusListeners = new Set<(s: SensorStatus) => void>()
  private readonly observationListeners = new Set<(o: SensorObservation) => void>()
  private readonly lumaCanvas = document.createElement('canvas')

  getStatus(): SensorStatus {
    return this.status
  }

  getPreviewStream(): MediaStream | null {
    return this.stream
  }

  onStatus(listener: (s: SensorStatus) => void): Unsubscribe {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  onObservation(listener: (o: SensorObservation) => void): Unsubscribe {
    this.observationListeners.add(listener)
    return () => this.observationListeners.delete(listener)
  }

  private setStatus(status: SensorStatus) {
    this.status = status
    this.statusListeners.forEach((l) => l(status))
  }

  async start(): Promise<void> {
    if (this.status.state === 'running' || this.status.state === 'starting') return
    const token = ++this.startToken
    this.setStatus({ state: 'starting', detail: 'Requesting camera' })
    // Load models while the user answers the permission prompt.
    const models = Promise.all([loadLandmarker(), loadEmbedder()])
    models.catch(() => {}) // handled below
    try {
      const stream = await openCamera()
      if (token !== this.startToken) {
        releaseStream(stream)
        return
      }
      this.stream = stream
      this.descriptor = { ...this.descriptor, name: describeCamera(stream) }
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (this.status.state === 'running') {
          this.teardown()
          this.setStatus({ state: 'error', error: sensorError('no-device', 'The camera was disconnected.') })
        }
      })

      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      this.video = video
      await video.play()

      this.setStatus({ state: 'starting', detail: 'Loading optic models' })
      const [landmarker, embedder] = await models
      if (token !== this.startToken) return
      this.landmarker = landmarker
      this.embedder = embedder
      this.setStatus({ state: 'running' })
      this.loop()
    } catch (err) {
      if (token !== this.startToken) return
      this.teardown()
      const error = isSensorError(err) ? err : sensorError('unknown', String(err))
      this.setStatus({ state: 'error', error })
      throw error
    }
  }

  async stop(): Promise<void> {
    this.startToken++
    this.teardown()
    if (this.status.state !== 'idle') this.setStatus({ state: 'stopped' })
  }

  private teardown() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    releaseStream(this.stream)
    this.stream = null
    if (this.video) {
      this.video.pause()
      this.video.srcObject = null
      this.video = null
    }
    this.previousCenter = null
    this.lastVideoTime = -1
  }

  private nextTimestamp(): number {
    this.lastTimestamp = Math.max(this.lastTimestamp + 1, performance.now())
    return this.lastTimestamp
  }

  private measureBrightness(source: CanvasImageSource) {
    const c = this.lumaCanvas
    c.width = 32
    c.height = 18
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(source, 0, 0, 32, 18)
    const d = ctx.getImageData(0, 0, 32, 18).data
    let sum = 0
    for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    this.brightness = sum / (d.length / 4) / 255
  }

  private loop = () => {
    const video = this.video
    const landmarker = this.landmarker
    if (!video || !landmarker || this.status.state !== 'running') return
    this.raf = requestAnimationFrame(this.loop)
    if (video.readyState < 2 || video.currentTime === this.lastVideoTime) return
    this.lastVideoTime = video.currentTime
    try {
      if (this.frameCount++ % 6 === 0) this.measureBrightness(video)
      const result = landmarker.detectForVideo(video, this.nextTimestamp())
      const aspect = video.videoWidth / Math.max(1, video.videoHeight)
      const { observation, center } = analyzeFrame({
        faces: result.faceLandmarks as LandmarkPoint[][],
        aspect,
        brightness: this.brightness,
        timestamp: Date.now(),
        previousCenter: this.previousCenter,
      })
      this.previousCenter = center
      this.observationListeners.forEach((l) => l(observation))
    } catch (err) {
      console.warn('[optic] tracking frame failed', err)
    }
  }

  async captureSample(): Promise<BiometricSample | null> {
    const video = this.video
    const landmarker = this.landmarker
    const embedder = this.embedder
    if (!video || !landmarker || !embedder || this.status.state !== 'running') return null
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return null

    // Temporary processing surfaces — wiped in `finally`.
    const frame = document.createElement('canvas')
    const chip = document.createElement('canvas')
    try {
      frame.width = w
      frame.height = h
      const ctx = frame.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(video, 0, 0, w, h)

      const result = landmarker.detectForVideo(frame, this.nextTimestamp())
      const faces = result.faceLandmarks as LandmarkPoint[][]
      const { observation } = analyzeFrame({
        faces,
        aspect: w / h,
        brightness: this.brightness,
        timestamp: Date.now(),
        previousCenter: null,
      })
      if (observation.presence !== 'eyes' || observation.quality.score < CAPTURE_MIN_QUALITY) return null
      const lm = faces[0]

      renderFaceChip(frame, lm, chip)
      const embedding = await embedder.embed(chip)
      const left = extractIrisCode(ctx, w, h, lm, 'left')
      const right = extractIrisCode(ctx, w, h, lm, 'right')
      const features: SampleFeatures = {
        embedding,
        geometry: computeGeometry(lm, w / h),
        iris: { ...(left && { left }), ...(right && { right }) },
      }
      return {
        modality: 'webcam-ocular-v1',
        sensorKind: 'webcam',
        capturedAt: Date.now(),
        quality: observation.quality.score,
        pose: observation.pose,
        features,
      }
    } catch (err) {
      console.warn('[optic] sample extraction failed', err)
      return null
    } finally {
      wipeCanvas(frame)
      wipeCanvas(chip)
    }
  }
}
