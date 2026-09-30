/**
 * Identity layer: who a biometric belongs to.
 *
 * Owns identities and their enrolled optic scans (sealed templates). It
 * answers exactly one question for the rest of the system — "which enrolled
 * identity, if any, does this probe belong to?" — and knows nothing about
 * doors, rooms, schedules or permissions (that is the authorization layer).
 *
 * Operators see identity metadata and scan metadata (label, quality, date,
 * fingerprint). Decrypted templates are only exposed through the explicit
 * `inspectScan` call used by the Optic Lab's representation viewer.
 */
import { DEFAULT_MATCH_POLICY, identify, type IdentificationResult, type MatchPolicy } from '../biometric/matcher'
import { syntheticTemplate } from '../biometric/synthetic'
import { templateSizeBytes } from '../biometric/template'
import type { BiometricSample, OpticTemplate } from '../biometric/types'
import { fingerprint, loadOrCreateKey, seal, unseal, type Sealed } from './crypto'
import { openStore, STORES, type KeyValueStore } from './db'
import type { Identity, IdentityOrigin, IdentitySnapshot, IdentityVerification, OpticScan } from './types'

interface StoredScan extends OpticScan {
  sealed: Sealed
}

export interface DemoIdentitySeed {
  identityId: string
  seed: string
  name: string
  email: string
  origin: IdentityOrigin
}

export interface EnrollInput {
  /** Existing identity to add a scan to; otherwise a new identity is created. */
  identityId?: string
  name: string
  email?: string
  externalId?: string
  origin: IdentityOrigin
  label: string
  /** Set when enrolled through the simulated sensor. */
  demoSeed?: string
}

export const normalizeEmail = (email?: string | null) => (email ?? '').trim().toLowerCase()

