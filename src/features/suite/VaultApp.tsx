import { Copy, Eye, EyeOff, FileText, Globe, KeyRound, Lock, Pencil, Plus, RefreshCw, Search, ShieldCheck, StickyNote, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { timeAgo } from '../../ui/format'
import { Modal } from '../../ui/overlay'
import { Badge, Button, Card, cx, EmptyState, Field, Input } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'
import { useGlance } from './presence'
import {
  createVault,
  deleteVaultItem,
  hasVault,
  listVaultItems,
  LockedOutError,
  saveVaultItem,
  unlockVault,
  WrongPinError,
  type VaultItem,
} from './secure'
import { useSession, useSuite } from './store'

const AUTO_LOCK_MS = 5 * 60_000
/** Unlocked vault keys live only in memory, per identity, and expire. */
const openVaults = new Map<string, { key: CryptoKey; until: number }>()

export function lockAllVaults() {
  openVaults.clear()
}

export function passwordStrength(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (pw.length >= 16) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const level = score <= 2 ? 0 : score <= 4 ? 1 : score === 5 ? 2 : 3
  return { level, label: ['Weak', 'Fair', 'Strong', 'Excellent'][level] }
}

export function generatePassword(length = 20) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+?'
  const bytes = crypto.getRandomValues(new Uint32Array(length))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export function VaultApp() {
  const session = useSession()
  const me = session.identityId!
  const glance = useGlance()
  const log = useSuite((s) => s.log)
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

  // Auto-lock after inactivity.
  useEffect(() => {
    if (state !== 'unlocked') return
    const t = setInterval(() => {
      const open = openVaults.get(me)
      if (!open || open.until < Date.now()) lock()
    }, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, me])

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
    log({ app: 'vault', action: 'lock', detail: 'Vault locked', identityId: me, name: session.name ?? '', ok: true })
  }

  const bump = () => {
    const o = openVaults.get(me)
    if (o) o.until = Date.now() + AUTO_LOCK_MS
  }

  return (
    <>
      <PageHeader
        title="Optic Vault"
        description="Passwords and secure notes. A glance proves it’s you; your PIN is the encryption key. Neither alone opens the vault."
        actions={
          state === 'unlocked' && (
            <Button icon={<Lock className="size-4" />} onClick={lock} data-testid="vault-lock">
              Lock vault
            </Button>
          )
        }
      />
      {state === 'loading' && <Card className="h-64 animate-pulse" />}
      {state === 'setup' && <SetupVault me={me} glance={glance} onDone={unlocked} />}
      {state === 'locked' && <UnlockVault me={me} glance={glance} onDone={unlocked} />}
      {state === 'unlocked' && key && <VaultBrowser me={me} vaultKey={key} items={items} refresh={() => refresh(key)} bump={bump} />}
    </>
  )
}

function PinInput({ value, onChange, autoFocus, testId }: { value: string; onChange: (v: string) => void; autoFocus?: boolean; testId?: string }) {
  return (
    <Input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus}
      maxLength={12}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      className="h-12 text-center font-mono text-[20px] tracking-[0.5em]"
      placeholder="••••••"
      data-testid={testId}
    />
  )
}

type GlanceFn = ReturnType<typeof useGlance>

function SetupVault({ me, glance, onDone }: { me: string; glance: GlanceFn; onDone: (k: CryptoKey) => void }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const log = useSuite((s) => s.log)
  const name = useSession((s) => s.name)
  const submit = async () => {
    if (pin.length < 6) return setError('Use at least 6 digits.')
    if (pin !== confirm) return setError('PINs don’t match.')
    setError(null)
    const g = await glance({ reason: 'Create your Optic Vault', app: 'vault', expectIdentityId: me, allowRecent: true })
    if (!g.ok) return setError('Glance not approved.')
    setBusy(true)
    const key = await createVault(me, pin)
    log({ app: 'vault', action: 'create', detail: 'Vault created', identityId: me, name: name ?? '', ok: true })
    onDone(key)
  }
  return (
    <Card className="mx-auto max-w-md p-8 text-center" data-testid="vault-setup">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-text">
        <KeyRound className="size-5" />
      </div>
      <h2 className="mt-4 text-[18px] font-semibold text-ink">Create your vault</h2>
      <p className="mt-1 text-[13px] text-muted">Choose a PIN. It never leaves this device and can’t be recovered — Optic can’t reset it.</p>
      <div className="mt-6 space-y-3 text-left">
        <Field label="PIN">
          <PinInput value={pin} onChange={setPin} autoFocus testId="vault-pin" />
        </Field>
        <Field label="Confirm PIN">
          <PinInput value={confirm} onChange={setConfirm} testId="vault-pin-confirm" />
        </Field>
      </div>
      {error && <div className="mt-3 text-[13px] text-bad">{error}</div>}
      <Button variant="primary" size="lg" className="mt-6 w-full" onClick={submit} loading={busy} data-testid="vault-create">
        Create vault
      </Button>
    </Card>
  )
}

