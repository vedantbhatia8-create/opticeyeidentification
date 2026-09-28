/**
 * Realistic demo data, generated relative to "now" so the dashboards always
 * look live (today's activity, current stays, this afternoon's visitors).
 */
import type { AccessEvent } from '../core/access/types'
import { seededRandom } from '../core/biometric/math'
import { startOfDay } from '../ui/format'
import type { Amenity, Guest, HotelState, Room } from './hotel/model'
import { roomResourceId } from './hotel/model'
import type { AccessRule, Device, Door, Employee, OfficeState, Visitor } from './office/model'
import { GROUP_EMPLOYEES, GROUP_VISITORS } from './office/model'
import { personaIdentity } from './personas'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const WEEKDAYS = [1, 2, 3, 4, 5]
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

const device = (serial: string, now: number): Device => ({
  serial,
  model: 'Optic T1 · webcam prototype',
  firmware: '0.9.4-proto',
  lastSeenAt: now,
})

export function seedOffice(now: number): OfficeState {
  const today = startOfDay(now)
  const emp = (
    id: string,
    name: string,
    department: string,
    role: string,
    groupIds: string[],
    persona: string | null,
    status: Employee['status'] = 'active',
  ): Employee => ({
    id,
    name,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@meridian.co`,
    department,
    role,
    groupIds,
    status,
    identityId: persona ? personaIdentity(persona) : null,
    createdAt: now - 90 * DAY,
  })

  const employees: Employee[] = [
    emp('emp_sarah', 'Sarah Chen', 'Engineering', 'Software Engineer', ['grp_eng'], 'sarah'),
    emp('emp_michael', 'Michael Patel', 'Engineering', 'Site Reliability Engineer', ['grp_eng', 'grp_infra'], 'michael'),
    emp('emp_priya', 'Priya Raman', 'Executive', 'Chief Operating Officer', ['grp_exec'], 'priya'),
    emp('emp_james', 'James Whitfield', 'Executive', 'Chief Executive Officer', ['grp_exec'], null),
    emp('emp_olivia', 'Olivia Martinez', 'Design', 'Product Designer', [], 'olivia'),
    emp('emp_lucas', 'Lucas Moreau', 'Engineering', 'Staff Engineer', ['grp_eng'], 'lucas'),
    emp('emp_grace', 'Grace Liu', 'Engineering', 'Engineering Manager', ['grp_eng'], 'grace'),
    emp('emp_daniel', 'Daniel Okafor', 'Sales', 'Account Executive', [], 'daniel-o'),
    emp('emp_hannah', 'Hannah Schmidt', 'People', 'HR Business Partner', [], 'hannah'),
    emp('emp_aisha', 'Aisha Bello', 'Finance', 'Financial Controller', [], null),
    emp('emp_tom', 'Tom Becker', 'Facilities', 'Facilities Manager', ['grp_facilities'], 'tom'),
    emp('emp_ryan', 'Ryan Brooks', 'IT', 'IT Administrator', ['grp_infra'], 'ryan'),
    emp('emp_noah', 'Noah Fischer', 'Marketing', 'Content Lead', [], 'noah-f', 'suspended'),
    emp('emp_emily', 'Emily Carter', 'Sales', 'Sales Development Rep', [], null),
  ]

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

  const visitors: Visitor[] = [
    {
      id: 'vis_david',
      name: 'David Kim',
      company: 'Acme',
      email: 'david.kim@acme.com',
      hostName: 'Sarah Chen',
      doorIds: ['door_main', 'door_confA'],
      start: today + 14 * HOUR,
      end: today + 16 * HOUR,
      revoked: false,
      identityId: personaIdentity('david'),
      createdAt: now - 2 * DAY,
    },
    {
      id: 'vis_lena',
      name: 'Lena Fischer',
      company: 'Globex',
      email: 'lena@globex.com',
      hostName: 'Priya Raman',
      doorIds: ['door_main', 'door_confA'],
      start: today - DAY + 10 * HOUR,
      end: today - DAY + 12 * HOUR,
      revoked: false,
      identityId: null,
      createdAt: now - 4 * DAY,
    },
    {
      id: 'vis_marco',
      name: 'Marco Rossi',
      company: 'Initech',
      email: 'marco.rossi@initech.com',
      hostName: 'Grace Liu',
      doorIds: ['door_main', 'door_confA'],
      start: today + DAY + 10 * HOUR,
      end: today + DAY + 11.5 * HOUR,
      revoked: false,
      identityId: null,
      createdAt: now - DAY,
    },
  ]

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
  const today = startOfDay(now)
  const checkInTime = (daysFromToday: number) => today + daysFromToday * DAY + 15 * HOUR
  const checkOutTime = (daysFromToday: number) => today + daysFromToday * DAY + 11 * HOUR

  const statusFor: Record<string, Room['status']> = {
    '801': 'vacant', '803': 'vacant', '806': 'cleaning', '808': 'vacant', '810': 'cleaning',
    '813': 'maintenance', '815': 'vacant', '817': 'cleaning', '820': 'vacant',
  }
  const rooms: Room[] = Array.from({ length: 20 }, (_, i) => {
    const number = String(801 + i)
    const n = i + 1
    return {
      number,
      floor: 8,
      type: n >= 19 ? 'Suite' : n >= 5 && n <= 12 ? 'Double Queen' : 'King',
      status: statusFor[number] ?? 'occupied',
      online: true,
      mode: 'normal',
      device: device(`OL1-8${String(n).padStart(2, '0')}`, now),
      lastAccess: null,
    }
  })

  const g = (
    id: string,
    name: string,
    room: string,
    inDays: number,
    outDays: number,
    status: Guest['status'],
    persona: string | null,
    extra: Partial<Guest> = {},
  ): Guest => ({
    id,
    name,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@gmail.com`,
    roomNumber: room,
    checkIn: checkInTime(inDays),
    checkOut: checkOutTime(outDays),
    status,
    identityId: persona ? personaIdentity(persona) : null,
    vip: false,
    partySize: 1,
    checkedOutAt: null,
    createdAt: now - 10 * DAY,
    ...extra,
  })

  const guests: Guest[] = [
    g('gst_emma', 'Emma Johnson', '814', -1, 2, 'checked-in', 'emma', { email: 'emma.johnson@gmail.com', partySize: 2 }),
    g('gst_marcus', 'Marcus Webb', '802', -2, 1, 'checked-in', 'marcus'),
    g('gst_sofia', 'Sofia Alvarez', '805', -1, 3, 'checked-in', 'sofia', { partySize: 3 }),
    g('gst_kenji', 'Kenji Tanaka', '809', -3, 1, 'checked-in', 'kenji'),
    g('gst_amara', 'Amara Nwosu', '811', 0, 4, 'checked-in', null),
    g('gst_liam', "Liam O'Connor", '816', -1, 2, 'checked-in', null),
    g('gst_chloe', 'Chloe Dubois', '819', -2, 3, 'checked-in', 'chloe', { vip: true, partySize: 2 }),
    g('gst_ethan', 'Ethan Brooks', '807', -1, 1, 'checked-in', null),
    g('gst_isabella', 'Isabella Rossi', '812', 0, 2, 'checked-in', null, { partySize: 2 }),
    g('gst_oliver', 'Oliver Grant', '804', -4, 1, 'checked-in', null),
    g('gst_mia', 'Mia Hoffmann', '818', -1, 5, 'checked-in', null),
    g('gst_nora', 'Nora Lindqvist', '820', 0, 3, 'reserved', null, { vip: true }),
    g('gst_zoe', 'Zoe Park', '815', 0, 2, 'reserved', null),
    g('gst_daniel', 'Daniel Reyes', '810', -3, 0, 'checked-out', 'daniel', { checkedOutAt: today + 9.5 * HOUR }),
  ]
  // Keep rooms consistent with in-house guests.
  for (const guest of guests) {
    const room = rooms.find((r) => r.number === guest.roomNumber)!
    if (guest.status === 'checked-in') room.status = 'occupied'
  }

  const amenities: Amenity[] = [
    { id: 'amenity-fitness', name: 'Fitness Center', schedule: { type: 'weekly', days: EVERY_DAY, start: '05:30', end: '23:00' }, vipOnly: false, online: true },
    { id: 'amenity-pool', name: 'Pool & Spa', schedule: { type: 'weekly', days: EVERY_DAY, start: '07:00', end: '21:00' }, vipOnly: false, online: true },
    { id: 'amenity-lounge', name: 'Club Lounge', schedule: { type: 'weekly', days: EVERY_DAY, start: '06:30', end: '22:30' }, vipOnly: true, online: true },
  ]

  return { propertyName: 'The Linden · San Francisco', rooms, guests, amenities }
}

