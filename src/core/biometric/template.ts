import { meanVector, stdVector } from './math'
import type { BiometricSample, OpticTemplate } from './types'

export const MIN_ENROLLMENT_SAMPLES = 5
const MAX_EMBEDDINGS = 24
const MAX_IRIS_CODES_PER_EYE = 10

export class TemplateError extends Error {}

/** Keep the best `limit` items while preserving pose diversity (items arrive in pose order). */
function bestSpread<T>(items: T[], quality: (t: T) => number, limit: number): T[] {
  if (items.length <= limit) return items
  const step = items.length / limit
  const picked: T[] = []
  for (let i = 0; i < limit; i++) {
    const window = items.slice(Math.floor(i * step), Math.floor((i + 1) * step))
    picked.push(window.reduce((a, b) => (quality(b) > quality(a) ? b : a)))
  }
  return picked
}

/**
 * Fuse enrollment samples into a single stored representation.
 * Only numeric features are kept — the samples themselves never contain imagery.
 */
export function buildTemplate(samples: BiometricSample[], poses: string[]): OpticTemplate {
  if (samples.length === 0) throw new TemplateError('No samples were captured.')
  const modality = samples[0].modality
  if (samples.some((s) => s.modality !== modality)) {
    throw new TemplateError('Samples come from different sensor modalities.')
  }
  const withEmbedding = samples.filter((s) => s.features.embedding?.length)
  if (withEmbedding.length < MIN_ENROLLMENT_SAMPLES) {
    throw new TemplateError(
      `Only ${withEmbedding.length} usable samples were captured (need ${MIN_ENROLLMENT_SAMPLES}).`,
    )
  }

  const kept = bestSpread(withEmbedding, (s) => s.quality, MAX_EMBEDDINGS)
  const embeddings = kept.map((s) => s.features.embedding!)
  const centroid = meanVector(embeddings)

  const geometries = samples.map((s) => s.features.geometry).filter((g): g is number[] => !!g?.length)
  let geometry: OpticTemplate['geometry']
  if (geometries.length >= 3) {
    const mean = meanVector(geometries)
    geometry = { mean, std: stdVector(geometries, mean) }
  }

  const eyeCodes = (eye: 'left' | 'right') =>
    bestSpread(
      samples.filter((s) => s.features.iris?.[eye]),
      (s) => s.quality,
      MAX_IRIS_CODES_PER_EYE,
    ).map((s) => s.features.iris![eye]!)

  return {
    version: 1,
    modality,
    createdAt: Date.now(),
    sampleCount: samples.length,
    quality: samples.reduce((a, s) => a + s.quality, 0) / samples.length,
    embeddings,
    centroid,
    geometry,
    iris: { left: eyeCodes('left'), right: eyeCodes('right') },
    poses: [...new Set(poses)],
  }
}

/** Approximate stored size, shown in the Optic Lab to make data minimisation tangible. */
export function templateSizeBytes(template: OpticTemplate): number {
  return new TextEncoder().encode(JSON.stringify(template)).length
}
