import { AlertTriangle, CheckCircle2, Cpu, Database, EyeOff, FileLock2, KeyRound, ListChecks, Lock, RotateCcw, ScanEye, ShieldCheck, Split, UserX } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SENSOR_KIND_LABEL, createSensor } from '../../core/sensor/registry'
import { SENSOR_ERROR_COPY, isSensorError, type SensorKind } from '../../core/sensor/types'
import { resetPrototype } from '../../state/services'
import { DemoPeopleToggle } from '../demo/DemoPanel'
import { useStore } from '../../state/store'
import { timeAgo } from '../../ui/format'
import { Modal } from '../../ui/overlay'
import { Badge, Button, buttonClass, Card, CardHeader, cx, StatusDot, Toggle } from '../../ui/primitives'
import { useIdentities } from '../sensor/hooks'
import { PageHeader } from './ConsoleLayout'
import { ActivityTable } from './console'

export function ActivityPage({ site }: { site: 'office' | 'hotel' }) {
  const office = useStore((s) => s.office)
  const hotel = useStore((s) => s.hotel)
  const resources =
    site === 'office'
      ? office.doors.map((d) => ({ id: d.id, name: d.name }))
      : [...hotel.rooms.map((r) => ({ id: `room-${r.number}`, name: `Room ${r.number}` })), ...hotel.amenities.map((a) => ({ id: a.id, name: a.name }))]
  return (
    <>
      <PageHeader
        title="Activity"
        description="The audit log. Every attempt is recorded with its decision and reason — never with biometric data."
      />
      <ActivityTable site={site} resources={resources} />
    </>
  )
}

const DRIVERS: { kind: SensorKind; body: string }[] = [
  { kind: 'webcam', body: 'Consumer camera + on-device face/iris landmarking and embedding. Prototype fidelity.' },
  { kind: 'simulated', body: 'No camera. Emits tracking and synthetic samples for demos and testing.' },
  { kind: 'iris-hardware', body: 'Dedicated NIR iris module via local bridge (ws://localhost:7447). Drop-in replacement.' },
]

