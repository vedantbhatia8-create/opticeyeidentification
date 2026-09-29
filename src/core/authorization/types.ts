/**
 * Authorization layer — what a verified identity may do.
 * Completely independent of biometrics: it receives a Principal (resolved
 * by a site adapter from an identity id) and a resource, never a template.
 */

export type PrincipalKind = 'employee' | 'visitor' | 'guest' | 'member'

export type PrincipalStatus = 'active' | 'pending' | 'suspended' | 'revoked' | 'ended'

/** Absolute validity window, epoch milliseconds. */
export interface TimeWindow {
  from: number
  until: number
}

export type Schedule =
  | { type: 'always' }
  | {
      type: 'weekly'
      /** 0 = Sunday … 6 = Saturday */
      days: number[]
      /** 'HH:MM' local time. If end <= start the window crosses midnight. */
      start: string
      end: string
    }

export interface GrantSource {
  kind: 'rule' | 'direct' | 'visit' | 'stay'
  id: string
  label: string
}

export interface Grant {
  resourceId: string
  schedule: Schedule
  window?: TimeWindow
  source: GrantSource
}

export interface Principal {
  id: string
  kind: PrincipalKind
  displayName: string
  status: PrincipalStatus
  /** Overall validity (visit duration, hotel stay). */
  window?: TimeWindow
  grants: Grant[]
}

export interface ProtectedResource {
  id: string
  name: string
  online: boolean
  mode: 'normal' | 'lockdown'
}

export type AuthorizationCode =
  | 'granted'
  | 'no-principal'
  | 'principal-pending'
  | 'principal-suspended'
  | 'principal-ended'
  | 'window-not-started'
  | 'window-expired'
  | 'no-grant'
  | 'outside-schedule'
  | 'resource-offline'
  | 'resource-lockdown'

export interface AuthorizationResult {
  allowed: boolean
  code: AuthorizationCode
  principal: Principal | null
  grant: Grant | null
  evaluatedAt: number
  /** For time-based denials: the relevant boundary (e.g. when access starts/ended). */
  boundary?: number
}
