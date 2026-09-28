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
import { useStore } from './store'

export const officeAdapter: SiteAdapter = {
  site: 'office',
  resolvePrincipal: (identityId, at) => resolveOfficePrincipal(useStore.getState().office, identityId, at),
  getResource: (id) => {
    const door = useStore.getState().office.doors.find((d) => d.id === id)
    return door ? doorResource(door) : null
  },
  describeDenial: describeOfficeDenial,
  unlock: (id, name, at) => useStore.getState().unlock('office', id, name, at),
}

export const hotelAdapter: SiteAdapter = {
  site: 'hotel',
  resolvePrincipal: (identityId) => resolveHotelPrincipal(useStore.getState().hotel, identityId),
  getResource: (id) => hotelResource(useStore.getState().hotel, id),
  describeDenial: describeHotelDenial,
  unlock: (id, name, at) => useStore.getState().unlock('hotel', id, name, at),
}

export const accessController = new AccessController(identityService, {
  append: (event) => useStore.getState().appendEvent(event),
})

export function initServices() {
  useStore.getState().rebaseSeedToToday()
  clock.setOffset(useStore.getState().demo.clockOffsetMs)
  useStore.subscribe((s, prev) => {
    if (s.demo.clockOffsetMs !== prev.demo.clockOffsetMs) clock.setOffset(s.demo.clockOffsetMs)
  })
  return identityService.init(DEMO_PERSONAS)
}

export async function resetPrototype() {
  useStore.getState().resetAll()
  await identityService.purgeAll(DEMO_PERSONAS)
}

export { identityService }
