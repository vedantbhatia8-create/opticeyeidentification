// RFC 6238 TOTP (time-based one-time passwords). SHA-1, 6 digits, 30s period
// by default — the scheme every authenticator app (Google Authenticator, Authy,
// GitHub, etc.) uses. The secret is base32. All on-device; nothing leaves.

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const c of clean) {
    const idx = B32.indexOf(c)
    if (idx < 0) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

export interface TotpConfig {
  period?: number
  digits?: number
  at?: number
}

export async function totp(secretBase32: string, cfg: TotpConfig = {}): Promise<string> {
  const period = cfg.period ?? 30
  const digits = cfg.digits ?? 6
  const counter = Math.floor((cfg.at ?? Date.now()) / 1000 / period)
  const keyBytes = base32Decode(secretBase32)
  if (keyBytes.length === 0) return ''.padStart(digits, '•')
  const key = await crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const msg = new ArrayBuffer(8)
  // Counter fits in the low 32 bits until the year ~4000, so the high word is 0.
  new DataView(msg).setUint32(4, counter)
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg))
  const offset = sig[sig.length - 1] & 0x0f
  const bin = ((sig[offset] & 0x7f) << 24) | (sig[offset + 1] << 16) | (sig[offset + 2] << 8) | sig[offset + 3]
  return String(bin % 10 ** digits).padStart(digits, '0')
}

/** Seconds left in the current step, for the countdown ring. */
export function secondsRemaining(period = 30, at = Date.now()): number {
  return period - (Math.floor(at / 1000) % period)
}

/** Accepts an otpauth:// URI (from a QR code) or a bare base32 secret. */
export function parseOtpauth(input: string): { secret: string; issuer?: string; label?: string; period?: number; digits?: number } | null {
  const text = input.trim()
  if (/^otpauth:\/\//i.test(text)) {
    try {
      const u = new URL(text)
      const secret = u.searchParams.get('secret')
      if (!secret) return null
      const path = decodeURIComponent(u.pathname.replace(/^\/+/, '').replace(/^totp\//i, ''))
      const issuer = u.searchParams.get('issuer') || (path.includes(':') ? path.split(':')[0] : undefined)
      const label = path.includes(':') ? path.split(':').slice(1).join(':') : path || undefined
      return {
        secret,
        issuer: issuer || undefined,
        label: label || undefined,
        period: u.searchParams.get('period') ? Number(u.searchParams.get('period')) : undefined,
        digits: u.searchParams.get('digits') ? Number(u.searchParams.get('digits')) : undefined,
      }
    } catch {
      return null
    }
  }
  const bare = text.toUpperCase().replace(/[^A-Z2-7]/g, '')
  return bare.length >= 8 ? { secret: bare } : null
}
