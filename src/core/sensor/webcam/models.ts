/**
 * On-device model loading. All assets are served from this app's own origin
 * (see scripts/setup-assets.mjs) — no frames are sent to any server.
 */
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import { sensorError } from '../types'

const base = import.meta.env.BASE_URL

let landmarkerPromise: Promise<FaceLandmarker> | null = null

/**
 * Software-emulated WebGL (e.g. SwiftShader on machines without a usable GPU)
 * is slower than MediaPipe's CPU path and can stall when shared with the
 * embedding network, so prefer the CPU delegate there.
 */
export function hasHardwareGpu(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    if (!gl) return false
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return !/swiftshader|llvmpipe|software/i.test(renderer)
  } catch {
    return false
  }
}
let embedderPromise: Promise<FaceEmbedder> | null = null

export function loadLandmarker(): Promise<FaceLandmarker> {
  landmarkerPromise ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
    const fileset = await FilesetResolver.forVisionTasks(`${base}vendor/mediapipe`)
    const make = (delegate: 'GPU' | 'CPU') =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${base}models/face_landmarker.task`, delegate },
        runningMode: 'VIDEO',
        numFaces: 2,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      })
    if (!hasHardwareGpu()) return make('CPU')
    try {
      return await make('GPU')
    } catch {
      return await make('CPU')
    }
  })().catch((err) => {
    landmarkerPromise = null
    throw sensorError('model-load-failed', `Face landmark model failed to load: ${err?.message ?? err}`)
  })
  return landmarkerPromise
}

export interface FaceEmbedder {
  embed(chip: HTMLCanvasElement): Promise<number[]>
}

export function loadEmbedder(): Promise<FaceEmbedder> {
  embedderPromise ??= (async () => {
    const faceapi = await import('@vladmandic/face-api')
    // The bundled tfjs exposes these at runtime; its published typings omit them.
    const tf = faceapi.tf as unknown as { setBackend(name: string): Promise<boolean>; ready(): Promise<void> }
    const ok = await tf.setBackend('webgl').catch(() => false)
    if (!ok) await tf.setBackend('cpu')
    await tf.ready()
    await faceapi.nets.faceRecognitionNet.loadFromUri(`${base}vendor/face-api`)
    return {
      async embed(chip: HTMLCanvasElement) {
        const out = await faceapi.computeFaceDescriptor(chip)
        const vec = Array.isArray(out) ? out[0] : out
        return Array.from(vec as Float32Array)
      },
    }
  })().catch((err) => {
    embedderPromise = null
    throw sensorError('model-load-failed', `Embedding model failed to load: ${err?.message ?? err}`)
  })
  return embedderPromise
}
