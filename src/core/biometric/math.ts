export function l2(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

export function norm(a: ArrayLike<number>): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * a[i]
  return Math.sqrt(sum)
}

export function meanVector(vectors: ArrayLike<number>[]): number[] {
  if (vectors.length === 0) return []
  const out = new Array<number>(vectors[0].length).fill(0)
  for (const v of vectors) for (let i = 0; i < out.length; i++) out[i] += v[i]
  return out.map((x) => x / vectors.length)
}

export function stdVector(vectors: ArrayLike<number>[], mean: number[]): number[] {
  if (vectors.length === 0) return []
  const out = new Array<number>(mean.length).fill(0)
  for (const v of vectors) for (let i = 0; i < out.length; i++) out[i] += (v[i] - mean[i]) ** 2
  return out.map((x) => Math.sqrt(x / vectors.length))
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function clamp(x: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, x))
}

export function logistic(x: number, midpoint: number, width: number): number {
  return 1 / (1 + Math.exp((x - midpoint) / width))
}

/** Deterministic PRNG (mulberry32) so synthetic demo templates are reproducible. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12)
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