function UnlockVault({ me, glance, onDone }: { me: string; glance: GlanceFn; onDone: (k: CryptoKey) => void }) {
  const [step, setStep] = useState<'glance' | 'pin'>('glance')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const log = useSuite((s) => s.log)
  const name = useSession((s) => s.name)
  const doGlance = async () => {
    setError(null)
    const g = await glance({ reason: 'Unlock Optic Vault', app: 'vault', expectIdentityId: me, allowRecent: true })
    if (g.ok) setStep('pin')
    else setError(g.reason === 'cancelled' ? null : 'Glance not approved.')
  }
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const key = await unlockVault(me, pin)
      log({ app: 'vault', action: 'unlock', detail: 'Vault unlocked (glance + PIN)', identityId: me, name: name ?? '', ok: true })
      onDone(key)
    } catch (err) {
      setError(err instanceof WrongPinError || err instanceof LockedOutError ? err.message : 'Could not unlock.')
      if (err instanceof WrongPinError) log({ app: 'vault', action: 'unlock', detail: 'Wrong PIN', identityId: me, name: name ?? '', ok: false })
      setPin('')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="mx-auto max-w-md p-8 text-center" data-testid="vault-locked">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-ink">
        <Lock className="size-5" />
      </div>
      <h2 className="mt-4 text-[18px] font-semibold text-ink">Vault locked</h2>
      <div className="mt-5 flex items-center justify-center gap-2 text-[12.5px]">
        <Badge tone={step === 'pin' ? 'ok' : 'accent'}>1 · Glance</Badge>
        <span className="text-subtle">→</span>
        <Badge tone={step === 'pin' ? 'accent' : 'neutral'}>2 · PIN</Badge>
      </div>
      {step === 'glance' ? (
        <Button variant="primary" size="lg" className="mt-6 w-full" onClick={doGlance} data-testid="vault-glance">
          Look to unlock
        </Button>
      ) : (
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <PinInput value={pin} onChange={setPin} autoFocus testId="vault-unlock-pin" />
          <Button variant="primary" size="lg" className="mt-3 w-full" type="submit" loading={busy} data-testid="vault-unlock">
            Unlock
          </Button>
        </form>
      )}
      {error && <div className="mt-3 text-[13px] text-bad" data-testid="vault-error">{error}</div>}
    </Card>
  )
}