/** Plausible access history for today (and yesterday evening). */
export function seedEvents(now: number, office: OfficeState, hotel: HotelState): AccessEvent[] {
  const rand = seededRandom(`events:${startOfDay(now)}`)
  const events: AccessEvent[] = []
  const today = startOfDay(now)
  const push = (e: Omit<AccessEvent, 'id' | 'sensorKind' | 'demo' | 'confidence'> & { confidence?: number | null }) => {
    if (e.at > now) return
    events.push({
      id: `evt_seed_${events.length}`,
      sensorKind: 'webcam',
      demo: false,
      confidence: e.confidence === undefined ? 0.9 + rand() * 0.08 : e.confidence,
      ...e,
    })
  }
  const doorName = (id: string) => office.doors.find((d) => d.id === id)!.name
  const officeGrant = (name: string, identityId: string | null, doorId: string, at: number) =>
    push({ at, site: 'office', resourceId: doorId, resourceName: doorName(doorId), subjectName: name, identityId, principalKind: 'employee', outcome: 'granted', code: 'granted', detail: 'Access granted' })

  // Morning arrivals.
  const active = office.employees.filter((e) => e.status === 'active' && e.identityId)
  active.forEach((e, i) => {
    const arrive = today + 7.6 * HOUR + i * 9 * 60_000 + rand() * 20 * 60_000
    officeGrant(e.name, e.identityId, 'door_main', arrive)
    const floor = e.groupIds.includes('grp_eng') ? 'door_f3' : e.groupIds.includes('grp_exec') ? 'door_exec' : 'door_f1'
    officeGrant(e.name, e.identityId, floor, arrive + 4 * 60_000)
  })
  // Through the day.
  for (let h = 9; h < 19; h += 0.55) {
    const e = active[Math.floor(rand() * active.length)]
    officeGrant(e.name, e.identityId, rand() > 0.5 ? 'door_confA' : 'door_f1', today + h * HOUR + rand() * 20 * 60_000)
  }
  const michael = office.employees.find((e) => e.id === 'emp_michael')!
  officeGrant(michael.name, michael.identityId, 'door_server', today + 10.2 * HOUR)
  officeGrant(michael.name, michael.identityId, 'door_exec', now - 3 * 60_000)
  // Denials.
  push({ at: now - 7 * 60_000, site: 'office', resourceId: 'door_server', resourceName: 'Server Room', subjectName: 'Unknown person', identityId: null, principalKind: null, outcome: 'denied-unrecognized', code: 'not-recognized', detail: 'Identity not recognized', confidence: 0.12 })
  push({ at: today + 11.3 * HOUR, site: 'office', resourceId: 'door_exec', resourceName: 'Executive Floor', subjectName: 'Lucas Moreau', identityId: 'idn_demo_lucas', principalKind: 'employee', outcome: 'denied-unauthorized', code: 'no-grant', detail: 'NOT AUTHORIZED' })
  push({ at: today + 8.1 * HOUR, site: 'office', resourceId: 'door_main', resourceName: 'Main Entrance', subjectName: 'Noah Fischer', identityId: 'idn_demo_noah-f', principalKind: 'employee', outcome: 'denied-unauthorized', code: 'principal-suspended', detail: 'ACCESS SUSPENDED' })
  push({ at: today + 6.4 * HOUR, site: 'office', resourceId: 'door_main', resourceName: 'Main Entrance', subjectName: 'Grace Liu', identityId: 'idn_demo_grace', principalKind: 'employee', outcome: 'denied-unauthorized', code: 'outside-schedule', detail: 'OUTSIDE PERMITTED HOURS' })
  push({ at: today + 13.2 * HOUR, site: 'office', resourceId: 'door_main', resourceName: 'Main Entrance', subjectName: 'Unknown person', identityId: null, principalKind: null, outcome: 'unable', code: 'capture-failed', detail: 'Scan incomplete', confidence: null })
  const sarah = office.employees.find((e) => e.id === 'emp_sarah')!
  officeGrant(sarah.name, sarah.identityId, 'door_main', now - 40_000)

  // Hotel.
  const hotelGrant = (guest: Guest, resourceId: string, name: string, at: number) =>
    push({ at, site: 'hotel', resourceId, resourceName: name, subjectName: guest.name, identityId: guest.identityId, principalKind: 'guest', outcome: 'granted', code: 'granted', detail: 'Access granted' })
  const inHouse = hotel.guests.filter((x) => x.status === 'checked-in')
  inHouse.forEach((guest, i) => {
    hotelGrant(guest, roomResourceId(guest.roomNumber), `Room ${guest.roomNumber}`, today + 7 * HOUR + i * 23 * 60_000 + rand() * 30 * 60_000)
    if (rand() > 0.5) hotelGrant(guest, 'amenity-fitness', 'Fitness Center', today + 6.5 * HOUR + rand() * 2 * HOUR)
    hotelGrant(guest, roomResourceId(guest.roomNumber), `Room ${guest.roomNumber}`, today + 12 * HOUR + rand() * 6 * HOUR)
  })
  const daniel = hotel.guests.find((x) => x.id === 'gst_daniel')!
  hotelGrant(daniel, 'room-810', 'Room 810', today + 8 * HOUR)
  push({ at: today + 10.4 * HOUR, site: 'hotel', resourceId: 'room-810', resourceName: 'Room 810', subjectName: 'Daniel Reyes', identityId: daniel.identityId, principalKind: 'guest', outcome: 'denied-unauthorized', code: 'principal-ended', detail: 'STAY ENDED' })
  push({ at: now - 22 * 60_000, site: 'hotel', resourceId: 'room-816', resourceName: 'Room 816', subjectName: 'Unknown person', identityId: null, principalKind: null, outcome: 'denied-unrecognized', code: 'not-recognized', detail: 'Identity not recognized', confidence: 0.18 })
  const emma = hotel.guests.find((x) => x.id === 'gst_emma')!
  hotelGrant(emma, 'room-814', 'Room 814', now - 55 * 60_000)

  return events.sort((a, b) => b.at - a.at)
}
