/**
 * Optic Connect — connecting your own apps to Optic Access with a code.
 *
 * You register an app here and get a connection code (optic_live_…). You paste
 * that code into your app (via the drop-in script or its /optic page). When your
 * app asks someone to verify, Optic runs a real glance and signs a challenge
 * bound to BOTH your app's origin and this code, so a code only works from the
 * origin you registered it for.
 */
import type { Connection } from '../../state/store'

const B32 = 'abcdefghijklmnopqrstuvwxyz234567'

/** A readable, unguessable code: optic_live_<24 base32 chars>. */
export function generateCode(): string {
  const buf = crypto.getRandomValues(new Uint8Array(15))
  let out = ''
  for (const b of buf) out += B32[b & 31] + B32[(b >> 3) & 31]
  return `optic_live_${out.slice(0, 24)}`
}

/** Normalize a URL to its origin (scheme + host + port). Returns null if unusable. */
export function toOrigin(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  try {
    return new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`).origin
  } catch {
    return null
  }
}

export function newConnection(name: string, origin: string): Connection {
  return {
    id: `conn_${crypto.randomUUID().slice(0, 8)}`,
    code: generateCode(),
    name: name.trim() || 'My app',
    origin,
    createdAt: Date.now(),
    lastUsedAt: null,
    revoked: false,
  }
}
