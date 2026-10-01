import { Check, Copy, KeyRound, Lock, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, cx, EmptyState, Input } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'
import { useGlance } from './presence'
import { deleteVaultItem, hasVault, listVaultItems, saveVaultItem, type VaultItem } from './secure'
import { useSession, useSuite } from './store'
import { parseOtpauth, secondsRemaining, totp } from './totp'
import { AUTO_LOCK_MS, openVaults, SetupVault, UnlockVault } from './VaultApp'

/**
 * Optic Authenticator: time-based 2FA codes (the same scheme as Google
 * Authenticator) stored in your sealed vault and shown only after a glance.
 */
export function AuthenticatorApp() {
  const session = useSession()
  const me = session.identityId!
  const glance = useGlance()
  const [state, setState] = useState<'loading' | 'setup' | 'locked' | 'unlocked'>('loading')
  const [key, setKey] = useState<CryptoKey | null>(null)
  const [items, setItems] = useState<VaultItem[]>([])

  const refresh = useCallback(async (k: CryptoKey) => setItems(await listVaultItems(me, k)), [me])

  useEffect(() => {
    const open = openVaults.get(me)
    if (open && open.until > Date.now()) {
      setKey(open.key)
      setState('unlocked')
      void refresh(open.key)
      return
    }
    hasVault(me).then((has) => setState(has ? 'locked' : 'setup'))
  }, [me, refresh])

  const unlocked = (k: CryptoKey) => {
    openVaults.set(me, { key: k, until: Date.now() + AUTO_LOCK_MS })
    setKey(k)
    setState('unlocked')
    void refresh(k)
  }
  const lock = () => {
    openVaults.delete(me)
    setKey(null)
    setItems([])
    setState('locked')
  }

  const codes = items.filter((i) => i.type === 'totp')

  return (
    <>
      <PageHeader
        title="Optic Authenticator"
        description="Your 2FA codes, sealed in your vault and revealed only on a glance. Works with any site that offers an authenticator app."
        actions={
          state === 'unlocked' && (
            <Button icon={<Lock className="size-4" />} onClick={lock} data-testid="auth-lock">
              Lock
            </Button>
          )
        }
      />
      {state === 'loading' && <Card className="h-64 animate-pulse" />}
      {state === 'setup' && <SetupVault me={me} glance={glance} onDone={unlocked} />}
      {state === 'locked' && <UnlockVault me={me} glance={glance} onDone={unlocked} />}
      {state === 'unlocked' && key && <CodeList me={me} vaultKey={key} codes={codes} refresh={() => refresh(key)} glance={glance} />}
    </>
  )
}

function CodeList({
  me,
  vaultKey,
  codes,
  refresh,
  glance,
}: {
  me: string
  vaultKey: CryptoKey
  codes: VaultItem[]
  refresh: () => void
  glance: ReturnType<typeof useGlance>
}) {
  const [adding, setAdding] = useState(false)
  const log = useSuite((s) => s.log)
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)} data-testid="auth-add">
          Add code
        </Button>
      </div>
      {adding && <AddCode me={me} vaultKey={vaultKey} onClose={() => setAdding(false)} onSaved={refresh} />}
      {codes.length === 0 && !adding ? (
        <Card>
          <EmptyState
            icon={<ShieldCheck className="size-5" />}
            title="No 2FA codes yet"
            description="Add a code from any site's authenticator setup — paste its otpauth:// link or the secret key."
            action={
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
                Add your first code
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="auth-list">
          {codes.map((c) => (
            <CodeCard
              key={c.id}
              item={c}
              onDelete={async () => {
                const g = await glance({ reason: `Delete ${c.title}`, app: 'vault', expectIdentityId: me, allowRecent: true })
                if (!g.ok) return
                await deleteVaultItem(c.id)
                log({ app: 'vault', action: 'delete', detail: `Removed 2FA · ${c.title}`, identityId: me, name: '', ok: true })
                refresh()
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CodeCard({ item, onDelete }: { item: VaultItem; onDelete: () => void }) {
  const [code, setCode] = useState('••••••')
  const [left, setLeft] = useState(30)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      if (!item.secret) return
      const c = await totp(item.secret)
      if (alive) {
        setCode(c)
        setLeft(secondsRemaining(30))
      }
    }
    void tick()
    const t = setInterval(tick, 1000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [item.secret])

  const pct = (left / 30) * 100
  return (
    <Card className="hairline p-4" data-testid="auth-code">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-ink">{item.title}</div>
          {item.issuer && <div className="truncate text-[12px] text-muted">{item.issuer}</div>}
        </div>
        <button onClick={onDelete} className="rounded-lg p-1.5 text-subtle hover:text-bad" aria-label="Delete" data-testid="auth-delete">
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="font-mono text-[30px] font-medium tracking-[0.18em] text-ink tabular" data-testid="auth-code-value">
          {code.slice(0, 3)} {code.slice(3)}
        </div>
        <div className="relative size-9">
          <svg viewBox="0 0 36 36" className="size-9 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke={left <= 5 ? 'var(--bad)' : 'var(--accent)'}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 2 * Math.PI * 15} ${2 * Math.PI * 15}`}
              style={{ transition: 'stroke-dasharray 1s linear, stroke .3s' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-muted tabular">{left}</span>
        </div>
      </div>
      <button
        onClick={() => {
          void navigator.clipboard.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-xl border border-line text-[12.5px] font-medium text-muted hover:border-accent/40 hover:text-ink"
        data-testid="auth-copy"
      >
        {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />} {copied ? 'Copied' : 'Copy code'}
      </button>
    </Card>
  )
}

function AddCode({ me, vaultKey, onClose, onSaved }: { me: string; vaultKey: CryptoKey; onClose: () => void; onSaved: () => void }) {
  const [raw, setRaw] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const parsed = useMemo(() => parseOtpauth(raw), [raw])

  const save = async () => {
    if (!parsed) return setError('Paste an otpauth:// link or a valid secret key.')
    await saveVaultItem(me, vaultKey, {
      type: 'totp',
      title: title.trim() || parsed.issuer || parsed.label || 'Code',
      issuer: parsed.issuer,
      secret: parsed.secret,
    })
    onSaved()
    onClose()
  }

  return (
    <Card className="hairline p-5" data-testid="auth-add-form">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <KeyRound className="size-4 text-accent" /> Add a 2FA code
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-subtle hover:text-ink" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-2 text-[13px] text-muted">
        On the other site, choose “set up authenticator app”, then “can’t scan / enter manually”, and paste what it shows — either the
        <span className="font-mono"> otpauth://</span> link or the secret key.
      </p>
      <div className="mt-4 space-y-3">
        <div className="flex gap-2">
          <Input autoFocus value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="otpauth://… or secret key" data-testid="auth-secret" className="flex-1" />
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const t = await navigator.clipboard.readText()
                if (t) setRaw(t.trim())
              } catch {
                setError('Could not read the clipboard — paste into the box instead.')
              }
            }}
          >
            Paste
          </Button>
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Label (e.g. GitHub)" data-testid="auth-title" />
        {parsed && (
          <Badge tone="ok" dot>
            Valid {parsed.issuer ? `· ${parsed.issuer}` : 'secret'}
          </Badge>
        )}
        {error && <div className="text-[12px] text-bad">{error}</div>}
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" className={cx('flex-[2]')} disabled={!parsed} onClick={save} data-testid="auth-save">
          Save code
        </Button>
      </div>
    </Card>
  )
}
