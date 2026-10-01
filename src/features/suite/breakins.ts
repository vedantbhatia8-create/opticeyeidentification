// Break-in log: when someone who isn't you is seen at the screen while you're
// signed in, we record a timestamped event with a small on-device snapshot.
// Snapshots never leave the device (IndexedDB, capped), like everything in Optic.
import { openStore, STORES, type KeyValueStore } from '../../core/identity/db'

let storePromise: Promise<KeyValueStore> | null = null
const store = () => (storePromise ??= openStore())
const rid = () => `bk_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`
const MAX = 40

export interface Breakin {
  id: string
  kind: 'breakin'
  at: number
  reason: 'stranger' | 'shoulder'
  app: string
  ownerId: string | null
  ownerName: string | null
  snapshot: string | null // small jpeg data URL
}

/** Grab one downscaled still from the live preview stream. Best-effort; null if unavailable. */
export async function captureSnapshot(stream: MediaStream | null, maxEdge = 260): Promise<string | null> {
  try {
    const track = stream?.getVideoTracks()[0]
    if (!stream || !track || track.readyState !== 'live') return null
    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    await video.play().catch(() => {})
    if (video.readyState < 2) await new Promise((r) => ((video.onloadeddata = () => r(null)), setTimeout(() => r(null), 800)))
    const w = video.videoWidth
    const h = video.videoHeight
    video.srcObject = null
    if (!w || !h) return null
    const scale = Math.min(1, maxEdge / Math.max(w, h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.55)
  } catch {
    return null
  }
}

export async function recordBreakin(e: Omit<Breakin, 'id' | 'kind'>): Promise<void> {
  const s = await store()
  await s.put(STORES.suite, { ...e, id: rid(), kind: 'breakin' } satisfies Breakin)
  // Prune to the most recent MAX.
  const all = (await s.getAll<Breakin>(STORES.suite)).filter((r) => r.kind === 'breakin').sort((a, b) => b.at - a.at)
  for (const old of all.slice(MAX)) await s.delete(STORES.suite, old.id)
}

export async function listBreakins(): Promise<Breakin[]> {
  return (await (await store()).getAll<Breakin>(STORES.suite)).filter((r) => r.kind === 'breakin').sort((a, b) => b.at - a.at)
}

export async function clearBreakins(): Promise<void> {
  const s = await store()
  for (const r of (await s.getAll<Breakin>(STORES.suite)).filter((x) => x.kind === 'breakin')) await s.delete(STORES.suite, r.id)
}
