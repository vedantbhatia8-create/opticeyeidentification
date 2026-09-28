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
    if (identity) {
      identity = { ...identity, name: input.name || identity.name, email: input.email ?? identity.email, updatedAt: now }
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

  /** Removes every non-demo enrollment (used by "Reset prototype data"). */
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
    const candidates = []
    for (const scan of this.scans.values()) {
      const identity = this.identities.get(scan.identityId)
      if (!identity || identity.status !== 'active') continue
      let template = this.templateCache.get(scan.id)
      if (!template) {
        template = await unseal<OpticTemplate>(key, scan.sealed)
        this.templateCache.set(scan.id, template)
      }
      candidates.push({ identityId: scan.identityId, scanId: scan.id, template })
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
