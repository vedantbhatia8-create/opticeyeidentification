/**
 * Supabase client for Optic's cross-device features (device list, remote lock,
 * remote snapshot). The URL and publishable key are public by design; isolation
 * between people comes from the unguessable account_key capability (see devices.ts).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vfdylsjqtcanohmoqixr.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_KL1OD0CmnWaefJXa0JLVmA_QoS5EiXz'

let client: SupabaseClient | null = null

/** Lazily created so the SDK isn't loaded until the devices feature is used. */
export function sb(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 5 } },
  })
  return client
}

export interface DeviceRow {
  id: string
  account_key: string
  name: string
  platform: string | null
  last_seen: string
  locked: boolean
  created_at: string
}

export interface CommandRow {
  id: string
  account_key: string
  target_device_id: string
  from_device_id: string | null
  from_name: string | null
  type: 'lock' | 'unlock' | 'snapshot'
  status: 'pending' | 'done' | 'failed'
  result: string | null
  created_at: string
}
