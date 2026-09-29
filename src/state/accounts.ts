/**
 * Accounts: one Optic identity per person (per email), holding every optic
 * scan and every app's data. Merging re-points everything that referenced a
 * duplicate identity onto the kept account.
 */
import { identityService } from '../core/identity/IdentityService'
import { reassignSuiteRecords } from '../features/suite/secure'
import { useSession, useSuite } from '../features/suite/store'
import { useStore } from './store'

export async function mergeAccounts(targetId: string, sourceIds: string[]): Promise<{ vaultsNotMerged: number }> {
  const sources = sourceIds.filter((id) => id !== targetId)
  if (sources.length === 0) return { vaultsNotMerged: 0 }
  const swap = (id: string | null) => (id && sources.includes(id) ? targetId : id)
  const dedupe = (ids: string[]) => [...new Set(ids.map((i) => swap(i)!))]

  const result = await reassignSuiteRecords(targetId, sources)
  await identityService.mergeIdentities(targetId, sources)

  useStore.setState((s) => ({
    office: {
      ...s.office,
      employees: s.office.employees.map((e) => ({ ...e, identityId: swap(e.identityId) })),
      visitors: s.office.visitors.map((v) => ({ ...v, identityId: swap(v.identityId) })),
    },
    hotel: { ...s.hotel, guests: s.hotel.guests.map((g) => ({ ...g, identityId: swap(g.identityId) })) },
    events: s.events.map((e) => (e.identityId && sources.includes(e.identityId) ? { ...e, identityId: targetId } : e)),
  }))

  useSuite.setState((s) => {
    const prefs = { ...s.prefs }
    for (const id of sources) {
      if (!prefs[targetId] && prefs[id]) prefs[targetId] = prefs[id]
      delete prefs[id]
    }
    const seen = new Set<string>()
    const checkins = s.checkins
      .map((c) => ({ ...c, identityId: swap(c.identityId)! }))
      .filter((c) => {
        const k = `${c.eventId}:${c.identityId}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
    return {
      family: s.family.map((m) => ({ ...m, identityId: swap(m.identityId) })),
      attendance: s.attendance.map((a) => ({ ...a, roster: dedupe(a.roster) })),
      checkins,
      focus: s.focus.map((f) => ({ ...f, identityId: swap(f.identityId) })),
      events: s.events.map((e) => ({ ...e, identityId: swap(e.identityId) })),
      prefs,
    }
  })

  const session = useSession.getState()
  if (session.identityId && sources.includes(session.identityId)) {
    session.signIn(targetId, identityService.getIdentity(targetId)?.name ?? session.name ?? '')
  }
  return result
}

/** Merges every set of accounts that share an email into the oldest one. */
export async function consolidateAccounts(): Promise<number> {
  let merged = 0
  for (const group of identityService.duplicateGroups()) {
    const [keep, ...rest] = group
    await mergeAccounts(keep.id, rest.map((i) => i.id))
    merged += rest.length
  }
  return merged
}
