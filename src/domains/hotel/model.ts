import type { AuthorizationResult, Grant, Principal, ProtectedResource, Schedule } from '../../core/authorization/types'
import type { Device } from '../office/model'
import { formatDate, formatDateTime } from '../../ui/format'

export type RoomStatus = 'vacant' | 'occupied' | 'cleaning' | 'maintenance'

export interface Room {
  number: string
  floor: number
  type: 'King' | 'Double Queen' | 'Suite'
  status: RoomStatus
  online: boolean
  mode: 'normal' | 'lockdown'
  device: Device
  lastAccess: { at: number; name: string } | null
}

export interface Guest {
  id: string
  name: string
  email: string
  roomNumber: string
  checkIn: number
  checkOut: number
  status: 'reserved' | 'checked-in' | 'checked-out'
  identityId: string | null
  vip: boolean
  partySize: number
  checkedOutAt: number | null
  createdAt: number
}

export interface Amenity {
  id: string
  name: string
  schedule: Schedule
  vipOnly: boolean
  online: boolean
}

export interface HotelState {
  propertyName: string
  rooms: Room[]
  guests: Guest[]
  amenities: Amenity[]
}

export const roomResourceId = (n: string) => `room-${n}`

export function guestPrincipal(state: HotelState, g: Guest): Principal {
  const window = { from: g.checkIn, until: g.checkOut }
  const stay = { kind: 'stay' as const, id: g.id, label: `Stay · Room ${g.roomNumber}` }
  const grants: Grant[] = [
    { resourceId: roomResourceId(g.roomNumber), schedule: { type: 'always' }, window, source: stay },
    ...state.amenities
      .filter((a) => !a.vipOnly || g.vip)
      .map<Grant>((a) => ({ resourceId: a.id, schedule: a.schedule, window, source: stay })),
  ]
  return {
    id: g.id,
    kind: 'guest',
    displayName: g.name,
    status: g.status === 'checked-in' ? 'active' : g.status === 'reserved' ? 'pending' : 'ended',
    window,
    grants,
  }
}

export function resolveHotelPrincipal(state: HotelState, identityId: string): Principal | null {
  const rank = { 'checked-in': 0, reserved: 1, 'checked-out': 2 }
  const stays = state.guests
    .filter((g) => g.identityId === identityId)
    .sort((a, b) => rank[a.status] - rank[b.status] || b.checkIn - a.checkIn)
  return stays[0] ? guestPrincipal(state, stays[0]) : null
}

export function hotelResource(state: HotelState, id: string): ProtectedResource | null {
  if (id.startsWith('room-')) {
    const room = state.rooms.find((r) => roomResourceId(r.number) === id)
    return room ? { id, name: `Room ${room.number}`, online: room.online, mode: room.mode } : null
  }
  const amenity = state.amenities.find((a) => a.id === id)
  return amenity ? { id, name: amenity.name, online: amenity.online, mode: 'normal' } : null
}

export function describeHotelDenial(result: AuthorizationResult, resource: ProtectedResource) {
  switch (result.code) {
    case 'principal-ended':
      return { title: 'STAY ENDED', detail: 'Your hotel stay has ended.' }
    case 'principal-pending':
      return {
        title: 'NOT CHECKED IN',
        detail: `Your stay begins ${result.boundary ? formatDate(result.boundary) : 'soon'}. Please check in at the front desk.`,
      }
    case 'window-expired':
      return { title: 'STAY ENDED', detail: `Your stay ended ${formatDateTime(result.boundary!)}. Please visit the front desk.` }
    case 'window-not-started':
      return { title: 'STAY NOT STARTED', detail: `Room access begins ${formatDateTime(result.boundary!)}.` }
    case 'no-grant':
      return resource.id.startsWith('room-')
        ? { title: 'NOT YOUR ROOM', detail: `${resource.name} is not assigned to you.` }
        : { title: 'NOT INCLUDED', detail: `${resource.name} is not included with your stay.` }
    case 'outside-schedule':
      return { title: 'CURRENTLY CLOSED', detail: `${resource.name} is closed at this time.` }
    case 'no-principal':
      return { title: 'NO ACTIVE STAY', detail: 'Your identity is verified but there is no reservation linked to it.' }
    case 'principal-suspended':
      return { title: 'ACCESS SUSPENDED', detail: 'Please contact the front desk.' }
    case 'resource-lockdown':
      return { title: 'ROOM LOCKED DOWN', detail: 'Please contact the front desk.' }
    case 'resource-offline':
      return { title: 'LOCK OFFLINE', detail: 'This lock is offline. Please contact the front desk.' }
    default:
      return { title: 'ACCESS DENIED', detail: 'Please contact the front desk.' }
  }
}
