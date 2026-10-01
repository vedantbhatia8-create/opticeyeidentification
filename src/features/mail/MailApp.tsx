import { FileText, Lock, Mail, Paperclip, Plus, Send, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { identityService } from '../../core/identity/IdentityService'
import { timeAgo } from '../../ui/format'
import { Modal } from '../../ui/overlay'
import { Avatar, Badge, Button, Card, cx, EmptyState, Field, Input, Select } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'
import { useIdentities } from '../sensor/hooks'
import { EyesOnlyApp } from '../suite/EyesOnlyApp'
import { useGlance } from '../suite/presence'
import { createDoc } from '../suite/secure'
import { useSession, useSuite } from '../suite/store'
import { inbox, revokeMail, sendMail, sent, type MailMessage } from './store'

type Meta = Omit<MailMessage, 'sealed'>
type Tab = 'inbox' | 'sent' | 'documents'

export function MailApp() {
  const me = useSession((s) => s.identityId)!
  const myName = useSession((s) => s.name) ?? ''
  const [params, setParams] = useSearchParams()
  const initial = (params.get('tab') as Tab) || 'inbox'
  const [tab, setTab] = useState<Tab>(['inbox', 'sent', 'documents'].includes(initial) ? initial : 'inbox')
  const [composing, setComposing] = useState(false)
  const [inboxMsgs, setInboxMsgs] = useState<Meta[]>([])
  const [sentMsgs, setSentMsgs] = useState<Meta[]>([])

  const refresh = useCallback(() => {
    void inbox(me).then(setInboxMsgs)
    void sent(me).then(setSentMsgs)
  }, [me])
  useEffect(() => {
    refresh()
  }, [refresh])

  const selectTab = (t: Tab) => {
    setTab(t)
    setParams(t === 'inbox' ? {} : { tab: t }, { replace: true })
  }

  const unread = inboxMsgs.filter((m) => m.readAt === null).length

  return (
    <>
      <PageHeader
        title="Optic Mail"
        description="Eyes-only email: every message is sealed and shows only while the verified recipient is looking. Attach eyes-only documents that stay protected too."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setComposing(true)} data-testid="mail-compose">
            Compose
          </Button>
        }
      />

      <div className="mb-4 inline-flex gap-0.5 rounded-xl border border-line bg-surface/70 p-1 shadow-[var(--shadow-card)] backdrop-blur">
        {(
          [
            ['inbox', 'Inbox', unread, 'mail-tab-inbox'],
            ['sent', 'Sent', 0, 'mail-tab-sent'],
            ['documents', 'Documents', 0, 'mail-tab-documents'],
          ] as const
        ).map(([k, label, count, tid]) => (
          <button
            key={k}
            onClick={() => selectTab(k)}
            data-testid={tid}
            className={cx(
              'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition',
              tab === k ? 'bg-accent-soft text-accent-text shadow-[var(--glow)]' : 'text-muted hover:bg-surface-2 hover:text-ink',
            )}
          >
            {label}
            {count > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-accent-contrast">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'documents' ? (
        <EyesOnlyApp embedded />
      ) : tab === 'inbox' ? (
        <MessageList messages={inboxMsgs} mode="inbox" refresh={refresh} onCompose={() => setComposing(true)} />
      ) : (
        <MessageList messages={sentMsgs} mode="sent" refresh={refresh} onCompose={() => setComposing(true)} />
      )}

      <ComposeModal open={composing} me={{ id: me, name: myName }} onClose={() => setComposing(false)} onSent={() => { setComposing(false); selectTab('sent'); refresh() }} />
    </>
  )
}

function MessageList({ messages, mode, refresh, onCompose }: { messages: Meta[]; mode: 'inbox' | 'sent'; refresh: () => void; onCompose: () => void }) {
  if (messages.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Mail className="size-5" />}
          title={mode === 'inbox' ? 'Your inbox is empty' : 'You haven’t sent anything yet'}
          description={mode === 'inbox' ? 'Sealed messages addressed to you will appear here.' : 'Compose a sealed message to another Optic account.'}
          action={
            <Button variant="primary" size="sm" onClick={onCompose}>
              Compose
            </Button>
          }
        />
      </Card>
    )
  }
  return (
    <Card className="divide-y divide-line overflow-hidden">
      {messages.map((m) => (
        <MessageRow key={m.id} msg={m} mode={mode} refresh={refresh} />
      ))}
    </Card>
  )
}

