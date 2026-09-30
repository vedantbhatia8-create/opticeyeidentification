import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, EyeOff, Lock, ScanEye, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { identityService } from '../../core/identity/IdentityService'
import { Link, useParams } from 'react-router-dom'
import { authorize } from '../../core/authorization/engine'
import type { Principal } from '../../core/authorization/types'
import { formatDateTime } from '../../ui/format'
import { cx } from '../../ui/primitives'
import { TerminalShell } from '../sensor/TerminalShell'
import { useGlance, usePresence } from './presence'
import { getDoc, openDoc, type DocContent, type OpticDoc } from './secure'
import { useSuite } from './store'

type Meta = Omit<OpticDoc, 'sealed'>
type Phase =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'ready'; meta: Meta }
  | { kind: 'denied'; meta: Meta | null; title: string; detail: string; who?: string }
  | { kind: 'open'; meta: Meta; content: DocContent; viewerId: string; viewerName: string; openedAt: number }

const MAX_OPEN_MS = 10 * 60_000

/** Same policy engine as the doors: the document is the resource, readers hold time-boxed grants. */
function docPrincipal(meta: Meta, identityId: string, name: string): Principal | null {
  if (!meta.recipients.includes(identityId)) return null
  return {
    id: identityId,
    kind: 'member',
    displayName: name,
    status: meta.revoked ? 'revoked' : 'active',
    window: { from: meta.createdAt, until: meta.expiresAt ?? Number.MAX_SAFE_INTEGER },
    grants: [{ resourceId: meta.id, schedule: { type: 'always' }, source: { kind: 'direct', id: meta.id, label: 'Eyes-only share' } }],
  }
}

