import { motion } from 'framer-motion'
import { Lock, LockOpen } from 'lucide-react'
import type { AccessDecision } from '../../core/access/types'
import { cx } from '../../ui/primitives'
import type { AuthPhase } from '../sensor/useAuthFlow'

/**
 * Virtual door: a physical-access simulation driven by the access decision
 * and the door's live lock state from the store.
 */
export function DoorPanel({
  name,
  subtitle,
  unlocked,
  phase,
  decision,
}: {
  name: string
  subtitle?: string
  unlocked: boolean
  phase: AuthPhase
  decision: AccessDecision | null
}) {
  const denied = phase === 'result' && decision && decision.outcome !== 'granted'
  const state = unlocked ? 'open' : denied ? 'denied' : phase === 'authorizing' ? 'checking' : 'locked'
  const led = state === 'open' ? '#3ddc97' : state === 'denied' ? '#ff5d5d' : state === 'checking' ? '#8cc8ff' : 'rgba(255,255,255,0.35)'

  return (
    <div className="hidden w-[260px] flex-col items-center lg:flex" data-testid="door-panel" data-state={state}>
      <div className="relative h-[300px] w-[190px] [perspective:900px] sm:h-[360px] sm:w-[220px]">
        {/* frame */}
        <div className="absolute inset-0 rounded-t-[14px] border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01]" />
        {/* light spill when open */}
        <motion.div
          className="absolute inset-[6px] rounded-t-[10px]"
          style={{ background: 'linear-gradient(180deg, rgba(61,220,151,0.22), rgba(61,220,151,0.04))' }}
          animate={{ opacity: state === 'open' ? 1 : 0 }}
          transition={{ duration: 0.6 }}
        />
        {/* door leaf */}
        <motion.div
          className="absolute inset-[6px] origin-left rounded-t-[10px] border border-white/10 bg-[linear-gradient(160deg,#1a1d22,#101216)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          animate={
            state === 'open'
              ? { rotateY: -62, x: 0 }
              : state === 'denied'
                ? { rotateY: 0, x: [0, -6, 6, -4, 4, 0] }
                : { rotateY: 0, x: 0 }
          }
          transition={state === 'denied' ? { duration: 0.45 } : { type: 'spring', stiffness: 60, damping: 14, delay: state === 'open' ? 0.35 : 0 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="absolute inset-x-5 top-6 h-[38%] rounded-md border border-white/[0.06]" />
          <div className="absolute inset-x-5 bottom-6 h-[38%] rounded-md border border-white/[0.06]" />
          {/* handle + reader */}
          <div className="absolute top-1/2 right-4 flex -translate-y-1/2 flex-col items-center gap-3">
            <div className="flex h-12 w-7 flex-col items-center justify-center gap-1.5 rounded-md border border-white/10 bg-black/60">
              <span className="size-1.5 rounded-full transition-colors duration-300" style={{ background: led, boxShadow: `0 0 10px ${led}` }} />
              <span className="size-2.5 rounded-full border border-white/15" />
            </div>
            <div className="h-10 w-1.5 rounded-full bg-white/20" />
          </div>
        </motion.div>
        {/* bolt */}
        <motion.div
          className="absolute top-1/2 right-[-3px] h-2 w-4 -translate-y-1/2 rounded-sm bg-white/40"
          animate={{ x: state === 'open' ? -14 : 0, opacity: state === 'open' ? 0.2 : 1 }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <div className="mt-5 text-center">
        <div className="font-mono text-[11px] tracking-[0.28em] text-white/45 uppercase">{subtitle ?? 'Door'}</div>
        <div className="mt-1 text-[15px] font-medium text-white/85">{name}</div>
        <div
          className={cx(
            'mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] tracking-[0.2em] uppercase transition-colors duration-300',
            state === 'open' ? 'border-granted/40 text-granted' : state === 'denied' ? 'border-denied/40 text-denied' : 'border-white/15 text-white/50',
          )}
        >
          {state === 'open' ? <LockOpen className="size-3" /> : <Lock className="size-3" />}
          {state === 'open' ? 'Unlocked' : 'Locked'}
        </div>
      </div>
    </div>
  )
}
