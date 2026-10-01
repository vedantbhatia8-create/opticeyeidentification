/**
 * Composition root: wires the layers together.
 *
 *   sensor (registry) → biometric (matcher) → identity (IdentityService)
 *   → authorization (engine) → access (AccessController + SiteAdapters) → UI
 */
import { AccessController } from '../core/access/AccessController'
import { clock } from '../core/access/clock'
import type { SiteAdapter } from '../core/access/types'
import { identityService } from '../core/identity/IdentityService'
import { describeHotelDenial, hotelResource, resolveHotelPrincipal } from '../domains/hotel/model'
import { describeOfficeDenial, doorResource, resolveOfficePrincipal } from '../domains/office/model'
import { DEMO_PERSONAS } from '../domains/personas'
import { startOfDay } from '../ui/format'
import { useStore } from './store'

/** Resolves a principal under any record id that belongs to the same account. */
const byAccount = <T>(identityId: string, resolve: (id: string) => T | null): T | null => {
  for (const id of identityService.accountIds(identityId)) {
    const p = resolve(id)
    if (p) return p
  }
  return null
}

export const officeAdapter: SiteAdapter = {
  site: 'office',
  resolvePrincipal: (identityId, at) => byAccount(identityId, (id) => resolveOfficePrincipal(useStore.getState().office, id, at)),
  getResource: (id) => {
    const door = useStore.getState().office.doors.find((d) => d.id === id)
    return door ? doorResource(door) : null
  },
  describeDenial: describeOfficeDenial,
  unlock: (id, name, at) => useStore.getState().unlock('office', id, name, at),
}

export const hotelAdapter: SiteAdapter = {
  site: 'hotel',
  resolvePrincipal: (identityId) => byAccount(identityId, (id) => resolveHotelPrincipal(useStore.getState().hotel, id)),
  getResource: (id) => hotelResource(useStore.getState().hotel, id),
  describeDenial: describeHotelDenial,
  unlock: (id, name, at) => useStore.getState().unlock('hotel', id, name, at),
}

export const accessController = new AccessController(identityService, {
  append: (event) => useStore.getState().appendEvent(event),
})

let initPromise: Promise<void> | null = null

/** Idempotent: React StrictMode mounts twice in development. */
export function initServices() {
  initPromise ??= initServicesOnce()
  return initPromise
}

function initServicesOnce() {
  clock.setOffset(useStore.getState().demo.clockOffsetMs)
  identityService.setTestOverride(useStore.getState().demo.overrideIdentityId)
  useStore.subscribe((s, prev) => {
    if (s.demo.clockOffsetMs !== prev.demo.clockOffsetMs) clock.setOffset(s.demo.clockOffsetMs)
    if (s.demo.overrideIdentityId !== prev.demo.overrideIdentityId) identityService.setTestOverride(s.demo.overrideIdentityId)
  })
  const { demoPeople } = useStore.getState().settings
  return identityService.init(demoPeople ? DEMO_PERSONAS : []).then(async () => {
    // Keep the demo cast's stays, visits and history on today's dates.
    if (demoPeople && useStore.getState().seededDay !== startOfDay(Date.now())) await setDemoPeople(true)
    // Clean up duplicate accounts created before accounts were email-keyed.
    const { consolidateAccounts } = await import('./accounts')
    const merged = await consolidateAccounts()
    if (merged) console.info(`[optic] merged ${merged} duplicate account(s)`)
  })
}

/** Shows or hides the demo cast everywhere: identities, office, hotel and apps. */
export async function setDemoPeople(on: boolean) {
  const { useSuite } = await import('../features/suite/store')
  await identityService.init()
  if (on) await identityService.addDemoIdentities(DEMO_PERSONAS)
  else await identityService.removeDemoIdentities(DEMO_PERSONAS)
  useStore.getState().applyDemoPeople(on)
  useSuite.getState().applyDemoPeople(on)
  if (!on) {
    const { demo, setDemo } = useStore.getState()
    if (demo.subject?.startsWith('idn_demo_')) setDemo({ subject: null })
  }
}

export async function resetPrototype() {
  const { useSuite } = await import('../features/suite/store')
  const { purgeSuiteSecrets } = await import('../features/suite/secure')
  useSuite.getState().reset()
  await purgeSuiteSecrets()
  useStore.getState().resetAll()
  await identityService.purgeAll([])
}

export { identityService }
