import { Check, ShieldAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useStore } from '../../state/store'
import { useIdentities } from '../sensor/hooks'
import { OpticTerminal } from '../sensor/OpticTerminal'
import { TerminalShell } from '../sensor/TerminalShell'

/**
 * Glance check opened by the Optic Access browser extension before a
 * "Sign in with Google". The result is posted to this window; the extension's
 * bridge script (present only on this origin) relays it to the extension,
 * which matches it against the nonce it issued.
 */
export function VerifyPage() {
  const [params] = useSearchParams()
  const nonce = params.get('nonce') ?? ''
  const site = params.get('site') ?? ''
  const setDemo = useStore((s) => s.setDemo)
  const { ready, identities } = useIdentities()
  const [done, setDone] = useState<null | { ok: boolean; name?: string }>(null)
  const posted = useRef(false)
  const hasExtension = typeof document !== 'undefined' && !!document.documentElement.dataset.opticExtension
  const real = identities.filter((i) => !i.synthetic && i.status === 'active')

  // Only real eyes count here: never a demo person or the simulated sensor.
  useEffect(() => {
    setDemo({ enabled: false, subject: null })
  }, [setDemo])

  const post = (result: { ok: boolean; name?: string; email?: string; reason?: string }) => {
    if (posted.current || !nonce) return
    posted.current = true
    window.postMessage({ source: 'optic-access', type: 'verify-result', nonce, ...result }, window.location.origin)
    setDone({ ok: result.ok, name: result.name })
  }

  const returnHere = `/verify?${params.toString()}`

  return (
    <TerminalShell location={site ? `Verify · ${site}` : 'Verify · Google sign-in'} exitTo="/">
      {!nonce || !hasExtension ? (
        <Notice
          title="Nothing to verify"
          body="This page is opened by the Optic Access extension when a website asks you to sign in with Google."
          action={<Link to="/apps/extension" className="text-accent underline">Get the extension</Link>}
        />
      ) : ready && real.length === 0 ? (
        <Notice
          title="Create your Optic account first"
          body="Enroll your eyes once. Then this window can verify you before every Google sign-in."
          action={
            <Link to={`/lab/enroll?return=${encodeURIComponent(returnHere)}`} className="btn-glow flex h-11 items-center rounded-2xl px-6 text-[14px] font-semibold">
              Sign up with a glance
            </Link>
          }
        />
      ) : done ? (
        <Notice
          icon={done.ok ? <Check className="size-6" /> : <ShieldAlert className="size-6" />}
          tone={done.ok ? 'ok' : 'bad'}
          title={done.ok ? `Verified${done.name ? ` · ${done.name}` : ''}` : 'Google sign-in blocked'}
          body={done.ok ? 'Returning you to Google. This window closes by itself.' : 'You can close this window.'}
        />
      ) : (
        <>
          <div className="mt-1 mb-2 max-w-md text-center text-[13.5px] text-white/60">
            {site ? <b className="text-white">{site}</b> : 'A website'} wants you to sign in with Google. Look at the camera to continue.
          </div>
          <OpticTerminal
            className="mt-2"
            onDecision={(d) => {
              if (d.outcome === 'granted' && d.identity.status === 'verified' && !d.identity.identity.synthetic) {
                const { name, email } = d.identity.identity
                setTimeout(() => post({ ok: true, name, email }), 900)
              }
            }}
          />
          <button
            type="button"
            onClick={() => post({ ok: false, reason: 'Verification cancelled.' })}
            className="mt-6 text-[13px] text-white/45 underline-offset-4 hover:text-white/80 hover:underline"
            data-testid="verify-cancel"
          >
            Cancel and block this sign-in
          </button>
        </>
      )}
    </TerminalShell>
  )
}

function Notice({ title, body, action, icon, tone }: { title: string; body: string; action?: React.ReactNode; icon?: React.ReactNode; tone?: 'ok' | 'bad' }) {
  return (
    <div className="mt-16 flex max-w-md flex-col items-center text-center" data-testid="verify-notice">
      {icon && (
        <div
          className={
            tone === 'ok'
              ? 'flex size-14 items-center justify-center rounded-full border border-granted/40 bg-granted/10 text-granted shadow-[0_0_30px_-6px_rgba(61,220,151,0.7)]'
              : 'flex size-14 items-center justify-center rounded-full border border-denied/40 bg-denied/10 text-denied'
          }
        >
          {icon}
        </div>
      )}
      <h1 className="mt-5 text-[24px] font-semibold tracking-tight text-white">{title}</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-white/60">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
