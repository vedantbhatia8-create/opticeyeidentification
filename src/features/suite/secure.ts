/**
 * Sealed storage for Optic apps.
 *
 * Vault: each identity's vault key is random and is wrapped with a key
 * derived from their PIN (PBKDF2-SHA256, 310k iterations). The glance is an
 * access gate; the PIN is the cryptographic factor — biometrics are not
 * secret and must never be used as an encryption key on their own.
 *
 * Eyes-Only documents: sealed with a non-extractable device key; access is
 * gated by identity verification and continuous presence.
 */
import { seal, unseal, type Sealed } from '../../core/identity/crypto'
import { openStore, STORES, type KeyValueStore } from '../../core/identity/db'

let storePromise: Promise<KeyValueStore> | null = null
const store = () => (storePromise ??= openStore())

const enc = new TextEncoder()
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const rid = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`

// ── Vault ──────────────────────────────────────────────────────────────────

interface VaultMeta {
  id: string
  kind: 'vault-meta'
  ownerId: string
  salt: string
  wrapped: Sealed
  createdAt: number
}

interface SealedRecord {
  id: string
  kind: 'vault-item' | 'doc'
  ownerId: string
  updatedAt: number
  sealed: Sealed
}

export interface VaultItem {
  id: string
  type: 'login' | 'note'
  title: string
  username?: string
  password?: string
  url?: string
  body?: string
  updatedAt: number
}

export class WrongPinError extends Error {}
export class LockedOutError extends Error {}

const metaId = (identityId: string) => `vaultmeta:${identityId}`
const failures = new Map<string, { count: number; until: number }>()

async function kekFromPin(pin: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 310_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function importVaultKey(raw: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  raw.fill(0)
  return key
}

export async function hasVault(identityId: string) {
  return !!(await (await store()).get<VaultMeta>(STORES.suite, metaId(identityId)))
}

export async function createVault(identityId: string, pin: string): Promise<CryptoKey> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const raw = crypto.getRandomValues(new Uint8Array(32))
  const kek = await kekFromPin(pin, salt)
  const wrapped = await seal(kek, b64(raw))
  const meta: VaultMeta = { id: metaId(identityId), kind: 'vault-meta', ownerId: identityId, salt: b64(salt), wrapped, createdAt: Date.now() }
  await (await store()).put(STORES.suite, meta)
  return importVaultKey(raw)
}

export async function unlockVault(identityId: string, pin: string): Promise<CryptoKey> {
  const f = failures.get(identityId)
  if (f && f.until > Date.now()) throw new LockedOutError(`Too many attempts. Try again in ${Math.ceil((f.until - Date.now()) / 1000)} s.`)
  const meta = await (await store()).get<VaultMeta>(STORES.suite, metaId(identityId))
  if (!meta) throw new Error('No vault for this identity.')
  try {
    const kek = await kekFromPin(pin, unb64(meta.salt))
    const raw = unb64(await unseal<string>(kek, meta.wrapped))
    failures.delete(identityId)
    return importVaultKey(raw)
  } catch {
    const count = (f?.count ?? 0) + 1
    failures.set(identityId, { count, until: count >= 5 ? Date.now() + 30_000 * (count - 4) : 0 })
    throw new WrongPinError('Incorrect PIN.')
  }
}

export async function listVaultItems(identityId: string, key: CryptoKey): Promise<VaultItem[]> {
  const all = await (await store()).getAll<SealedRecord>(STORES.suite)
  const mine = all.filter((r) => r.kind === 'vault-item' && r.ownerId === identityId)
  const items = await Promise.all(mine.map((r) => unseal<VaultItem>(key, r.sealed)))
  return items.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveVaultItem(identityId: string, key: CryptoKey, item: Omit<VaultItem, 'id' | 'updatedAt'> & { id?: string }) {
  const full: VaultItem = { ...item, id: item.id ?? rid('vi'), updatedAt: Date.now() }
  const record: SealedRecord = { id: full.id, kind: 'vault-item', ownerId: identityId, updatedAt: full.updatedAt, sealed: await seal(key, full) }
  await (await store()).put(STORES.suite, record)
  return full
}

export async function deleteVaultItem(id: string) {
  await (await store()).delete(STORES.suite, id)
}

export async function destroyVault(identityId: string) {
  const s = await store()
  for (const r of await s.getAll<SealedRecord | VaultMeta>(STORES.suite)) {
    if (r.ownerId === identityId && (r.kind === 'vault-item' || r.kind === 'vault-meta')) await s.delete(STORES.suite, r.id)
  }
}

// ── Eyes-Only documents ────────────────────────────────────────────────────

export interface OpticDoc {
  id: string
  kind: 'doc'
  ownerId: string
  ownerName: string
  title: string
  hideTitle: boolean
  contentType: 'text' | 'image'
  recipients: string[]
  createdAt: number
  expiresAt: number | null
  maxViews: number | null
  views: number
  revoked: boolean
  sealed: Sealed
}

export interface DocContent {
  text?: string
  image?: string
  fileName?: string
}

const DOC_KEY_ID = 'suite-doc-key-v1'

async function docKey(): Promise<CryptoKey> {
  const s = await store()
  const existing = await s.get<CryptoKey>(STORES.keys, DOC_KEY_ID)
  if (existing) return existing
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await s.put(STORES.keys, key, DOC_KEY_ID)
  return key
}

export async function listDocs(): Promise<Omit<OpticDoc, 'sealed'>[]> {
  const all = await (await store()).getAll<OpticDoc>(STORES.suite)
  return all
    .filter((r) => r.kind === 'doc')
    .map(({ sealed: _s, ...meta }) => meta)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function getDoc(id: string): Promise<Omit<OpticDoc, 'sealed'> | null> {
  const d = await (await store()).get<OpticDoc>(STORES.suite, id)
  if (!d || d.kind !== 'doc') return null
  const { sealed: _s, ...meta } = d
  return meta
}

export async function createDoc(input: Omit<OpticDoc, 'id' | 'kind' | 'createdAt' | 'views' | 'revoked' | 'sealed'>, content: DocContent) {
  const doc: OpticDoc = {
    ...input,
    id: rid('doc'),
    kind: 'doc',
    createdAt: Date.now(),
    views: 0,
    revoked: false,
    sealed: await seal(await docKey(), content),
  }
  await (await store()).put(STORES.suite, doc)
  return doc.id
}

export async function updateDoc(id: string, patch: Partial<Pick<OpticDoc, 'revoked' | 'recipients' | 'expiresAt' | 'maxViews'>>) {
  const s = await store()
  const d = await s.get<OpticDoc>(STORES.suite, id)
  if (d) await s.put(STORES.suite, { ...d, ...patch })
}

/** Decrypts content and counts the view. Callers must have authorized the viewer first. */
export async function openDoc(id: string): Promise<DocContent | null> {
  const s = await store()
  const d = await s.get<OpticDoc>(STORES.suite, id)
  if (!d) return null
  await s.put(STORES.suite, { ...d, views: d.views + 1 })
  return unseal<DocContent>(await docKey(), d.sealed)
}

export async function deleteDoc(id: string) {
  await (await store()).delete(STORES.suite, id)
}

export async function purgeSuiteSecrets() {
  await (await store()).clear(STORES.suite)
}
