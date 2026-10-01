/**
 * Device keys for "Sign in with Optic" on other apps (relying parties).
 * One ECDSA P-256 key pair per relying-party origin, created on first use and stored
 * in IndexedDB as a non-extractable CryptoKey: the private key can sign but can never
 * be read out of the browser. We only sign after a live, non-demo optic verification.
 */
const DB = 'optic-connect'
const STORE = 'rp-keys'

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  })
}

interface StoredKey { privateKey: CryptoKey; publicJwk: JsonWebKey; identityId: string; createdAt: number }

/** Key pair bound to this relying party and this enrolled identity. */
export async function keyFor(rpOrigin: string, identityId: string): Promise<StoredKey> {
  const id = `${rpOrigin}|${identityId}`
  const existing = await idb<StoredKey | undefined>('readonly', (s) => s.get(id))
  if (existing) return existing
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  const rec: StoredKey = { privateKey: pair.privateKey, publicJwk, identityId, createdAt: Date.now() }
  await idb('readwrite', (s) => s.put(rec, id))
  return rec
}

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Signs the relying party's one-time challenge. Signature is raw r||s (64 bytes), base64url. */
export async function signChallenge(key: StoredKey, message: string): Promise<string> {
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key.privateKey, new TextEncoder().encode(message))
  return b64url(sig)
}

/** Only hand identities back to apps running on this computer or over HTTPS. */
export function safeReturnUrl(raw: string | null): URL | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    const local = u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
    return local || u.protocol === 'https:' ? u : null
  } catch {
    return null
  }
}
