/**
 * State for the Optic apps suite. Non-sensitive settings and records live
 * here (localStorage). Secrets — vault items and eyes-only documents — are
 * sealed in IndexedDB by vaultService / docsService, never stored here.
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Schedule } from '../../core/authorization/types'

export type AppId = 'suite' | 'vault' | 'eyes-only' | 'guard' | 'family' | 'focus' | 'attendance' | 'approve'

export interface SuiteEvent {
  id: string
  at: number
  app: AppId
  action: string
  detail: string
  identityId: string | null
  name: string
  ok: boolean
  /** Related record, e.g. a document id. */
  ref?: string
}

export interface GuardSettings {
  enabled: boolean
  awayLock: boolean
  awaySeconds: number
  shoulderShield: boolean
  strangerLock: boolean
}

export interface KidApp {
  id: string
  name: string
  url: string
  color: string
  blurb: string
}

export interface FamilyMember {
  id: string
  name: string
  role: 'parent' | 'kid'
  identityId: string | null
  accent: string
  theme: 'light' | 'dark'
  dailyMinutes: number
  schedule: Schedule
  apps: string[]
  paused: boolean
}

export interface FocusSession {
  id: string
  identityId: string | null
  goal: string
  plannedMinutes: number
  startedAt: number
  endedAt: number
  focusedSec: number
  awaySec: number
  distractions: number
  /** One entry per 5 s: f = focused, a = away / looking elsewhere, c = eyes closed. */
  timeline: string
  score: number
}

export interface AttendanceEvent {
  id: string
  name: string
  location: string
  start: number
  end: number
  graceMin: number
  roster: string[]
}

export interface Checkin {
  eventId: string
  identityId: string
  name: string
  at: number
  late: boolean
}

export interface ProfilePrefs {
  accent: string
  theme: 'light' | 'dark'
}

export const KID_APPS: KidApp[] = [
  { id: 'khan', name: 'Khan Academy Kids', url: 'https://learn.khanacademy.org/khan-academy-kids/', color: '#14bf96', blurb: 'Reading & math' },
  { id: 'scratch', name: 'Scratch', url: 'https://scratch.mit.edu', color: '#f59e0b', blurb: 'Make games' },
  { id: 'pbs', name: 'PBS Kids', url: 'https://pbskids.org', color: '#2f5bea', blurb: 'Shows & games' },
  { id: 'nasa', name: 'NASA Space Place', url: 'https://spaceplace.nasa.gov', color: '#0b3d91', blurb: 'Space science' },
  { id: 'duolingo', name: 'Duolingo', url: 'https://www.duolingo.com', color: '#58cc02', blurb: 'Languages' },
  { id: 'typing', name: 'TypingClub', url: 'https://www.typingclub.com', color: '#8b5cf6', blurb: 'Typing practice' },
  { id: 'natgeo', name: 'Nat Geo Kids', url: 'https://kids.nationalgeographic.com', color: '#e6b800', blurb: 'Animals & nature' },
  { id: 'code', name: 'Code.org', url: 'https://code.org', color: '#e0457b', blurb: 'Learn to code' },
]

export const ACCENTS = ['#2f5bea', '#0f8a6a', '#e0457b', '#8b5cf6', '#e0852b', '#0ea5b7', '#111214']

/** Starts empty: family profiles and attendance lists are built from real accounts. */
function seed() {
  return { family: [] as FamilyMember[], attendance: [] as AttendanceEvent[], checkins: [] as Checkin[] }
}

