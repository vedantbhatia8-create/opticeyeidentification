import { Camera, Laptop, Link2, Lock, LockOpen, Monitor, Plus, Smartphone, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { timeAgo } from '../../ui/format'
import { Badge, Button, Card, CardHeader, cx, EmptyState, Input } from '../../ui/primitives'
import { useSession } from '../suite/store'
import {
  accountKey,
  createPairing,
  deviceId,
  getCommand,
  isOnline,
  listDevices,
  redeemPairing,
  registerDevice,
  removeDevice,
  sendCommand,
  setDeviceName,
  setLocked,
} from './devices'
import type { DeviceRow } from './supabase'
import { sb } from './supabase'

function DeviceIcon({ name }: { name: string }) {
  if (/iPhone|Android|phone/i.test(name)) return <Smartphone className="size-4" />
  if (/iPad|tablet/i.test(name)) return <Monitor className="size-4" />
  if (/Mac|Windows|Linux/i.test(name)) return <Laptop className="size-4" />
  return <Monitor className="size-4" />
}

export function DevicesPanel() {
  const myName = useSession((s) => s.name) ?? 'You'
  const [devices, setDevices] = useState<DeviceRow[] | null>(null)
  const me = deviceId()

  const refresh = useCallback(() => void listDevices().then(setDevices), [])
  useEffect(() => {
    void registerDevice().then(refresh)
    const channel = sb()
      .channel(`optic-devices-${accountKey()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices', filter: `account_key=eq.${accountKey()}` }, refresh)
      .subscribe()
    const t = setInterval(refresh, 8000)
    return () => {
      clearInterval(t)
      void sb().removeChannel(channel)
    }
  }, [refresh])

  const list = devices ?? []

  return (
    <div className="space-y-4">
      <Card data-testid="devices-card">
        <CardHeader
          title="Your devices"
          description="Every device signed in to this Optic account. Lock one remotely, or ask it for a camera snapshot."
          action={<LinkDevice onDone={refresh} />}
        />
        {devices === null ? (
          <div className="px-5 py-8 text-center text-[13px] text-muted">Loading devices…</div>
        ) : list.length === 0 ? (
          <EmptyState icon={<Monitor className="size-5" />} title="No devices yet" description="This device will appear here in a moment." />
        ) : (
          <ul className="divide-y divide-line border-t border-line" data-testid="devices-list">
            {list.map((d) => (
              <DeviceRowItem key={d.id} d={d} isMe={d.id === me} myName={myName} onChange={refresh} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function DeviceRowItem({ d, isMe, myName, onChange }: { d: DeviceRow; isMe: boolean; myName: string; onChange: () => void }) {
  const online = isOnline(d)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(d.name)
  const [snap, setSnap] = useState<{ state: 'idle' | 'waiting' | 'done' | 'failed'; url?: string }>({ state: 'idle' })

  const requestSnapshot = async () => {
    setSnap({ state: 'waiting' })
    const id = await sendCommand(d.id, 'snapshot', myName)
    if (!id) return setSnap({ state: 'failed' })
    const started = Date.now()
    const poll = setInterval(async () => {
      const cmd = await getCommand(id)
      if (cmd && cmd.status !== 'pending') {
        clearInterval(poll)
        if (cmd.status === 'done' && cmd.result) setSnap({ state: 'done', url: cmd.result })
        else setSnap({ state: 'failed' })
      } else if (Date.now() - started > 25000) {
        clearInterval(poll)
        setSnap({ state: 'failed' })
      }
    }, 1500)
  }

  const toggleLock = async () => {
    await setLocked(d.id, !d.locked)
    if (!d.locked) await sendCommand(d.id, 'lock', myName)
    else await sendCommand(d.id, 'unlock', myName)
    onChange()
  }

  return (
    <li className="px-5 py-3.5" data-testid="device-item">
      <div className="flex items-center gap-3">
        <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-xl', online ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted')}>
          <DeviceIcon name={d.name} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          {renaming ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                setDeviceName(name)
                if (isMe) void registerDevice().then(onChange)
                setRenaming(false)
              }}
            >
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-8" />
              <Button size="sm" type="submit" variant="primary">Save</Button>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-2 truncate text-[13.5px] font-medium text-ink">
                {d.name}
                {isMe && <span className="text-[11px] text-subtle">(this device)</span>}
                {d.locked && <Badge tone="bad">Locked</Badge>}
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-muted">
                <span className={cx('size-1.5 rounded-full', online ? 'bg-granted' : 'bg-subtle')} />
                {online ? 'Online now' : `Last seen ${timeAgo(new Date(d.last_seen).getTime())}`}
              </div>
            </>
          )}
        </div>
        {!renaming && (
          <div className="flex items-center gap-1.5">
            {isMe ? (
              <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}>Rename</Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" icon={<Camera className="size-3.5" />} onClick={requestSnapshot} data-testid="device-snapshot">
                  Snapshot
                </Button>
                <Button
                  size="sm"
                  variant={d.locked ? 'secondary' : 'danger'}
                  icon={d.locked ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}
                  onClick={toggleLock}
                  data-testid="device-lock"
                >
                  {d.locked ? 'Unlock' : 'Lock'}
                </Button>
                <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} aria-label="Remove" onClick={() => void removeDevice(d.id).then(onChange)} />
              </>
            )}
          </div>
        )}
      </div>

      {snap.state !== 'idle' && !isMe && (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-line bg-surface-2/50 p-3" data-testid="device-snapshot-result">
          {snap.state === 'waiting' && <div className="text-[12.5px] text-muted">Asking {d.name} for a snapshot… (it needs to be online with a camera)</div>}
          {snap.state === 'failed' && <div className="text-[12.5px] text-bad">Couldn’t get a snapshot — the device may be offline, locked, or has no camera.</div>}
          {snap.state === 'done' && snap.url && (
            <>
              <img src={snap.url} alt="Camera snapshot" className="h-28 w-auto rounded-lg border border-line" />
              <div className="text-[12px] text-muted">
                Live snapshot from {d.name}.
                <button className="mt-1 block text-accent-text hover:underline" onClick={() => setSnap({ state: 'idle' })}>
                  Dismiss
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  )
}

function LinkDevice({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<null | 'show' | 'enter'>(null)
  const [code, setCode] = useState('')
  const [entered, setEntered] = useState('')
  const [msg, setMsg] = useState('')
  const timer = useRef<number | null>(null)

  const start = async () => {
    setMode('show')
    setCode(await createPairing())
  }
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  const redeem = async () => {
    setMsg('')
    const ok = await redeemPairing(entered)
    if (ok) {
      setMsg('Linked! This device now shares your account.')
      setTimeout(() => { setMode(null); onDone() }, 1200)
    } else {
      setMsg('That code is wrong or expired. Generate a fresh one on your other device.')
    }
  }

  if (!mode)
    return (
      <div className="flex gap-2">
        <Button size="sm" icon={<Plus className="size-3.5" />} onClick={start} data-testid="device-pair-show">Link a device</Button>
        <Button size="sm" variant="ghost" onClick={() => setMode('enter')} data-testid="device-pair-enter">Enter a code</Button>
      </div>
    )

  return (
    <div className="w-full max-w-xs rounded-xl border border-line bg-surface-2/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink"><Link2 className="size-3.5" /> Link a device</span>
        <button onClick={() => setMode(null)} className="text-subtle hover:text-ink" aria-label="Close"><X className="size-3.5" /></button>
      </div>
      {mode === 'show' ? (
        <>
          <p className="text-[12px] text-muted">On your other device, open Optic → Security → Devices → “Enter a code”, and type:</p>
          <div className="mt-2 rounded-lg border border-accent/30 bg-accent-soft py-2 text-center font-mono text-[22px] tracking-[0.3em] text-accent-text" data-testid="device-pair-code">
            {code}
          </div>
          <p className="mt-2 text-[11px] text-subtle">Expires in 10 minutes.</p>
        </>
      ) : (
        <>
          <p className="text-[12px] text-muted">Type the 6-digit code shown on your other device.</p>
          <Input value={entered} onChange={(e) => setEntered(e.target.value)} placeholder="000000" inputMode="numeric" maxLength={6} className="mt-2 text-center font-mono tracking-[0.3em]" data-testid="device-pair-input" />
          <Button size="sm" variant="primary" className="mt-2 w-full" onClick={redeem} data-testid="device-pair-redeem">Link this device</Button>
        </>
      )}
      {msg && <p className="mt-2 text-[11.5px] text-muted">{msg}</p>}
    </div>
  )
}
