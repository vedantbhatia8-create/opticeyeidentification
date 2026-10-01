import { Check, Copy, Eye, EyeOff, KeyRound, Lock, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../../state/store'
import { OpticTerminal } from '../sensor/OpticTerminal'
import { TerminalShell } from '../sensor/TerminalShell'
import { forgetVaultKey, hasVault, listVaultItems, rememberedVaultKey, rememberVaultKey, unlockVault, WrongPinError, type VaultItem } from './secure'

const IDLE_LOCK_MS = 60_000

type Phase =
  | { kind: 'scan' }
  | { kind: 'pin'; id: string; name: string }
  | { kind: 'no-vault'; name: string }
  | { kind: 'open'; id: string; name: string; items: VaultItem[] }

/** Quick passwords: one glance, then search and copy any password from your Vault. */
export function QuickPasswords() {
  const setDemo = useStore((s) => s.setDemo)
  const [phase, setPhase] = useState<Phase>({ kind: 'scan' })

  // Real eyes only: never a demo person.
  useEffect(() => setDemo({ enabled: false, subject: null }), [setDemo])

  const onVerified = async (id: string, name: string) => {
    const key = await rememberedVaultKey(id)
    if (key) {
      try {
        return setPhase({ kind: 'open', id, name, items: await listVaultItems(id, key) })
      } catch {
        await forgetVaultKey(id) // vault was re-created: fall back to the PIN once
      }
    }
    setPhase((await hasVault(id)) ? { kind: 'pin', id, name } : { kind: 'no-vault', name })
  }

  return (
    <TerminalShell location="Quick passwords" exitTo="/apps/vault">
      {phase.kind === 'scan' && (
        <>
          <div className="mt-1 mb-2 text-center text-[13.5px] text-white/60">Look at the camera to open your passwords.</div>
          <OpticTerminal
            className="mt-2"
            onDecision={(d) => {
              if (d.outcome === 'granted' && d.identity.status === 'verified' && !d.identity.identity.synthetic) {
                const { id, name } = d.identity.identity
                setTimeout(() => void onVerified(id, name), 700)
              }
            }}
          />
        </>
      )}
      {phase.kind === 'pin' && (
        <PinOnce
          name={phase.name}
          onUnlock={async (pin) => {
            const key = await unlockVault(phase.id, pin)
            await rememberVaultKey(phase.id, key)
            setPhase({ kind: 'open', id: phase.id, name: phase.name, items: await listVaultItems(phase.id, key) })
          }}
        />
      )}
      {phase.kind === 'no-vault' && (
        <div className="mt-16 max-w-md text-center">
          <h1 className="text-[24px] font-semibold text-white">No vault yet, {phase.name.split(' ')[0]}</h1>
          <p className="mt-2 text-[14px] text-white/60">Create your Optic Vault and add a password, then come back here.</p>
          <Link to="/apps/vault" className="btn-glow mt-6 inline-flex h-11 items-center rounded-2xl px-6 text-[14px] font-semibold">
            Open Vault
          </Link>
        </div>
      )}
      {phase.kind === 'open' && <PasswordList name={phase.name} items={phase.items} onLock={() => setPhase({ kind: 'scan' })} />}
    </TerminalShell>
  )
}

function PinOnce({ name, onUnlock }: { name: string; onUnlock: (pin: string) => Promise<void> }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="mt-12 w-full max-w-sm text-center"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        try {
          await onUnlock(pin)
        } catch (err) {
          setError(err instanceof WrongPinError ? 'Wrong PIN.' : err instanceof Error ? err.message : 'Could not unlock.')
          setBusy(false)
        }
      }}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-accent/30 bg-accent-soft text-accent shadow-[var(--glow)]">
        <KeyRound className="size-5" />
      </div>
      <h1 className="mt-5 text-[22px] font-semibold text-white">Verified · {name.split(' ')[0]}</h1>
      <p className="mt-2 text-[13.5px] text-white/60">Enter your Vault PIN once. After this, a glance is all it takes on this device.</p>
      <input
        autoFocus
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="Vault PIN"
        className="mt-6 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-center text-[18px] tracking-[0.3em] text-white outline-none focus:border-accent/60"
        data-testid="quick-pin"
      />
      {error && <div className="mt-2 text-[13px] text-denied">{error}</div>}
      <button disabled={busy || !pin} className="btn-glow mt-4 h-12 w-full rounded-2xl text-[15px] font-semibold disabled:opacity-50" data-testid="quick-unlock">
        {busy ? 'Unlocking…' : 'Unlock'}
      </button>
    </form>
  )
}

