import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collectSamples } from '../../core/sensor/capture'
import { identityService } from '../../core/identity/IdentityService'
import { useSession } from '../suite/store'
import { useStore } from '../../state/store'
import { useIdentities, useSensor, useSensorConfig } from '../sensor/hooks'
import { SensorViewport } from '../sensor/SensorViewport'
import { TerminalShell } from '../sensor/TerminalShell'

type Who = 'owner' | 'alike'
const SCANS_NEEDED: Record<Who, number> = { owner: 3, alike: 2 }
/** Minimum gap between your worst score and the look-alike's best score for a threshold to separate you. */
const MIN_GAP = 0.04

/**
 * Look-alike tuning: measure how close the account owner and a look-alike
 * (e.g. a sibling) score against the owner's account, then set the accept
 * distance just above the owner's own scores. As tight as the data allows,
 * while the owner still gets in consistently.
 */
export function LookAlikeTuning() {
  const { identities } = useIdentities()
  const real = useMemo(() => identities.filter((i) => !i.synthetic && i.status === 'active'), [identities])
  const sessionId = useSession((s) => s.identityId)
  const [accountId, setAccountId] = useState<string>('')
  const account = real.find((i) => i.id === accountId) ?? real.find((i) => i.id === sessionId) ?? real[real.length - 1]

  const config = useSensorConfig()
  const { sensor, status, observation } = useSensor(config)
  const running = status.state === 'running'

  const [results, setResults] = useState<Record<Who, number[]>>({ owner: [], alike: [] })
  const [busy, setBusy] = useState<Who | null>(null)
  const [progress, setProgress] = useState(0)
  const [note, setNote] = useState('')
  const acceptDistance = useStore((s) => s.settings.acceptDistance)
  const setSettings = useStore((s) => s.setSettings)

  const scan = async (who: Who) => {
    if (!account || busy) return
    setBusy(who)
    setNote('')
    setProgress(0)
    const samples = await collectSamples(sensor, { count: 5, timeoutMs: 9000, onSample: (n) => setProgress(n / 5) })
    const d = samples.length >= 3 ? await identityService.distanceTo(samples, account.id) : null
    setBusy(null)
    setProgress(0)
    if (d === null) {
      setNote('Couldn’t get a clear look. Face the camera in good light and try again.')
      return
    }
    setResults((r) => ({ ...r, [who]: [...r[who], d] }))
  }

  const ownerWorst = results.owner.length ? Math.max(...results.owner) : null
  const alikeBest = results.alike.length ? Math.min(...results.alike) : null
  const ready = results.owner.length >= SCANS_NEEDED.owner && results.alike.length >= SCANS_NEEDED.alike
  const gap = ownerWorst !== null && alikeBest !== null ? alikeBest - ownerWorst : null
  const separable = ready && gap !== null && gap >= MIN_GAP
  const recommended = separable ? Math.min(0.5, Math.max(0.2, Math.round((ownerWorst! + gap! * 0.4) * 100) / 100)) : null

  return (
    <TerminalShell location="Look-alike tuning" exitTo="/lab">
      <div className="mx-auto mt-2 grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_380px]">
        <SensorViewport
          sensor={sensor}
          observation={observation}
          running={running}
          tone={busy ? 'active' : observation?.presence === 'eyes' ? 'tracking' : 'idle'}
          progress={progress}
          scanning={!!busy}
          className="aspect-[4/3] w-full rounded-3xl"
        />
        <div className="space-y-4 text-white" data-testid="tuning">
          <div>
            <div className="text-[18px] font-semibold">Tell look-alikes apart</div>
            <p className="mt-1 text-[13px] leading-relaxed text-white/55">
              Scan yourself a few times, then the person who gets mistaken for you. Optic sets the match limit just above your own
              scores: as tight as possible while still letting you in every time.
            </p>
          </div>
          {real.length === 0 ? (
            <p className="text-[13px] text-white/60">
              Enroll first. <Link to="/lab/enroll" className="underline">Create your account</Link>
            </p>
          ) : (
            <>
              <label className="block text-[12px] text-white/50">
                Account being protected
                <select
                  value={account?.id ?? ''}
                  onChange={(e) => {
                    setAccountId(e.target.value)
                    setResults({ owner: [], alike: [] })
                  }}
                  className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-transparent px-2 text-[13px] text-white"
                >
                  {real.map((i) => (
                    <option key={i.id} value={i.id} className="bg-black">
                      {i.name}
                      {i.email ? ` · ${i.email}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <ScanRow
                title={`1 · ${account?.name.split(' ')[0] ?? 'You'} (the real owner)`}
                values={results.owner}
                needed={SCANS_NEEDED.owner}
                busy={busy === 'owner'}
                disabled={!running || !!busy}
                onScan={() => void scan('owner')}
                testId="scan-owner"
              />
              <ScanRow
                title="2 · The look-alike"
                values={results.alike}
                needed={SCANS_NEEDED.alike}
                busy={busy === 'alike'}
                disabled={!running || !!busy}
                onScan={() => void scan('alike')}
                testId="scan-alike"
              />
              {note && <p className="text-[12.5px] text-[#f5b454]">{note}</p>}
              {ready && separable && recommended !== null && (
                <div className="rounded-xl border border-granted/30 bg-granted/10 p-3.5 text-[13px]" data-testid="tuning-result">
                  Your worst score <b>{ownerWorst!.toFixed(3)}</b>, look-alike’s best <b>{alikeBest!.toFixed(3)}</b>. Recommended
                  limit <b>{recommended.toFixed(2)}</b> (now {acceptDistance.toFixed(2)}).
                  <button
                    onClick={() => setSettings({ acceptDistance: recommended })}
                    className="mt-3 h-10 w-full rounded-lg bg-white text-[13.5px] font-semibold text-black hover:bg-white/90"
                    data-testid="apply-threshold"
                  >
                    {acceptDistance === recommended ? 'Applied' : `Apply ${recommended.toFixed(2)}`}
                  </button>
                </div>
              )}
              {ready && !separable && (
                <div className="rounded-xl border border-[#f5b454]/30 bg-[#f5b454]/10 p-3.5 text-[13px] text-[#f5d49a]" data-testid="tuning-result">
                  Too close for a webcam to separate with a limit alone (your worst {ownerWorst!.toFixed(3)}, look-alike’s best{' '}
                  {alikeBest!.toFixed(3)}). Give them their own account: every scan is then compared against both of you, and
                  Optic only accepts a clear winner.
                  <Link
                    to="/lab/enroll"
                    className="mt-3 flex h-10 w-full items-center justify-center rounded-lg bg-[#f5b454] text-[13.5px] font-semibold text-black"
                  >
                    Enroll the look-alike
                  </Link>
                </div>
              )}
              <p className="text-[11.5px] leading-relaxed text-white/35">
                Scores are embedding distances (lower = more similar). Each scan takes 5 samples. Best results: same room and light
                you normally use.
              </p>
            </>
          )}
        </div>
      </div>
    </TerminalShell>
  )
}

function ScanRow({
  title,
  values,
  needed,
  busy,
  disabled,
  onScan,
  testId,
}: {
  title: string
  values: number[]
  needed: number
  busy: boolean
  disabled: boolean
  onScan: () => void
  testId: string
}) {
  return (
    <div className="rounded-xl border border-white/10 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13.5px] font-medium">{title}</div>
        <button
          onClick={onScan}
          disabled={disabled}
          className="h-8 rounded-lg bg-white px-3 text-[12.5px] font-semibold text-black disabled:opacity-40"
          data-testid={testId}
        >
          {busy ? 'Scanning…' : values.length ? 'Scan again' : 'Scan'}
        </button>
      </div>
      <div className="mt-2 font-mono text-[12px] text-white/60">
        {values.length ? values.map((v) => v.toFixed(3)).join('  ·  ') : `No scans yet (need ${needed})`}
        {values.length > 0 && values.length < needed && ` · ${needed - values.length} more`}
      </div>
    </div>
  )
}
