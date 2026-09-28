/**
 * Template sealing. Templates are encrypted with AES-GCM using a
 * non-extractable key generated in, and bound to, this browser profile.
 * The key material can be used by this origin but never read out.
 *
 * Production note: a real deployment would keep templates in a server-side
 * vault or secure element with KMS-managed keys, or match on-device only.
 */
import { STORES, type KeyValueStore } from './db'

export interface Sealed {
  iv: string
  data: string
}

const KEY_ID = 'template-key-v1'

const toB64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export async function loadOrCreateKey(store: KeyValueStore): Promise<CryptoKey> {
  const existing = await store.get<CryptoKey>(STORES.keys, KEY_ID)
  if (existing) return existing
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await store.put(STORES.keys, key, KEY_ID)
  return key
}

export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plain = new TextEncoder().encode(JSON.stringify(value))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
  return { iv: toB64(iv), data: toB64(data) }
}

export async function unseal<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(sealed.iv) }, key, fromB64(sealed.data))
  return JSON.parse(new TextDecoder().decode(plain)) as T
}

/** Short non-reversible fingerprint of the sealed template, safe to show operators. */
export async function fingerprint(sealed: Sealed): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sealed.data))
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
