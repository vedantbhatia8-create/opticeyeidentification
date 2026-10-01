import { AlertTriangle, Check, Fingerprint, KeyRound, Mail, Merge, Pencil, Plus, ScanEye, ShieldAlert, ShieldCheck, ShieldHalf, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { normalizeEmail } from '../../core/identity/IdentityService'
import type { Identity } from '../../core/identity/types'
import { mergeAccounts } from '../../state/accounts'
import { identityService } from '../../state/services'
import { useStore } from '../../state/store'
import { formatBytes, formatDate, formatDateTime, timeAgo } from '../../ui/format'
import { Modal } from '../../ui/overlay'
import { Avatar, Badge, Button, buttonClass, Card, CardHeader, cx, Input } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'
import { useIdentities } from '../sensor/hooks'
import { useIsAdmin } from '../admin/admin'
import { listBreakins } from './breakins'
import { useGlance } from './presence'
import { accountRecordSummary, destroyVault } from './secure'
import { useSession, useSuite } from './store'
import { lockAllVaults } from './VaultApp'

const normName = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ')

export function AccountPage() {
  const session = useSession()
  const me = session.identityId!
  const navigate = useNavigate()
  const glance = useGlance()
  const { identities, scans } = useIdentities()
  const account = identities.find((i) => i.id === me)
  const myScans = scans.filter((s) => s.identityId === me)
  const suite = useSuite()
  const [records, setRecords] = useState({ hasVault: false, vaultItems: 0, docsOwned: 0, docsShared: 0 })
  const [strangerCount, setStrangerCount] = useState(0)
  const isAdmin = useIsAdmin()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: '', email: '' })
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const refresh = useCallback(() => accountRecordSummary(me).then(setRecords), [me])
  useEffect(() => {
    void refresh()
    void listBreakins().then((b) => setStrangerCount(b.length))
  }, [refresh, identities.length])

  // Other real accounts that look like the same person (same email or same name).
  const duplicates = useMemo(() => {
    if (!account) return []
    return identities.filter(
      (i) =>
        i.id !== me &&
        !i.synthetic &&
        ((normalizeEmail(i.email) && normalizeEmail(i.email) === normalizeEmail(account.email)) || normName(i.name) === normName(account.name)),
    )
  }, [identities, account, me])

  if (!account) return null

  const saveProfile = async () => {
    const email = draft.email.trim()
    const clash = email ? identityService.findAccountByEmail(email) : undefined
    if (clash && clash.id !== me) {
      setNotice(`${email} already belongs to the account “${clash.name}”. Merge it below instead.`)
      return
    }
    await identityService.updateIdentity(me, { name: draft.name.trim() || account.name, email: email || undefined })
    useSession.getState().signIn(me, draft.name.trim() || account.name)
    setEditing(false)
    setNotice(null)
  }

  const merge = async (dups: Identity[]) => {
    const g = await glance({ reason: `Merge ${dups.length} account${dups.length === 1 ? '' : 's'} into yours`, app: 'suite', expectIdentityId: me, allowRecent: true })
    if (!g.ok) return
    const { vaultsNotMerged } = await mergeAccounts(me, dups.map((d) => d.id))
    suite.log({ app: 'suite', action: 'merge', detail: `Merged ${dups.length} duplicate account(s)`, identityId: me, name: account.name, ok: true })
    setNotice(
      vaultsNotMerged
        ? `Merged. ${vaultsNotMerged} extra vault could not be combined because it was sealed with a different PIN.`
        : `Merged ${dups.length} account${dups.length === 1 ? '' : 's'} — all scans and data are now in this account.`,
    )
    void refresh()
  }

  const deleteAccount = async () => {
    const g = await glance({ reason: 'Delete your Optic account permanently', app: 'suite', expectIdentityId: me })
    if (!g.ok) return
    useStore.getState().clearIdentityLinks(me)
    await destroyVault(me)
    await identityService.deleteIdentity(me)
    lockAllVaults()
    useSession.getState().signOut()
    navigate('/')
  }

  const everything = [
    { icon: KeyRound, label: 'Vault', value: records.hasVault ? `${records.vaultItems} item${records.vaultItems === 1 ? '' : 's'}` : 'Not set up', to: '/apps/vault' },
    { icon: ShieldCheck, label: 'Authenticator', value: records.hasVault ? '2FA codes' : 'Not set up', to: '/apps/auth' },
    { icon: Mail, label: 'Mail', value: `${records.docsOwned} sent · ${records.docsShared} received`, to: '/apps/mail' },
    { icon: ShieldAlert, label: 'Security', value: strangerCount ? `${strangerCount} stranger alert${strangerCount === 1 ? '' : 's'}` : 'All clear', to: '/apps/security' },
    { icon: ShieldHalf, label: 'Guard', value: 'Walk-away lock on', to: '/apps/guard' },
    ...(isAdmin ? [{ icon: ShieldHalf, label: 'Admin', value: 'Console', to: '/apps/admin' }] : []),
  ]

  return (
    <>
      <PageHeader title="Your security hub" description="Everything that protects you, in one place — your face, your vault, your 2FA, and who's been at your screen." />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SecurityStat icon={<ScanEye className="size-4" />} label="Verified" value={session.lastVerifiedAt ? timeAgo(session.lastVerifiedAt) : 'just now'} tone="ok" />
        <SecurityStat icon={<Fingerprint className="size-4" />} label="Optic scans" value={String(myScans.length)} tone="ok" />
        <SecurityStat icon={<KeyRound className="size-4" />} label="Vault" value={records.hasVault ? `${records.vaultItems}` : 'Off'} tone={records.hasVault ? 'ok' : 'neutral'} />
        <SecurityStat
          icon={<ShieldAlert className="size-4" />}
          label="Stranger alerts"
          value={String(strangerCount)}
          tone={strangerCount ? 'bad' : 'ok'}
        />
      </div>
      {notice && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3 text-[13px] text-ink" data-testid="account-notice">
          {notice}
          <button onClick={() => setNotice(null)} className="text-muted hover:text-ink" aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card className="p-6" data-testid="account-profile">
          <div className="flex items-start gap-4">
            <Avatar name={account.name} size={56} />
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="space-y-2">
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name" data-testid="account-name" />
                  <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Email" type="email" />
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" icon={<Check className="size-3.5" />} onClick={saveProfile} data-testid="account-save">
                      Save
                    </Button>
                    <Button size="sm" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-[20px] font-semibold tracking-tight text-ink">{account.name}</div>
                  <div className="text-[13.5px] text-muted">{account.email || 'No email yet — add one so your account is easy to find'}</div>
                  <div className="mt-1 font-mono text-[11px] text-subtle">Account {account.id} · since {formatDate(account.createdAt)}</div>
                </>
              )}
            </div>
            {!editing && (
              <Button size="sm" icon={<Pencil className="size-3.5" />} onClick={() => { setDraft({ name: account.name, email: account.email ?? '' }); setEditing(true) }}>
                Edit
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-[13px] font-semibold text-ink">Your security, app by app</div>
          <div className="mt-3 grid grid-cols-2 gap-2" data-testid="account-summary">
            {everything.map((x) => (
              <Link key={x.label} to={x.to} className="rounded-xl border border-line px-3 py-2.5 transition hover:border-line-strong hover:bg-surface-2/50">
                <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
                  <x.icon className="size-3.5" /> {x.label}
                </div>
                <div className="mt-0.5 truncate text-[13px] font-medium text-ink">{x.value}</div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {duplicates.length > 0 && (
        <Card className="mt-4 border-warn/30" data-testid="account-duplicates">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-warn" /> {duplicates.length} other account{duplicates.length === 1 ? '' : 's'} look like you
              </span>
            }
            description="Same name or email. Merge them to move their scans and data into this account and remove the clutter."
            action={
              <Button variant="primary" size="sm" icon={<Merge className="size-3.5" />} onClick={() => merge(duplicates)} data-testid="merge-all">
                Merge all into this account
              </Button>
            }
          />
          <ul className="divide-y divide-line border-t border-line">
            {duplicates.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={d.name} size={30} />
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium text-ink">{d.name}</div>
                    <div className="truncate text-[12px] text-muted">
                      {d.email || 'no email'} · {scans.filter((s) => s.identityId === d.id).length} scan(s) · created {formatDateTime(d.createdAt)}
                    </div>
                  </div>
                </div>
                <Button size="sm" icon={<Merge className="size-3.5" />} onClick={() => merge([d])}>
                  Merge
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Fingerprint className="size-4 text-subtle" /> Optic scans
            </span>
          }
          description="Each scan is one enrollment of your eyes. Add scans for different lighting or glasses — they all belong to this one account."
          action={
            <Link to={`/lab/enroll?identity=${me}&return=/apps/account`} className={buttonClass('secondary', 'sm')} data-testid="account-add-scan">
              <Plus className="size-3.5" /> Add scan
            </Link>
          }
        />
        <ul className="divide-y divide-line border-t border-line" data-testid="account-scans">
          {myScans.map((scan) => (
            <ScanRow key={scan.id} id={scan.id} label={scan.label} meta={`${scan.sampleCount} samples · ${Math.round(scan.quality * 100)}% quality · ${formatBytes(scan.sizeBytes)} · ${formatDate(scan.createdAt)}${scan.lastMatchedAt ? ` · used ${timeAgo(scan.lastMatchedAt)}` : ''}`} canDelete={myScans.length > 1} />
          ))}
        </ul>
      </Card>

      <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="text-[14px] font-semibold text-ink">Delete account</div>
          <div className="text-[12.5px] text-muted">Destroys your optic scans and vault, and removes your access everywhere.</div>
        </div>
        <Button variant="danger" size="sm" icon={<Trash2 className="size-3.5" />} onClick={() => setConfirmDelete(true)}>
          Delete account
        </Button>
      </Card>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete your Optic account?"
        description="This can’t be undone. You’ll be asked to confirm with a glance."
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => { setConfirmDelete(false); void deleteAccount() }}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-muted">Family profiles and roster entries for this account are removed too.</p>
      </Modal>
    </>
  )
}

function SecurityStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'ok' | 'bad' | 'neutral' }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span
        className={cx(
          'flex size-9 shrink-0 items-center justify-center rounded-xl',
          tone === 'bad' ? 'bg-bad-soft text-bad' : tone === 'ok' ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-muted',
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[16px] font-semibold text-ink">{value}</div>
        <div className="truncate text-[11.5px] text-muted">{label}</div>
      </div>
    </Card>
  )
}

function ScanRow({ id, label, meta, canDelete }: { id: string; label: string; meta: string; canDelete: boolean }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(label)
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
          <Fingerprint className="size-4" />
        </span>
        {editing ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              await identityService.renameScan(id, value)
              setEditing(false)
            }}
          >
            <Input value={value} onChange={(e) => setValue(e.target.value)} autoFocus className="h-8" />
            <Button size="sm" type="submit" variant="primary">
              Save
            </Button>
          </form>
        ) : (
          <div className="min-w-0">
            <button onClick={() => setEditing(true)} className="group flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
              {label} <Pencil className="size-3 text-subtle opacity-0 group-hover:opacity-100" />
            </button>
            <div className="truncate text-[12px] text-muted">{meta}</div>
          </div>
        )}
      </div>
      <div className={cx('flex items-center gap-2', editing && 'hidden')}>
        <Badge tone="ok">Active</Badge>
        {canDelete && (
          <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} aria-label="Delete scan" onClick={() => identityService.deleteScan(id)} />
        )}
      </div>
    </li>
  )
}
