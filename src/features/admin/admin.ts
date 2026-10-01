/**
 * Admin / ownership model.
 *
 * The account OWNER is the first real (non-synthetic) account ever enrolled —
 * that is you, Vedant. The owner is always an admin and cannot be demoted.
 * The owner can grant admin to other real accounts; admins get the
 * test-as-account override and the admin console.
 */
import type { Identity } from '../../core/identity/types'
import { useIdentities } from '../sensor/hooks'
import { useSession } from '../suite/store'
import { useStore } from '../../state/store'

/** The owner: earliest-created real, active account. Null until someone enrolls. */
export function ownerId(identities: Identity[]): string | null {
  const real = identities.filter((i) => !i.synthetic && i.status === 'active')
  if (real.length === 0) return null
  return real.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b)).id
}

export function isAdminId(id: string | null, identities: Identity[], adminIds: string[]): boolean {
  if (!id) return false
  if (id === ownerId(identities)) return true
  return adminIds.includes(id)
}

/** Whether the signed-in account is an admin. */
export function useIsAdmin(): boolean {
  const { identities } = useIdentities()
  const sessionId = useSession((s) => s.identityId)
  const adminIds = useStore((s) => s.settings.adminIds)
  return isAdminId(sessionId, identities, adminIds)
}

/** Whether the signed-in account is the owner (top-level, cannot be demoted). */
export function useIsOwner(): boolean {
  const { identities } = useIdentities()
  const sessionId = useSession((s) => s.identityId)
  return !!sessionId && sessionId === ownerId(identities)
}
