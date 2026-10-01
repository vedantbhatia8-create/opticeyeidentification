/**
 * Application state for the office and hotel deployments, the audit log and
 * settings. Persisted to localStorage. Contains no biometric data — only
 * identity ids that reference the identity layer.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AccessEvent } from '../core/access/types'
import type { SensorKind } from '../core/sensor/types'
import { DEFAULT_MATCH_POLICY } from '../core/biometric/matcher'
import type { Guest, HotelState, Room } from '../domains/hotel/model'
import { roomResourceId } from '../domains/hotel/model'
import type { AccessRule, Door, Employee, OfficeState, Visitor } from '../domains/office/model'
import { demoCast, isDemoEvent, isDemoRecord } from '../domains/demoPeople'
import { seedEvents, seedHotel, seedOffice } from '../domains/seed'
import { startOfDay } from '../ui/format'

export type Theme = 'light' | 'dark' | 'system'

export interface DemoSettings {
  enabled: boolean
  /** Persona key, 'unknown', or null for "use my real eyes". */
  subject: string | null
  clockOffsetMs: number
  /** Testing: resolve a real scan to this enrolled account instead. */
  overrideIdentityId: string | null
}

export interface Settings {
  theme: Theme
  /** Preferred sensor for terminals. The webcam is primary; simulated is the fallback. */
  sensorKind: Extract<SensorKind, 'webcam' | 'simulated'>
  acceptDistance: number
  showDiagnostics: boolean
  /** Show the demo cast (Sarah Chen, the Chen family, hotel guests…) alongside real people. */
  demoPeople: boolean
  /** Identity ids explicitly granted admin. The account owner (first enrolled) is always admin. */
  adminIds: string[]
}

interface State {
  schema: number
  /** Start of the day the demo data was generated for. */
  seededDay: number
  office: OfficeState
  hotel: HotelState
  events: AccessEvent[]
  settings: Settings
  demo: DemoSettings
  /** Transient: resources currently held unlocked (resourceId → relock time). */
  unlocked: Record<string, number>
}

interface Actions {
  appendEvent(e: AccessEvent): void
  unlock(site: 'office' | 'hotel', resourceId: string, byName: string, at: number): void
  // office
  upsertEmployee(e: Employee): void
  removeEmployee(id: string): void
  setDoor(id: string, patch: Partial<Door>): void
  upsertRule(r: AccessRule): void
  removeRule(id: string): void
  upsertVisitor(v: Visitor): void
  removeVisitor(id: string): void
  // hotel
  upsertGuest(g: Guest): void
  checkIn(guestId: string): void
  checkOut(guestId: string, at: number): void
  setRoom(number: string, patch: Partial<Room>): void
  // settings
  setSettings(patch: Partial<Settings>): void
  setDemo(patch: Partial<DemoSettings>): void
  clearIdentityLinks(identityId: string): void
  /** Adds (or refreshes) the demo cast's records; `false` removes them. */
  applyDemoPeople(on: boolean): void
  resetAll(): void
}

const SCHEMA = 7
const RELOCK_MS = 6000

function freshState(): Omit<State, 'settings' | 'demo'> {
  const now = Date.now()
  const office = seedOffice(now)
  const hotel = seedHotel(now)
  const events = seedEvents(now, office, hotel)
  // Last-access columns reflect the seeded history.
  for (const e of [...events].reverse()) {
    if (e.outcome !== 'granted' || !e.resourceId || e.at > now) continue
    const door = office.doors.find((d) => d.id === e.resourceId)
    if (door) door.lastAccess = { at: e.at, name: e.subjectName }
    const room = hotel.rooms.find((r) => roomResourceId(r.number) === e.resourceId)
    if (room) room.lastAccess = { at: e.at, name: e.subjectName }
  }
  return { schema: SCHEMA, seededDay: startOfDay(now), office, hotel, events, unlocked: {} }
}