export function EyesOnlyViewer() {
  const { docId } = useParams()
  const glance = useGlance()
  const log = useSuite((s) => s.log)
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })

  useEffect(() => {
    if (!docId) return
    getDoc(docId).then((meta) => setPhase(meta ? { kind: 'ready', meta } : { kind: 'missing' }))
  }, [docId])

  const verify = async (meta: Meta) => {
    const g = await glance({ reason: 'Verify you are an intended reader', app: 'eyes-only' })
    if (g.reason === 'cancelled') return
    const fresh = (await getDoc(meta.id)) ?? meta
    if (!g.ok || !g.identityId) {
      log({ app: 'eyes-only', action: 'open', detail: 'Unrecognized person tried to open', identityId: null, name: 'Unknown person', ok: false, ref: meta.id })
      setPhase({ kind: 'denied', meta: fresh, title: 'IDENTITY NOT RECOGNIZED', detail: 'This document can only be opened by its intended readers.' })
      return
    }
    const principal = docPrincipal(fresh, g.identityId, g.name ?? '')
    const result = authorize(principal, { id: fresh.id, name: fresh.title, online: true, mode: 'normal' }, Date.now())
    const overLimit = fresh.maxViews !== null && fresh.views >= fresh.maxViews
    if (!result.allowed || overLimit) {
      const copy = overLimit
        ? { title: 'VIEW LIMIT REACHED', detail: 'This document has already been viewed the maximum number of times.' }
        : result.code === 'no-principal'
          ? { title: 'NOT AN INTENDED READER', detail: 'Your identity is verified, but this document wasn’t shared with you.' }
          : result.code === 'window-expired'
            ? { title: 'DOCUMENT EXPIRED', detail: `Access ended ${formatDateTime(fresh.expiresAt!)}.` }
            : result.code === 'principal-suspended'
              ? { title: 'ACCESS REVOKED', detail: 'The owner revoked this document.' }
              : { title: 'ACCESS DENIED', detail: 'You can’t open this document.' }
      log({ app: 'eyes-only', action: 'open', detail: copy.title.toLowerCase(), identityId: g.identityId, name: g.name ?? '', ok: false, ref: fresh.id })
      setPhase({ kind: 'denied', meta: fresh, ...copy, who: g.name ?? undefined })
      return
    }
    const content = await openDoc(fresh.id)
    if (!content) return setPhase({ kind: 'missing' })
    log({ app: 'eyes-only', action: 'open', detail: 'Opened document', identityId: g.identityId, name: g.name ?? '', ok: true, ref: fresh.id })
    setPhase({ kind: 'open', meta: fresh, content, viewerId: g.identityId, viewerName: g.name ?? '', openedAt: Date.now() })
  }

  return (
    <TerminalShell location="Eyes-only document" exitTo="/apps/eyes-only">
      <div className="mt-4 w-full max-w-3xl">
        {phase.kind === 'loading' && <div className="h-64" />}
        {phase.kind === 'missing' && (
          <Panel icon={<AlertTriangle className="size-6 text-[#f5b454]" />} title="Document not found" body="It may have been deleted, or it lives on a different device." />
        )}
        {phase.kind === 'ready' && (
          <Panel
            icon={<ScanEye className="size-6 text-scan-accent" />}
            title={phase.meta.hideTitle ? 'Eyes-only document' : phase.meta.title}
            body={`From ${phase.meta.ownerName}. Only intended readers can open this, and it stays visible only while they are looking at the screen.`}
          >
            <button onClick={() => verify(phase.meta)} className="mt-6 h-11 rounded-xl bg-white px-6 text-[14px] font-semibold text-black hover:bg-white/90" data-testid="eo-verify">
              Look to open
            </button>
          </Panel>
        )}
        {phase.kind === 'denied' && (
          <Panel icon={<X className="size-6 text-denied" />} title={phase.title} body={phase.detail} eyebrow={phase.who ? `Identity verified · ${phase.who}` : 'Access denied'} testId="eo-denied">
            {phase.meta && (
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
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])

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
  // Only a positively re-identified reader who is looking sees the content.
  const visible = hiddenReason === null && reader

  // Log shoulder-surfing / strangers (throttled).
  const lastLog = useRef(0)
  useEffect(() => {
    if ((hiddenReason === 'shoulder' || hiddenReason === 'stranger') && Date.now() - lastLog.current > 10_000) {
      lastLog.current = Date.now()
      log({
        app: 'eyes-only',
        action: 'hidden',
        detail: hiddenReason === 'shoulder' ? 'Hidden — second person looking' : 'Hidden — someone else at the screen',
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
    stranger: { icon: <Lock className="size-5 text-denied" />, text: 'This isn’t the intended reader — content hidden' },
    'Sensor starting': { icon: <ScanEye className="size-5" />, text: 'Starting sensor…' },
    checking: { icon: <ScanEye className="size-5" />, text: 'Confirming it’s you…' },
  }
  const watermark = `${phase.viewerName} · ${new Date(now).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`

  return (
    <div data-testid="eo-open-view">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-mono text-[11px] tracking-[0.22em] text-white/45 uppercase">Eyes-only · {phase.viewerName}</div>
          <div className="text-[18px] font-semibold text-white">{phase.meta.title}</div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cx(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] tracking-[0.14em] uppercase',
              visible ? 'border-granted/30 text-granted' : 'border-denied/30 text-denied',
            )}
            data-testid="eo-visibility"
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
              {phase.content.text && <div className="text-[15.5px] leading-relaxed whitespace-pre-wrap" data-testid="eo-content">{phase.content.text}</div>}
              {phase.content.image && <img src={phase.content.image} alt="" className="mx-auto max-h-[70vh] rounded-lg" draggable={false} />}
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
        {/* Watermark deters photographing the screen */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.08]"
          style={{ transform: 'rotate(-24deg) scale(1.5)' }}
        >
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} className="font-mono text-[13px] whitespace-nowrap text-black" style={{ marginTop: 22 }}>
              {Array(8).fill(watermark).join('      ')}
            </div>
          ))}
        </div>
        <AnimatePresence>
          {!visible && hiddenReason && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2.5 rounded-2xl bg-black/80 px-5 py-3 text-[14px] text-white" data-testid="eo-hidden-reason">
                {copy[hiddenReason].icon}
                {copy[hiddenReason].text}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-3 text-center text-[12px] text-white/40">
        Closes automatically after 10 minutes. Copying is disabled; the watermark identifies the reader. <Link to="/apps/eyes-only" className="underline-offset-4 hover:underline">Back to documents</Link>
      </div>
    </div>
  )
}
