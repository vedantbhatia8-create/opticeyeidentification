/**
 * Matching and 1:N identification.
 *
 * Decision rule (webcam prototype):
 *   The face-region embedding is the discriminative signal a consumer webcam
 *   can reliably provide, so the accept/reject decision is made on embedding
 *   distance with a margin against the runner-up identity. Iris texture and
 *   ocular geometry contribute to the fused confidence shown to operators.
 *   With NIR iris hardware the iris Hamming distance would become the
 *   primary decision signal (typical threshold ≈ 0.32).
 */
import { irisHammingDistance } from './irisCode'
import { clamp, l2, logistic, median } from './math'
import type { BiometricSample, MatchScore, OpticTemplate } from './types'

export interface MatchPolicy {
  /** Maximum embedding distance accepted as the same person. */
  acceptDistance: number
  /** Required distance gap between best and runner-up identity. */
  minMargin: number
  /** Minimum good probe samples needed to decide at all. */
  minProbeSamples: number
}

export const DEFAULT_MATCH_POLICY: MatchPolicy = {
  acceptDistance: 0.5,
  minMargin: 0.04,
  minProbeSamples: 3,
}

export function compareProbe(probe: BiometricSample[], template: OpticTemplate): MatchScore {
  const usable = probe.filter((s) => s.modality === template.modality && s.features.embedding?.length)

  const perSample = usable.map((s) => {
    const e = s.features.embedding!
    let best = l2(e, template.centroid)
    for (const t of template.embeddings) best = Math.min(best, l2(e, t))
    return best
  })
  const embeddingDistance = perSample.length ? median(perSample) : Infinity

  const hams: number[] = []
  for (const s of usable) {
    for (const eye of ['left', 'right'] as const) {
      const code = s.features.iris?.[eye]
      if (!code || template.iris[eye].length === 0) continue
      hams.push(Math.min(...template.iris[eye].map((t) => irisHammingDistance(code, t))))
    }
  }
  const irisHamming = hams.length ? median(hams) : null

  let geometryDeviation: number | null = null
  if (template.geometry) {
    const devs = usable
      .map((s) => s.features.geometry)
      .filter((g): g is number[] => !!g?.length)
      .map((g) => {
        const { mean, std } = template.geometry!
        let sum = 0
        for (let i = 0; i < mean.length; i++) sum += Math.abs(g[i] - mean[i]) / (std[i] + 0.02)
        return sum / mean.length
      })
    if (devs.length) geometryDeviation = median(devs)
  }

  const sEmbedding = logistic(embeddingDistance, 0.5, 0.06)
  const sIris = irisHamming === null ? sEmbedding : logistic(irisHamming, 0.44, 0.02)
  const sGeometry = geometryDeviation === null ? sEmbedding : logistic(geometryDeviation, 3, 0.8)
  return {
    similarity: clamp(0.82 * sEmbedding + 0.12 * sIris + 0.06 * sGeometry),
    components: { embeddingDistance, irisHamming, geometryDeviation },
  }
}

export interface Candidate {
  identityId: string
  scanId: string
  template: OpticTemplate
}

export interface RankedMatch {
  identityId: string
  scanId: string
  score: MatchScore
}

export type IdentificationResult =
  | { status: 'verified'; match: RankedMatch; runnerUp: RankedMatch | null; probeCount: number }
  | { status: 'not-recognized'; best: RankedMatch | null; probeCount: number }
  | {
      status: 'unable'
      reason: 'insufficient-samples' | 'modality-mismatch'
      probeCount: number
    }

export function identify(
  probe: BiometricSample[],
  candidates: Candidate[],
  policy: MatchPolicy = DEFAULT_MATCH_POLICY,
): IdentificationResult {
  const good = probe.filter((s) => s.features.embedding?.length)
  if (good.length < policy.minProbeSamples) {
    return { status: 'unable', reason: 'insufficient-samples', probeCount: good.length }
  }
  const comparable = candidates.filter((c) => c.template.modality === good[0].modality)
  if (candidates.length > 0 && comparable.length === 0) {
    return { status: 'unable', reason: 'modality-mismatch', probeCount: good.length }
  }

  // Best score per identity (an identity may have several enrolled scans).
  const byIdentity = new Map<string, RankedMatch>()
  for (const c of comparable) {
    const score = compareProbe(good, c.template)
    const prev = byIdentity.get(c.identityId)
    if (!prev || score.components.embeddingDistance < prev.score.components.embeddingDistance) {
      byIdentity.set(c.identityId, { identityId: c.identityId, scanId: c.scanId, score })
    }
  }
  const ranked = [...byIdentity.values()].sort(
    (a, b) => a.score.components.embeddingDistance - b.score.components.embeddingDistance,
  )
  const best = ranked[0] ?? null
  const runnerUp = ranked[1] ?? null
  if (!best) return { status: 'not-recognized', best: null, probeCount: good.length }

  const d = best.score.components.embeddingDistance
  const margin = runnerUp ? runnerUp.score.components.embeddingDistance - d : Infinity
  if (d <= policy.acceptDistance && margin >= policy.minMargin) {
    return { status: 'verified', match: best, runnerUp, probeCount: good.length }
  }
  return { status: 'not-recognized', best, probeCount: good.length }
}
