import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
        <div className="text-[12.5px] text-white/40">Already have an account? Just look at the sensor.</div>
      </div>
    </TerminalShell>
  )
}
