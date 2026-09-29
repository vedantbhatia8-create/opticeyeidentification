import { Ban, Clock, EyeOff, FileText, Image as ImageIcon, Link2, Plus, Send, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime, timeAgo } from '../../ui/format'
import { Modal } from '../../ui/overlay'
import { Avatar, Badge, Button, buttonClass, Card, cx, EmptyState, Field, Input, Select, Toggle, type Tone } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'
import { useIdentities } from '../sensor/hooks'
import { useGlance } from './presence'
import { createDoc, deleteDoc, listDocs, updateDoc, type OpticDoc } from './secure'
import { useSession, useSuite } from './store'

type DocMeta = Omit<OpticDoc, 'sealed'>

export function docStatus(d: DocMeta, now = Date.now()): { label: string; tone: Tone } {
  if (d.revoked) return { label: 'Revoked', tone: 'bad' }
  if (d.expiresAt && now >= d.expiresAt) return { label: 'Expired', tone: 'bad' }
  if (d.maxViews && d.views >= d.maxViews) return { label: 'View limit reached', tone: 'warn' }
  return { label: 'Active', tone: 'ok' }
}

export function EyesOnlyApp() {
  const me = useSession((s) => s.identityId)!
  const [docs, setDocs] = useState<DocMeta[]>([])
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox')
  const [creating, setCreating] = useState(false)
  const [logFor, setLogFor] = useState<DocMeta | null>(null)
  const refresh = useCallback(() => listDocs().then(setDocs), [])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const inbox = docs.filter((d) => d.recipients.includes(me))
  const sent = docs.filter((d) => d.ownerId === me)
  const shown = tab === 'inbox' ? inbox : sent

  return (
    <>
      <PageHeader
        title="Optic Eyes-Only"
        description="Documents that open only for their intended readers — and only while those readers are looking. Shoulder-surfers see a blur."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)} data-testid="eo-new">
            New eyes-only document
          </Button>
        }
      />
      <div className="mb-4 inline-flex rounded-lg border border-line bg-surface p-0.5 shadow-[var(--shadow-card)]">
        {(
          [
            ['inbox', `Shared with me ${inbox.length}`],
            ['sent', `Sent by me ${sent.length}`],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cx('rounded-md px-3 py-1.5 text-[13px] font-medium', tab === k ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink')}
          >
            {l}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<EyeOff className="size-5" />}
            title={tab === 'inbox' ? 'Nothing shared with you' : 'You haven’t sent anything yet'}
            description="Create a document, choose who may read it, and set when it expires."
            action={
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                New document
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((d) => (
            <DocCard key={d.id} doc={d} mine={d.ownerId === me} refresh={refresh} onLog={() => setLogFor(d)} />
          ))}
        </div>
      )}
      <CreateDocModal open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setTab('sent'); void refresh() }} />
      <AccessLogModal doc={logFor} onClose={() => setLogFor(null)} />
    </>
  )
}

