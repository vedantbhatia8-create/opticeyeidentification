import { formatClock } from '../../core/authorization/engine'
import type {
  AuthorizationResult,
  Grant,
  Principal,
  ProtectedResource,
  Schedule,
} from '../../core/authorization/types'
import { formatDateTime, formatTime } from '../../ui/format'

export interface Employee {
  id: string
  name: string
  email: string
  department: string
  role: string
  groupIds: string[]
  status: 'active' | 'suspended'
  identityId: string | null
  createdAt: number
}

export interface AccessGroup {
  id: string
  name: string
  description: string
  /** Implicit groups include every active employee / every visitor. */
  implicit?: 'employees' | 'visitors'
}

export interface Device {
  serial: string
  model: string
  firmware: string
  lastSeenAt: number
}

export interface Door {
  id: string
  name: string
  zone: string
  online: boolean
  mode: 'normal' | 'lockdown'
  device: Device
  lastAccess: { at: number; name: string } | null
}

export interface AccessRule {
  id: string
  groupId: string
  doorIds: string[]
  schedule: Schedule
  enabled: boolean
}

export interface Visitor {
  id: string
  name: string
  company: string
  email: string
  hostName: string
  doorIds: string[]
  start: number
  end: number
  revoked: boolean
  identityId: string | null
  createdAt: number
}

export interface OfficeState {
  orgName: string
  siteName: string
  employees: Employee[]
  groups: AccessGroup[]
  doors: Door[]
  rules: AccessRule[]
  visitors: Visitor[]
}

export const GROUP_EMPLOYEES = 'grp_all'
export const GROUP_VISITORS = 'grp_visitors'

export function visitorStatus(v: Visitor, now: number): 'scheduled' | 'active' | 'expired' | 'revoked' {
  if (v.revoked) return 'revoked'
  if (now < v.start) return 'scheduled'
  if (now >= v.end) return 'expired'
  return 'active'
}

export function groupMembers(state: OfficeState, groupId: string): Employee[] {
  const group = state.groups.find((g) => g.id === groupId)
  if (group?.implicit === 'employees') return state.employees.filter((e) => e.status === 'active')
  return state.employees.filter((e) => e.groupIds.includes(groupId))
}

function ruleGrants(state: OfficeState, groupIds: string[]): Grant[] {
  const grants: Grant[] = []
  for (const rule of state.rules) {
    if (!rule.enabled || !groupIds.includes(rule.groupId)) continue
    const group = state.groups.find((g) => g.id === rule.groupId)
    for (const doorId of rule.doorIds) {
      grants.push({
        resourceId: doorId,
        schedule: rule.schedule,
        source: { kind: 'rule', id: rule.id, label: group?.name ?? 'Rule' },
      })
    }
  }
  return grants
}

export function employeePrincipal(state: OfficeState, e: Employee): Principal {
  return {
    id: e.id,
    kind: 'employee',
    displayName: e.name,
    status: e.status === 'active' ? 'active' : 'suspended',
    grants: ruleGrants(state, [GROUP_EMPLOYEES, ...e.groupIds]),
  }
}

export function visitorPrincipal(state: OfficeState, v: Visitor): Principal {
  const window = { from: v.start, until: v.end }
  return {
    id: v.id,
    kind: 'visitor',
    displayName: v.name,
    status: v.revoked ? 'revoked' : 'active',
    window,
    grants: [
      ...v.doorIds.map<Grant>((doorId) => ({
        resourceId: doorId,
        schedule: { type: 'always' },
        window,
        source: { kind: 'visit', id: v.id, label: `Visit hosted by ${v.hostName}` },
      })),
      ...ruleGrants(state, [GROUP_VISITORS]),
    ],
  }
}

export function resolveOfficePrincipal(state: OfficeState, identityId: string, now: number): Principal | null {
  const employee = state.employees.find((e) => e.identityId === identityId)
  if (employee) return employeePrincipal(state, employee)
  // A person may have several visits; prefer the current one, then the next, then the latest.
  const visits = state.visitors
    .filter((v) => v.identityId === identityId)
    .sort((a, b) => {
      const rank = (v: Visitor) => ({ active: 0, scheduled: 1, expired: 2, revoked: 3 })[visitorStatus(v, now)]
      return rank(a) - rank(b) || b.start - a.start
    })
  return visits[0] ? visitorPrincipal(state, visits[0]) : null
}

export function doorResource(d: Door): ProtectedResource {
  return { id: d.id, name: d.name, online: d.online, mode: d.mode }
}

/** Which doors a principal can reach at all, with the schedule label. */
export function accessSummary(principal: Principal, doors: Door[]) {
  const byDoor = new Map<string, Grant[]>()
  for (const g of principal.grants) byDoor.set(g.resourceId, [...(byDoor.get(g.resourceId) ?? []), g])
  return doors.filter((d) => byDoor.has(d.id)).map((d) => ({ door: d, grants: byDoor.get(d.id)! }))
}

export function describeOfficeDenial(
  result: AuthorizationResult,
  resource: ProtectedResource,
): { title: string; detail: string } {
  const kind = result.principal?.kind
  switch (result.code) {
    case 'window-expired':
      return kind === 'visitor'
        ? { title: 'VISITOR ACCESS EXPIRED', detail: `Your visit ended at ${formatTime(result.boundary!)}. Please see reception.` }
        : { title: 'ACCESS EXPIRED', detail: 'Your access to this area has expired.' }
    case 'window-not-started':
      return kind === 'visitor'
        ? { title: 'VISIT NOT STARTED', detail: `Your visitor access begins ${formatDateTime(result.boundary!)}.` }
        : { title: 'NOT YET ACTIVE', detail: `Access begins ${formatDateTime(result.boundary!)}.` }
    case 'outside-schedule': {
      const s = result.grant?.schedule
      const hours = s?.type === 'weekly' ? ` (${formatClock(s.start)}–${formatClock(s.end)})` : ''
      return { title: 'OUTSIDE PERMITTED HOURS', detail: `You can access ${resource.name} during scheduled hours${hours}.` }
    }
    case 'no-grant':
      return { title: 'NOT AUTHORIZED', detail: 'You do not have permission to access this area.' }
    case 'principal-suspended':
      return { title: 'ACCESS SUSPENDED', detail: 'Your access has been suspended. Contact your administrator.' }
    case 'no-principal':
      return { title: 'NOT REGISTERED HERE', detail: 'Your identity is verified but has no access at this site.' }
    case 'resource-lockdown':
      return { title: 'DOOR IN LOCKDOWN', detail: 'This door has been locked down by security.' }
    case 'resource-offline':
      return { title: 'DOOR OFFLINE', detail: 'This door controller is offline.' }
    default:
      return { title: 'ACCESS DENIED', detail: 'You do not have permission to access this location.' }
  }
}
