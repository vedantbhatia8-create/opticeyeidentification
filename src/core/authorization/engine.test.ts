import { describe, expect, it } from 'vitest'
import { authorize, describeSchedule, scheduleAllows } from './engine'
import type { Principal, ProtectedResource } from './types'

const at = (iso: string) => new Date(iso).getTime()
// 2026-09-28 is a Monday.
const MON_10AM = at('2026-09-28T10:00:00')
const MON_9PM = at('2026-09-28T21:00:00')
const SAT_10AM = at('2026-10-03T10:00:00')

const door: ProtectedResource = { id: 'main', name: 'Main Entrance', online: true, mode: 'normal' }
const officeHours = { type: 'weekly' as const, days: [1, 2, 3, 4, 5], start: '07:00', end: '20:00' }
const employee: Principal = {
  id: 'e1',
  kind: 'employee',
  displayName: 'Sarah Chen',
  status: 'active',
  grants: [{ resourceId: 'main', schedule: officeHours, source: { kind: 'rule', id: 'r1', label: 'Employees' } }],
}

describe('authorization engine', () => {
  it('grants within schedule and denies outside it', () => {
    expect(authorize(employee, door, MON_10AM).code).toBe('granted')
    expect(authorize(employee, door, MON_9PM).code).toBe('outside-schedule')
    expect(authorize(employee, door, SAT_10AM).code).toBe('outside-schedule')
  })

  it('denies resources the principal holds no grant for', () => {
    expect(authorize(employee, { ...door, id: 'server' }, MON_10AM).code).toBe('no-grant')
  })

  it('separates identity from authorization: verified but unknown to the site', () => {
    expect(authorize(null, door, MON_10AM).code).toBe('no-principal')
  })

  it('enforces validity windows (visitor expiry, hotel stay)', () => {
    const visitor: Principal = {
      ...employee,
      kind: 'visitor',
      window: { from: at('2026-09-28T14:00:00'), until: at('2026-09-28T16:00:00') },
      grants: [{ resourceId: 'main', schedule: { type: 'always' }, source: { kind: 'visit', id: 'v', label: 'Visit' } }],
    }
    expect(authorize(visitor, door, MON_10AM).code).toBe('window-not-started')
    expect(authorize(visitor, door, at('2026-09-28T15:00:00')).code).toBe('granted')
    expect(authorize(visitor, door, at('2026-09-28T16:30:00')).code).toBe('window-expired')
  })

  it('denies ended, suspended and pending principals regardless of grants', () => {
    expect(authorize({ ...employee, status: 'ended' }, door, MON_10AM).code).toBe('principal-ended')
    expect(authorize({ ...employee, status: 'suspended' }, door, MON_10AM).code).toBe('principal-suspended')
    expect(authorize({ ...employee, status: 'pending' }, door, MON_10AM).code).toBe('principal-pending')
  })

  it('respects device state', () => {
    expect(authorize(employee, { ...door, online: false }, MON_10AM).code).toBe('resource-offline')
    expect(authorize(employee, { ...door, mode: 'lockdown' }, MON_10AM).code).toBe('resource-lockdown')
  })

  it('handles overnight schedules', () => {
    const night = { type: 'weekly' as const, days: [1], start: '22:00', end: '06:00' }
    expect(scheduleAllows(night, at('2026-09-28T23:00:00'))).toBe(true)
    expect(scheduleAllows(night, at('2026-09-29T05:00:00'))).toBe(true)
    expect(scheduleAllows(night, at('2026-09-29T07:00:00'))).toBe(false)
  })

  it('describes schedules for humans', () => {
    expect(describeSchedule(officeHours)).toBe('Mon–Fri · 7:00 AM–8:00 PM')
    expect(describeSchedule({ type: 'always' })).toBe('24/7')
  })
})
