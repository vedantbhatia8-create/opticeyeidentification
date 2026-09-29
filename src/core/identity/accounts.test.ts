import { describe, expect, it } from 'vitest'
import { syntheticTemplate } from '../biometric/synthetic'
import { IdentityService } from './IdentityService'

describe('accounts', () => {
  it('keeps one account per email and merges duplicates', async () => {
    const svc = new IdentityService()
    await svc.init([])
    const a = await svc.enroll({ name: 'Vedant Bhatia', email: 'v@example.com', origin: 'lab', label: 'Desk' }, syntheticTemplate('v1'))
    const b = await svc.enroll({ name: 'Vedant Bhatia', email: ' V@Example.com ', origin: 'lab', label: 'Glasses' }, syntheticTemplate('v2'))
    expect(b.identity.id).toBe(a.identity.id)
    expect(svc.getSnapshot().identities.filter((i) => !i.synthetic)).toHaveLength(1)
    expect(svc.scansFor(a.identity.id)).toHaveLength(2)

    // Legacy duplicate created without an email, then merged.
    const c = await svc.enroll({ name: 'Vedant Bhatia', origin: 'lab', label: 'Old' }, syntheticTemplate('v3'))
    expect(c.identity.id).not.toBe(a.identity.id)
    await svc.mergeIdentities(a.identity.id, [c.identity.id])
    expect(svc.getIdentity(c.identity.id)).toBeUndefined()
    expect(svc.scansFor(a.identity.id)).toHaveLength(3)
  })
})
