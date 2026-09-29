import type { AuthorizationCode, AuthorizationResult, Principal, ProtectedResource } from '../authorization/types'
import type { IdentityVerification } from '../identity/types'

export type SiteId = 'office' | 'hotel' | 'lab' | 'attendance'

/**
 * A domain (office, hotel, …) plugs into the shared access engine by
 * implementing this adapter. Only data lookup and wording differ per domain.
 */
export interface SiteAdapter {
  site: SiteId
  resolvePrincipal(identityId: string, at: number): Principal | null
  getResource(resourceId: string): ProtectedResource | null
  /** Domain-specific wording for a denial, e.g. "Your hotel stay has ended." */
  describeDenial(result: AuthorizationResult, resource: ProtectedResource): { title: string; detail: string }
  /** Drive the (virtual) lock — or whatever "granted" means for this site. */
  unlock(resourceId: string, byName: string, at: number): void
  /** Optional wording for a grant (e.g. "CHECKED IN" for attendance). */
  describeGrant?(name: string, resource: ProtectedResource, at: number): { headline: string; title: string; detail: string }
}

export type AccessOutcome =
  /** Identity verified and authorized. */
  | 'granted'
  /** Identity verified, authorization refused. */
  | 'denied-unauthorized'
  /** No enrolled identity matched. */
  | 'denied-unrecognized'
  /** Capture was not good enough to decide. */
  | 'unable'

export interface AccessDecision {
  id: string
  at: number
  site: SiteId
  outcome: AccessOutcome
  resource: { id: string; name: string } | null
  identity: IdentityVerification
  authorization: AuthorizationResult | null
  /** Big status line, e.g. "ACCESS GRANTED". */
  headline: string
  /** Secondary title, e.g. "VISITOR ACCESS EXPIRED". */
  title: string
  detail: string
  demo: boolean
  sensorKind: string
}

/** Audit record. Contains no biometric data — only the decision and its reason. */
export interface AccessEvent {
  id: string
  at: number
  site: SiteId
  resourceId: string | null
  resourceName: string
  subjectName: string
  identityId: string | null
  principalKind: Principal['kind'] | null
  outcome: AccessOutcome
  code: AuthorizationCode | 'not-recognized' | 'capture-failed' | 'identity-only'
  detail: string
  confidence: number | null
  sensorKind: string
  demo: boolean
}

export interface AccessLog {
  append(event: AccessEvent): void
}