const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`

export class IdentityService {
  private store: KeyValueStore | null = null
  private key: CryptoKey | null = null
  private ready: Promise<void> | null = null
  private identities = new Map<string, Identity>()
  private scans = new Map<string, StoredScan>()
  private templateCache = new Map<string, OpticTemplate>()
  private listeners = new Set<() => void>()
  private snapshot: IdentitySnapshot = { ready: false, persistent: true, identities: [], scans: [] }

  init(seeds: DemoIdentitySeed[] = []): Promise<void> {
    this.ready ??= (async () => {
      this.store = await openStore()
      this.key = await loadOrCreateKey(this.store)
      for (const i of await this.store.getAll<Identity>(STORES.identities)) this.identities.set(i.id, i)
      for (const s of await this.store.getAll<StoredScan>(STORES.scans)) this.scans.set(s.id, s)
      await this.ensureDemoIdentities(seeds)
      this.emit()
    })()
    return this.ready
  }

  private async ensureDemoIdentities(seeds: DemoIdentitySeed[]) {
    for (const seed of seeds) {
      if (this.identities.has(seed.identityId)) continue
      const now = Date.now()
      const identity: Identity = {
        id: seed.identityId,
        name: seed.name,
        email: seed.email,
        origin: seed.origin,
        synthetic: true,
        demoSeed: seed.seed,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }
      await this.putIdentity(identity)
      await this.putScan(identity.id, 'Demo persona · synthetic template', syntheticTemplate(seed.seed), true)
    }
  }

  // ── Subscriptions (React uses useSyncExternalStore) ──────────────────────
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getSnapshot = (): IdentitySnapshot => this.snapshot

  private emit() {
    const publicScans = [...this.scans.values()]
      .map(({ sealed: _sealed, ...meta }) => meta)
      .sort((a, b) => b.createdAt - a.createdAt)
    this.snapshot = {
      ready: true,
      persistent: this.store?.persistent ?? true,
      identities: [...this.identities.values()].sort((a, b) => b.createdAt - a.createdAt),
      scans: publicScans,
    }
    this.listeners.forEach((l) => l())
  }

  private async requireReady() {
    if (!this.ready) await this.init()
    await this.ready
    return { store: this.store!, key: this.key! }
  }

  /** Callers must have awaited readiness (or be inside init). */
  private async putIdentity(identity: Identity) {
    await this.store!.put(STORES.identities, identity)
    this.identities.set(identity.id, identity)
  }

  private async putScan(identityId: string, label: string, template: OpticTemplate, synthetic: boolean) {
    const store = this.store!
    const sealed = await seal(this.key!, template)
    const scan: StoredScan = {
      id: newId('scn'),
      identityId,
      label,
      createdAt: Date.now(),
      modality: template.modality,
      sampleCount: template.sampleCount,
      quality: template.quality,
      poses: template.poses,
      sizeBytes: templateSizeBytes(template),
      fingerprint: await fingerprint(sealed),
      synthetic,
      matchCount: 0,
      lastMatchedAt: null,
      sealed,
    }
    await store.put(STORES.scans, scan)
    this.scans.set(scan.id, scan)
    this.templateCache.set(scan.id, template)
    return scan
  }

  // ── Enrollment ───────────────────────────────────────────────────────────
  async enroll(input: EnrollInput, template: OpticTemplate): Promise<{ identity: Identity; scan: OpticScan }> {
    await this.requireReady()
    const now = Date.now()
    let identity = input.identityId ? this.identities.get(input.identityId) : undefined
    // One account per email: a new enrollment with a known email becomes another scan on that account.
    if (!identity && !input.demoSeed) identity = this.findAccountByEmail(input.email)
    if (identity) {
      const email = normalizeEmail(input.email) && normalizeEmail(input.email) !== normalizeEmail(identity.email) ? input.email : identity.email
      identity = { ...identity, name: input.name || identity.name, email: email ?? input.email, updatedAt: now }
    } else {
      identity = {
        id: input.identityId ?? newId('idn'),
        name: input.name,
        email: input.email,
        externalId: input.externalId,
        origin: input.origin,
        synthetic: !!input.demoSeed,
        demoSeed: input.demoSeed,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }
    }
    await this.putIdentity(identity)
    const { sealed: _s, ...scan } = await this.putScan(identity.id, input.label, template, !!input.demoSeed)
    this.emit()
    return { identity, scan }
  }

  // ── Management ───────────────────────────────────────────────────────────
  async renameScan(scanId: string, label: string) {
    const { store } = await this.requireReady()
    const scan = this.scans.get(scanId)
    if (!scan) return
    const next = { ...scan, label: label.trim() || scan.label }
    await store.put(STORES.scans, next)
    this.scans.set(scanId, next)
    this.emit()
  }

  async updateIdentity(id: string, patch: Partial<Pick<Identity, 'name' | 'email' | 'externalId' | 'status'>>) {
    const { store } = await this.requireReady()
    const identity = this.identities.get(id)
    if (!identity) return
    const next = { ...identity, ...patch, updatedAt: Date.now() }
    await store.put(STORES.identities, next)
    this.identities.set(id, next)
    this.emit()
  }

  async deleteScan(scanId: string) {
    const { store } = await this.requireReady()
    await store.delete(STORES.scans, scanId)
    this.scans.delete(scanId)
    this.templateCache.delete(scanId)
    this.emit()
  }

  /** Deletes the identity and destroys every template bound to it. */
  async deleteIdentity(id: string) {
    const { store } = await this.requireReady()
    for (const scan of [...this.scans.values()].filter((s) => s.identityId === id)) {
      await store.delete(STORES.scans, scan.id)
      this.scans.delete(scan.id)
      this.templateCache.delete(scan.id)
    }
    await store.delete(STORES.identities, id)
    this.identities.delete(id)
    this.emit()
  }

  /** Adds the given demo identities (skipping any that already exist). */
  async addDemoIdentities(seeds: DemoIdentitySeed[]) {
    await this.requireReady()
    await this.ensureDemoIdentities(seeds)
    this.emit()
  }

  /** Removes the given demo identities and their synthetic templates. */
  async removeDemoIdentities(seeds: DemoIdentitySeed[]) {
    for (const seed of seeds) if (this.identities.get(seed.identityId)?.synthetic) await this.deleteIdentity(seed.identityId)
  }

  /** Removes every enrollment, then re-adds the given demo identities (used by "Reset prototype data"). */
  async purgeAll(seeds: DemoIdentitySeed[]) {
    const { store } = await this.requireReady()
    await store.clear(STORES.scans)
    await store.clear(STORES.identities)
    this.scans.clear()
    this.identities.clear()
    this.templateCache.clear()
    await this.ensureDemoIdentities(seeds)
    this.emit()
  }

  /**
   * Every identity id that belongs to the same person as `id`: the id itself
   * plus real identities with the same email or the same name. Guards against
   * leftover duplicate records making a person "someone else" to themselves.
   */
  accountIds(id: string): string[] {
    const me = this.identities.get(id)
    if (!me || me.synthetic) return [id]
    const email = normalizeEmail(me.email)
    const name = me.name.trim().toLowerCase()
    const ids = [...this.identities.values()]
      .filter((i) => !i.synthetic && i.status === 'active')
      .filter((i) => (email && normalizeEmail(i.email) === email) || (name && i.name.trim().toLowerCase() === name))
      .map((i) => i.id)
    return [id, ...ids.filter((x) => x !== id)]
  }

  /** True when both ids belong to the same person's account. */
  isSameAccount(a?: string | null, b?: string | null): boolean {
    if (!a || !b) return false
    return a === b || this.accountIds(a).includes(b)
  }

  /** The real (non-demo) account registered to this email, if any. */
  findAccountByEmail(email?: string | null): Identity | undefined {
    const key = normalizeEmail(email)
    if (!key) return undefined
    return [...this.identities.values()]
      .filter((i) => !i.synthetic && normalizeEmail(i.email) === key)
      .sort((a, b) => a.createdAt - b.createdAt)[0]
  }

  /** Groups of real identities that share an email (oldest first). */
  duplicateGroups(): Identity[][] {
    const groups = new Map<string, Identity[]>()
    for (const i of this.identities.values()) {
      const key = normalizeEmail(i.email)
      if (i.synthetic || !key) continue
      groups.set(key, [...(groups.get(key) ?? []), i])
    }
    return [...groups.values()].filter((g) => g.length > 1).map((g) => g.sort((a, b) => a.createdAt - b.createdAt))
  }

  /** Moves every optic scan from `sourceIds` onto `targetId` and removes the source identities. */
  async mergeIdentities(targetId: string, sourceIds: string[]) {
    const { store } = await this.requireReady()
    const target = this.identities.get(targetId)
    if (!target) throw new Error('Target identity not found')
    for (const sourceId of sourceIds) {
      if (sourceId === targetId) continue
      const source = this.identities.get(sourceId)
      if (!source) continue
      for (const scan of [...this.scans.values()].filter((s) => s.identityId === sourceId)) {
        const moved = { ...scan, identityId: targetId }
        await store.put(STORES.scans, moved)
        this.scans.set(scan.id, moved)
      }
      if (!target.email && source.email) target.email = source.email
      if (!target.externalId && source.externalId) target.externalId = source.externalId
      await store.delete(STORES.identities, sourceId)
      this.identities.delete(sourceId)
    }
    const next = { ...target, updatedAt: Date.now() }
    await store.put(STORES.identities, next)
    this.identities.set(targetId, next)
    this.emit()
  }

  getIdentity(id: string | null | undefined): Identity | undefined {
    return id ? this.identities.get(id) : undefined
  }

  scansFor(identityId: string): OpticScan[] {
    return this.snapshot.scans.filter((s) => s.identityId === identityId)
  }

  /** Explicit, user-initiated reveal of a template for the Optic Lab viewer. */
  async inspectScan(scanId: string): Promise<OpticTemplate | null> {
    const { key } = await this.requireReady()
    const scan = this.scans.get(scanId)
    if (!scan) return null
    return this.templateCache.get(scanId) ?? unseal<OpticTemplate>(key, scan.sealed)
  }

  // ── Verification ─────────────────────────────────────────────────────────
  async verify(probe: BiometricSample[], policy: MatchPolicy = DEFAULT_MATCH_POLICY): Promise<IdentityVerification> {
    const { key, store } = await this.requireReady()
    const canonicalIds = new Map<string, string>()
    const canonical = (id: string) => {
      let c = canonicalIds.get(id)
      if (!c) {
        c = this.accountIds(id)
          .map((x) => this.identities.get(x)!)
          .sort((x, y) => x.createdAt - y.createdAt)[0].id
        canonicalIds.set(id, c)
      }
      return c
    }
    const candidates = []
    for (const scan of this.scans.values()) {
      const identity = this.identities.get(scan.identityId)
      if (!identity || identity.status !== 'active') continue
      let template = this.templateCache.get(scan.id)
      if (!template) {
        template = await unseal<OpticTemplate>(key, scan.sealed)
        this.templateCache.set(scan.id, template)
      }
      // Duplicate records of one person compete as one account, not as rivals.
      candidates.push({ identityId: canonical(scan.identityId), scanId: scan.id, template })
    }
    const result: IdentificationResult = identify(probe, candidates, policy)

    if (result.status === 'verified') {
      const scan = this.scans.get(result.match.scanId)!
      const next = { ...scan, matchCount: scan.matchCount + 1, lastMatchedAt: Date.now() }
      this.scans.set(scan.id, next)
      store.put(STORES.scans, next).then(() => this.emit())
      return {
        status: 'verified',
        identity: this.identities.get(result.match.identityId)!,
        scanId: result.match.scanId,
        confidence: result.match.score.similarity,
        distance: result.match.score.components.embeddingDistance,
        components: result.match.score.components,
        probeCount: result.probeCount,
      }
    }
    if (result.status === 'not-recognized') {
      return {
        status: 'not-recognized',
        confidence: result.best?.score.similarity ?? 0,
        distance: result.best?.score.components.embeddingDistance ?? null,
        probeCount: result.probeCount,
      }
    }
    return { status: 'unable', reason: result.reason, probeCount: result.probeCount }
  }
}

export const identityService = new IdentityService()
