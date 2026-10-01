import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { redeemPairing } from '../devices/devices'
import { pullEnrollments } from '../devices/enrollmentSync'
import { OpticTerminal } from '../sensor/OpticTerminal'
import { TerminalShell } from '../sensor/TerminalShell'
import { useSession, useSuite } from './store'

/** Sign in to Optic Apps with a glance — the same terminal as the doors. */
export function SignIn() {
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/apps'
  const navigate = useNavigate()
  const session = useSession()
  const log = useSuite((s) => s.log)

  useEffect(() => {
    if (session.identityId) navigate(next, { replace: true })
  }, [session.identityId, next, navigate])

  return (
    <TerminalShell location="Optic Apps · Sign in" exitTo="/">
      <OpticTerminal
        className="mt-2"
        onDecision={(d) => {
          if (d.outcome === 'granted' && d.identity.status === 'verified') {
            const { id, name } = d.identity.identity
            log({ app: 'suite', action: 'sign-in', detail: 'Signed in to Optic Apps', identityId: id, name, ok: true })
            setTimeout(() => useSession.getState().signIn(id, name), 1100)
          } else {
            log({ app: 'suite', action: 'sign-in', detail: 'Sign-in refused', identityId: null, name: 'Unknown person', ok: false })
          }
        }}
      />
      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <Link
          to="/lab/enroll?return=/apps/signin"
          className="flex h-11 items-center rounded-xl bg-white px-6 text-[14px] font-semibold text-black hover:bg-white/90"
          data-testid="create-account"
        >
          New here? Create your Optic account
        </Link>
        <LinkThisDevice />
        <div className="text-[12.5px] text-white/40">Already have an account on this device? Just look at the sensor.</div>
      </div>
    </TerminalShell>
  )
}

/**
 * On a fresh browser/device, restore your enrollment from another device using a
 * 6-digit code (Security → Devices → “Link a device” shows one). This imports
 * your encrypted eye template so the glance below recognizes you — no re-enroll.
 */
function LinkThisDevice() {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  const restore = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setState('error')
      setMsg('Enter the 6-digit code from your other device.')
      return
    }
    setState('working')
    setMsg('')
    try {
      const ok = await redeemPairing(code.trim())
      if (!ok) {
        setState('error')
        setMsg('That code is wrong or expired. Generate a fresh one on your other device.')
        return
      }
      const added = await pullEnrollments()
      setState('done')
      setMsg(added > 0 ? 'Restored your Optic account. Look at the sensor to sign in.' : 'Linked, but no enrollment was found to restore yet.')
    } catch {
      setState('error')
      setMsg('Could not reach your account. Check your connection and try again.')
    }
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="text-[12.5px] text-white/55 underline hover:text-white/80" data-testid="signin-link-device">
        New device? Link it with a code
      </button>
    )

  return (
    <div className="w-[min(340px,calc(100vw-3rem))] rounded-xl border border-white/15 bg-white/5 p-3 text-left">
      <div className="text-[12.5px] text-white/70">
        On a device where Optic already knows you, open <span className="text-white/90">Security → Devices → “Link a device”</span> and enter the 6-digit code here.
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && restore()}
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          className="h-10 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 text-center font-mono text-[18px] tracking-[0.3em] text-white outline-none focus:border-white/40"
          data-testid="signin-link-input"
        />
        <button
          onClick={restore}
          disabled={state === 'working'}
          className="h-10 rounded-lg bg-white px-4 text-[13px] font-semibold text-black hover:bg-white/90 disabled:opacity-60"
          data-testid="signin-link-redeem"
        >
          {state === 'working' ? 'Linking…' : 'Restore'}
        </button>
      </div>
      {msg && <div className={`mt-2 text-[12px] ${state === 'error' ? 'text-red-300' : 'text-emerald-300'}`} data-testid="signin-link-msg">{msg}</div>}
    </div>
  )
}
