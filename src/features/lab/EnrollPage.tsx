import { ArrowRight, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { IdentityOrigin } from '../../core/identity/types'
import { identityService } from '../../state/services'
import { useStore } from '../../state/store'
import { EnrollmentSession, type EnrollmentSubject } from '../sensor/EnrollmentSession'
import { TerminalShell } from '../sensor/TerminalShell'

type LinkTarget = { kind: 'employee' | 'guest' | 'visitor'; id: string }

/**
 * Shared enrollment page. Used by the Optic Lab and by the office / hotel
 * consoles ("Enroll Optic Identity"), which pass `for=employee:<id>` etc. so
 * the resulting identity is linked to that person.
 */
export function EnrollPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const returnTo = params.get('return') ?? '/lab'
  const existingIdentity = identityService.getIdentity(params.get('identity'))
  const target = useMemo<LinkTarget | null>(() => {
    const raw = params.get('for')
    if (!raw) return null
    const [kind, id] = raw.split(':')
    return kind === 'employee' || kind === 'guest' || kind === 'visitor' ? { kind, id } : null
  }, [params])

  const state = useStore()
  const person =
    target?.kind === 'employee'
      ? state.office.employees.find((e) => e.id === target.id)
      : target?.kind === 'visitor'
        ? state.office.visitors.find((v) => v.id === target.id)
        : target?.kind === 'guest'
          ? state.hotel.guests.find((g) => g.id === target.id)
          : undefined
  const origin: IdentityOrigin = target?.kind === 'guest' ? 'hotel' : target ? 'office' : 'lab'

  const [form, setForm] = useState({
    name: existingIdentity?.name ?? person?.name ?? '',
    email: existingIdentity?.email ?? person?.email ?? '',
    externalId: existingIdentity?.externalId ?? person?.id ?? '',
  })
  const [subject, setSubject] = useState<EnrollmentSubject | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-use the person's existing identity when they already have one (adds a scan).
  const linkedIdentityId = existingIdentity?.id ?? (person && 'identityId' in person ? person.identityId : null) ?? undefined
  const linkedIsSynthetic = identityService.getIdentity(linkedIdentityId)?.synthetic

  const begin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Name is required.')
    if (!target && !existingIdentity && !form.email.trim()) return setError('Email is required — it’s how your Optic account is identified.')
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid email address.')
    setError(null)
    setSubject({
      // Replacing a synthetic demo template with a real one creates a new, real identity.
      identityId: linkedIsSynthetic ? undefined : linkedIdentityId,
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      externalId: form.externalId.trim() || undefined,
      origin,
    })
  }

  const onComplete = ({ identity }: { identity: { id: string } }) => {
    setDone(true)
    if (!target) return
    const s = useStore.getState()
    if (target.kind === 'employee') {
      const e = s.office.employees.find((x) => x.id === target.id)
      if (e) s.upsertEmployee({ ...e, identityId: identity.id })
    } else if (target.kind === 'visitor') {
      const v = s.office.visitors.find((x) => x.id === target.id)
      if (v) s.upsertVisitor({ ...v, identityId: identity.id })
    } else {
      const g = s.hotel.guests.find((x) => x.id === target.id)
      if (g) s.upsertGuest({ ...g, identityId: identity.id })
    }
  }

  const location = target ? `Enroll · ${target.kind}` : existingIdentity ? 'Add optic scan' : 'Create account'
  const emailAccount = !existingIdentity && form.email.includes('@') ? identityService.findAccountByEmail(form.email) : undefined

  return (
    <TerminalShell location={location} exitTo={returnTo}>
      {!subject ? (
        <form onSubmit={begin} className="mt-10 w-full max-w-[440px]" data-testid="enroll-form">
          <div className="font-mono text-[11px] tracking-[0.26em] text-scan-accent uppercase">
            {existingIdentity ? 'Add a scan to your account' : person ? 'Link an Optic account' : 'Optic account'}
          </div>
          <h1 className="mt-3 text-[30px] font-semibold tracking-tight">
            {existingIdentity ? existingIdentity.name : person ? `Enroll ${person.name}` : 'Create your account'}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-white/55">
            You’ll be guided through five short looks. Takes about 20 seconds. Make sure your face is evenly lit.
          </p>
          <div className="mt-8 space-y-4">
            <DarkField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoFocus placeholder="Jane Appleseed" disabled={!!existingIdentity} testId="enroll-name" />
            <DarkField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="jane@company.com" type="email" disabled={!!existingIdentity} testId="enroll-email" />
            {emailAccount && (
              <div className="rounded-xl border border-granted/25 bg-granted/[0.06] px-4 py-3 text-[13px] text-white/75" data-testid="existing-account">
                Welcome back, <b className="text-white">{emailAccount.name}</b>. This email already has an Optic account — this
                enrollment adds another optic scan to it instead of creating a new account.
              </div>
            )}
            <DarkField label="User ID" value={form.externalId} onChange={(v) => setForm({ ...form, externalId: v })} placeholder="e.g. EMP-1042" disabled={!!existingIdentity} testId="enroll-userid" />
          </div>
          {error && <div className="mt-3 text-[13px] text-denied">{error}</div>}
          <button
            type="submit"
            className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-semibold text-black transition hover:bg-white/90"
            data-testid="enroll-start"
          >
            {existingIdentity || emailAccount ? 'Add optic scan' : person ? 'Enroll identity' : 'Create account'} <ArrowRight className="size-4" />
          </button>
          <div className="mt-5 flex items-start gap-2 text-[12px] leading-relaxed text-white/40">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            Video is processed in memory on this device and discarded. Only an encrypted numeric template is stored.
          </div>
        </form>
      ) : (
        <>
          <EnrollmentSession
            subject={subject}
            onComplete={onComplete}
            onCancel={() => navigate(returnTo)}
          />
          {done && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {target ? (
                <Link to={returnTo} className="flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-[14px] font-semibold text-black">
                  Continue <ArrowRight className="size-4" />
                </Link>
              ) : (
                <>
                  <Link to="/lab/authenticate" className="flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-[14px] font-semibold text-black" data-testid="go-authenticate">
                    Authenticate now <ArrowRight className="size-4" />
                  </Link>
                  <Link to="/apps/account" className="flex h-11 items-center rounded-xl border border-white/15 px-5 text-[14px] font-medium text-white/80" data-testid="go-account">
                    Open my account
                  </Link>
                </>
              )}
            </div>
          )}
        </>
      )}
    </TerminalShell>
  )
}

function DarkField({
  label,
  value,
  onChange,
  testId,
  ...rest
}: {
  label: string
  value: string
  onChange: (v: string) => void
  testId?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-white/70">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="h-11 w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-scan-accent/60 focus:bg-white/[0.06] disabled:opacity-60"
        {...rest}
      />
    </label>
  )
}