function PasswordList({ name, items, onLock }: { name: string; items: VaultItem[]; onLock: () => void }) {
  const [q, setQ] = useState('')
  const [shown, setShown] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const idle = useRef<number>(0)
  const logins = useMemo(() => items.filter((i) => i.type === 'login'), [items])
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    return logins.filter((i) => !s || [i.title, i.username, i.url].some((v) => v?.toLowerCase().includes(s)))
  }, [logins, q])

  // Lock again after a minute without activity.
  useEffect(() => {
    const reset = () => {
      window.clearTimeout(idle.current)
      idle.current = window.setTimeout(onLock, IDLE_LOCK_MS)
    }
    reset()
    const events = ['keydown', 'pointerdown', 'pointermove'] as const
    events.forEach((e) => window.addEventListener(e, reset))
    return () => {
      window.clearTimeout(idle.current)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [onLock])

  const copy = async (id: string, value?: string) => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(id)
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500)
  }

  return (
    <div className="mt-6 w-full max-w-2xl" data-testid="quick-list">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] text-white/60">
          Unlocked for <b className="text-white">{name}</b> · locks after 1 min idle
        </div>
        <button onClick={onLock} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-white/60 hover:text-white">
          <Lock className="size-3.5" /> Lock
        </button>
      </div>
      <label className="mt-4 flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 focus-within:border-accent/60">
        <Search className="size-4 text-white/40" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${logins.length} password${logins.length === 1 ? '' : 's'}…`}
          className="h-full flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/35"
          data-testid="quick-search"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) void copy(`${results[0].id}:pw`, results[0].password)
          }}
        />
        <span className="hidden font-mono text-[10.5px] text-white/35 sm:inline">ENTER copies top result</span>
      </label>
      <ul className="mt-3 space-y-2">
        {results.map((i) => (
          <li key={i.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3" data-testid="quick-item">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14.5px] font-semibold text-white">{i.title}</div>
              <div className="truncate font-mono text-[12.5px] text-white/50">
                {i.username || i.url || '—'} · {shown === i.id ? i.password : '••••••••••'}
              </div>
            </div>
            <button onClick={() => setShown(shown === i.id ? null : i.id)} className="rounded-lg p-2 text-white/50 hover:text-white" aria-label="Show password">
              {shown === i.id ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
            {i.username && (
              <button onClick={() => void copy(`${i.id}:user`, i.username)} className="h-9 rounded-xl border border-white/10 px-3 text-[12.5px] text-white/75 hover:border-accent/50">
                {copied === `${i.id}:user` ? 'Copied' : 'User'}
              </button>
            )}
            <button
              onClick={() => void copy(`${i.id}:pw`, i.password)}
              className="btn-glow flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold"
              data-testid="quick-copy"
            >
              {copied === `${i.id}:pw` ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied === `${i.id}:pw` ? 'Copied' : 'Password'}
            </button>
          </li>
        ))}
        {results.length === 0 && (
          <li className="rounded-2xl border border-white/[0.08] px-4 py-8 text-center text-[13.5px] text-white/50">
            {logins.length ? 'No match.' : 'Your vault has no passwords yet.'}{' '}
            <Link to="/apps/vault" className="text-accent underline">Add one in Vault</Link>
          </li>
        )}
      </ul>
    </div>
  )
}
