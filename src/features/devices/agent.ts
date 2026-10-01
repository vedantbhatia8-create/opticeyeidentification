/**
 * Device agent — runs on every signed-in device. It registers the device,
 * heartbeats, and listens for remote commands from your other devices:
 *   • lock / unlock → shows a full-screen lock on this device
 *   • snapshot      → briefly opens the camera, captures one frame, and sends
 *                     it back so you can see who is here from your phone.
 */
import { create } from 'zustand'
import { openCamera, releaseStream } from '../../core/sensor/webcam/camera'
import { captureSnapshot } from '../suite/breakins'
import { sb, type CommandRow } from './supabase'
import { completeCommand, deviceId, heartbeat, listDevices, registerDevice, setLocked } from './devices'
import { pullEnrollments, pushEnrollments } from './enrollmentSync'

interface AgentState {
  locked: boolean
  lockedBy: string | null
  setLocked(locked: boolean, by?: string | null): void
}

export const useDeviceAgent = create<AgentState>((set) => ({
  locked: false,
  lockedBy: null,
  setLocked: (locked, by = null) => set({ locked, lockedBy: locked ? by : null }),
}))

async function handleCommand(cmd: CommandRow) {
  if (cmd.target_device_id !== deviceId()) return
  if (cmd.type === 'lock') {
    useDeviceAgent.getState().setLocked(true, cmd.from_name)
    await setLocked(deviceId(), true)
    await completeCommand(cmd.id, 'locked')
  } else if (cmd.type === 'unlock') {
    useDeviceAgent.getState().setLocked(false)
    await setLocked(deviceId(), false)
    await completeCommand(cmd.id, 'unlocked')
  } else if (cmd.type === 'snapshot') {
    let stream: MediaStream | null = null
    try {
      stream = await openCamera()
      await new Promise((r) => setTimeout(r, 600))
      const shot = await captureSnapshot(stream, 360)
      await completeCommand(cmd.id, shot, shot ? 'done' : 'failed')
    } catch {
      await completeCommand(cmd.id, null, 'failed')
    } finally {
      releaseStream(stream)
    }
  }
}

/** Start the agent for the signed-in session. Returns a cleanup function. */
export function startDeviceAgent(): () => void {
  let stopped = false
  void registerDevice()
  // Keep enrollment in sync both ways: pull others' enrollments in, push ours up.
  void pullEnrollments()
    .catch(() => 0)
    .then(() => pushEnrollments())
    .catch(() => 0)

  // Reflect any lock already set on this device's row (e.g. locked while offline).
  void listDevices().then((rows) => {
    const me = rows.find((r) => r.id === deviceId())
    if (me?.locked && !stopped) useDeviceAgent.getState().setLocked(true)
  })

  const beat = setInterval(() => void heartbeat(), 20_000)

  const channel = sb()
    .channel(`optic-cmds-${deviceId()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'commands', filter: `target_device_id=eq.${deviceId()}` }, (payload) =>
      handleCommand(payload.new as CommandRow),
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'devices', filter: `id=eq.${deviceId()}` }, (payload) => {
      const row = payload.new as { locked: boolean }
      if (!row.locked) useDeviceAgent.getState().setLocked(false)
    })
    .subscribe()

  return () => {
    stopped = true
    clearInterval(beat)
    void sb().removeChannel(channel)
  }
}
