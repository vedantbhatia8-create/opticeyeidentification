import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { BiometricSensor, EyeObservation, Point, SensorObservation } from '../../core/sensor/types'
import { cx } from '../../ui/primitives'

export type ViewportTone = 'idle' | 'tracking' | 'active' | 'granted' | 'denied'

const TONE_COLOR: Record<ViewportTone, string> = {
  idle: 'rgba(207,233,255,0.45)',
  tracking: 'rgba(207,233,255,0.8)',
  active: '#8cc8ff',
  granted: '#3ddc97',
  denied: '#ff5d5d',
}

interface Props {
  sensor: BiometricSensor
  observation: SensorObservation | null
  running: boolean
  tone: ViewportTone
  /** 0..1 capture progress, drawn as tick rings around each eye. */
  progress: number
  scanning: boolean
  /** Arrow for guided enrollment (screen direction). */
  guide?: Point | null
  /** Dims the preview (e.g. under a result card). */
  dimmed?: boolean
  className?: string
  children?: React.ReactNode
}

interface Smoothed {
  face: { x: number; y: number; w: number; h: number } | null
  left: { x: number; y: number; r: number; open: number } | null
  right: { x: number; y: number; r: number; open: number } | null
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Maps normalised video coordinates into container pixels under object-fit: cover. */
function useCoverMapping(aspect: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const containerAspect = size.w / size.h
  let dispW = size.w
  let dispH = size.h
  if (aspect > containerAspect) dispW = size.h * aspect
  else dispH = size.w / aspect
  const ox = (dispW - size.w) / 2
  const oy = (dispH - size.h) / 2
  const map = (p: Point) => ({ x: p.x * dispW - ox, y: p.y * dispH - oy })
  return { ref, size, map, scale: dispW }
}

export function SensorViewport({
  sensor,
  observation,
  running,
  tone,
  progress,
  scanning,
  guide,
  dimmed,
  className,
  children,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const aspect = observation?.aspect ?? 16 / 9
  const { ref, size, map, scale } = useCoverMapping(aspect)
  const stream = running ? sensor.getPreviewStream() : null

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    // React does not reliably reflect the `muted` prop as an attribute, which
    // iOS needs for inline autoplay — force it on the element.
    v.muted = true
    v.setAttribute('playsinline', '')
    v.setAttribute('webkit-playsinline', '')
    if (v.srcObject !== stream) v.srcObject = stream
    if (stream) v.play().catch(() => {})
  }, [stream])

  // Exponential smoothing for calm, non-jittery overlays.
  const smooth = useRef<Smoothed>({ face: null, left: null, right: null })
  const [, force] = useState(0)
  useEffect(() => {
    const o = observation
    const s = smooth.current
    const t = 0.45
    if (o?.faceBox) {
      const f = { x: o.faceBox.x, y: o.faceBox.y, w: o.faceBox.width, h: o.faceBox.height }
      s.face = s.face
        ? { x: lerp(s.face.x, f.x, t), y: lerp(s.face.y, f.y, t), w: lerp(s.face.w, f.w, t), h: lerp(s.face.h, f.h, t) }
        : f
    } else s.face = null
    const eye = (prev: Smoothed['left'], e?: EyeObservation) => {
      if (!e) return null
      const n = { x: e.center.x, y: e.center.y, r: e.irisRadius, open: e.openness }
      return prev
        ? { x: lerp(prev.x, n.x, 0.55), y: lerp(prev.y, n.y, 0.55), r: lerp(prev.r, n.r, 0.3), open: lerp(prev.open, n.open, 0.5) }
        : n
    }
    s.left = o?.presence === 'eyes' || o?.presence === 'face' ? eye(s.left, o.eyes?.left) : null
    s.right = o?.presence === 'eyes' || o?.presence === 'face' ? eye(s.right, o.eyes?.right) : null
    force((x) => x + 1)
  }, [observation])

