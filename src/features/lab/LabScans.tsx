import { Check, Eye, Fingerprint, Pencil, Plus, ShieldOff, ShieldCheck, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { irisCodeGrid } from '../../core/biometric/irisCode'
import type { OpticTemplate } from '../../core/biometric/types'
import type { Identity, OpticScan } from '../../core/identity/types'
import { identityService } from '../../state/services'
import { useStore } from '../../state/store'
import { formatBytes, formatDateTime, timeAgo } from '../../ui/format'
import { Modal } from '../../ui/overlay'
import { Avatar, Badge, Button, buttonClass, Card, EmptyState, Input, cx } from '../../ui/primitives'
import { useIdentities } from '../sensor/hooks'

type Filter = 'real' | 'demo' | 'all'

export function useIdentityLinks() {
  const office = useStore((s) => s.office)
  const hotel = useStore((s) => s.hotel)
  return (identityId: string) => [
    ...office.employees.filter((e) => e.identityId === identityId).map((e) => `Employee · ${e.department}`),
    ...office.visitors.filter((v) => v.identityId === identityId).map((v) => `Visitor · ${v.company}`),
    ...hotel.guests.filter((g) => g.identityId === identityId).map((g) => `Guest · Room ${g.roomNumber}`),
  ]
}

export function LabScans() {
  const { identities, scans } = useIdentities()
  const [filter, setFilter] = useState<Filter>('real')
  const [inspect, setInspect] = useState<OpticScan | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Identity | null>(null)
  const links = useIdentityLinks()
  const clearIdentityLinks = useStore((s) => s.clearIdentityLinks)

  const shown = identities.filter((i) => (filter === 'all' ? true : filter === 'demo' ? i.synthetic : !i.synthetic))
  const counts = { real: identities.filter((i) => !i.synthetic).length, demo: identities.filter((i) => i.synthetic).length, all: identities.length }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Optic scans</h1>
          <p className="mt-1.5 max-w-2xl text-[14px] text-muted">
            Each scan is one enrollment: an encrypted template built from guided samples. Name scans to tell them apart
            — e.g. “Desk · daylight” or “With glasses”. An identity matches if any of its scans match.
          </p>
        </div>
        <Link to="/lab/enroll" className={buttonClass('primary')} data-testid="scans-enroll">
          <Plus className="size-4" /> Enroll identity
        </Link>
      </div>

      <div className="mt-6 inline-flex rounded-lg border border-line bg-surface p-0.5 shadow-[var(--shadow-card)]">
        {(['real', 'demo', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cx(
              'rounded-md px-3 py-1.5 text-[13px] font-medium transition',
              filter === f ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {f === 'real' ? 'Webcam enrollments' : f === 'demo' ? 'Demo personas' : 'All'}
            <span className="ml-1.5 text-subtle tabular">{counts[f]}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {shown.length === 0 && (
          <Card>
            <EmptyState
              icon={<Fingerprint className="size-5" />}
              title={filter === 'demo' ? 'No demo personas' : 'No optic scans yet'}
              description="Enroll an identity with your webcam. The scan will appear here, ready to be named."
              action={
                <Link to="/lab/enroll" className={buttonClass('primary', 'sm')}>
                  Enroll identity
                </Link>
              }
            />
          </Card>
        )}
        {shown.map((identity) => (
          <IdentityCard
            key={identity.id}
            identity={identity}
            scans={scans.filter((s) => s.identityId === identity.id)}
            links={links(identity.id)}
            onInspect={setInspect}
            onDelete={() => setConfirmDelete(identity)}
          />
        ))}
      </div>

      <InspectModal scan={inspect} onClose={() => setInspect(null)} />
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.name}?`}
        description="The identity and every template bound to it are destroyed. Linked people lose Optic access immediately."
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              data-testid="confirm-delete"
              onClick={async () => {
                if (!confirmDelete) return
                clearIdentityLinks(confirmDelete.id)
                await identityService.deleteIdentity(confirmDelete.id)
                setConfirmDelete(null)
              }}
            >
              Delete identity
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-muted">This cannot be undone. The person can be enrolled again later.</p>
      </Modal>
    </div>
  )
}

function IdentityCard({
  identity,
  scans,
  links,
  onInspect,
  onDelete,
}: {
  identity: Identity
  scans: OpticScan[]
  links: string[]
  onInspect: (s: OpticScan) => void
  onDelete: () => void
}) {
  const active = identity.status === 'active'
  return (
    <Card className="overflow-hidden" data-testid="identity-card">
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <Avatar name={identity.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-ink">{identity.name}</span>
            {identity.synthetic ? <Badge tone="warn">Demo persona</Badge> : <Badge tone="accent">Webcam</Badge>}
            {!active && <Badge tone="bad">Revoked</Badge>}
            {links.map((l) => (
              <Badge key={l}>{l}</Badge>
            ))}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-muted">
            {[identity.email, identity.externalId && `ID ${identity.externalId}`, `enrolled ${formatDateTime(identity.createdAt)}`]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link to={`/lab/enroll?identity=${identity.id}&return=/lab/scans`} className={buttonClass('secondary', 'sm')}>
            <Plus className="size-3.5" /> Add scan
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => identityService.updateIdentity(identity.id, { status: active ? 'revoked' : 'active' })}
            icon={active ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
          >
            {active ? 'Revoke' : 'Restore'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} icon={<Trash2 className="size-3.5" />} aria-label="Delete identity" />
        </div>
      </div>
      <div className="border-t border-line bg-surface-2/40">
        {scans.map((scan) => (
          <ScanRow key={scan.id} scan={scan} onInspect={() => onInspect(scan)} canDelete={scans.length > 1} />
        ))}
      </div>
    </Card>
  )
}

function ScanRow({ scan, onInspect, canDelete }: { scan: OpticScan; onInspect: () => void; canDelete: boolean }) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(scan.label)
  const save = async () => {
    await identityService.renameScan(scan.id, label)
    setEditing(false)
  }
  return (
    <div className="grid grid-cols-1 items-center gap-3 border-b border-line px-5 py-3 last:border-0 md:grid-cols-[1.6fr_1fr_1fr_auto]">
      <div className="flex min-w-0 items-center gap-3">
        <ScanGlyph fingerprint={scan.fingerprint} />
        {editing ? (
          <form
            className="flex flex-1 items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            <Input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus className="h-8" data-testid="rename-input" />
            <Button size="sm" type="submit" variant="primary" icon={<Check className="size-3.5" />} aria-label="Save name" />
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} icon={<X className="size-3.5" />} aria-label="Cancel" />
          </form>
        ) : (
          <div className="min-w-0">
            <button
              onClick={() => setEditing(true)}
              className="group flex max-w-full items-center gap-1.5 text-left text-[14px] font-medium text-ink"
              data-testid="scan-label-text"
            >
              <span className="truncate">{scan.label}</span>
              <Pencil className="size-3 shrink-0 text-subtle opacity-0 transition group-hover:opacity-100" />
            </button>
            <div className="font-mono text-[11px] text-subtle">{scan.fingerprint}</div>
          </div>
        )}
      </div>
      <div className="text-[12px] text-muted">
        <div>
          {scan.sampleCount} samples · {scan.poses.length}/5 poses
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1 w-20 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-ok" style={{ width: `${Math.round(scan.quality * 100)}%` }} />
          </div>
          <span className="tabular">{Math.round(scan.quality * 100)}% quality</span>
        </div>
      </div>
      <div className="text-[12px] text-muted">
        <div>{formatBytes(scan.sizeBytes)} encrypted</div>
        <div className="mt-0.5">
          {scan.matchCount} match{scan.matchCount === 1 ? '' : 'es'}
          {scan.lastMatchedAt && ` · last matched ${timeAgo(scan.lastMatchedAt).toLowerCase()}`}
        </div>
      </div>
      <div className="flex items-center gap-1 md:justify-end">
        <Button size="sm" variant="ghost" onClick={onInspect} icon={<Eye className="size-3.5" />}>
          Inspect
        </Button>
        {canDelete && (
          <Button size="sm" variant="ghost" onClick={() => identityService.deleteScan(scan.id)} icon={<Trash2 className="size-3.5" />} aria-label="Delete scan" />
        )}
      </div>
    </div>
  )
}

/** Deterministic glyph from the (non-reversible) template fingerprint. */
function ScanGlyph({ fingerprint }: { fingerprint: string }) {
  const bytes = fingerprint.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []
  return (
    <svg viewBox="0 0 40 40" className="size-9 shrink-0 rounded-lg border border-line bg-surface">
      {bytes.map((b, i) => {
        const r = 5 + i * 1.8
        const start = (b / 255) * Math.PI * 2
        const len = 0.9 + ((b * 7) % 100) / 60
        const x1 = 20 + r * Math.cos(start)
        const y1 = 20 + r * Math.sin(start)
        const x2 = 20 + r * Math.cos(start + len)
        const y2 = 20 + r * Math.sin(start + len)
        return (
          <path
            key={i}
            d={`M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`}
            fill="none"
            stroke="currentColor"
            className="text-ink"
            strokeOpacity={0.25 + (i / bytes.length) * 0.6}
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        )
      })}
      <circle cx="20" cy="20" r="2" className="fill-ink" />
    </svg>
  )
}

function InspectModal({ scan, onClose }: { scan: OpticScan | null; onClose: () => void }) {
  const [template, setTemplate] = useState<OpticTemplate | null>(null)
  const [revealed, setRevealed] = useState(false)
  const key = scan?.id
  useEffect(() => {
    setTemplate(null)
    setRevealed(false)
  }, [key])

  return (
    <Modal
      open={!!scan}
      onClose={onClose}
      width={640}
      title={scan ? `“${scan.label}”` : ''}
      description="Stored biometric representation"
    >
      {!revealed ? (
        <div className="text-center">
          <p className="mx-auto max-w-md text-[13px] leading-relaxed text-muted">
            This decrypts the template locally for transparency. Administrator consoles never display biometric data —
            only this Lab view, on request.
          </p>
          <Button
            className="mt-4"
            variant="primary"
            onClick={async () => {
              if (!scan) return
              setTemplate(await identityService.inspectScan(scan.id))
              setRevealed(true)
            }}
            data-testid="reveal-template"
          >
            Decrypt and view representation
          </Button>
        </div>
      ) : template ? (
        <TemplateView template={template} />
      ) : (
        <div className="text-[13px] text-muted">Template unavailable.</div>
      )}
    </Modal>
  )
}

function TemplateView({ template }: { template: OpticTemplate }) {
  const max = Math.max(...template.centroid.map(Math.abs), 1e-6)
  return (
    <div className="space-y-5" data-testid="template-view">
      <div>
        <div className="mb-2 flex items-baseline justify-between text-[12px]">
          <span className="font-medium text-ink">Ocular-region embedding · centroid</span>
          <span className="font-mono text-subtle">{template.centroid.length}-d · {template.embeddings.length} poses</span>
        </div>
        <div className="flex h-12 items-center gap-px rounded-lg border border-line bg-surface-2 px-1.5">
          {template.centroid.map((v, i) => (
            <div
              key={i}
              className={cx('flex-1 rounded-[1px]', v >= 0 ? 'bg-accent' : 'bg-ink/50')}
              style={{ height: `${10 + (Math.abs(v) / max) * 80}%`, opacity: 0.35 + (Math.abs(v) / max) * 0.65 }}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(['right', 'left'] as const).map((eye) => (
          <div key={eye}>
            <div className="mb-2 flex items-baseline justify-between text-[12px]">
              <span className="font-medium text-ink">IrisCode · {eye === 'right' ? 'OD (right)' : 'OS (left)'}</span>
              <span className="font-mono text-subtle">{template.iris[eye].length} codes</span>
            </div>
            {template.iris[eye][0] ? <IrisGrid grid={irisCodeGrid(template.iris[eye][0])} /> : <div className="text-[12px] text-muted">Not captured</div>}
          </div>
        ))}
      </div>
      {template.geometry && (
        <div>
          <div className="mb-2 text-[12px] font-medium text-ink">Ocular geometry ratios</div>
          <div className="flex flex-wrap gap-1.5 font-mono text-[11px] text-muted">
            {template.geometry.mean.map((g, i) => (
              <span key={i} className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5">
                {g.toFixed(3)}
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="text-[12px] leading-relaxed text-subtle">
        Numbers only — no image can be reconstructed from this at webcam fidelity. Modality {template.modality}, v
        {template.version}.
      </p>
    </div>
  )
}

function IrisGrid({ grid }: { grid: number[][] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface-2 p-1.5">
      <svg viewBox={`0 0 ${grid[0].length} ${grid.length}`} preserveAspectRatio="none" className="h-14 w-full">
        {grid.map((row, y) =>
          row.map((v, x) =>
            v === -1 ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} className={v ? 'fill-ink' : 'fill-transparent'} />,
          ),
        )}
      </svg>
    </div>
  )
}
