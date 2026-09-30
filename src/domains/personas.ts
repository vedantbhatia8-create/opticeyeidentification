/**
 * Simulated identities for Demo Mode. There are no built-in people: every
 * identity in the system is a real enrollment. The only simulated subject is
 * "Unknown Person", a stranger whose template is fresh on every attempt.
 */
import type { DemoIdentitySeed } from '../core/identity/IdentityService'

export type DemoPersona = DemoIdentitySeed

export const DEMO_PERSONAS: DemoPersona[] = []

/** Seed used for the "Unknown Person" demo subject; fresh every attempt so it never matches. */
export const unknownSeed = () => `unknown:${crypto.randomUUID()}`