  const color = TONE_COLOR[tone]
  const s = smooth.current
  const eyesVisible = !!(s.left && s.right && observation?.presence === 'eyes')
  const eyePx = (e: NonNullable<Smoothed['left']>) => ({ ...map(e), r: Math.max(e.r * scale * 2.4, 22) })
  const L = s.left ? eyePx(s.left) : null
  const R = s.right ? eyePx(s.right) : null
  const face = s.face
    ? (() => {
        const a = map({ x: s.face.x, y: s.face.y })
        const b = map({ x: s.face.x + s.face.w, y: s.face.y + s.face.h })
        return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }
      })()
    : null
  const band =
    L && R
      ? {
          x: Math.min(L.x, R.x) - Math.max(L.r, R.r) * 1.5,
          y: (L.y + R.y) / 2 - Math.max(L.r, R.r) * 1.25,
          w: Math.abs(L.x - R.x) + Math.max(L.r, R.r) * 3,
          h: Math.max(L.r, R.r) * 2.5,
        }
      : null

  return (
    <div
      ref={ref}
      className={cx('relative overflow-hidden bg-term-2 select-none', className)}
      data-testid="sensor-viewport"
    >
      {sensor.descriptor.providesPreview ? (
        <video
          ref={videoRef}
          muted
          playsInline
          className={cx(
            'absolute inset-0 h-full w-full -scale-x-100 object-cover transition-[filter,opacity] duration-700',
            dimmed ? 'opacity-40 blur-[6px]' : 'opacity-100',
          )}
          style={{ filter: dimmed ? undefined : 'grayscale(0.55) contrast(1.08) brightness(0.82)' }}
        />
      ) : (
        <SyntheticBackdrop />
      )}

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 50% 45%, transparent 45%, rgba(5,6,7,0.85) 100%)' }}
      />

      <svg className="pointer-events-none absolute inset-0 h-full w-full" width={size.w} height={size.h}>
        <defs>
          <mask id="optic-spotlight">
            <rect width={size.w} height={size.h} fill="white" />
            {band && <rect x={band.x} y={band.y} width={band.w} height={band.h} rx={band.h / 2} fill="black" />}
          </mask>
          <linearGradient id="optic-sweep" x1="0" x2="1">
            <stop offset="0" stopColor={color} stopOpacity="0" />
            <stop offset="0.5" stopColor={color} stopOpacity="0.9" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Spotlight: darken everything but the ocular band once eyes are locked */}
        <rect
          width={size.w}
          height={size.h}
          fill="rgba(5,6,7,0.55)"
          mask="url(#optic-spotlight)"
          style={{ opacity: eyesVisible && tone !== 'idle' ? 1 : 0, transition: 'opacity 600ms ease' }}
        />

        {face && <FaceBrackets {...face} color={color} faint={eyesVisible} />}

        {L && R && (
          <>
            <EyeReticle {...L} label="OS" color={color} progress={progress} locked={eyesVisible} scanning={scanning} open={s.left!.open} />
            <EyeReticle {...R} label="OD" color={color} progress={progress} locked={eyesVisible} scanning={scanning} open={s.right!.open} flip />
            {band && scanning && <ScanSweep band={band} />}
          </>
        )}

        {guide && (guide.x !== 0 || guide.y !== 0) && L && R && (
          <GuideArrow from={{ x: (L.x + R.x) / 2, y: (L.y + R.y) / 2 }} dir={guide} color={color} />
        )}
      </svg>

      {children}
    </div>
  )
}

function FaceBrackets({ x, y, w, h, color, faint }: { x: number; y: number; w: number; h: number; color: string; faint: boolean }) {
  const pad = w * 0.08
  const l = Math.min(w, h) * 0.12
  const X = x - pad
  const Y = y - pad
  const W = w + pad * 2
  const H = h + pad * 2
  const d = [
    `M${X},${Y + l} V${Y} H${X + l}`,
    `M${X + W - l},${Y} H${X + W} V${Y + l}`,
    `M${X + W},${Y + H - l} V${Y + H} H${X + W - l}`,
    `M${X + l},${Y + H} H${X} V${Y + H - l}`,
  ].join(' ')
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.25}
      strokeLinecap="round"
      style={{ opacity: faint ? 0.22 : 0.7, transition: 'opacity 500ms ease, stroke 400ms ease' }}
    />
  )
}

