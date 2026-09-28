import { Fingerprint, Link2, ScanEye, Unlink } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useStore } from '../../state/store'
import { timeAgo } from '../../ui/format'
import { Badge, Button, buttonClass, Select } from '../../ui/primitives'
import { useIdentities } from '../sensor/hooks'

/**
 * Identity-layer status for a person record. Shows metadata only — never
 * biometric data — and offers enroll / link / unlink.
 */
export function OpticIdentityCard({
  identityId,
  forParam,
  onLink,
  enrollLabel = 'Enroll Optic Identity',
}: {
  identityId: string | null
  /** e.g. "employee:emp_sarah" */
  forParam: string
  onLink: (identityId: string | null) => void
  enrollLabel?: string
}) {
  const location = useLocation()
  const { identities, scans } = useIdentities()
  const office = useStore((s) => s.office)
  const hotel = useStore((s) => s.hotel)
  const [linking, setLinking] = useState(false)
  const identity = identities.find((i) => i.id === identityId)
  const own = scans.filter((s) => s.identityId === identityId)
  const lastMatch = Math.max(0, ...own.map((s) => s.lastMatchedAt ?? 0))
  const returnTo = encodeURIComponent(location.pathname + location.search)
  const enrollHref = `/lab/enroll?for=${forParam}&return=${returnTo}`

  const linked = new Set([
    ...office.employees.map((e) => e.identityId),
    ...office.visitors.map((v) => v.identityId),
    ...hotel.guests.map((g) => g.identityId),
  ])
  const linkable = identities.filter((i) => !i.synthetic && !linked.has(i.id))

  if (!identity) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong bg-surface-2/40 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-muted">
            <Fingerprint className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-medium text-ink">No Optic identity</div>
            <p className="mt-0.5 text-[12.5px] text-muted">Enroll their eyes at a sensor, or link an existing enrollment.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to={enrollHref} className={buttonClass('primary', 'sm')} data-testid="enroll-optic">
                <ScanEye className="size-3.5" /> {enrollLabel}
              </Link>
              {linkable.length > 0 && !linking && (
                <Button size="sm" onClick={() => setLinking(true)} icon={<Link2 className="size-3.5" />}>
                  Link existing
                </Button>
              )}
            </div>
            {linking && (
              <Select className="mt-2 h-8 text-[13px]" defaultValue="" onChange={(e) => e.target.value && onLink(e.target.value)} data-testid="link-identity">
                <option value="">Choose an enrolled identity…</option>
                {linkable.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} {i.email ? `· ${i.email}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-line bg-surface-2/40 p-4" data-testid="optic-identity">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ok-soft text-ok">
          <Fingerprint className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13.5px] font-medium text-ink">Optic identity enrolled</span>
            {identity.synthetic ? <Badge tone="warn">Demo persona</Badge> : <Badge tone="accent">Webcam</Badge>}
            {identity.status === 'revoked' && <Badge tone="bad">Revoked</Badge>}
          </div>
          <div className="mt-0.5 text-[12.5px] text-muted">
            {own.length} optic scan{own.length === 1 ? '' : 's'} · {lastMatch ? `last verified ${timeAgo(lastMatch, Date.now())}` : 'not verified yet'}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-subtle">{identity.id}</div>
          <p className="mt-2 text-[11.5px] text-subtle">Biometric templates are sealed and never shown in this console.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to={enrollHref} className={buttonClass('secondary', 'sm')}>
              <ScanEye className="size-3.5" /> {identity.synthetic ? 'Enroll real eyes' : 'Add scan'}
            </Link>
            <Button size="sm" variant="ghost" onClick={() => onLink(null)} icon={<Unlink className="size-3.5" />}>
              Unlink
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
