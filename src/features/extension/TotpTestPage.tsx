import { Check, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Backdrop } from '../../ui/Backdrop'
import { LogoMark } from '../../ui/Logo'
import { cx } from '../../ui/primitives'
import { secondsRemaining, totp } from '../suite/totp'

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function randomSecret(bytes = 20): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes))
  let bits = 0
  let value = 0
  let out = ''
  for (const b of buf) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

/**
 * A stand-in for a real website's two-factor screen, so you can test Optic
 * Authenticator honestly. It generates a secret for you to add to Optic, then
 * verifies whatever code you type by INDEPENDENTLY computing the valid TOTP
 * from that secret and the current time (RFC 6238, ±1 step like real servers).
 * It never reads Optic's displayed code.
 */
export function TotpTestPage() {
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [result, setResult] = useState<null | { ok: boolean; note: string }>(null)
  const [left, setLeft] = useState(30)
  const [attempts, setAttempts] = useState<{ code: string; ok: boolean; at: number }[]>([])

  useEffect(() => setSecret(randomSecret()), [])
  useEffect(() => {
    const t = setInterval(() => setLeft(secondsRemaining(30)), 1000)
    return () => clearInterval(t)
  }, [])

  const otpauth = useMemo(() => `otpauth://totp/Optic%20Test:you?secret=${secret}&issuer=Optic%20Test`, [secret])

  const verify = async () => {
    const entered = code.replace(/\s/g, '')
    if (!/^\d{6}$/.test(entered)) {
      setResult({ ok: false, note: 'Enter the 6-digit code from Optic Authenticator.' })
      return
    }
    // Independent check: compute the valid codes for the previous, current and next
    // 30s step straight from the shared secret — the same way a real 2FA server does.
    const now = Date.now()
    const valid = await Promise.all([-1, 0, 1].map((k) => totp(secret, { at: now + k * 30_000 })))
    const ok = valid.includes(entered)
    setResult({
      ok,
      note: ok ? 'Correct — that is a valid live code for this secret right now.' : 'Not a valid code for this moment. Check you added this exact secret, and try the current code.',
    })
    setAttempts((a) => [{ code: entered, ok, at: now }, ...a].slice(0, 6))
    setCode('')
  }

  const copy = (v: string) => navigator.clipboard.writeText(v).catch(() => {})

  return (
    <div className="dark relative isolate min-h-screen bg-bg text-ink">
      <Backdrop />
      <div className="relative mx-auto flex max-w-xl flex-col gap-5 px-5 py-14">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-7 text-accent [--logo-fg:var(--bg)]" />
          <span className="font-mono text-[11px] tracking-[0.2em] text-accent-text uppercase">Authenticator test</span>
        </div>
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em]">A pretend website that wants your 2FA code</h1>
        <p className="text-[14px] leading-relaxed text-muted">
          This page checks your code the honest way: it computes the valid code itself from the secret below and the current time, like a
          real server. It does not look at Optic.
        </p>

        {/* Step 1 */}
        <div className="glass hairline rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[11px] tracking-[0.18em] text-accent-text uppercase">1 · Add this to Optic Authenticator</div>
            <button onClick={() => { setSecret(randomSecret()); setResult(null); setAttempts([]) }} className="flex items-center gap-1 text-[12px] text-muted hover:text-ink" data-testid="totp-regen">
              <RefreshCw className="size-3.5" /> New secret
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-line bg-surface-2/70 px-3 py-2 font-mono text-[13px]" data-testid="totp-secret">
              {secret}
            </code>
            <button onClick={() => copy(secret)} className="rounded-lg border border-line px-3 py-2 text-[12px] hover:border-accent/40">Copy</button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-line bg-surface-2/70 px-3 py-2 font-mono text-[11.5px] text-muted">{otpauth}</code>
            <button onClick={() => copy(otpauth)} className="rounded-lg border border-line px-3 py-2 text-[12px] hover:border-accent/40">Copy link</button>
          </div>
          <p className="mt-3 text-[12.5px] text-muted">
            Open <Link to="/apps/auth" className="text-accent-text underline" target="_blank">Optic Authenticator</Link> → Add code → paste either value.
          </p>
        </div>

        {/* Step 2 */}
        <div className="glass hairline rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[11px] tracking-[0.18em] text-accent-text uppercase">2 · Enter the code Optic shows</div>
            <span className="font-mono text-[11px] text-subtle">resets in {left}s</span>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && verify()}
              inputMode="numeric"
              maxLength={7}
              placeholder="123 456"
              className="h-12 flex-1 rounded-xl border border-line bg-surface-2/70 px-4 text-center font-mono text-[20px] tracking-[0.3em] outline-none focus:border-accent/60"
              data-testid="totp-input"
            />
            <button onClick={verify} className="btn-glow rounded-xl px-5 text-[14px] font-semibold" data-testid="totp-verify">
              Verify
            </button>
          </div>
          {result && (
            <div
              className={cx(
                'mt-3 flex items-center gap-2 rounded-xl border px-4 py-3 text-[13.5px]',
                result.ok ? 'border-granted/40 bg-granted/10 text-granted' : 'border-denied/40 bg-denied/10 text-denied',
              )}
              data-testid="totp-result"
              data-ok={result.ok}
            >
              {result.ok ? <Check className="size-4" /> : <X className="size-4" />} {result.note}
            </div>
          )}
          {result?.ok && (
            <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted">
              <ShieldCheck className="size-4 text-ok" /> That proves the code is a real, time-based code — not a value copied from Optic.
            </div>
          )}
        </div>

        {attempts.length > 0 && (
          <div className="text-[12px] text-subtle">
            <div className="mb-1 font-mono tracking-[0.14em] uppercase">Attempts</div>
            {attempts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 font-mono">
                <span className={a.ok ? 'text-ok' : 'text-bad'}>{a.ok ? '✓' : '✗'}</span> {a.code} · {new Date(a.at).toLocaleTimeString()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