function MessageRow({ msg, mode, refresh }: { msg: Meta; mode: 'inbox' | 'sent'; refresh: () => void }) {
  const unread = mode === 'inbox' && msg.readAt === null
  const who = mode === 'inbox' ? msg.fromName : msg.toName
  const [busy, setBusy] = useState(false)
  const glance = useGlance()
  const me = useSession((s) => s.identityId)

  return (
    <div className={cx('relative flex items-center gap-3 py-3 pr-4 pl-5 transition hover:bg-surface-2/50', unread && 'bg-accent-soft/30')} data-testid="mail-item">
      {unread && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />}
      <Link to={`/apps/mail/view/${msg.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="relative shrink-0">
          <Avatar name={who} size={38} />
          {unread && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-accent" data-testid="mail-unread" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cx('truncate text-[14px]', unread ? 'font-semibold text-ink' : 'font-medium text-ink')}>{who}</span>
            {msg.docIds.length > 0 && <Paperclip className="size-3.5 shrink-0 text-subtle" />}
            <span className="ml-auto shrink-0 text-[12px] text-subtle sm:hidden">{timeAgo(msg.createdAt)}</span>
          </div>
          <div className={cx('truncate text-[13px]', unread ? 'font-medium text-ink' : 'text-muted')}>{msg.subject || '(no subject)'}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-subtle">
            <Lock className="size-3" /> Sealed · opens only for {mode === 'inbox' ? 'your eyes' : 'the recipient'}
          </div>
        </div>
      </Link>
      <Badge tone="accent" className="hidden sm:inline-flex">
        <Lock className="size-3" /> Eyes-only
      </Badge>
      <span className="hidden w-[72px] shrink-0 text-right text-[12px] text-subtle sm:block">{timeAgo(msg.createdAt)}</span>
      {mode === 'sent' && (
        <Button
          size="sm"
          variant="ghost"
          icon={<Undo2 className="size-3.5" />}
          loading={busy}
          data-testid="mail-recall"
          onClick={async () => {
            const g = await glance({ reason: `Recall “${msg.subject}”`, app: 'eyes-only', expectIdentityId: me, allowRecent: true })
            if (!g.ok) return
            setBusy(true)
            await revokeMail(msg.id)
            setBusy(false)
            refresh()
          }}
        >
          Recall
        </Button>
      )}
    </div>
  )
}

function ComposeModal({ open, me, onClose, onSent }: { open: boolean; me: { id: string; name: string }; onClose: () => void; onSent: () => void }) {
  const { identities } = useIdentities()
  const glance = useGlance()
  const log = useSuite((s) => s.log)
  const recipients = useMemo(
    () => identities.filter((i) => !i.synthetic && i.status === 'active' && !identityService.isSameAccount(i.id, me.id)),
    [identities, me.id],
  )

  const [toId, setToId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [docIds, setDocIds] = useState<string[]>([])
  const [attachTitles, setAttachTitles] = useState<Record<string, string>>({})
  const [attaching, setAttaching] = useState(false)
  const [attachTitle, setAttachTitle] = useState('')
  const [attachText, setAttachText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setToId('')
      setSubject('')
      setBody('')
      setDocIds([])
      setAttachTitles({})
      setAttaching(false)
      setAttachTitle('')
      setAttachText('')
      setError(null)
    }
  }, [open])

  const to = recipients.find((r) => r.id === toId)

  const addAttachment = async () => {
    if (!to) return setError('Choose a recipient before attaching a document.')
    const title = attachTitle.trim() || 'Eyes-only attachment'
    const id = await createDoc(
      {
        ownerId: me.id,
        ownerName: me.name,
        title,
        hideTitle: false,
        contentType: 'text',
        recipients: [me.id, to.id],
        expiresAt: null,
        maxViews: null,
      },
      { text: attachText },
    )
    setDocIds((d) => [...d, id])
    setAttachTitles((t) => ({ ...t, [id]: title }))
    setAttaching(false)
    setAttachTitle('')
    setAttachText('')
    setError(null)
  }

  const removeAttachment = (id: string) => setDocIds((d) => d.filter((x) => x !== id))

  const submit = async () => {
    if (!to) return setError('Choose a recipient.')
    if (!subject.trim()) return setError('Add a subject.')
    if (!body.trim() && docIds.length === 0) return setError('Write a message or attach a document.')
    setError(null)
    const g = await glance({ reason: 'Send sealed message', app: 'eyes-only', expectIdentityId: me.id, allowRecent: true })
    if (!g.ok) return setError('Glance not approved.')
    setBusy(true)
    await sendMail({ id: me.id, name: me.name }, { toId: to.id, toName: to.name, subject: subject.trim(), body, docIds })
    log({ app: 'eyes-only', action: 'send', detail: `Sent “${subject.trim()}” to ${to.name}`, identityId: me.id, name: me.name, ok: true })
    setBusy(false)
    onSent()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={600}
      title="New sealed message"
      description="Sealed on this device. Your recipient must verify with a glance, and must keep looking to keep reading."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={<Send className="size-4" />} onClick={submit} loading={busy} data-testid="mail-send">
            Seal & send
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="To">
          <Select value={toId} onChange={(e) => setToId(e.target.value)} data-testid="mail-to">
            <option value="">Choose a recipient…</option>
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.email ? ` · ${r.email}` : ''}
              </option>
            ))}
          </Select>
          {recipients.length === 0 && <p className="mt-1.5 text-[12px] text-subtle">No other enrolled Optic accounts on this device yet.</p>}
        </Field>
        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Confidential update" data-testid="mail-subject" />
        </Field>
        <div>
          <span className="mb-1.5 block text-[12.5px] font-medium text-muted">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={7}
            placeholder="Write the confidential message…"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-[var(--shadow-card)] outline-none focus:border-accent/60 focus:ring-3 focus:ring-accent/15"
            data-testid="mail-body"
          />
        </div>

        <div className="rounded-xl border border-line p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[13px] text-ink">
              <Paperclip className="size-3.5 text-subtle" /> Eyes-only attachments
            </span>
            <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setAttaching((v) => !v)} data-testid="mail-attach">
              Attach eyes-only document
            </Button>
          </div>
          {docIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {docIds.map((id) => (
                <span key={id} className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-soft px-2 py-1 text-[12px] text-accent-text" data-testid="mail-attachment-chip">
                  <FileText className="size-3.5" /> {attachTitles[id] ?? 'Document'}
                  <button onClick={() => removeAttachment(id)} aria-label="Remove attachment" className="text-accent-text/70 hover:text-accent-text">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {attaching && (
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              <Input value={attachTitle} onChange={(e) => setAttachTitle(e.target.value)} placeholder="Document title" data-testid="mail-attach-title" />
              <textarea
                value={attachText}
                onChange={(e) => setAttachText(e.target.value)}
                rows={4}
                placeholder="Sealed document content…"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent/60 focus:ring-3 focus:ring-accent/15"
                data-testid="mail-attach-text"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setAttaching(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={addAttachment} data-testid="mail-attach-add">
                  Seal & attach
                </Button>
              </div>
            </div>
          )}
        </div>

        {error && <div className="text-[13px] text-bad">{error}</div>}
      </div>
    </Modal>
  )
}
