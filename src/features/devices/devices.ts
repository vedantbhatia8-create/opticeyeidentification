/**
 * Optic device registry + remote control, backed by Supabase.
 *
 * A person's devices are grouped by a high-entropy `account_key` kept in
 * localStorage (and shared to another device with a 6-digit pairing code — the
 * key itself never travels in a URL). Each device has a stable `deviceId`. The
 * registry heartbeats every 20s; remote lock and remote snapshot flow through
 * the `commands` table over Realtime.
 */
import { sb, type CommandRow, type DeviceRow } from './supabase'

const KEY_ACCOUNT = 'optic.deviceAccountKey'
const KEY_DEVICE = 'optic.deviceId'
const KEY_NAME = 'optic.deviceName'

function rand(n: number): string {
  const a = crypto.getRandomValues(new Uint8Array(n))
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** This browser's stable device id. */
export function deviceId(): string {
  let id = localStorage.getItem(KEY_DEVICE)
  if (!id) {
    id = `dev_${rand(8)}`
    localStorage.setItem(KEY_DEVICE, id)
  }
  return id
}

/** The account key grouping this person's devices (created on first use). */
export function accountKey(): string {
  let k = localStorage.getItem(KEY_ACCOUNT)
  if (!k) {
    k = `ak_${rand(24)}`
    localStorage.setItem(KEY_ACCOUNT, k)
  }
  return k
}

export function setAccountKey(k: string) {
  localStorage.setItem(KEY_ACCOUNT, k)
}

/** A friendly, editable name for this device, guessed from the user agent. */
export function deviceName(): string {
  const saved = localStorage.getItem(KEY_NAME)
  if (saved) return saved
  const ua = navigator.userAgent
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Device'
  const browser = /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'Browser'
  return `${browser} on ${os}`
}

export function setDeviceName(name: string) {
  localStorage.setItem(KEY_NAME, name)
}

export function thisPlatform(): string {
  return navigator.platform || 'web'
}

/** Register (or refresh) this device and set its heartbeat. */
export async function registerDevice(): Promise<void> {
  await sb()
    .from('devices')
    .upsert(
      {
        id: deviceId(),
        account_key: accountKey(),
        name: deviceName(),
        platform: thisPlatform(),
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
}

export async function heartbeat(): Promise<void> {
  await sb().from('devices').update({ last_seen: new Date().toISOString() }).eq('id', deviceId())
}

export async function listDevices(): Promise<DeviceRow[]> {
  const { data } = await sb().from('devices').select('*').eq('account_key', accountKey()).order('created_at', { ascending: true })
  return data ?? []
}

export async function setLocked(targetId: string, locked: boolean): Promise<void> {
  await sb().from('devices').update({ locked }).eq('id', targetId).eq('account_key', accountKey())
}

export async function removeDevice(targetId: string): Promise<void> {
  await sb().from('devices').delete().eq('id', targetId).eq('account_key', accountKey())
}

/** Issue a command to another device (lock / unlock / snapshot). Returns the row id. */
export async function sendCommand(targetId: string, type: CommandRow['type'], fromName: string): Promise<string | null> {
  const { data } = await sb()
    .from('commands')
    .insert({ account_key: accountKey(), target_device_id: targetId, from_device_id: deviceId(), from_name: fromName, type })
    .select('id')
    .single()
  return data?.id ?? null
}

export async function getCommand(id: string): Promise<CommandRow | null> {
  const { data } = await sb().from('commands').select('*').eq('id', id).single()
  return (data as CommandRow) ?? null
}

/** Mark a command handled and attach a result (e.g. a snapshot data URL). */
export async function completeCommand(id: string, result: string | null, status: CommandRow['status'] = 'done'): Promise<void> {
  await sb().from('commands').update({ status, result }).eq('id', id)
}

const ONLINE_MS = 60_000
export function isOnline(d: DeviceRow): boolean {
  return Date.now() - new Date(d.last_seen).getTime() < ONLINE_MS
}

/** ---- Pairing: link a second device to the same account_key. ---- */

export async function createPairing(): Promise<string> {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  await sb().from('pairings').upsert({ code, account_key: accountKey() }, { onConflict: 'code' })
  return code
}

/** Adopt the account_key behind a pairing code. Returns true on success. */
export async function redeemPairing(code: string): Promise<boolean> {
  const { data } = await sb().from('pairings').select('account_key, expires_at').eq('code', code.trim()).single()
  if (!data) return false
  if (new Date(data.expires_at).getTime() < Date.now()) return false
  setAccountKey(data.account_key as string)
  await sb().from('pairings').delete().eq('code', code.trim())
  await registerDevice()
  return true
}