function VaultBrowser({
  me,
  vaultKey,
  items,
  refresh,
  bump,
}: {
  me: string
  vaultKey: CryptoKey
  items: VaultItem[]
  refresh: () => Promise<void>
  bump: () => void
}) {
  const [tab, setTab] = useState<'all' | 'login' | 'note'>('all')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<VaultItem> | null>(null)
  const shown = items.filter((i) => (tab === 'all' || i.type === tab) && (!q || `${i.title} ${i.username ?? ''} ${i.url ?? ''}`.toLowerCase().includes(q.toLowerCase())))
  const selected = items.find((i) => i.id === selectedId) ?? shown[0] ?? null

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]" data-testid="vault-open">
      <Card className="overflow-hidden">
        <div className="space-y-2 border-b border-line p-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vault" className="pl-9" />
            </div>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing({ type: 'login' })} aria-label="New item" data-testid="vault-add" />
          </div>
          <div className="inline-flex w-full rounded-lg border border-line bg-surface-2 p-0.5">
            {(
              [
                ['all', `All ${items.length}`],
                ['login', 'Logins'],
                ['note', 'Notes'],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cx('flex-1 rounded-md py-1.5 text-[12.5px] font-medium', tab === k ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-muted')}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <EmptyState icon={<KeyRound className="size-5" />} title="Nothing here yet" description="Add a login or a secure note." className="py-10" />
        ) : (
          <ul className="max-h-[560px] divide-y divide-line overflow-y-auto">
            {shown.map((i) => (
              <li key={i.id}>
                <button
                  onClick={() => {
                    setSelectedId(i.id)
                    bump()
                  }}
                  className={cx('flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2/60', selected?.id === i.id && 'bg-surface-2')}
                  data-testid="vault-item"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-[13px] font-semibold text-ink">
                    {i.type === 'note' ? <StickyNote className="size-4 text-muted" /> : i.title.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium text-ink">{i.title}</span>
                    <span className="block truncate text-[12px] text-muted">{i.type === 'note' ? 'Secure note' : i.username || i.url}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="min-h-[420px]">
        {selected ? (
          <ItemDetail key={selected.id} me={me} item={selected} onEdit={() => setEditing(selected)} refresh={refresh} bump={bump} />
        ) : (
          <EmptyState icon={<ShieldCheck className="size-5" />} title="Your vault is open" description="Everything here is encrypted with your PIN-derived key and decrypted only in this tab’s memory." />
        )}
      </Card>
      <ItemEditor
        item={editing}
        onClose={() => setEditing(null)}
        onSave={async (i) => {
          const saved = await saveVaultItem(me, vaultKey, i as VaultItem)
          setEditing(null)
          setSelectedId(saved.id)
          bump()
          await refresh()
        }}
      />
    </div>
  )
}

function ItemDetail({ me, item, onEdit, refresh, bump }: { me: string; item: VaultItem; onEdit: () => void; refresh: () => Promise<void>; bump: () => void }) {
  const glance = useGlance()
  const log = useSuite((s) => s.log)
  const name = useSession((s) => s.name) ?? ''
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const strength = useMemo(() => passwordStrength(item.password ?? ''), [item.password])

  const approve = async (reason: string, recent = true) => {
    const g = await glance({ reason, app: 'vault', expectIdentityId: me, allowRecent: recent })
    bump()
    return g.ok
  }
  const copy = async (label: string, value: string, sensitive: boolean) => {
    if (sensitive && !(await approve(`Copy password for ${item.title}`))) return
    await navigator.clipboard.writeText(value).catch(() => {})
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
    if (sensitive) {
      log({ app: 'vault', action: 'copy', detail: `Copied password · ${item.title}`, identityId: me, name, ok: true })
      // Clear the clipboard after 30 s if it still holds the secret.
      setTimeout(async () => {
        const now = await navigator.clipboard.readText().catch(() => null)
        if (now === value) await navigator.clipboard.writeText('').catch(() => {})
      }, 30_000)
    }
  }

  return (
    <div className="p-6" data-testid="vault-detail">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-[18px] font-semibold text-ink">
            {item.type === 'note' ? <FileText className="size-5 text-muted" /> : item.title.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div className="text-[18px] font-semibold tracking-tight text-ink">{item.title}</div>
            <div className="text-[12.5px] text-muted">Updated {timeAgo(item.updatedAt)}</div>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" icon={<Pencil className="size-3.5" />} onClick={onEdit}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 className="size-3.5" />}
            aria-label="Delete"
            onClick={async () => {
              if (!(await approve(`Delete “${item.title}” permanently`, false))) return
              await deleteVaultItem(item.id)
              log({ app: 'vault', action: 'delete', detail: `Deleted · ${item.title}`, identityId: me, name, ok: true })
              await refresh()
            }}
          />
        </div>
      </div>

      {item.type === 'login' ? (
        <div className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {item.username && <Row label="Username" value={item.username} onCopy={() => copy('user', item.username!, false)} copied={copied === 'user'} />}
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-[12px] text-muted">Password</div>
              <div className="mt-0.5 truncate font-mono text-[14px] text-ink" data-testid="vault-password">
                {revealed ? item.password : '•'.repeat(Math.min(16, item.password?.length ?? 12))}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Badge tone={strength.level >= 2 ? 'ok' : strength.level === 1 ? 'warn' : 'bad'}>{strength.label}</Badge>
              <Button
                size="sm"
                variant="ghost"
                icon={revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                aria-label={revealed ? 'Hide' : 'Reveal'}
                data-testid="vault-reveal"
                onClick={async () => {
                  if (revealed) return setRevealed(false)
                  if (await approve(`Reveal password for ${item.title}`)) {
                    setRevealed(true)
                    log({ app: 'vault', action: 'reveal', detail: `Revealed password · ${item.title}`, identityId: me, name, ok: true })
                    setTimeout(() => setRevealed(false), 20_000)
                  }
                }}
              />
              <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" />} aria-label="Copy password" onClick={() => copy('pw', item.password ?? '', true)}>
                {copied === 'pw' ? 'Copied' : ''}
              </Button>
            </div>
          </div>
          {item.url && (
            <div className="flex items-center gap-2 px-4 py-3 text-[13.5px]">
              <Globe className="size-4 text-subtle" />
              <a href={item.url.startsWith('http') ? item.url : `https://${item.url}`} target="_blank" rel="noreferrer" className="truncate text-accent-text hover:underline">
                {item.url}
              </a>
            </div>
          )}
        </div>
      ) : null}
      {item.body && (
        <div className="mt-5">
          <div className="mb-1.5 text-[12px] text-muted">{item.type === 'note' ? 'Note' : 'Notes'}</div>
          <div className="rounded-xl border border-line bg-surface-2/50 p-4 text-[14px] leading-relaxed whitespace-pre-wrap text-ink">{item.body}</div>
        </div>
      )}
      <p className="mt-6 text-[12px] text-subtle">Revealing, copying or deleting asks for a fresh glance (reused for 30 seconds). Clipboard clears after 30 seconds.</p>
    </div>
  )
}

function Row({ label, value, onCopy, copied }: { label: string; value: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[12px] text-muted">{label}</div>
        <div className="mt-0.5 truncate text-[14px] text-ink">{value}</div>
      </div>
      <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" />} onClick={onCopy}>
        {copied ? 'Copied' : ''}
      </Button>
    </div>
  )
}

function ItemEditor({ item, onClose, onSave }: { item: Partial<VaultItem> | null; onClose: () => void; onSave: (i: Partial<VaultItem>) => Promise<void> }) {
  const [draft, setDraft] = useState<Partial<VaultItem>>({})
  const [last, setLast] = useState(item)
  if (item !== last) {
    setLast(item)
    setDraft(item ?? {})
  }
  const [show, setShow] = useState(false)
  const s = passwordStrength(draft.password ?? '')
  const valid = !!draft.title?.trim() && (draft.type === 'note' ? !!draft.body?.trim() : !!draft.password)
  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={draft.id ? 'Edit item' : 'New vault item'}
      width={520}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={() => onSave(draft)} data-testid="vault-save">
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!draft.id && (
          <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
            {(['login', 'note'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDraft({ ...draft, type: t })}
                className={cx('rounded-md px-3 py-1.5 text-[12.5px] font-medium', draft.type === t ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-muted')}
              >
                {t === 'login' ? 'Login' : 'Secure note'}
              </button>
            ))}
          </div>
        )}
        <Field label="Title">
          <Input autoFocus value={draft.title ?? ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={draft.type === 'note' ? 'Wi-Fi & alarm codes' : 'GitHub'} data-testid="vault-title" />
        </Field>
        {draft.type !== 'note' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Username">
                <Input value={draft.username ?? ''} onChange={(e) => setDraft({ ...draft, username: e.target.value })} placeholder="you@example.com" />
              </Field>
              <Field label="Website">
                <Input value={draft.url ?? ''} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="github.com" />
              </Field>
            </div>
            <Field label="Password" hint={draft.password ? `Strength: ${s.label}` : undefined}>
              <div className="flex gap-2">
                <Input
                  type={show ? 'text' : 'password'}
                  value={draft.password ?? ''}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                  className="font-mono"
                  data-testid="vault-password-input"
                />
                <Button icon={show ? <EyeOff className="size-4" /> : <Eye className="size-4" />} onClick={() => setShow(!show)} aria-label="Show" />
                <Button icon={<RefreshCw className="size-4" />} onClick={() => { setDraft({ ...draft, password: generatePassword() }); setShow(true) }} data-testid="vault-generate">
                  Generate
                </Button>
              </div>
              {draft.password && (
                <div className="mt-2 flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={cx('h-1 flex-1 rounded-full', i <= s.level ? (s.level >= 2 ? 'bg-ok' : s.level === 1 ? 'bg-warn' : 'bg-bad') : 'bg-surface-3')} />
                  ))}
                </div>
              )}
            </Field>
          </>
        )}
        <Field label={draft.type === 'note' ? 'Note' : 'Notes (optional)'}>
          <textarea
            value={draft.body ?? ''}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            rows={draft.type === 'note' ? 7 : 3}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-[var(--shadow-card)] outline-none focus:border-accent/60 focus:ring-3 focus:ring-accent/15"
            data-testid="vault-body"
          />
        </Field>
      </div>
    </Modal>
  )
}
