import { describe, expect, it } from 'vitest'
import { base32Decode, parseOtpauth, secondsRemaining, totp } from './totp'

// RFC 6238 test vector: secret = ASCII "12345678901234567890" (base32 below), SHA-1.
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

describe('totp', () => {
  it('base32 decodes to the known ASCII secret', () => {
    expect(new TextDecoder().decode(base32Decode(SECRET))).toBe('12345678901234567890')
  })

  it('matches RFC 6238 vectors (6 digits)', async () => {
    expect(await totp(SECRET, { at: 59_000 })).toBe('287082')
    expect(await totp(SECRET, { at: 1111111109_000 })).toBe('081804')
    expect(await totp(SECRET, { at: 1234567890_000 })).toBe('005924')
  })

  it('countdown stays within the period', () => {
    const r = secondsRemaining(30, 59_000)
    expect(r).toBeGreaterThan(0)
    expect(r).toBeLessThanOrEqual(30)
  })

  it('parses otpauth URIs and bare secrets', () => {
    const p = parseOtpauth('otpauth://totp/GitHub:vedant?secret=' + SECRET + '&issuer=GitHub')
    expect(p?.secret).toBe(SECRET)
    expect(p?.issuer).toBe('GitHub')
    expect(parseOtpauth(SECRET)?.secret).toBe(SECRET)
    expect(parseOtpauth('nope')).toBeNull()
  })
})
