/**
 * Cross-device enrollment sync. Your enrolled eye templates follow you to every
 * linked device so you never re-enroll. The raw biometric never leaves a device
 * in the clear: templates are re-encrypted with an AES-GCM key DERIVED from your
 * account_key (which only your linked devices hold), then stored as opaque
 * ciphertext in Supabase. The server can't derive the key or read the template.
 */
import { identityService } from '../../core/identity/IdentityService'
import { accountKey } from './devices'
import { sb } from './supabase'

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

/** Deterministic AES-GCM key from the account_key (same on every linked device). */
async function syncKey(): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(accountKey()), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('optic-enrollment-sync-v1'), iterations: 100_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encrypt(key: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)))
  return JSON.stringify({ iv: b64(iv), data: b64(data) })
}
async function decrypt<T>(key: CryptoKey, payload: string): Promise<T | null> {
  try {
    const { iv, data } = JSON.parse(payload) as { iv: string; data: string }
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(data))
    return JSON.parse(new TextDecoder().decode(plain)) as T
  } catch {
    return null
  }
}

/** Upload every local enrollment, encrypted, so linked devices can restore it. */
export async function pushEnrollments(): Promise<number> {
  const entries = await identityService.exportForSync()
  if (entries.length === 0) return 0
  const key = await syncKey()
  const ak = accountKey()
  const rows = await Promise.all(
    entries.map(async (e) => ({ id: e.identity.id, account_key: ak, payload: await encrypt(key, e), updated_at: new Date().toISOString() })),
  )
  await sb().from('enrollments').upsert(rows, { onConflict: 'id' })
  return rows.length
}

/** Download + import enrollments for the current account_key. Returns scans added. */
export async function pullEnrollments(): Promise<number> {
  const key = await syncKey()
  const { data } = await sb().from('enrollments').select('payload').eq('account_key', accountKey())
  if (!data?.length) return 0
  let added = 0
  for (const row of data) {
    const entry = await decrypt<Parameters<typeof identityService.importFromSync>[0]>(key, (row as { payload: string }).payload)
    if (entry?.identity && Array.isArray(entry.scans)) added += await identityService.importFromSync(entry)
  }
  return added
}
