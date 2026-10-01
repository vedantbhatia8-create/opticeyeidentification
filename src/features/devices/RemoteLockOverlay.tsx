import { Lock, ScanEye } from 'lucide-react'
import { useDeviceAgent } from './agent'
import { setLocked } from './devices'
import { deviceId } from './devices'

/**
 * Shown full-screen when another of your devices has locked this one. It clears
 * when the other device unlocks it, or when you verify here with a glance.
 */
export function RemoteLockOverlay() {
  const locked = useDeviceAgent((s) => s.locked)
  const by = useDeviceAgent((s) => s.lockedBy)
  if (!locked) return null
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/92 backdrop-blur-xl">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
        <Lock className="size-7 text-white/80" />
      </div>
      <div className="mt-5 text-[20px] font-semibold text-white">This device is locked</div>
      <div className="mt-1.5 max-w-sm px-6 text-center text-[14px] text-white/55">
        {by ? `Locked remotely from “${by}”.` : 'Locked remotely from another of your devices.'} It stays locked until you unlock it there.
      </div>
      <button
        onClick={async () => {
          await setLocked(deviceId(), false)
          useDeviceAgent.getState().setLocked(false)
        }}
        className="mt-7 flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-[13.5px] font-medium text-white/80 hover:bg-white/10"
      >
        <ScanEye className="size-4" /> It’s me — unlock this device
      </button>
    </div>
  )
}
