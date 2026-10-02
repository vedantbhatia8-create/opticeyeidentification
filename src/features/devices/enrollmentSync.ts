/**
 * Automatic enrollment sync. Enroll once on any browser and you're recognized
 * on every browser — no pairing, no steps. Your eye templates are re-encrypted
 * with a fixed app key and stored in Supabase; every browser pulls them on load
 * and imports them, so the glance recognizes you anywhere.
 *
 * Prototype note: the encryption key is a constant shipped in the client, so
 * this protects the data at rest in the database, not against someone who loads
 * the app. That is the deliberate tradeoff for "recognized on any browser with
 * no login or pairing."
 */
import { identityService } from '../../core/identity/IdentityService'
import { sb } from './supabase'

/** One shared workspace so any browser sees every enrollment. */
const WORKSPACE = 'optic-global-v1'
const APP_SECRET = 'optic-access-enrollment-workspace-key-v1'

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

let keyPromise: Promise<CryptoKey> | null = null
function syncKey(): Promise<CryptoKey> {
  keyPromise ??= (async () => {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(APP_SECRET), 'PBKDF2', false, ['deriveKey'])
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: new TextEncoder().encode('optic-enrollment-sync-v1'), iterations: 100_000, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
  })()
  return keyPromise
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

/** Upload every local enrollment so other browsers can recognize this person. */
export async function pushEnrollments(): Promise<number> {
  try {
    const entries = await identityService.exportForSync()
    if (entries.length === 0) return 0
    const key = await syncKey()
    const rows = await Promise.all(
      entries.map(async (e) => ({ id: e.identity.id, account_key: WORKSPACE, payload: await encrypt(key, e), updated_at: new Date().toISOString() })),
    )
    const { error } = await sb().from('enrollments').upsert(rows, { onConflict: 'id' })
    if (error) {
      console.warn('[optic] enrollment push failed:', error.message)
      return 0
    }
    return rows.length
  } catch (err) {
    console.warn('[optic] enrollment push error:', err)
    return 0
  }
}

/** Download every enrollment and import it locally so the glance recognizes anyone enrolled. */
export async function pullEnrollments(): Promise<number> {
  try {
    const key = await syncKey()
    const { data, error } = await sb().from('enrollments').select('payload').eq('account_key', WORKSPACE)
    if (error) {
      console.warn('[optic] enrollment pull failed:', error.message)
      return 0
    }
    if (!data?.length) return 0
    let added = 0
    for (const row of data) {
      const entry = await decrypt<Parameters<typeof identityService.importFromSync>[0]>(key, (row as { payload: string }).payload)
      if (entry?.identity && Array.isArray(entry.scans)) added += await identityService.importFromSync(entry)
    }
    return added
  } catch (err) {
    console.warn('[optic] enrollment pull error:', err)
    return 0
  }
}