interface SuiteState {
  guard: GuardSettings
  family: FamilyMember[]
  usage: Record<string, number>
  bonus: Record<string, number>
  focus: FocusSession[]
  attendance: AttendanceEvent[]
  checkins: Checkin[]
  prefs: Record<string, ProfilePrefs>
  events: SuiteEvent[]
  log(e: Omit<SuiteEvent, 'id' | 'at'>): void
  setGuard(patch: Partial<GuardSettings>): void
  upsertMember(m: FamilyMember): void
  removeMember(id: string): void
  addUsage(memberId: string, seconds: number): void
  addBonus(memberId: string, minutes: number): void
  addFocus(s: FocusSession): void
  upsertAttendance(e: AttendanceEvent): void
  removeAttendance(id: string): void
  checkIn(c: Checkin): void
  setPrefs(identityId: string, p: ProfilePrefs): void
  reset(): void
}

export const dayKey = (memberId: string, at = Date.now()) => `${memberId}:${new Date(at).toDateString()}`
const rid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12)

export const useSuite = create<SuiteState>()(
  persist(
    (set) => ({
      guard: { enabled: false, awayLock: true, awaySeconds: 8, shoulderShield: true, strangerLock: true },
      ...seed(),
      usage: {},
      bonus: {},
      focus: [],
      prefs: {},
      events: [],
      log: (e) => set((s) => ({ events: [{ ...e, id: `sev_${rid()}`, at: Date.now() }, ...s.events].slice(0, 500) })),
      setGuard: (patch) => set((s) => ({ guard: { ...s.guard, ...patch } })),
      upsertMember: (m) =>
        set((s) => ({ family: s.family.some((x) => x.id === m.id) ? s.family.map((x) => (x.id === m.id ? m : x)) : [...s.family, m] })),
      removeMember: (id) => set((s) => ({ family: s.family.filter((x) => x.id !== id) })),
      addUsage: (memberId, seconds) =>
        set((s) => {
          const k = dayKey(memberId)
          return { usage: { ...s.usage, [k]: (s.usage[k] ?? 0) + seconds } }
        }),
      addBonus: (memberId, minutes) =>
        set((s) => {
          const k = dayKey(memberId)
          return { bonus: { ...s.bonus, [k]: (s.bonus[k] ?? 0) + minutes } }
        }),
      addFocus: (f) => set((s) => ({ focus: [f, ...s.focus].slice(0, 200) })),
      upsertAttendance: (e) =>
        set((s) => ({
          attendance: s.attendance.some((x) => x.id === e.id) ? s.attendance.map((x) => (x.id === e.id ? e : x)) : [e, ...s.attendance],
        })),
      removeAttendance: (id) => set((s) => ({ attendance: s.attendance.filter((x) => x.id !== id), checkins: s.checkins.filter((c) => c.eventId !== id) })),
      checkIn: (c) =>
        set((s) =>
          s.checkins.some((x) => x.eventId === c.eventId && x.identityId === c.identityId) ? s : { checkins: [...s.checkins, c] },
        ),
      setPrefs: (identityId, p) => set((s) => ({ prefs: { ...s.prefs, [identityId]: p } })),
      reset: () => set({ ...seed(), usage: {}, bonus: {}, focus: [], prefs: {}, events: [] }),
    }),
    { name: 'optic-suite', version: 1 },
  ),
)

export const newSuiteId = (prefix: string) => `${prefix}_${rid()}`

/** Who is signed in to the Optic apps (per browser tab session). */
interface SessionState {
  identityId: string | null
  name: string | null
  signedInAt: number
  /** Last successful glance — step-up approvals within 30 s reuse it. */
  lastVerifiedAt: number
  signIn(identityId: string, name: string): void
  touch(): void
  signOut(): void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      identityId: null,
      name: null,
      signedInAt: 0,
      lastVerifiedAt: 0,
      signIn: (identityId, name) => set({ identityId, name, signedInAt: Date.now(), lastVerifiedAt: Date.now() }),
      touch: () => set({ lastVerifiedAt: Date.now() }),
      signOut: () => set({ identityId: null, name: null, signedInAt: 0, lastVerifiedAt: 0 }),
    }),
    { name: 'optic-session', storage: createJSONStorage(() => sessionStorage) },
  ),
)
