/**
 * Synthetic biometric features for DEMO MODE.
 *
 * Demo personas (e.g. "Sarah Chen") have deterministic synthetic templates so
 * a single presenter can demonstrate several identities. Synthetic samples
 * still go through the real template builder and matcher — only the sensor
 * input is simulated. Synthetic vectors are random directions in embedding
 * space and are far from any real person's embedding, so they can never
 * match a real enrollment (and vice-versa).
 */
import { packBits } from './irisCode'
import { gaussian, seededRandom } from './math'
import { buildTemplate } from './template'
import type { BiometricSample, IrisCode, OpticTemplate } from './types'

const DIM = 128
const IRIS_W = 64
const IRIS_H = 16
const BASE_GEOMETRY = [0.33, 0.33, 0.34, 0.42, 0.36, 0.52, 1.35, 1.9, 0.72, 0.28, 0.28, 0.42]

interface PersonaBase {
  embedding: number[]
  iris: { left: Uint8Array; right: Uint8Array }
  geometry: number[]
}

function personaBase(seed: string): PersonaBase {
  const rand = seededRandom(`optic:${seed}`)
  const embedding = Array.from({ length: DIM }, () => (gaussian(rand) * 0.9) / Math.sqrt(DIM))
  const bits = () => Uint8Array.from({ length: IRIS_W * IRIS_H }, () => (rand() > 0.5 ? 1 : 0))
  return {
    embedding,
    iris: { left: bits(), right: bits() },
    geometry: BASE_GEOMETRY.map((g) => g * (1 + gaussian(rand) * 0.06)),
  }
}

function noisyIris(bits: Uint8Array, rand: () => number, flip: number): IrisCode {
  const noisy = bits.map((b) => (rand() < flip ? 1 - b : b))
  const mask = Uint8Array.from({ length: bits.length }, () => (rand() < 0.85 ? 1 : 0))
  return { width: IRIS_W, height: IRIS_H, bits: packBits(noisy), mask: packBits(mask) }
}

export function syntheticSample(seed: string, sampleSeed: string = String(Math.random())): BiometricSample {
  const base = personaBase(seed)
  const rand = seededRandom(`${seed}:${sampleSeed}`)
  const sigma = 0.22 / Math.sqrt(DIM)
  return {
    modality: 'webcam-ocular-v1',
    sensorKind: 'simulated',
    capturedAt: Date.now(),
    quality: 0.8 + rand() * 0.15,
    pose: { yaw: gaussian(rand) * 4, pitch: gaussian(rand) * 3, roll: gaussian(rand) * 2 },
    features: {
      embedding: base.embedding.map((v) => v + gaussian(rand) * sigma),
      geometry: base.geometry.map((g) => g * (1 + gaussian(rand) * 0.015)),
      iris: { left: noisyIris(base.iris.left, rand, 0.2), right: noisyIris(base.iris.right, rand, 0.2) },
    },
  }
}

export function syntheticTemplate(seed: string): OpticTemplate {
  const poses = ['center', 'left', 'right', 'up', 'down']
  const samples = Array.from({ length: 15 }, (_, i) => syntheticSample(seed, `enroll-${i}`))
  return buildTemplate(samples, poses)
}
