/**
 * Starting configuration: doors, groups, rules, rooms and amenities.
 * No people and no history. Everyone in the system is a real enrollment.
 */
import type { AccessEvent } from '../core/access/types'
import type { Amenity, Guest, HotelState, Room } from './hotel/model'
import type { AccessRule, Device, Door, Employee, OfficeState, Visitor } from './office/model'
import { GROUP_EMPLOYEES, GROUP_VISITORS } from './office/model'

const WEEKDAYS = [1, 2, 3, 4, 5]
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

const device = (serial: string, now: number): Device => ({
  serial,
  model: 'Optic T1 · webcam prototype',
  firmware: '0.9.4-proto',
  lastSeenAt: now,
})

export function seedOffice(now: number): OfficeState {
  const employees: Employee[] = []

  const d = (id: string, name: string, zone: string, serial: string, extra: Partial<Door> = {}): Door => ({
    id,
    name,
    zone,
    online: true,
    mode: 'normal',
    device: device(serial, now),
    lastAccess: null,
    ...extra,
  })
  const doors: Door[] = [
    d('door_main', 'Main Entrance', 'Lobby · Ground', 'OT1-00A1'),
    d('door_f1', '1st Floor', 'Level 1 · Operations', 'OT1-00B2'),
    d('door_f2', '2nd Floor', 'Level 2 · Product', 'OT1-00B3'),
    d('door_f3', '3rd Floor', 'Level 3 · Engineering', 'OT1-00B4'),
    d('door_exec', 'Executive Floor', 'Level 4 · Executive', 'OT1-00C1'),
    d('door_confA', 'Conference Room A', 'Level 1 · Meeting', 'OT1-00D1'),
    d('door_server', 'Server Room', 'Level 3 · Restricted', 'OT1-00E1'),
  ]

  const weekly = (start: string, end: string, days = WEEKDAYS) => ({ type: 'weekly' as const, days, start, end })
  const rules: AccessRule[] = [
    { id: 'rule_emp', groupId: GROUP_EMPLOYEES, doorIds: ['door_main', 'door_f1'], schedule: weekly('07:00', '20:00'), enabled: true },
    { id: 'rule_emp_conf', groupId: GROUP_EMPLOYEES, doorIds: ['door_confA'], schedule: weekly('08:00', '19:00'), enabled: true },
    { id: 'rule_eng', groupId: 'grp_eng', doorIds: ['door_f2', 'door_f3'], schedule: weekly('07:00', '20:00'), enabled: true },
    {
      id: 'rule_exec',
      groupId: 'grp_exec',
      doorIds: ['door_main', 'door_f1', 'door_f2', 'door_f3', 'door_exec', 'door_confA'],
      schedule: { type: 'always' },
      enabled: true,
    },
    { id: 'rule_infra', groupId: 'grp_infra', doorIds: ['door_server', 'door_f3'], schedule: weekly('08:00', '18:00'), enabled: true },
    { id: 'rule_visitors', groupId: GROUP_VISITORS, doorIds: ['door_confA'], schedule: weekly('14:00', '16:00', EVERY_DAY), enabled: true },
    { id: 'rule_facilities', groupId: 'grp_facilities', doorIds: doors.map((x) => x.id), schedule: { type: 'always' }, enabled: true },
  ]

  const visitors: Visitor[] = []

  return {
    orgName: 'Meridian',
    siteName: 'Meridian HQ · San Francisco',
    employees,
    groups: [
      { id: GROUP_EMPLOYEES, name: 'All Employees', description: 'Every active employee', implicit: 'employees' },
      { id: 'grp_eng', name: 'Engineering', description: 'Product engineering teams' },
      { id: 'grp_infra', name: 'Infrastructure', description: 'SRE & IT — restricted infrastructure' },
      { id: 'grp_exec', name: 'Executives', description: 'Leadership team' },
      { id: 'grp_facilities', name: 'Facilities', description: 'Building operations, all doors' },
      { id: GROUP_VISITORS, name: 'Visitors', description: 'Every registered visitor', implicit: 'visitors' },
    ],
    doors,
    rules,
    visitors,
  }
}

export function seedHotel(now: number): HotelState {
  const rooms: Room[] = Array.from({ length: 20 }, (_, i) => {
    const number = String(801 + i)
    const n = i + 1
    return {
      number,
      floor: 8,
      type: n >= 19 ? 'Suite' : n >= 5 && n <= 12 ? 'Double Queen' : 'King',
      status: 'vacant',
      online: true,
      mode: 'normal',
      device: device(`OL1-8${String(n).padStart(2, '0')}`, now),
      lastAccess: null,
    }
  })
  const guests: Guest[] = []

  const amenities: Amenity[] = [
    { id: 'amenity-fitness', name: 'Fitness Center', schedule: { type: 'weekly', days: EVERY_DAY, start: '05:30', end: '23:00' }, vipOnly: false, online: true },
    { id: 'amenity-pool', name: 'Pool & Spa', schedule: { type: 'weekly', days: EVERY_DAY, start: '07:00', end: '21:00' }, vipOnly: false, online: true },
    { id: 'amenity-lounge', name: 'Club Lounge', schedule: { type: 'weekly', days: EVERY_DAY, start: '06:30', end: '22:30' }, vipOnly: true, online: true },
  ]

  return { propertyName: 'The Linden · San Francisco', rooms, guests, amenities }
}

/** No pre-made history: the log starts empty and fills with real attempts. */
export function seedEvents(_now: number, _office: OfficeState, _hotel: HotelState): AccessEvent[] {
  return []
}
