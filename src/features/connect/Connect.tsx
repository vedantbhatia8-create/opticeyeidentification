import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useStore } from '../../state/store'
import { OpticTerminal } from '../sensor/OpticTerminal'
import { TerminalShell } from '../sensor/TerminalShell'
import { keyFor, safeReturnUrl, signChallenge } from './keys'

/**
 * "Sign in with Optic" for other apps, e.g. Quanta on http://localhost:5070.
 *   /connect?app=Quanta&return=<callback url>&nonce=<one-time challenge>
 * After a live optic match (Demo Mode is switched off and synthetic personas are refused)
 * the browser signs `optic-connect|<app origin>|<nonce>` with a device key and returns to
 * the callback with the signature and public key. The app verifies it server-side.
 */
export function Connect() {
  const [params] = useSearchParams()
  const app = (params.get('app') ?? 'An app').slice(0, 40)
  const nonce = params.get('nonce') ?? ''
  const ret = safeReturnUrl(params.get('return'))
  const [error, setError] = useState<string | null>(null)
  const done = useRef(false)
  const here = useLocation()

  // Demo personas must never be able to unlock a real app.
  useEffect(() => {
    useStore.getState().setDemo({ enabled: false, subject: null })
  }, [])

  const bad = !ret ? 'This link has an invalid return address.' : !/^[A-Za-z0-9_-]{16,128}$/.test(nonce) ? 'This link is missing its security code.' : null

  return (
    <TerminalShell location={`Sign in to ${app} with Optic`} exitTo="/">
      {bad ? (
        <div className="mx-auto mt-10 max-w-md text-center text-[15px] text-denied">{bad}</div>
      ) : (
        <>
          <div className="mx-auto mb-4 max-w-xl text-center text-[14px] text-white/60">
            <span className="text-white/90">{app}</span> is asking you to verify your identity. You'll be sent back to{' '}
            <span className="font-mono text-white/80">{ret!.host}</span>.
          </div>
          <OpticTerminal
            className="mt-2"
            onDecision={async (d) => {
              if (done.current) return
              if (d.outcome !== 'granted' || d.identity.status !== 'verified') return
              const who = d.identity.identity
              if (who.synthetic || who.origin === 'demo' || useStore.getState().demo.enabled) {
                setError('Demo personas can’t sign in to other apps. Use your own enrolled eyes.')
                return
              }
              done.current = true
              try {
                const key = await keyFor(ret!.origin, who.id)
                const sig = await signChallenge(key, `optic-connect|${ret!.origin}|${nonce}`)
                const back = new URL(ret!.toString())
                back.searchParams.set('nonce', nonce)
                back.searchParams.set('sig', sig)
                back.searchParams.set('pub', btoa(JSON.stringify({ x: key.publicJwk.x, y: key.publicJwk.y })))
                back.searchParams.set('name', who.name)
                setTimeout(() => window.location.assign(back.toString()), 1100)
              } catch (e) {
                done.current = false
                setError(`Couldn't sign the response: ${(e as Error).message}`)
              }
            }}
          />
          {error && <div className="mt-4 text-center text-[14px] text-denied">{error}</div>}
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <Link
              to={`/lab/enroll?return=${encodeURIComponent(here.pathname + here.search)}`}
              className="flex h-11 items-center rounded-xl bg-white px-6 text-[14px] font-semibold text-black hover:bg-white/90"
            >
              New here? Create your Optic account
            </Link>
            <div className="text-[12.5px] text-white/40">Already enrolled on this browser? Just look at the sensor.</div>
          </div>
        </>
      )}
    </TerminalShell>
  )
}
