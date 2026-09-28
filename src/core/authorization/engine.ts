import type { AuthorizationResult, Grant, Principal, ProtectedResource, Schedule } from './types'

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function scheduleAllows(schedule: Schedule, at: number): boolean {
  if (schedule.type === 'always') return true
  const d = new Date(at)
  const minutes = d.getHours() * 60 + d.getMinutes()
  const start = toMinutes(schedule.start)
  const end = toMinutes(schedule.end)
  const day = d.getDay()
  if (end > start) return schedule.days.includes(day) && minutes >= start && minutes < end
  // Overnight window: belongs to the day it started on.
  if (minutes >= start) return schedule.days.includes(day)
  return minutes < end && schedule.days.includes((day + 6) % 7)
}

/**
 * Pure policy evaluation. Order matters: device state first, then who the
 * person is (status, validity), then what they hold (grants, schedule).
 */
export function authorize(
  principal: Principal | null,
  resource: ProtectedResource,
  at: number,
): AuthorizationResult {
  const result = (code: AuthorizationResult['code'], grant: Grant | null = null, boundary?: number): AuthorizationResult => ({
    allowed: code === 'granted',
    code,
    principal,
    grant,
    evaluatedAt: at,
    boundary,
  })

  if (!resource.online) return result('resource-offline')
  if (resource.mode === 'lockdown') return result('resource-lockdown')
  if (!principal) return result('no-principal')

  switch (principal.status) {
    case 'ended':
      return result('principal-ended', null, principal.window?.until)
    case 'suspended':
    case 'revoked':
      return result('principal-suspended')
    case 'pending':
      return result('principal-pending', null, principal.window?.from)
  }

  if (principal.window) {
    if (at < principal.window.from) return result('window-not-started', null, principal.window.from)
    if (at >= principal.window.until) return result('window-expired', null, principal.window.until)
  }

  const forResource = principal.grants.filter((g) => g.resourceId === resource.id)
  if (forResource.length === 0) return result('no-grant')

  const inWindow = forResource.filter((g) => !g.window || (at >= g.window.from && at < g.window.until))
  if (inWindow.length === 0) {
    const future = forResource.filter((g) => g.window && at < g.window.from)
    return future.length
      ? result('window-not-started', null, Math.min(...future.map((g) => g.window!.from)))
      : result('window-expired', null, Math.max(...forResource.map((g) => g.window?.until ?? 0)))
  }

  const active = inWindow.find((g) => scheduleAllows(g.schedule, at))
  return active ? result('granted', active) : result('outside-schedule', inWindow[0])
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 && h < 24 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m || 0).padStart(2, '0')} ${suffix}`
}

export function describeDays(days: number[]): string {
  const sorted = [...days].sort()
  const key = sorted.join('')
  if (key === '0123456') return 'Every day'
  if (key === '12345') return 'Mon–Fri'
  if (key === '06') return 'Weekends'
  return sorted.map((d) => DAY_NAMES[d]).join(', ')
}

export function describeSchedule(schedule: Schedule): string {
  if (schedule.type === 'always') return '24/7'
  return `${describeDays(schedule.days)} · ${formatClock(schedule.start)}–${formatClock(schedule.end)}`
}
