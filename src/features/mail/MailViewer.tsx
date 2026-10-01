import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, EyeOff, FileText, Lock, ScanEye, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { identityService } from '../../core/identity/IdentityService'
import { formatDateTime } from '../../ui/format'
import { cx } from '../../ui/primitives'
import { TerminalShell } from '../sensor/TerminalShell'
import { useGlance, usePresence } from '../suite/presence'
import { getDoc, type OpticDoc } from '../suite/secure'
import { useSession, useSuite } from '../suite/store'
import { inbox, markRead, openMail, sent, type MailMessage } from './store'

type Meta = Omit<MailMessage, 'sealed'>
type DocMeta = Omit<OpticDoc, 'sealed'>
type Phase =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'ready'; meta: Meta }
  | { kind: 'denied'; meta: Meta | null; title: string; detail: string; who?: string }
  | { kind: 'open'; meta: Meta; body: string; viewerId: string; viewerName: string; openedAt: number }

const MAX_OPEN_MS = 10 * 60_000

/**
 * Sealed mail reader. Mirrors the Eyes-Only document viewer exactly: the body
 * is revealed only while the verified recipient is looking at the screen, and
 * it is *removed* from the page (not blurred) for anyone else.
 */
export function MailViewer() {
  const { id } = useParams()
  const me = useSession((s) => s.identityId)
  const glance = useGlance()
  const log = useSuite((s) => s.log)
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })

  useEffect(() => {
    if (!id || !me) return
    let alive = true
    Promise.all([inbox(me), sent(me)]).then(([inb, snt]) => {
      if (!alive) return
      const m = inb.find((x) => x.id === id) ?? snt.find((x) => x.id === id)
      if (!m) return setPhase({ kind: 'missing' })
      if (!identityService.isSameAccount(m.toId, me)) {
        setPhase({ kind: 'denied', meta: m, title: 'RECIPIENT ONLY', detail: `This message is sealed for ${m.toName}. Only its recipient can open it.` })
        return
      }
      setPhase({ kind: 'ready', meta: m })
    })
    return () => {
      alive = false
    }
  }, [id, me])

  const verify = async (meta: Meta) => {
    const g = await glance({ reason: 'Verify you are the recipient', app: 'eyes-only', expectIdentityId: meta.toId, allowed: [meta.toId] })
    if (g.reason === 'cancelled') return
    if (!g.ok || !g.identityId || !identityService.isSameAccount(g.identityId, meta.toId)) {
      log({ app: 'eyes-only', action: 'open', detail: 'Mail — identity not the recipient', identityId: g.identityId, name: g.name ?? 'Unknown person', ok: false, ref: meta.id })
      setPhase({
        kind: 'denied',
        meta,
        title: g.identityId ? 'NOT THE RECIPIENT' : 'IDENTITY NOT RECOGNIZED',
        detail: g.identityId ? 'Your identity is verified, but this message wasn’t sent to you.' : 'This message can only be opened by its intended recipient.',
        who: g.name ?? undefined,
      })
      return
    }
    const body = await openMail(meta.id)
    if (body === null) return setPhase({ kind: 'missing' })
    await markRead(meta.id)
    log({ app: 'eyes-only', action: 'open', detail: `Opened mail “${meta.subject}”`, identityId: g.identityId, name: g.name ?? '', ok: true, ref: meta.id })
    setPhase({ kind: 'open', meta, body, viewerId: g.identityId, viewerName: g.name ?? '', openedAt: Date.now() })
  }

  return (
    <TerminalShell location="Eyes-only message" exitTo="/apps/mail">
      <div className="mt-4 w-full max-w-3xl">
        {phase.kind === 'loading' && <div className="h-64" />}
        {phase.kind === 'missing' && (
          <Panel icon={<AlertTriangle className="size-6 text-[#f5b454]" />} title="Message not found" body="It may have been recalled by the sender, deleted, or it lives on a different device." testId="mail-locked" />
        )}
        {phase.kind === 'ready' && (
          <Panel
            icon={<ScanEye className="size-6 text-scan-accent" />}
            title={phase.meta.subject}
            body={`From ${phase.meta.fromName}. Only you can open this, and it stays on screen only while you are looking at it.`}
            eyebrow={`Sealed message · ${formatDateTime(phase.meta.createdAt)}`}
          >
            <button onClick={() => verify(phase.meta)} className="mt-6 h-11 rounded-xl bg-white px-6 text-[14px] font-semibold text-black hover:bg-white/90" data-testid="mail-open">
              Look to open
            </button>
          </Panel>
        )}
        {phase.kind === 'denied' && (
          <Panel icon={<X className="size-6 text-denied" />} title={phase.title} body={phase.detail} eyebrow={phase.who ? `Identity verified · ${phase.who}` : 'Access denied'} testId="mail-locked">
            {phase.meta && identityService.isSameAccount(phase.meta.toId, me) && (
              <button onClick={() => setPhase({ kind: 'ready', meta: phase.meta! })} className="mt-6 text-[13px] text-white/50 hover:text-white/80">
                Try again
              </button>
            )}
          </Panel>
        )}
        {phase.kind === 'open' && <ProtectedView phase={phase} onClose={() => setPhase({ kind: 'ready', meta: phase.meta })} />}
      </div>
    </TerminalShell>
  )
}

