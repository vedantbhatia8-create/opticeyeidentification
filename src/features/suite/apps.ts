import { ClipboardCheck, EyeOff, Home, KeyRound, ListChecks, ShieldHalf, Target, Users, type LucideIcon } from 'lucide-react'
import type { AppId } from './store'

export interface SuiteApp {
  id: AppId
  name: string
  to: string
  icon: LucideIcon
  tagline: string
  combines: string
}

export const SUITE_APPS: SuiteApp[] = [
  { id: 'vault', name: 'Vault', to: '/apps/vault', icon: KeyRound, tagline: 'Passwords and secure notes, unlocked with a glance + PIN', combines: 'Password manager · Secure notes · Approve' },
  { id: 'eyes-only', name: 'Eyes-Only', to: '/apps/eyes-only', icon: EyeOff, tagline: 'Documents only the intended person can see', combines: 'Eyes-only documents · Secure sharing' },
  { id: 'guard', name: 'Guard', to: '/apps/guard', icon: ShieldHalf, tagline: 'Locks when you leave, blurs when someone looks', combines: 'Walk-away lock · Shoulder-surf shield' },
  { id: 'family', name: 'Family', to: '/apps/family', icon: Users, tagline: 'Screen time and profiles that follow whoever sits down', combines: 'Screen Time · Shared screen · Profiles · Kids launcher' },
  { id: 'focus', name: 'Focus', to: '/apps/focus', icon: Target, tagline: 'Measures real eyes-on-work time', combines: 'Focus sessions · Focus score' },
  { id: 'attendance', name: 'Attendance', to: '/apps/attendance', icon: ClipboardCheck, tagline: 'Check in to classes and meetings with a glance', combines: 'Rosters · Check-in kiosk' },
]

export const SUITE_NAV = [
  { to: '/apps', label: 'Home', icon: Home, end: true },
  ...SUITE_APPS.map((a) => ({ to: a.to, label: a.name, icon: a.icon, end: false })),
  { to: '/apps/approvals', label: 'Activity', icon: ListChecks, end: false },
]