function DocCard({ doc, mine, refresh, onLog }: { doc: DocMeta; mine: boolean; refresh: () => void; onLog: () => void }) {
  const { identities } = useIdentities()
  const glance = useGlance()
  const me = useSession((s) => s.identityId)
  const st = docStatus(doc)
  const [copied, setCopied] = useState(false)
  const link = `${location.origin}/apps/view/${doc.id}`
  return (
    <Card className="p-5" data-testid="eo-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
            {doc.contentType === 'image' ? <ImageIcon className="size-5" /> : <FileText className="size-5" />}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-ink">{doc.hideTitle && !mine ? 'Eyes-only document' : doc.title}</div>
            <div className="text-[12.5px] text-muted">
              {mine ? 'You' : doc.ownerName} · {timeAgo(doc.createdAt)}
            </div>
          </div>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" /> {doc.expiresAt ? `Expires ${formatDateTime(doc.expiresAt)}` : 'No expiry'}
        </span>
        <span>
          {doc.views}
          {doc.maxViews ? `/${doc.maxViews}` : ''} views
        </span>
        <span className="flex items-center gap-1">
          <span className="flex -space-x-1.5">
            {doc.recipients.slice(0, 4).map((r) => (
              <Avatar key={r} name={identities.find((i) => i.id === r)?.name ?? '?'} size={20} className="ring-2 ring-surface" />
            ))}
          </span>
          {doc.recipients.length} reader{doc.recipients.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        <Link to={`/apps/view/${doc.id}`} className={buttonClass('primary', 'sm')} data-testid="eo-open">
          <EyeOff className="size-3.5" /> Open
        </Link>
        {mine && (
          <>
            <Button
              size="sm"
              icon={<Link2 className="size-3.5" />}
              onClick={async () => {
                await navigator.clipboard.writeText(link).catch(() => {})
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onLog}>
              Access log
            </Button>
            {!doc.revoked && (
              <Button
                size="sm"
                variant="ghost"
                icon={<Ban className="size-3.5" />}
                onClick={async () => {
                  await updateDoc(doc.id, { revoked: true })
                  refresh()
                }}
              >
                Revoke
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 className="size-3.5" />}
              aria-label="Delete"
              onClick={async () => {
                const g = await glance({ reason: `Delete “${doc.title}”`, app: 'eyes-only', expectIdentityId: me, allowRecent: true })
                if (!g.ok) return
                await deleteDoc(doc.id)
                refresh()
              }}
            />
          </>
        )}
      </div>
    </Card>
  )
}

const EXPIRY = [
  { label: '1 hour', ms: 3_600_000 },
  { label: '24 hours', ms: 86_400_000 },
  { label: '7 days', ms: 7 * 86_400_000 },
  { label: 'Never', ms: 0 },
]

function CreateDocModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const session = useSession()
  const log = useSuite((s) => s.log)
  const glance = useGlance()
  const { identities } = useIdentities()
  const readers = identities.filter((i) => i.status === 'active')
  const [form, setForm] = useState({ title: '', hideTitle: false, type: 'text' as 'text' | 'image', text: '', image: '', fileName: '', recipients: [] as string[], expiry: 1, maxViews: 0 })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const toggleReader = (id: string) =>
    setForm((f) => ({ ...f, recipients: f.recipients.includes(id) ? f.recipients.filter((x) => x !== id) : [...f.recipients, id] }))

  const submit = async () => {
    if (!form.title.trim()) return setError('Give it a title.')
    if (form.type === 'text' ? !form.text.trim() : !form.image) return setError(form.type === 'text' ? 'Write something.' : 'Choose an image.')
    setError(null)
    const g = await glance({ reason: 'Seal this document', app: 'eyes-only', expectIdentityId: session.identityId, allowRecent: true })
    if (!g.ok) return setError('Glance not approved.')
    setBusy(true)
    const recipients = [...new Set([session.identityId!, ...form.recipients])]
    const expiryMs = EXPIRY[form.expiry].ms
    const id = await createDoc(
      {
        ownerId: session.identityId!,
        ownerName: session.name ?? '',
        title: form.title.trim(),
        hideTitle: form.hideTitle,
        contentType: form.type,
        recipients,
        expiresAt: expiryMs ? Date.now() + expiryMs : null,
        maxViews: form.maxViews || null,
      },
      form.type === 'text' ? { text: form.text } : { image: form.image, fileName: form.fileName },
    )
    log({ app: 'eyes-only', action: 'create', detail: `Sealed “${form.title.trim()}” for ${recipients.length} reader(s)`, identityId: session.identityId, name: session.name ?? '', ok: true, ref: id })
    setBusy(false)
    setForm({ title: '', hideTitle: false, type: 'text', text: '', image: '', fileName: '', recipients: [], expiry: 1, maxViews: 0 })
    onCreated()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={600}
      title="New eyes-only document"
      description="Sealed on this device. Readers must verify with a glance, and must keep looking to keep reading."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={<Send className="size-4" />} onClick={submit} loading={busy} data-testid="eo-create">
            Seal & share
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title">
          <Input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Q4 board memo" data-testid="eo-title" />
        </Field>
        <div className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5">
          <span className="text-[13px] text-ink">Hide the title from readers’ lists too</span>
          <Toggle checked={form.hideTitle} onChange={(hideTitle) => setForm({ ...form, hideTitle })} label="Hide title" />
        </div>
        <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
          {(['text', 'image'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setForm({ ...form, type: t })}
              className={cx('rounded-md px-3 py-1.5 text-[12.5px] font-medium', form.type === t ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-muted')}
            >
              {t === 'text' ? 'Text' : 'Image'}
            </button>
          ))}
        </div>
        {form.type === 'text' ? (
          <textarea
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            rows={7}
            placeholder="Write the confidential content…"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-[var(--shadow-card)] outline-none focus:border-accent/60 focus:ring-3 focus:ring-accent/15"
            data-testid="eo-text"
          />
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface-2/40 px-4 py-8 text-center text-[13px] text-muted hover:bg-surface-2">
            {form.image ? <img src={form.image} alt="" className="max-h-40 rounded-lg" /> : <ImageIcon className="mb-2 size-6" />}
            <span className="mt-2">{form.fileName || 'Choose an image (up to 4 MB)'}</span>
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.size > 4 * 1024 * 1024) return setError('Image is larger than 4 MB.')
                const reader = new FileReader()
                reader.onload = () => setForm((f) => ({ ...f, image: String(reader.result), fileName: file.name }))
                reader.readAsDataURL(file)
              }}
            />
          </label>
        )}
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-ink">Readers</div>
          <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
            {readers
              .filter((i) => i.id !== session.identityId)
              .map((i) => {
                const on = form.recipients.includes(i.id)
                return (
                  <button
                    key={i.id}
                    onClick={() => toggleReader(i.id)}
                    data-testid="eo-reader"
                    className={cx(
                      'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[12.5px] font-medium transition',
                      on ? 'border-accent/40 bg-accent-soft text-accent-text' : 'border-line text-muted hover:text-ink',
                    )}
                  >
                    <Avatar name={i.name} size={18} /> {i.name}
                    {i.synthetic && <span className="text-[10.5px] text-subtle">demo</span>}
                  </button>
                )
              })}
          </div>
          <p className="mt-1.5 text-[12px] text-subtle">You are always a reader. Readers must be enrolled on this device (prototype).</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Expires after">
            <Select value={form.expiry} onChange={(e) => setForm({ ...form, expiry: Number(e.target.value) })}>
              {EXPIRY.map((x, i) => (
                <option key={x.label} value={i}>
                  {x.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="View limit">
            <Select value={form.maxViews} onChange={(e) => setForm({ ...form, maxViews: Number(e.target.value) })}>
              <option value={0}>Unlimited</option>
              <option value={1}>1 view (burn after reading)</option>
              <option value={3}>3 views</option>
              <option value={10}>10 views</option>
            </Select>
          </Field>
        </div>
        {error && <div className="text-[13px] text-bad">{error}</div>}
      </div>
    </Modal>
  )
}

function AccessLogModal({ doc, onClose }: { doc: DocMeta | null; onClose: () => void }) {
  const events = useSuite((s) => s.events)
  const rows = useMemo(() => (doc ? events.filter((e) => e.ref === doc.id) : []), [events, doc])
  return (
    <Modal open={!!doc} onClose={onClose} title="Access log" description={doc?.title} width={560}>
      {rows.length === 0 ? (
        <div className="py-6 text-center text-[13px] text-muted">No access attempts yet.</div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
              <span className="min-w-0">
                <span className="font-medium text-ink">{e.name}</span>
                <span className="text-muted"> · {e.detail}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge tone={e.ok ? 'ok' : 'bad'}>{e.ok ? 'OK' : 'Blocked'}</Badge>
                <span className="text-[12px] text-subtle">{timeAgo(e.at)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