function EyeReticle({
  x,
  y,
  r,
  label,
  color,
  progress,
  locked,
  scanning,
  open,
  flip,
}: {
  x: number
  y: number
  r: number
  label: string
  color: string
  progress: number
  locked: boolean
  scanning: boolean
  open: number
  flip?: boolean
}) {
  const ticks = 48
  const lit = Math.round(progress * ticks)
  const outer = r * 1.55
  const irisR = r / 2.4
  return (
    <g transform={`translate(${x},${y})`} style={{ transition: 'opacity 400ms ease', opacity: open < 0.15 ? 0.5 : 1 }}>
      {/* capture progress ticks */}
      {Array.from({ length: ticks }, (_, i) => {
        const a = (i / ticks) * Math.PI * 2 - Math.PI / 2
        const on = i < lit
        const r1 = outer + 3
        const r2 = outer + (on ? 9 : 6)
        return (
          <line
            key={i}
            x1={Math.cos(a) * r1}
            y1={Math.sin(a) * r1}
            x2={Math.cos(a) * r2}
            y2={Math.sin(a) * r2}
            stroke={color}
            strokeWidth={on ? 1.6 : 1}
            strokeLinecap="round"
            opacity={on ? 1 : locked ? 0.28 : 0.12}
          />
        )
      })}
      {/* rotating segmented ring */}
      <g style={{ animation: `${flip ? 'optic-spin-rev' : 'optic-spin'} ${scanning ? 3 : 9}s linear infinite`, transformOrigin: '0 0' }}>
        <circle r={outer} fill="none" stroke={color} strokeWidth={1.1} strokeDasharray={`${outer * 0.9} ${outer * 0.35}`} opacity={0.6} />
      </g>
      <g style={{ animation: `${flip ? 'optic-spin' : 'optic-spin-rev'} 14s linear infinite`, transformOrigin: '0 0' }}>
        <circle r={r * 1.18} fill="none" stroke={color} strokeWidth={0.8} strokeDasharray="2 5" opacity={0.45} />
      </g>
      {/* iris boundary + pupil */}
      <circle
        r={locked ? irisR * 1.05 : r}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        opacity={locked ? 0.95 : 0.4}
        style={{ transition: 'r 500ms cubic-bezier(.2,.8,.2,1), opacity 400ms' }}
      />
      <circle r={1.6} fill={color} opacity={locked ? 1 : 0} style={{ transition: 'opacity 400ms' }} />
      {/* crosshair */}
      {[0, 90, 180, 270].map((deg) => (
        <line
          key={deg}
          x1={0}
          y1={-(r * 0.55)}
          x2={0}
          y2={-(r * 0.8)}
          transform={`rotate(${deg})`}
          stroke={color}
          strokeWidth={1}
          opacity={locked ? 0.7 : 0.3}
        />
      ))}
      <text
        x={flip ? outer + 14 : -outer - 14}
        y={-outer + 4}
        textAnchor={flip ? 'start' : 'end'}
        fill={color}
        fontSize={10}
        fontFamily="JetBrains Mono Variable, monospace"
        letterSpacing="0.12em"
        opacity={locked ? 0.85 : 0}
        style={{ transition: 'opacity 400ms' }}
      >
        {label}
      </text>
    </g>
  )
}

function ScanSweep({ band }: { band: { x: number; y: number; w: number; h: number } }) {
  return (
    <g>
      <clipPath id="optic-band-clip">
        <rect x={band.x} y={band.y} width={band.w} height={band.h} rx={band.h / 2} />
      </clipPath>
      <g clipPath="url(#optic-band-clip)">
        <rect
          x={band.x}
          y={band.y}
          width={3}
          height={band.h}
          fill="url(#optic-sweep)"
          style={{ animation: 'optic-scan-x 1.6s cubic-bezier(.45,0,.55,1) infinite alternate', ['--band-w' as string]: `${band.w}px` }}
        />
      </g>
    </g>
  )
}

function GuideArrow({ from, dir, color }: { from: Point; dir: Point; color: string }) {
  const len = 120
  const angle = Math.atan2(-dir.y, dir.x)
  return (
    <g transform={`translate(${from.x},${from.y}) rotate(${(angle * 180) / Math.PI})`} opacity={0.85}>
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M${len + i * 18},-9 l9,9 l-9,9`}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: `optic-pulse 1.2s ease-in-out ${i * 0.18}s infinite` }}
        />
      ))}
    </g>
  )
}

/** Shown when the sensor provides no video preview (simulated / hardware). */
function SyntheticBackdrop() {
  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(207,233,255,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(207,233,255,0.25) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(70% 60% at 50% 45%, black, transparent)',
        }}
      />
      <div className="absolute inset-x-0 bottom-5 text-center font-mono text-[10px] tracking-[0.2em] text-scan/40 uppercase">
        No video preview · simulated optic sensor
      </div>
    </div>
  )
}
