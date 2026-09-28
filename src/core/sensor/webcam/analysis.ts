/**
 * Converts MediaPipe landmarks (normalised, un-mirrored image space) into a
 * sensor-agnostic SensorObservation (normalised, mirrored display space).
 */
import type { HeadPose } from '../../biometric/types'
import type { EyeObservation, Point, QualityIssue, SensorObservation } from '../types'
import { LM, type EyeSide, type LandmarkPoint } from './landmarks'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** Aspect-corrected distance (units of frame height). */
export function dist(a: LandmarkPoint, b: LandmarkPoint, aspect: number): number {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y)
}

const toDisplay = (p: { x: number; y: number }): Point => ({ x: 1 - p.x, y: p.y })

export function irisRadiusPx(lm: LandmarkPoint[], side: EyeSide, aspect: number): number {
  const eye = LM[side]
  const c = lm[eye.irisCenter]
  return eye.irisEdge.reduce((a, i) => a + dist(c, lm[i], aspect), 0) / eye.irisEdge.length
}

export function eyeAspectRatio(lm: LandmarkPoint[], side: EyeSide, aspect: number): number {
  const eye = LM[side]
  return dist(lm[eye.upper], lm[eye.lower], aspect) / Math.max(1e-6, dist(lm[eye.outer], lm[eye.inner], aspect))
}

function eyeObservation(lm: LandmarkPoint[], side: EyeSide, aspect: number): EyeObservation {
  const eye = LM[side]
  const ear = eyeAspectRatio(lm, side, aspect)
  return {
    center: toDisplay(lm[eye.irisCenter]),
    // height units → fraction of frame width
    irisRadius: irisRadiusPx(lm, side, aspect) / aspect,
    corners: [toDisplay(lm[eye.outer]), toDisplay(lm[eye.inner])],
    contour: eye.contour.map((i) => toDisplay(lm[i])),
    openness: clamp((ear - 0.12) / 0.18, 0, 1),
  }
}

/** Geometric head-pose estimate. Positive yaw = subject's left, positive pitch = up. */
export function estimatePose(lm: LandmarkPoint[], aspect: number): HeadPose {
  const nose = lm[LM.noseTip]
  const cr = lm[LM.cheekRight]
  const cl = lm[LM.cheekLeft]
  const yawRatio = (nose.x - cr.x) / Math.max(1e-6, cl.x - cr.x)
  const bridge = lm[LM.noseBridge]
  const chin = lm[LM.chin]
  const pitchRatio = (nose.y - bridge.y) / Math.max(1e-6, chin.y - bridge.y)
  const ro = lm[LM.right.outer]
  const lo = lm[LM.left.outer]
  return {
    yaw: (yawRatio - 0.5) * 110,
    pitch: (0.4 - pitchRatio) * 160,
    roll: (Math.atan2(lo.y - ro.y, (lo.x - ro.x) * aspect) * 180) / Math.PI,
  }
}

/** Iris position within the eye opening. x positive = subject's left, y positive = up. */
export function estimateGaze(lm: LandmarkPoint[], aspect: number): Point {
  const one = (side: EyeSide) => {
    const eye = LM[side]
    const a = lm[eye.outer]
    const b = lm[eye.inner]
    const [imgLeft, imgRight] = a.x < b.x ? [a, b] : [b, a]
    const iris = lm[eye.irisCenter]
    const t = (iris.x - imgLeft.x) / Math.max(1e-6, imgRight.x - imgLeft.x)
    const width = dist(a, b, aspect)
    const midY = (lm[eye.upper].y + lm[eye.lower].y) / 2
    return { x: (t - 0.5) * 5, y: ((midY - iris.y) / Math.max(1e-6, width)) * 6 }
  }
  const r = one('right')
  const l = one('left')
  return { x: clamp((r.x + l.x) / 2, -1, 1), y: clamp((r.y + l.y) / 2, -1, 1) }
}

export interface AnalysisInput {
  faces: LandmarkPoint[][]
  aspect: number
  brightness: number
  timestamp: number
  previousCenter: Point | null
}

export function analyzeFrame(input: AnalysisInput): { observation: SensorObservation; center: Point | null } {
  const { faces, aspect, brightness, timestamp } = input
  const issues: QualityIssue[] = []
  if (brightness < 0.18) issues.push('too-dark')
  else if (brightness > 0.9) issues.push('too-bright')

  if (faces.length === 0) {
    return {
      observation: { timestamp, presence: 'none', quality: { score: 0, issues: ['no-face', ...issues], brightness }, aspect },
      center: null,
    }
  }
  if (faces.length > 1) {
    return {
      observation: {
        timestamp,
        presence: 'multiple',
        quality: { score: 0, issues: ['multiple-faces', ...issues], brightness },
        aspect,
      },
      center: null,
    }
  }

  const lm = faces[0]
  let minX = 1, minY = 1, maxX = 0, maxY = 0
  for (const p of lm) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const faceBox = { x: 1 - maxX, y: minY, width: maxX - minX, height: maxY - minY }
  const center = { x: faceBox.x + faceBox.width / 2, y: faceBox.y + faceBox.height / 2 }

  const left = eyeObservation(lm, 'left', aspect)
  const right = eyeObservation(lm, 'right', aspect)
  const pose = estimatePose(lm, aspect)
  const gaze = estimateGaze(lm, aspect)

  // Quality factors
  const faceSize = faceBox.width
  if (faceSize < 0.16) issues.push('too-far')
  else if (faceSize > 0.75) issues.push('too-close')
  const offCenter = Math.hypot(center.x - 0.5, center.y - 0.5)
  if (offCenter > 0.25) issues.push('off-center')
  const openness = Math.min(left.openness, right.openness)
  if (openness < 0.2) issues.push('eyes-closed')
  if (Math.abs(pose.yaw) > 32 || Math.abs(pose.pitch) > 32) issues.push('head-turned')
  let motion = 0
  if (input.previousCenter) {
    motion = Math.hypot(center.x - input.previousCenter.x, center.y - input.previousCenter.y) / Math.max(0.05, faceSize)
    if (motion > 0.08) issues.push('motion')
  }

  const sizeScore = clamp((faceSize - 0.1) / 0.14, 0, 1) * (faceSize > 0.75 ? 0.4 : 1)
  const lightScore = brightness < 0.18 ? brightness / 0.18 : brightness > 0.9 ? 0.5 : 1
  const score =
    sizeScore *
    clamp(1 - (offCenter - 0.2) * 3, 0.2, 1) *
    clamp(openness * 1.6, 0, 1) *
    lightScore *
    clamp(1 - motion * 4, 0.3, 1) *
    (issues.includes('head-turned') ? 0.6 : 1)

  const eyesUsable = openness >= 0.2 && left.irisRadius > 0.002 && right.irisRadius > 0.002
  return {
    observation: {
      timestamp,
      presence: eyesUsable ? 'eyes' : 'face',
      faceBox,
      eyes: { left, right },
      pose,
      gaze,
      quality: { score: clamp(score, 0, 1), issues, brightness },
      aspect,
    },
    center,
  }
}