function Panel({
  icon,
  title,
  body,
  eyebrow,
  children,
  testId,
}: {
  icon: React.ReactNode
  title: string
  body: string
  eyebrow?: string
  children?: React.ReactNode
  testId?: string
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-white/10 bg-white/[0.03] px-8 py-10 text-center" data-testid={testId}>
      <div className="flex size-14 items-center justify-center rounded-full border border-white/15 bg-white/5">{icon}</div>
      {eyebrow && <div className="mt-5 font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase">{eyebrow}</div>}
      <div className="mt-3 text-[20px] font-semibold tracking-tight text-white">{title}</div>
      <p className="mt-2 text-[14px] leading-relaxed text-white/60">{body}</p>
      {children}
    </div>
  )
}

function ProtectedView({ phase, onClose }: { phase: Extract<Phase, { kind: 'open' }>; onClose: () => void }) {
  const p = usePresence({ identify: true })
  const log = useSuite((s) => s.log)
  const [now, setNow] = useState(Date.now())
  const [attachments, setAttachments] = useState<DocMeta[]>([])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    let alive = true
    Promise.all(phase.meta.docIds.map((d) => getDoc(d))).then((docs) => {
      if (alive) setAttachments(docs.filter((d): d is DocMeta => !!d))
    })
    return () => {
      alive = false
    }
  }, [phase.meta.docIds])

  const reader = p.who !== null && p.who !== 'unknown' && identityService.isSameAccount(p.who.identityId, phase.viewerId)
  const hiddenReason =
    p.status.state !== 'running'
      ? 'Sensor starting'
      : p.faces === 'multiple'
        ? 'shoulder'
        : p.faces === 'none'
          ? 'away'
          : p.who === 'unknown' || (p.who !== null && !reader)
            ? 'stranger'
            : !p.looking
              ? 'look-away'
              : !reader
                ? 'checking'
                : null
  // Only a positively re-identified recipient who is looking sees the content.
  const visible = hiddenReason === null && reader

  const lastLog = useRef(0)
  useEffect(() => {
    if ((hiddenReason === 'shoulder' || hiddenReason === 'stranger') && Date.now() - lastLog.current > 10_000) {
      lastLog.current = Date.now()
      log({
        app: 'eyes-only',
        action: 'hidden',
        detail: hiddenReason === 'shoulder' ? 'Mail hidden — second person looking' : 'Mail hidden — someone else at the screen',
        identityId: phase.viewerId,
        name: phase.viewerName,
        ok: false,
        ref: phase.meta.id,
      })
    }
  }, [hiddenReason, log, phase])

  useEffect(() => {
    if (now - phase.openedAt > MAX_OPEN_MS) onClose()
  }, [now, phase.openedAt, onClose])

  const copy: Record<string, { icon: React.ReactNode; text: string }> = {
    away: { icon: <EyeOff className="size-5" />, text: 'Look back at the screen to keep reading' },
    'look-away': { icon: <EyeOff className="size-5" />, text: 'Look back at the screen to keep reading' },
    shoulder: { icon: <Users className="size-5 text-denied" />, text: 'Another person is looking — content hidden' },
    stranger: { icon: <Lock className="size-5 text-denied" />, text: 'This isn’t the intended recipient — content hidden' },
    'Sensor starting': { icon: <ScanEye className="size-5" />, text: 'Starting sensor…' },
    checking: { icon: <ScanEye className="size-5" />, text: 'Confirming it’s you…' },
  }
  const watermark = `${phase.viewerName} · ${new Date(now).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`

  return (
    <div data-testid="mail-viewer">
      <div className="mb-3 flex items-center justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[11px] tracking-[0.22em] text-white/45 uppercase">Eyes-only · {phase.viewerName}</div>
          <div className="truncate text-[18px] font-semibold text-white">{phase.meta.subject}</div>
          <div className="text-[12.5px] text-white/50">From {phase.meta.fromName}</div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cx(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] tracking-[0.14em] uppercase',
              visible ? 'border-granted/30 text-granted' : 'border-denied/30 text-denied',
            )}
            data-testid="mail-visibility"
            data-visible={visible}
          >
            <span className="size-1.5 rounded-full bg-current" /> {visible ? 'Visible' : 'Hidden'}
          </span>
          <button onClick={onClose} className="rounded-full border border-white/10 px-3 py-1 text-[12px] text-white/60 hover:text-white">
            Close
          </button>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#f7f7f4] text-[#111]">
        <div className="min-h-[360px] p-8 select-none" onCopy={(e) => e.preventDefault()}>
          {visible ? (
            <>
              <div className="text-[15.5px] leading-relaxed whitespace-pre-wrap" data-testid="mail-body-text">
                {phase.body}
              </div>
              {attachments.length > 0 && (
                <div className="mt-6 border-t border-black/10 pt-4">
                  <div className="mb-2 font-mono text-[10.5px] tracking-[0.18em] text-black/40 uppercase">Eyes-only attachments</div>
                  <div className="flex flex-col gap-2">
                    {attachments.map((d) => (
                      <Link
                        key={d.id}
                        to={`/apps/view/${d.id}`}
                        className="flex items-center gap-2 rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-[13.5px] font-medium text-[#111] hover:bg-black/[0.06]"
                        data-testid="mail-attachment"
                      >
                        <FileText className="size-4 text-black/50" /> {d.hideTitle ? 'Eyes-only document' : d.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            // Not blurred — removed. Hidden content is not in the page at all.
            <div className="space-y-3" aria-hidden>
              {[92, 78, 88, 64, 84, 70, 90, 56].map((w, i) => (
                <div key={i} className="h-3 rounded-full bg-black/[0.07]" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.08]" style={{ transform: 'rotate(-24deg) scale(1.5)' }}>
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} className="font-mono text-[13px] whitespace-nowrap text-black" style={{ marginTop: 22 }}>
              {Array(8).fill(watermark).join('      ')}
            </div>
          ))}
        </div>
        <AnimatePresence>
          {!visible && hiddenReason && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2.5 rounded-2xl bg-black/80 px-5 py-3 text-[14px] text-white" data-testid="mail-locked">
                {copy[hiddenReason].icon}
                {copy[hiddenReason].text}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-3 text-center text-[12px] text-white/40">
        Closes automatically after 10 minutes. Copying is disabled; the watermark identifies the reader.{' '}
        <Link to="/apps/mail" className="underline-offset-4 hover:underline">
          Back to inbox
        </Link>
      </div>
    </div>
  )
}
