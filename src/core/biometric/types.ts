/**
 * Biometric processing layer — types.
 *
 * Data flows through three strictly separated stages:
 *
 *   1. RAW INPUT        camera frames / hardware image buffers.
 *                       Owned by a sensor. Never persisted, never leaves the sensor.
 *   2. TEMPORARY        in-memory crops (face chip, unwrapped iris bands) that a
 *      PROCESSING       sensor's extractor uses to compute features. Discarded
 *                       immediately after a BiometricSample is produced.
 *   3. REPRESENTATION   BiometricSample (probe) and OpticTemplate (enrolled).
 *                       Numeric feature vectors only — no images. Templates are
 *                       encrypted at rest by the identity vault.
 */

/** Which feature pipeline produced a sample. Templates only match same-family samples. */
export type BiometricModality =
  /** Consumer webcam: face-region embedding + ocular geometry + low-res iris texture code. */
  | 'webcam-ocular-v1'
  /** Reserved for dedicated near-infrared iris hardware (ISO/IEC 19794-6 style IrisCode). */
  | 'iris-nir-v1'

/** A binarised, polar-unwrapped iris texture code (Daugman-style, prototype fidelity). */
export interface IrisCode {
  /** Angular samples (columns). */
  width: number
  /** Radial samples (rows). */
  height: number
  /** Base64 of packed bits, row-major, length width*height bits. */
  bits: string
  /** Base64 of packed validity mask bits (1 = usable, 0 = eyelid/glare/occluded). */
  mask: string
}

export interface HeadPose {
  /** Degrees. Positive = subject turned to their left (image right when mirrored). */
  yaw: number
  /** Degrees. Positive = looking up. */
  pitch: number
  roll: number
}

export interface SampleFeatures {
  /** L2-comparable embedding of the aligned face/periocular region. */
  embedding?: number[]
  /** Scale-invariant ocular geometry ratios. */
  geometry?: number[]
  iris?: { left?: IrisCode; right?: IrisCode }
}

/** One probe measurement produced by a sensor. Contains no image data. */
export interface BiometricSample {
  modality: BiometricModality
  sensorKind: string
  capturedAt: number
  /** 0..1 capture quality as judged by the sensor. */
  quality: number
  pose?: HeadPose
  features: SampleFeatures
}

/** The stored biometric representation for one enrollment ("optic scan"). */
export interface OpticTemplate {
  version: 1
  modality: BiometricModality
  createdAt: number
  sampleCount: number
  quality: number
  /** Per-pose embeddings (bounded) plus their centroid. */
  embeddings: number[][]
  centroid: number[]
  geometry?: { mean: number[]; std: number[] }
  iris: { left: IrisCode[]; right: IrisCode[] }
  /** Poses covered during enrollment, for coverage reporting. */
  poses: string[]
}

export interface MatchComponents {
  /** Best L2 distance between probe embeddings and template (lower is better). */
  embeddingDistance: number
  /** Fractional Hamming distance of iris codes (0.5 ≈ unrelated), null if unavailable. */
  irisHamming: number | null
  /** Normalised geometry deviation, null if unavailable. */
  geometryDeviation: number | null
  /** Per-probe-sample embedding distances (the decision needs most of them to agree). */
  sampleDistances?: number[]
}

export interface MatchScore {
  /** 0..1 fused similarity used for ranking and display. */
  similarity: number
  components: MatchComponents
}