const defaultSettings: Settings = {
  theme: 'dark',
  sensorKind: 'webcam',
  acceptDistance: DEFAULT_MATCH_POLICY.acceptDistance,
  showDiagnostics: false,
  demoPeople: false,
  adminIds: [],
}
const defaultDemo: DemoSettings = { enabled: false, subject: null, clockOffsetMs: 0, overrideIdentityId: null }

const relockTimers = new Map<string, number>()

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...freshState(),
      settings: defaultSettings,
      demo: defaultDemo,

      appendEvent: (e) => set((s) => ({ events: [e, ...s.events].slice(0, 800) })),

      unlock: (site, resourceId, byName, at) => {
        const lastAccess = { at, name: byName }
        set((s) => ({
          unlocked: { ...s.unlocked, [resourceId]: Date.now() + RELOCK_MS },
          office:
            site === 'office'
              ? { ...s.office, doors: s.office.doors.map((d) => (d.id === resourceId ? { ...d, lastAccess } : d)) }
              : s.office,
          hotel:
            site === 'hotel'
              ? {
                  ...s.hotel,
                  rooms: s.hotel.rooms.map((r) => (roomResourceId(r.number) === resourceId ? { ...r, lastAccess } : r)),
                }
              : s.hotel,
        }))
        clearTimeout(relockTimers.get(resourceId))
        relockTimers.set(
          resourceId,
          window.setTimeout(() => {
            const { [resourceId]: _, ...rest } = get().unlocked
            set({ unlocked: rest })
          }, RELOCK_MS),
        )
      },

      upsertEmployee: (e) =>
        set((s) => ({
          office: {
            ...s.office,
            employees: s.office.employees.some((x) => x.id === e.id)
              ? s.office.employees.map((x) => (x.id === e.id ? e : x))
              : [e, ...s.office.employees],
          },
        })),
      removeEmployee: (id) =>
        set((s) => ({ office: { ...s.office, employees: s.office.employees.filter((x) => x.id !== id) } })),
      setDoor: (id, patch) =>
        set((s) => ({ office: { ...s.office, doors: s.office.doors.map((d) => (d.id === id ? { ...d, ...patch } : d)) } })),
      upsertRule: (r) =>
        set((s) => ({
          office: {
            ...s.office,
            rules: s.office.rules.some((x) => x.id === r.id)
              ? s.office.rules.map((x) => (x.id === r.id ? r : x))
              : [...s.office.rules, r],
          },
        })),
      removeRule: (id) => set((s) => ({ office: { ...s.office, rules: s.office.rules.filter((r) => r.id !== id) } })),
      upsertVisitor: (v) =>
        set((s) => ({
          office: {
            ...s.office,
            visitors: s.office.visitors.some((x) => x.id === v.id)
              ? s.office.visitors.map((x) => (x.id === v.id ? v : x))
              : [v, ...s.office.visitors],
          },
        })),
      removeVisitor: (id) =>
        set((s) => ({ office: { ...s.office, visitors: s.office.visitors.filter((x) => x.id !== id) } })),

      upsertGuest: (g) =>
        set((s) => ({
          hotel: {
            ...s.hotel,
            guests: s.hotel.guests.some((x) => x.id === g.id)
              ? s.hotel.guests.map((x) => (x.id === g.id ? g : x))
              : [g, ...s.hotel.guests],
          },
        })),
      checkIn: (guestId) =>
        set((s) => {
          const guest = s.hotel.guests.find((g) => g.id === guestId)
          if (!guest) return s
          return {
            hotel: {
              ...s.hotel,
              guests: s.hotel.guests.map((g) => (g.id === guestId ? { ...g, status: 'checked-in' } : g)),
              rooms: s.hotel.rooms.map((r) => (r.number === guest.roomNumber ? { ...r, status: 'occupied' } : r)),
            },
          }
        }),
      checkOut: (guestId, at) =>
        set((s) => {
          const guest = s.hotel.guests.find((g) => g.id === guestId)
          if (!guest) return s
          const { [roomResourceId(guest.roomNumber)]: _, ...unlocked } = s.unlocked
          return {
            unlocked,
            hotel: {
              ...s.hotel,
              guests: s.hotel.guests.map((g) =>
                g.id === guestId ? { ...g, status: 'checked-out', checkedOutAt: at } : g,
              ),
              rooms: s.hotel.rooms.map((r) => (r.number === guest.roomNumber ? { ...r, status: 'cleaning' } : r)),
            },
          }
        }),
      setRoom: (number, patch) =>
        set((s) => ({
          hotel: { ...s.hotel, rooms: s.hotel.rooms.map((r) => (r.number === number ? { ...r, ...patch } : r)) },
        })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setDemo: (patch) => set((s) => ({ demo: { ...s.demo, ...patch } })),

      clearIdentityLinks: (identityId) =>
        set((s) => ({
          office: {
            ...s.office,
            employees: s.office.employees.map((e) => (e.identityId === identityId ? { ...e, identityId: null } : e)),
            visitors: s.office.visitors.map((v) => (v.identityId === identityId ? { ...v, identityId: null } : v)),
          },
          hotel: {
            ...s.hotel,
            guests: s.hotel.guests.map((g) => (g.identityId === identityId ? { ...g, identityId: null } : g)),
          },
        })),

      applyDemoPeople: (on) =>
        set((s) => {
          const now = Date.now()
          // Always strip the old cast first so turning it on again refreshes dates.
          const office = {
            ...s.office,
            employees: s.office.employees.filter((x) => !isDemoRecord(x)),
            visitors: s.office.visitors.filter((x) => !isDemoRecord(x)),
          }
          const removedGuests = s.hotel.guests.filter((x) => isDemoRecord(x))
          const guests = s.hotel.guests.filter((x) => !isDemoRecord(x))
          const stillOccupied = new Set(guests.filter((g) => g.status === 'checked-in').map((g) => g.roomNumber))
          let rooms = s.hotel.rooms.map((r) =>
            removedGuests.some((g) => g.roomNumber === r.number) && !stillOccupied.has(r.number) && r.status === 'occupied'
              ? { ...r, status: 'vacant' as const }
              : r,
          )
          let events = s.events.filter((e) => !isDemoEvent(e))
          const settings = { ...s.settings, demoPeople: on }
          if (!on) return { office, hotel: { ...s.hotel, guests, rooms }, events, settings }

          const cast = demoCast(now)
          const free = (roomNumber: string) => !stillOccupied.has(roomNumber)
          const castGuests = cast.guests.filter((g) => free(g.roomNumber))
          rooms = rooms.map((r) => (cast.occupiedRooms.includes(r.number) && free(r.number) ? { ...r, status: 'occupied' as const } : r))
          events = [...events, ...cast.events].sort((a, b) => b.at - a.at)
          return {
            seededDay: startOfDay(now),
            office: { ...office, employees: [...office.employees, ...cast.employees], visitors: [...office.visitors, ...cast.visitors] },
            hotel: { ...s.hotel, guests: [...guests, ...castGuests], rooms },
            events,
            settings,
          }
        }),

      resetAll: () => set({ ...freshState(), demo: defaultDemo }),

    }),
    {
      name: 'optic-access-state',
      version: SCHEMA,
      partialize: ({ unlocked: _u, ...rest }) => rest,
      migrate: (persisted, version) => {
        // 5 → 6: stricter match threshold. 6 → 7: new dark-first look. Both keep all data.
        if ((version === 5 || version === 6) && persisted && typeof persisted === 'object') {
          const p = persisted as State
          const acceptDistance = p.settings.acceptDistance >= 0.5 ? defaultSettings.acceptDistance : p.settings.acceptDistance
          const theme = p.settings.theme === 'light' ? 'dark' : p.settings.theme
          return { ...p, schema: SCHEMA, settings: { ...p.settings, acceptDistance, theme } } as unknown as State & Actions
        }
        return { ...freshState(), settings: defaultSettings, demo: defaultDemo } as unknown as State & Actions
      },
    },
  ),
)

export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`
