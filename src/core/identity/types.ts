import type { BiometricModality, MatchComponents } from '../biometric/types'

export type IdentityOrigin = 'lab' | 'office' | 'hotel' | 'demo'

/** A person known to the platform. Contains no biometric data. */
export interface Identity {
  id: string
  name: string
  email?: string
  /** Customer-provided user / employee / guest reference. */
  externalId?: string
  origin: IdentityOrigin
  /** True for Demo Mode personas whose templates are synthetic. */
  synthetic: boolean
  /** Seed that reproduces a synthetic identity's samples in Demo Mode. */
  demoSeed?: string
  status: 'active' | 'revoked'
  createdAt: number
  updatedAt: number
}

/** Metadata about one enrolled template ("optic scan"). The template itself stays sealed. */
export interface OpticScan {
  id: string
  identityId: string
  /** User-editable name, e.g. "Desk, daylight" or "With glasses". */
  label: string
  createdAt: number
  modality: BiometricModality
  sampleCount: number
  quality: number
  poses: string[]
  sizeBytes: number
  /** Non-reversible SHA-256 prefix of the sealed template. */
  fingerprint: string
  synthetic: boolean
  matchCount: number
  lastMatchedAt: number | null
}

export interface IdentitySnapshot {
  ready: boolean
  /** False when the browser blocks IndexedDB and enrollments are memory-only. */
  persistent: boolean
  identities: Identity[]
  scans: OpticScan[]
}

export type IdentityVerification =
  | {
      status: 'verified'
      identity: Identity
      scanId: string
      confidence: number
      distance: number
      components: MatchComponents
      probeCount: number
    }
  | { status: 'not-recognized'; confidence: number; distance: number | null; probeCount: number }
  | { status: 'unable'; reason: 'insufficient-samples' | 'modality-mismatch'; probeCount: number }
