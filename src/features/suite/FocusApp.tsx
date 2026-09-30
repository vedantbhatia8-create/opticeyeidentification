import { Eye, EyeOff, Flame, Play, Square, Target, Timer } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDate, formatTime, isSameDay, startOfDay } from '../../ui/format'
import { Badge, Button, Card, CardHeader, cx, EmptyState, Input, Toggle } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'
import { SensorViewport } from '../sensor/SensorViewport'
import { usePresence, type PresenceState } from './presence'
import { newSuiteId, useSession, useSuite, type FocusSession } from './store'

type Live = 'f' | 'a' | 'c'
const BUCKET = 5

function classify(p: PresenceState): Live {
  if (p.faces === 'none') return 'a'
  if (p.eyesClosed) return 'c'
  return p.looking ? 'f' : 'a'
}

export function focusScore(focusedSec: number, elapsedSec: number, distractions: number) {
  if (elapsedSec <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((focusedSec / elapsedSec) * 100 - distractions * 2)))
}

export function FocusApp() {
  const me = useSession((s) => s.identityId)
  const sessions = useSuite((s) => s.focus)
  const addFocus = useSuite((s) => s.addFocus)
  const log = useSuite((s) => s.log)
  const name = useSession((s) => s.name) ?? ''
  const mine = useMemo(() => sessions.filter((s) => s.identityId === me), [sessions, me])

  const [goal, setGoal] = useState('')
  const [minutes, setMinutes] = useState(25)
  const [running, setRunning] = useState<{ startedAt: number; planned: number; goal: string } | null>(null)
  const [summary, setSummary] = useState<FocusSession | null>(null)
  const [showCam, setShowCam] = useState(false)

  const p = usePresence({ enabled: !!running || showCam })
  const pRef = useRef(p)
  pRef.current = p
  const acc = useRef({ focused: 0, away: 0, distractions: 0, streakAway: 0, counted: false, bucket: [] as Live[], timeline: '' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!running) return
    acc.current = { focused: 0, away: 0, distractions: 0, streakAway: 0, counted: false, bucket: [], timeline: '' }
    const t = setInterval(() => {
      const a = acc.current
      const live = pRef.current.status.state === 'running' ? classify(pRef.current) : 'a'
      if (live === 'f') {
        a.focused++
        a.streakAway = 0
        a.counted = false
      } else {
        a.away++
        a.streakAway++
        if (a.streakAway >= 5 && !a.counted) {
          a.distractions++
          a.counted = true
        }
      }
      a.bucket.push(live)
      if (a.bucket.length >= BUCKET) {
        const f = a.bucket.filter((x) => x === 'f').length
        const c = a.bucket.filter((x) => x === 'c').length
        a.timeline += f >= 3 ? 'f' : c >= 3 ? 'c' : 'a'
        a.bucket = []
      }
      setTick((x) => x + 1)
    }, 1000)
    return () => clearInterval(t)
  }, [running])

  const elapsed = running ? acc.current.focused + acc.current.away : 0
  const remaining = running ? Math.max(0, running.planned * 60 - elapsed) : 0

  const finish = () => {
    if (!running) return
    const a = acc.current
    const total = a.focused + a.away
    const s: FocusSession = {
      id: newSuiteId('focus'),
      identityId: me,
      goal: running.goal || 'Focus session',
      plannedMinutes: running.planned,
      startedAt: running.startedAt,
      endedAt: Date.now(),
      focusedSec: a.focused,
      awaySec: a.away,
      distractions: a.distractions,
      timeline: a.timeline,
      score: focusScore(a.focused, total, a.distractions),
    }
    addFocus(s)
    log({ app: 'focus', action: 'session', detail: `${s.goal} · ${Math.round(s.focusedSec / 60)} focused min · score ${s.score}`, identityId: me, name, ok: true })
    setRunning(null)
    setSummary(s)
  }

  useEffect(() => {
    if (running && remaining <= 0 && elapsed > 0) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const todaySec = mine.filter((s) => isSameDay(s.startedAt, Date.now())).reduce((a, s) => a + s.focusedSec, 0)
  const streak = useMemo(() => {
    let days = 0
    let day = startOfDay(Date.now())
    const set = new Set(mine.map((s) => startOfDay(s.startedAt)))
    while (set.has(day)) {
      days++
      day -= 86_400_000
    }
    return days
  }, [mine])
  const live = running ? classify(p) : null
  const liveScore = running ? focusScore(acc.current.focused, elapsed, acc.current.distractions) : 0

  return (
    <>
      <PageHeader title="Optic Focus" description="Focus sessions that measure real eyes-on-work time — not just a timer running in the background." />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          {!running && !summary && (
            <div data-testid="focus-setup">
              <div className="text-[18px] font-semibold text-ink">Start a session</div>
              <Input className="mt-4 h-11" placeholder="What are you working on?" value={goal} onChange={(e) => setGoal(e.target.value)} data-testid="focus-goal" />
              <div className="mt-3 flex gap-2">
                {[1, 15, 25, 50].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMinutes(m)}
                    className={cx('h-9 flex-1 rounded-lg border text-[13px] font-medium', minutes === m ? 'border-accent/50 bg-accent-soft text-accent-text shadow-[var(--glow)]' : 'border-line text-muted hover:text-ink')}
                    data-testid={`focus-min-${m}`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
              <Button variant="primary" size="lg" className="mt-5 w-full" icon={<Play className="size-4" />} onClick={() => { setSummary(null); setRunning({ startedAt: Date.now(), planned: minutes, goal: goal.trim() }) }} data-testid="focus-start">
                Start focusing
              </Button>
              <p className="mt-3 text-[12px] text-subtle">Time counts as focused only while you’re looking at the screen with your eyes open. No video is recorded.</p>
            </div>
          )}
          {running && (
            <div className="flex flex-col items-center py-4" data-testid="focus-running">
              <div className="text-[13px] text-muted">{running.goal || 'Focus session'}</div>
              <Ring pct={remaining / (running.planned * 60)} label={`${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`} />
              <div className="mt-4 flex items-center gap-2">
                <Badge tone={live === 'f' ? 'ok' : live === 'c' ? 'warn' : 'bad'} dot>
                  <span data-testid="focus-live">{live === 'f' ? 'Focused' : live === 'c' ? 'Eyes closed' : p.faces === 'none' ? 'Away from screen' : 'Looking away'}</span>
                </Badge>
                <Badge>Score {liveScore}</Badge>
                <Badge>{acc.current.distractions} distractions</Badge>
              </div>
              <Timeline timeline={acc.current.timeline} className="mt-5 w-full max-w-md" />
              <Button className="mt-6" icon={<Square className="size-3.5" />} onClick={finish} data-testid="focus-stop">
                End session
              </Button>
            </div>
          )}
          {summary && !running && <Summary s={summary} onNew={() => setSummary(null)} />}
        </Card>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="px-5 py-4">
              <div className="flex items-center gap-1.5 text-[12.5px] text-muted">
                <Timer className="size-3.5" /> Focused today
              </div>
              <div className="mt-1 text-[26px] font-semibold text-ink tabular">{Math.round(todaySec / 60)}m</div>
            </Card>
            <Card className="px-5 py-4">
              <div className="flex items-center gap-1.5 text-[12.5px] text-muted">
                <Flame className="size-3.5" /> Streak
              </div>
              <div className="mt-1 text-[26px] font-semibold text-ink tabular">
                {streak} day{streak === 1 ? '' : 's'}
              </div>
            </Card>
          </div>
          <Card>
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                {showCam ? <Eye className="size-4" /> : <EyeOff className="size-4" />} Show camera view
              </span>
              <Toggle checked={showCam} onChange={setShowCam} label="Show camera" />
            </div>
            {showCam && (
              <div className="border-t border-line p-3">
                <SensorViewport sensor={p.sensor} observation={p.observation} running={p.status.state === 'running'} tone={p.looking ? 'tracking' : 'idle'} progress={0} scanning={false} className="aspect-[16/10] w-full rounded-xl" />
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="History" />
            {mine.length === 0 ? (
              <EmptyState icon={<Target className="size-5" />} title="No sessions yet" description="Your first session will show up here." className="py-8" />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {mine.slice(0, 8).map((s) => (
                  <li key={s.id} className="px-5 py-3">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="truncate font-medium text-ink">{s.goal}</span>
                      <Badge tone={s.score >= 75 ? 'ok' : s.score >= 50 ? 'warn' : 'bad'}>{s.score}</Badge>
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted">
                      {formatDate(s.startedAt)} {formatTime(s.startedAt)} · {Math.round(s.focusedSec / 60)}m focused
                    </div>
                    <Timeline timeline={s.timeline} className="mt-2" small />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 46
  const c = 2 * Math.PI * r
  return (
    <div className="relative mt-4 size-[200px]">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="3" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[40px] font-light text-ink tabular">{label}</div>
    </div>
  )
}

function Timeline({ timeline, className, small }: { timeline: string; className?: string; small?: boolean }) {
  const cells = timeline.split('')
  if (!cells.length) return <div className={cx('rounded bg-surface-2', small ? 'h-1.5' : 'h-3', className)} />
  return (
    <div className={cx('flex gap-px overflow-hidden rounded', small ? 'h-1.5' : 'h-3', className)} title="Green: focused · Amber: eyes closed · Grey: away">
      {cells.map((c, i) => (
        <div key={i} className={cx('flex-1', c === 'f' ? 'bg-ok' : c === 'c' ? 'bg-warn' : 'bg-surface-3')} />
      ))}
    </div>
  )
}

function Summary({ s, onNew }: { s: FocusSession; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center py-4 text-center" data-testid="focus-summary">
      <div className="text-[13px] text-muted">{s.goal}</div>
      <div className="mt-3 text-[64px] leading-none font-semibold tracking-tight text-ink tabular" data-testid="focus-score">
        {s.score}
      </div>
      <div className="mt-1 text-[13px] text-muted">focus score</div>
      <div className="mt-6 grid w-full max-w-md grid-cols-3 gap-2">
        {[
          ['Focused', `${Math.round(s.focusedSec / 60)}m ${s.focusedSec % 60}s`],
          ['Away', `${Math.round(s.awaySec / 60)}m ${s.awaySec % 60}s`],
          ['Distractions', String(s.distractions)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line py-3">
            <div className="text-[15px] font-semibold text-ink tabular">{v}</div>
            <div className="text-[11.5px] text-muted">{k}</div>
          </div>
        ))}
      </div>
      <Timeline timeline={s.timeline} className="mt-5 w-full max-w-md" />
      <Button variant="primary" className="mt-6" onClick={onNew}>
        New session
      </Button>
    </div>
  )
}