export function DevicesPage({ site }: { site: 'office' | 'hotel' }) {
  const office = useStore((s) => s.office)
  const hotel = useStore((s) => s.hotel)
  const sensorKind = useStore((s) => s.settings.sensorKind)
  const [probe, setProbe] = useState<Record<string, string>>({})
  const devices =
    site === 'office'
      ? office.doors.map((d) => ({ id: d.id, name: d.name, sub: d.zone, device: d.device, online: d.online, to: `/terminal/office/${d.id}` }))
      : hotel.rooms.map((r) => ({ id: r.number, name: `Room ${r.number}`, sub: r.type, device: { ...r.device, model: 'Optic L1 lock · webcam prototype' }, online: r.online, to: `/terminal/hotel/room-${r.number}` }))

  const test = async (kind: SensorKind) => {
    setProbe((p) => ({ ...p, [kind]: 'Testing…' }))
    const sensor = createSensor({ kind })
    try {
      await sensor.start()
      setProbe((p) => ({ ...p, [kind]: `Connected · ${sensor.descriptor.name}` }))
    } catch (err) {
      setProbe((p) => ({ ...p, [kind]: isSensorError(err) ? SENSOR_ERROR_COPY[err.code].title : 'Failed' }))
    } finally {
      await sensor.stop()
    }
  }

  return (
    <>
      <PageHeader title="Devices" description="Access terminals and the biometric sensor drivers they can run." />
      <Card className="mb-4">
        <CardHeader
          title="Sensor drivers"
          description="Every terminal talks to a BiometricSensor interface. Swapping the webcam for iris hardware changes this layer only."
        />
        <div className="grid gap-3 border-t border-line p-4 md:grid-cols-3">
          {DRIVERS.map((d) => (
            <div key={d.kind} className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                  <Cpu className="size-4 text-subtle" /> {SENSOR_KIND_LABEL[d.kind]}
                </span>
                {d.kind === sensorKind ? (
                  <Badge tone="ok">In use</Badge>
                ) : d.kind === 'iris-hardware' ? (
                  <Badge>Future</Badge>
                ) : (
                  <Badge>Available</Badge>
                )}
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{d.body}</p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={() => test(d.kind)} data-testid={`test-${d.kind}`}>
                  Test connection
                </Button>
                {probe[d.kind] && <span className="truncate text-[12px] text-muted" data-testid={`probe-${d.kind}`}>{probe[d.kind]}</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="bg-surface-2/60 text-[12px] text-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">Terminal</th>
                <th className="px-3 py-2.5 font-medium">Model</th>
                <th className="px-3 py-2.5 font-medium">Serial</th>
                <th className="px-3 py-2.5 font-medium">Firmware</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {devices.map((d) => (
                <tr key={d.id}>
                  <td className="px-5 py-2.5">
                    <div className="font-medium text-ink">{d.name}</div>
                    <div className="text-[12px] text-muted">{d.sub}</div>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{d.device.model}</td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-muted">{d.device.serial}</td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-muted">{d.device.firmware}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2 text-muted">
                      <StatusDot tone={d.online ? 'ok' : 'bad'} pulse={d.online} />
                      {d.online ? `Online · ${timeAgo(d.device.lastSeenAt, Date.now()) === 'Just now' ? 'now' : 'seen ' + timeAgo(d.device.lastSeenAt, Date.now())}` : 'Offline'}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <Link to={d.to} className="text-[12.5px] font-medium text-accent-text hover:underline">
                      Open terminal
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

export const PRINCIPLES = [
  { icon: EyeOff, title: 'Minimal biometric data', body: 'Only a compact numeric template is kept per scan — no photos, no video, no eye images.' },
  { icon: ScanEye, title: 'Raw footage is never stored', body: 'Frames live in memory inside the sensor. Temporary crops are wiped right after features are extracted.' },
  { icon: FileLock2, title: 'Encrypted at rest', body: 'Templates are sealed with AES-GCM using a non-extractable browser key. Production would use a KMS-backed vault or on-device matching.' },
  { icon: Split, title: 'Authentication ≠ authorization', body: 'The identity layer answers “who is this?”. A separate policy engine answers “may they open this door now?”.' },
  { icon: UserX, title: 'Administrators can revoke', body: 'Suspend people, end visits, check out guests, lock down doors, or delete identities — effective on the next attempt.' },
  { icon: ListChecks, title: 'Every attempt is logged', body: 'Granted, denied, unrecognized and failed reads are all audited — with reasons, never with biometrics.' },
  { icon: KeyRound, title: 'Biometrics hidden from admins', body: 'Consoles show enrollment status and a non-reversible fingerprint only. Templates can’t be viewed or exported here.' },
  { icon: Lock, title: 'Stays on this device', body: 'A Content-Security-Policy blocks all outbound connections, including third-party runtime telemetry.' },
]

export function SettingsPage({ site }: { site: 'office' | 'hotel' }) {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const orgName = useStore((s) => (site === 'office' ? s.office.siteName : s.hotel.propertyName))
  const { identities, scans, persistent } = useIdentities()
  const events = useStore((s) => s.events.length)
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <>
      <PageHeader title="Settings" description={orgName} />
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Security & privacy" description="How Optic Access handles identity data." />
            <div className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
              {PRINCIPLES.map((p) => (
                <div key={p.title} className="bg-surface p-4">
                  <p.icon className="size-4 text-ink" />
                  <div className="mt-2 text-[13.5px] font-semibold text-ink">{p.title}</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{p.body}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="border-warn/25 bg-warn-soft/40 p-5">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" />
              <div>
                <div className="text-[14px] font-semibold text-ink">This is a prototype</div>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">
                  The webcam sensor cannot resolve iris texture like dedicated near-infrared hardware and has no
                  presentation-attack (spoof) detection. A printed photo or screen may be accepted. Matching relies
                  mainly on an ocular/face-region embedding. Do not use this prototype to protect real spaces.
                </p>
              </div>
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Matching" description="Threshold for accepting a probe as an enrolled identity." />
            <div className="border-t border-line px-5 py-4">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted">Strict</span>
                <span className="font-mono text-ink">{settings.acceptDistance.toFixed(2)}</span>
                <span className="text-muted">Lenient</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={0.6}
                step={0.01}
                value={settings.acceptDistance}
                onChange={(e) => setSettings({ acceptDistance: Number(e.target.value) })}
                className="mt-2 w-full accent-[var(--accent)]"
              />
              <p className="mt-2 text-[12px] text-muted">
                Lower values reduce false accepts but may reject enrolled people in poor light. Default 0.42. Raise it only if you are often not recognized; lower it if look-alikes get in.
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-line px-5 py-3.5">
              <div>
                <div className="text-[13.5px] font-medium text-ink">Show match diagnostics on terminals</div>
                <div className="text-[12px] text-muted">Distances and scores, for demos and tuning.</div>
              </div>
              <Toggle checked={settings.showDiagnostics} onChange={(v) => setSettings({ showDiagnostics: v })} label="Diagnostics" />
            </div>
            <DemoPeopleToggle className="border-t border-line px-5 py-3.5" />
          </Card>
          <Card>
            <CardHeader title="Data inventory" description="What this prototype stores, and where." />
            <ul className="divide-y divide-line border-t border-line text-[13px]">
              <InventoryRow icon={<Database className="size-4" />} label="Identities" where="IndexedDB · plain metadata" value={identities.length} />
              <InventoryRow icon={<Lock className="size-4" />} label="Optic templates" where={`IndexedDB · AES-GCM sealed${persistent ? '' : ' (memory only)'}`} value={scans.length} />
              <InventoryRow icon={<ListChecks className="size-4" />} label="Audit events" where="localStorage · no biometrics" value={events} />
              <InventoryRow icon={<EyeOff className="size-4" />} label="Video, photos, eye images" where="Never stored" value={0} ok />
            </ul>
          </Card>
          <Card className="p-5">
            <div className="text-[14px] font-semibold text-ink">Reset prototype data</div>
            <p className="mt-1 text-[12.5px] text-muted">Restores demo data and deletes every webcam enrollment on this device.</p>
            <Button className="mt-3" variant="danger" size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => setConfirmReset(true)}>
              Reset everything
            </Button>
          </Card>
          <Link to="/lab/architecture" className={cx(buttonClass('secondary', 'md', 'w-full'))}>
            <ShieldCheck className="size-4" /> View system architecture
          </Link>
        </div>
      </div>
      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all prototype data?"
        description="Every enrollment you made will be destroyed. Demo data is restored."
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await resetPrototype()
                setConfirmReset(false)
              }}
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-muted">This cannot be undone.</p>
      </Modal>
    </>
  )
}

function InventoryRow({ icon, label, where, value, ok }: { icon: React.ReactNode; label: string; where: string; value: number; ok?: boolean }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="text-subtle">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-ink">{label}</div>
        <div className="text-[12px] text-muted">{where}</div>
      </div>
      {ok ? <CheckCircle2 className="size-4 text-ok" /> : <span className="font-mono text-ink tabular">{value}</span>}
    </li>
  )
}
