import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
  const [sync, setSync] = useState<'syncing' | 'ready' | 'offline'>('syncing')

  // Pull every enrollment so this browser recognizes you even if you enrolled
  // somewhere else — no pairing, no steps.
  useEffect(() => {
    let alive = true
    pullEnrollments()
      .then(() => alive && setSync('ready'))
      .catch(() => alive && setSync('offline'))
    return () => {
      alive = false
    }
  }, [])

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
      <div className="mt-4 text-center text-[12px] text-white/45" data-testid="signin-sync">
        {sync === 'syncing' && 'Syncing your Optic account to this browser…'}
        {sync === 'ready' && 'Your account is synced to this browser. Look at the sensor.'}
        {sync === 'offline' && 'Could not reach your account to sync. You can still use accounts enrolled on this browser.'}
      </div>
      <div className="mt-5 flex flex-col items-center gap-3 text-center">
        <Link
          to="/lab/enroll?return=/apps/signin"
          className="flex h-11 items-center rounded-xl bg-white px-6 text-[14px] font-semibold text-black hover:bg-white/90"
          data-testid="create-account"
        >
          New here? Create your Optic account
        </Link>
        <div className="text-[12.5px] text-white/40">Enroll once — Optic then recognizes you on any browser automatically.</div>
      </div>
    </TerminalShell>
  )
}
