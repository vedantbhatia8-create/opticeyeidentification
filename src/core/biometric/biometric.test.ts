import { describe, expect, it } from 'vitest'
import { encodeIrisBand, irisHammingDistance } from './irisCode'
import { identify } from './matcher'
import { seededRandom } from './math'
import { syntheticSample, syntheticTemplate } from './synthetic'
import { buildTemplate, TemplateError } from './template'

function band(seed: string, angular = 64, radial = 8) {
  const r = seededRandom(seed)
  return Float32Array.from({ length: angular * radial }, () => r() * 2 - 1)
}
const allValid = (n: number) => new Uint8Array(n).fill(1)

describe('iris code', () => {
  it('matches itself, tolerates rotation, separates different irises', () => {
    const a = band('a')
    const codeA = encodeIrisBand(a, 64, 8, allValid(512))
    expect(irisHammingDistance(codeA, codeA)).toBe(0)

    // Rotate by 2 angular samples (head roll).
    const rotated = new Float32Array(a.length)
    for (let r = 0; r < 8; r++) for (let c = 0; c < 64; c++) rotated[r * 64 + c] = a[r * 64 + ((c + 2) % 64)]
    expect(irisHammingDistance(codeA, encodeIrisBand(rotated, 64, 8, allValid(512)))).toBe(0)

    const codeB = encodeIrisBand(band('b'), 64, 8, allValid(512))
    expect(irisHammingDistance(codeA, codeB)).toBeGreaterThan(0.35)
  })
})

describe('template + identification', () => {
  const candidates = ['sarah', 'emma', 'michael'].map((seed) => ({
    identityId: seed,
    scanId: `scan-${seed}`,
    template: syntheticTemplate(seed),
  }))
  const probe = (seed: string, n = 6) => Array.from({ length: n }, (_, i) => syntheticSample(seed, `probe-${i}`))

  it('identifies enrolled people', () => {
    for (const seed of ['sarah', 'emma', 'michael']) {
      const result = identify(probe(seed), candidates)
      expect(result.status).toBe('verified')
      if (result.status === 'verified') expect(result.match.identityId).toBe(seed)
    }
  })

  it('rejects unknown people', () => {
    for (let i = 0; i < 20; i++) {
      expect(identify(probe(`stranger-${i}`), candidates).status).toBe('not-recognized')
    }
  })

  it('refuses to decide with too few samples', () => {
    expect(identify(probe('sarah', 1), candidates)).toMatchObject({ status: 'unable', reason: 'insufficient-samples' })
  })

  it('does not match anyone when nothing is enrolled', () => {
    expect(identify(probe('sarah'), []).status).toBe('not-recognized')
  })

  it('requires enough enrollment samples and stores no imagery', () => {
    expect(() => buildTemplate(probe('x', 2), ['center'])).toThrow(TemplateError)
    const t = syntheticTemplate('sarah')
    expect(Object.keys(t).sort()).toEqual(
      ['centroid', 'createdAt', 'embeddings', 'geometry', 'iris', 'modality', 'poses', 'quality', 'sampleCount', 'version'].sort(),
    )
  })
})
