/**
 * TEMPORARY PROCESSING — derive features from a single frame.
 *
 * Operates on in-memory canvases owned by the WebcamSensor. Nothing here is
 * persisted; callers wipe the canvases as soon as features are extracted.
 */
import { encodeIrisBand } from '../../biometric/irisCode'
import type { IrisCode } from '../../biometric/types'
import { dist, irisRadiusPx } from './analysis'
import { LM, type EyeSide, type LandmarkPoint } from './landmarks'

export const CHIP_SIZE = 150
const IRIS_ANGULAR = 64
const IRIS_RADIAL = 8

/** Render an eye-levelled, tightly cropped face chip for the embedding network. */
export function renderFaceChip(
  frame: HTMLCanvasElement,
  lm: LandmarkPoint[],
  chip: HTMLCanvasElement,
): void {
  const w = frame.width
  const h = frame.height
  const r = lm[LM.right.irisCenter]
  const l = lm[LM.left.irisCenter]
  const angle = Math.atan2((l.y - r.y) * h, (l.x - r.x) * w)

  let cx = 0
  let cy = 0
  for (const p of lm) {
    cx += p.x * w
    cy += p.y * h
  }
  cx /= lm.length
  cy /= lm.length

  // Extent of the face in the eye-levelled frame.
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of lm) {
    const dx = p.x * w - cx
    const dy = p.y * h - cy
    const rx = dx * cos - dy * sin
    const ry = dx * sin + dy * cos
    minX = Math.min(minX, rx)
    maxX = Math.max(maxX, rx)
    minY = Math.min(minY, ry)
    maxY = Math.max(maxY, ry)
  }
  const side = Math.max(maxX - minX, maxY - minY) * 1.05
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2

  chip.width = CHIP_SIZE
  chip.height = CHIP_SIZE
  const ctx = chip.getContext('2d')!
  ctx.save()
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, CHIP_SIZE, CHIP_SIZE)
  ctx.translate(CHIP_SIZE / 2, CHIP_SIZE / 2)
  ctx.scale(CHIP_SIZE / side, CHIP_SIZE / side)
  ctx.translate(-midX, -midY)
  ctx.rotate(-angle)
  ctx.translate(-cx, -cy)
  ctx.drawImage(frame, 0, 0)
  ctx.restore()
}

function pointInPolygon(x: number, y: number, poly: { x: number; y: number }[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** Polar-unwrap one iris from the frame and encode it. Returns null if the eye is unusable. */
export function extractIrisCode(
  frameCtx: CanvasRenderingContext2D,
  frameW: number,
  frameH: number,
  lm: LandmarkPoint[],
  side: EyeSide,
): IrisCode | null {
  const aspect = frameW / frameH
  const eye = LM[side]
  const c = lm[eye.irisCenter]
  const R = irisRadiusPx(lm, side, aspect) * frameH // pixels
  if (R < 4) return null

  const cx = c.x * frameW
  const cy = c.y * frameH
  const x0 = Math.max(0, Math.floor(cx - R - 2))
  const y0 = Math.max(0, Math.floor(cy - R - 2))
  const x1 = Math.min(frameW, Math.ceil(cx + R + 2))
  const y1 = Math.min(frameH, Math.ceil(cy + R + 2))
  const rw = x1 - x0
  const rh = y1 - y0
  if (rw < 4 || rh < 4) return null
  const img = frameCtx.getImageData(x0, y0, rw, rh)

  const luma = (x: number, y: number) => {
    const xi = Math.min(rw - 2, Math.max(0, Math.floor(x - x0)))
    const yi = Math.min(rh - 2, Math.max(0, Math.floor(y - y0)))
    const fx = x - x0 - xi
    const fy = y - y0 - yi
    const at = (xx: number, yy: number) => {
      const i = (yy * rw + xx) * 4
      return (0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]) / 255
    }
    return (
      at(xi, yi) * (1 - fx) * (1 - fy) +
      at(xi + 1, yi) * fx * (1 - fy) +
      at(xi, yi + 1) * (1 - fx) * fy +
      at(xi + 1, yi + 1) * fx * fy
    )
  }

  const lid = eye.contour.map((i) => ({ x: lm[i].x * frameW, y: lm[i].y * frameH }))
  const band = new Float32Array(IRIS_ANGULAR * IRIS_RADIAL)
  const valid = new Uint8Array(IRIS_ANGULAR * IRIS_RADIAL)
  let sum = 0
  let count = 0
  for (let ri = 0; ri < IRIS_RADIAL; ri++) {
    const rr = R * (0.38 + (0.55 * (ri + 0.5)) / IRIS_RADIAL)
    for (let ai = 0; ai < IRIS_ANGULAR; ai++) {
      const t = (2 * Math.PI * ai) / IRIS_ANGULAR
      const x = cx + rr * Math.cos(t)
      const y = cy + rr * Math.sin(t)
      const v = luma(x, y)
      const idx = ri * IRIS_ANGULAR + ai
      band[idx] = v
      if (pointInPolygon(x, y, lid) && v < 0.92) {
        valid[idx] = 1
        sum += v
        count++
      }
    }
  }
  if (count < band.length * 0.3) return null

  // Normalise contrast over the usable region.
  const mean = sum / count
  let varSum = 0
  for (let i = 0; i < band.length; i++) if (valid[i]) varSum += (band[i] - mean) ** 2
  const std = Math.sqrt(varSum / count) || 1
  for (let i = 0; i < band.length; i++) band[i] = (band[i] - mean) / std

  const code = encodeIrisBand(band, IRIS_ANGULAR, IRIS_RADIAL, valid)
  // Wipe the temporary buffers.
  img.data.fill(0)
  band.fill(0)
  return code
}

/** Scale-invariant ocular/facial geometry ratios, normalised by outer-canthal distance. */
export function computeGeometry(lm: LandmarkPoint[], aspect: number): number[] {
  const d = (a: number, b: number) => dist(lm[a], lm[b], aspect)
  const iod = Math.max(1e-6, d(LM.right.outer, LM.left.outer))
  const rEye = d(LM.right.outer, LM.right.inner)
  const lEye = d(LM.left.outer, LM.left.inner)
  const irisD = irisRadiusPx(lm, 'right', aspect) + irisRadiusPx(lm, 'left', aspect)
  return [
    rEye / iod,
    lEye / iod,
    d(LM.right.inner, LM.left.inner) / iod,
    d(LM.noseBridge, LM.noseTip) / iod,
    d(LM.noseRight, LM.noseLeft) / iod,
    d(LM.mouthRight, LM.mouthLeft) / iod,
    d(LM.cheekRight, LM.cheekLeft) / iod,
    d(LM.forehead, LM.chin) / iod,
    d(LM.noseTip, LM.chin) / iod,
    d(LM.browRight, LM.right.upper) / iod,
    d(LM.browLeft, LM.left.upper) / iod,
    irisD / Math.max(1e-6, rEye + lEye),
  ]
}

export function wipeCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  ctx?.clearRect(0, 0, canvas.width, canvas.height)
  canvas.width = 1
  canvas.height = 1
}
