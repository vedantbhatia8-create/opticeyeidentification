/**
 * Access-control layer — the one engine shared by every deployment.
 *
 *   Sensor ─► BiometricSample[] ─► IdentityService.verify ─► SiteAdapter.resolvePrincipal
 *          ─► authorize() ─► AccessDecision ─► door actuation + audit log
 *
 * The controller never sees camera frames and never sees templates.
 */
import { authorize } from '../authorization/engine'
import type { BiometricSample } from '../biometric/types'
import type { MatchPolicy } from '../biometric/matcher'
import type { IdentityService } from '../identity/IdentityService'
import type { IdentityVerification } from '../identity/types'
import { clock } from './clock'
import type { AccessDecision, AccessEvent, AccessLog, SiteAdapter, SiteId } from './types'

export interface AttemptInput {
  samples: BiometricSample[]
  /** Omit for identity-only checks (Optic Lab "Authenticate"). */
  adapter?: SiteAdapter
  resourceId?: string
  sensorKind: string
  demo: boolean
  policy?: MatchPolicy
  /** Awaited after identity is established — lets a terminal show who was recognized before the permission check. */
  onIdentity?: (verification: IdentityVerification) => Promise<void> | void
}

const eventId = () => `evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`

export class AccessController {
  private readonly identities: IdentityService
  private readonly log: AccessLog

  constructor(identities: IdentityService, log: AccessLog) {
    this.identities = identities
    this.log = log
  }

  async attempt(input: AttemptInput): Promise<AccessDecision> {
    const site: SiteId = input.adapter?.site ?? 'lab'
    const resource = input.adapter && input.resourceId ? input.adapter.getResource(input.resourceId) : null

    const identity = await this.identities.verify(input.samples, input.policy)
    await input.onIdentity?.(identity)
    // Policy is evaluated at the access clock (Demo Mode may shift it);
    // the audit record always carries real wall-clock time.
    const at = clock.now()

    const base = {
      id: eventId(),
      at: Date.now(),
      site,
      resource: resource ? { id: resource.id, name: resource.name } : null,
      identity,
      demo: input.demo,
      sensorKind: input.sensorKind,
    }

    let decision: AccessDecision
    if (identity.status === 'unable') {
      decision = {
        ...base,
        outcome: 'unable',
        authorization: null,
        headline: 'UNABLE TO AUTHENTICATE',
        title: 'Scan incomplete',
        detail:
          identity.reason === 'modality-mismatch'
            ? 'This sensor type has no compatible enrollments.'
            : 'The sensor could not capture a clear view of your eyes. Please try again.',
      }
    } else if (identity.status === 'not-recognized') {
      decision = {
        ...base,
        outcome: 'denied-unrecognized',
        authorization: null,
        headline: 'ACCESS DENIED',
        title: 'Identity not recognized',
        detail: 'Identity could not be verified.',
      }
    } else if (!input.adapter || !resource) {
      // Identity-only authentication (no door involved).
      decision = {
        ...base,
        outcome: 'granted',
        authorization: null,
        headline: 'ACCESS GRANTED',
        title: `Welcome, ${identity.identity.name}`,
        detail: 'Authentication successful.',
      }
    } else {
      const principal = input.adapter.resolvePrincipal(identity.identity.id, at)
      const authorization = authorize(principal, resource, at)
      if (authorization.allowed) {
        input.adapter.unlock(resource.id, identity.identity.name, Date.now())
        decision = {
          ...base,
          outcome: 'granted',
          authorization,
          headline: 'ACCESS GRANTED',
          title: `Welcome, ${identity.identity.name}`,
          detail: resource.name,
        }
      } else {
        const copy = input.adapter.describeDenial(authorization, resource)
        decision = { ...base, outcome: 'denied-unauthorized', authorization, headline: 'ACCESS DENIED', ...copy }
      }
    }

    this.log.append(toEvent(decision))
    return decision
  }
}

function toEvent(d: AccessDecision): AccessEvent {
  const verified = d.identity.status === 'verified' ? d.identity : null
  return {
    id: d.id,
    at: d.at,
    site: d.site,
    resourceId: d.resource?.id ?? null,
    resourceName: d.resource?.name ?? 'Optic Lab',
    subjectName: verified ? verified.identity.name : 'Unknown person',
    identityId: verified?.identity.id ?? null,
    principalKind: d.authorization?.principal?.kind ?? null,
    outcome: d.outcome,
    code:
      d.identity.status === 'unable'
        ? 'capture-failed'
        : d.identity.status === 'not-recognized'
          ? 'not-recognized'
          : (d.authorization?.code ?? 'identity-only'),
    detail: d.outcome === 'granted' ? 'Access granted' : d.title,
    confidence: d.identity.status === 'unable' ? null : d.identity.confidence,
    sensorKind: d.sensorKind,
    demo: d.demo,
  }
}
