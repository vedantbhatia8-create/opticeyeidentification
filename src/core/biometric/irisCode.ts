/**
 * Prototype IrisCode: encode a polar-unwrapped iris band into phase bits and
 * compare codes with rotation-tolerant fractional Hamming distance.
 *
 * With dedicated NIR iris hardware this is where a certified iris encoder
 * would plug in. With a consumer webcam the iris spans only ~20–40 px, so
 * these codes carry limited identity information and are weighted
 * accordingly by the matcher.
 */
import type { IrisCode } from './types'

export function packBits(bits: Uint8Array): string {
  const bytes = new Uint8Array(Math.ceil(bits.length / 8))
  for (let i = 0; i < bits.length; i++) if (bits[i]) bytes[i >> 3] |= 1 << (i & 7)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export function unpackBits(encoded: string, length: number): Uint8Array {
  const s = atob(encoded)
  const out = new Uint8Array(length)
  for (let i = 0; i < length; i++) out[i] = (s.charCodeAt(i >> 3) >> (i & 7)) & 1
  return out
}

/**
 * Encode a polar iris band.
 * @param band  grayscale samples, `radial` rows × `angular` columns, row-major
 * @param valid 1 where the sample is usable (not eyelid / glare)
 * Produces 2 bit-planes (even/odd Gabor phase) per radial row → height = radial*2.
 */
export function encodeIrisBand(
  band: Float32Array,
  angular: number,
  radial: number,
  valid: Uint8Array,
  wavelength = 8,
): IrisCode {
  const height = radial * 2
  const bits = new Uint8Array(angular * height)
  const mask = new Uint8Array(angular * height)
  const half = Math.ceil(wavelength)
  const sigma = wavelength / 2
  const kernel: { even: number; odd: number }[] = []
  let evenSum = 0
  for (let k = -half; k <= half; k++) {
    const g = Math.exp(-(k * k) / (2 * sigma * sigma))
    const even = g * Math.cos((2 * Math.PI * k) / wavelength)
    kernel.push({ even, odd: g * Math.sin((2 * Math.PI * k) / wavelength) })
    evenSum += even
  }
  // Zero-DC even kernel so absolute brightness does not leak into the code.
  const dc = evenSum / kernel.length
  for (const k of kernel) k.even -= dc

  for (let r = 0; r < radial; r++) {
    for (let c = 0; c < angular; c++) {
      let re = 0
      let im = 0
      let usable = valid[r * angular + c] === 1
      for (let k = -half; k <= half; k++) {
        const cc = (c + k + angular) % angular // angular axis wraps around
        const v = band[r * angular + cc]
        re += v * kernel[k + half].even
        im += v * kernel[k + half].odd
        if (valid[r * angular + cc] !== 1 && Math.abs(k) <= 1) usable = false
      }
      const weak = Math.abs(re) + Math.abs(im) < 1e-3
      const iRe = r * 2 * angular + c
      const iIm = (r * 2 + 1) * angular + c
      bits[iRe] = re > 0 ? 1 : 0
      bits[iIm] = im > 0 ? 1 : 0
      mask[iRe] = mask[iIm] = usable && !weak ? 1 : 0
    }
  }
  return { width: angular, height, bits: packBits(bits), mask: packBits(mask) }
}

/**
 * Fractional Hamming distance, minimised over circular angular shifts to
 * tolerate head roll. 0 = identical, ~0.5 = statistically independent.
 */
export function irisHammingDistance(a: IrisCode, b: IrisCode, maxShift = 4): number {
  if (a.width !== b.width || a.height !== b.height) return 0.5
  const n = a.width * a.height
  const ab = unpackBits(a.bits, n)
  const am = unpackBits(a.mask, n)
  const bb = unpackBits(b.bits, n)
  const bm = unpackBits(b.mask, n)
  let best = 0.5
  for (let s = -maxShift; s <= maxShift; s++) {
    let diff = 0
    let total = 0
    for (let row = 0; row < a.height; row++) {
      for (let col = 0; col < a.width; col++) {
        const i = row * a.width + col
        const j = row * a.width + ((col + s + a.width) % a.width)
        if (am[i] && bm[j]) {
          total++
          if (ab[i] !== bb[j]) diff++
        }
      }
    }
    // Require a meaningful overlap, otherwise the comparison is uninformative.
    if (total >= n * 0.25) best = Math.min(best, diff / total)
  }
  return best
}

/** Returns a grid (-1 = masked) for visualising a code in the Optic Lab. */
export function irisCodeGrid(code: IrisCode): number[][] {
  const n = code.width * code.height
  const bits = unpackBits(code.bits, n)
  const mask = unpackBits(code.mask, n)
  const grid: number[][] = []
  for (let r = 0; r < code.height; r++) {
    const row: number[] = []
    for (let c = 0; c < code.width; c++) {
      const i = r * code.width + c
      row.push(mask[i] ? bits[i] : -1)
    }
    grid.push(row)
  }
  return grid
}
