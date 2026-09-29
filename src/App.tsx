import {
  Activity,
  BedDouble,
  BrushCleaning,
  ConciergeBell,
  Cpu,
  DoorClosed,
  KeyRound,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  UserRoundPlus,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { DemoGuide } from './features/demo/DemoGuide'
import {
  FrontDeskPage,
  GuestsPage,
  HotelAccessPage,
  HotelOverview,
  HousekeepingPage,
  RoomsPage,
} from './features/hotel/HotelPages'
import { ArchitecturePage } from './features/lab/ArchitecturePage'
import { EnrollPage } from './features/lab/EnrollPage'
import { LabAuthenticate } from './features/lab/LabAuthenticate'
import { LabHome } from './features/lab/LabHome'
import { LabLayout } from './features/lab/LabLayout'
import { LabScans } from './features/lab/LabScans'
import { Landing } from './features/landing/Landing'
import { AccessPage } from './features/office/AccessPage'
import { DoorsPage } from './features/office/DoorsPage'
import { OfficeOverview } from './features/office/OfficeOverview'
import { PeoplePage } from './features/office/PeoplePage'
import { VisitorsPage } from './features/office/VisitorsPage'
import { ConsoleLayout, type NavItem } from './features/shell/ConsoleLayout'
import { ActivityPage, DevicesPage, SettingsPage } from './features/shell/SharedPages'
import { useApplyTheme } from './features/shell/ThemeToggle'
import { TerminalPage } from './features/terminal/TerminalPage'
import { SuiteActivity } from './features/suite/ActivityPage'
import { AttendanceApp, AttendanceKiosk } from './features/suite/AttendanceApp'
import { EyesOnlyApp } from './features/suite/EyesOnlyApp'
import { EyesOnlyViewer } from './features/suite/EyesOnlyViewer'
import { FamilyApp, FamilyScreen } from './features/suite/FamilyApp'
import { FocusApp } from './features/suite/FocusApp'
import { GuardApp } from './features/suite/GuardApp'
import { SuiteHome } from './features/suite/Home'
import { PresenceProvider } from './features/suite/presence'
import { SignIn } from './features/suite/SignIn'
import { SuiteLayout } from './features/suite/SuiteLayout'
import { VaultApp } from './features/suite/VaultApp'
import { initServices } from './state/services'
import { useStore } from './state/store'

const OFFICE_NAV: NavItem[] = [
  { to: '/office', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/office/people', label: 'People', icon: Users },
  { to: '/office/doors', label: 'Doors', icon: DoorClosed },
  { to: '/office/access', label: 'Access Groups', icon: ShieldCheck },
  { to: '/office/visitors', label: 'Visitors', icon: UserRoundPlus },
  { to: '/office/activity', label: 'Activity', icon: Activity },
  { to: '/office/devices', label: 'Devices', icon: Cpu },
  { to: '/office/settings', label: 'Settings', icon: Settings },
]

const HOTEL_NAV: NavItem[] = [
  { to: '/hotel', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/hotel/guests', label: 'Guests', icon: Users },
  { to: '/hotel/rooms', label: 'Rooms', icon: BedDouble },
  { to: '/hotel/front-desk', label: 'Front Desk', icon: ConciergeBell },
  { to: '/hotel/housekeeping', label: 'Housekeeping', icon: BrushCleaning },
  { to: '/hotel/access', label: 'Access', icon: KeyRound },
  { to: '/hotel/activity', label: 'Activity', icon: Activity },
  { to: '/hotel/devices', label: 'Devices', icon: Cpu },
  { to: '/hotel/settings', label: 'Settings', icon: Settings },
]

export function App() {
  useApplyTheme()
  const officeSite = useStore((s) => s.office.siteName)
  const hotelSite = useStore((s) => s.hotel.propertyName)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    initServices()
      .catch((err) => console.error('[optic] identity vault failed to initialise', err))
      .finally(() => setReady(true))
  }, [])
  if (!ready) return <div className="min-h-screen bg-bg" />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/demo" element={<DemoGuide />} />

        {/* Phase 1 — Optic Sensor Lab */}
        <Route path="/lab" element={<LabLayout />}>
          <Route index element={<LabHome />} />
          <Route path="scans" element={<LabScans />} />
          <Route path="architecture" element={<ArchitecturePage />} />
        </Route>
        <Route path="/lab/enroll" element={<EnrollPage />} />
        <Route path="/lab/authenticate" element={<LabAuthenticate />} />

        {/* Phase 2 — Office */}
        <Route path="/office" element={<ConsoleLayout product="office" nav={OFFICE_NAV} siteName={officeSite} terminalTo="/terminal/office" />}>
          <Route index element={<OfficeOverview />} />
          <Route path="people" element={<PeoplePage />} />
          <Route path="doors" element={<DoorsPage />} />
          <Route path="access" element={<AccessPage />} />
          <Route path="visitors" element={<VisitorsPage />} />
          <Route path="activity" element={<ActivityPage site="office" />} />
          <Route path="devices" element={<DevicesPage site="office" />} />
          <Route path="settings" element={<SettingsPage site="office" />} />
        </Route>

        {/* Phase 3 — Hotel */}
        <Route path="/hotel" element={<ConsoleLayout product="hotel" nav={HOTEL_NAV} siteName={hotelSite} terminalTo="/terminal/hotel" />}>
          <Route index element={<HotelOverview />} />
          <Route path="guests" element={<GuestsPage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="front-desk" element={<FrontDeskPage />} />
          <Route path="housekeeping" element={<HousekeepingPage />} />
          <Route path="access" element={<HotelAccessPage />} />
          <Route path="activity" element={<ActivityPage site="hotel" />} />
          <Route path="devices" element={<DevicesPage site="hotel" />} />
          <Route path="settings" element={<SettingsPage site="hotel" />} />
        </Route>

        {/* Optic Apps — software products on the same identity engine */}
        <Route
          path="/apps"
          element={
            <PresenceProvider>
              <Outlet />
            </PresenceProvider>
          }
        >
          <Route path="signin" element={<SignIn />} />
          <Route path="view/:docId" element={<EyesOnlyViewer />} />
          <Route path="family/screen" element={<FamilyScreen />} />
          <Route path="attendance/kiosk/:eventId" element={<AttendanceKiosk />} />
          <Route element={<SuiteLayout />}>
            <Route index element={<SuiteHome />} />
            <Route path="vault" element={<VaultApp />} />
            <Route path="eyes-only" element={<EyesOnlyApp />} />
            <Route path="guard" element={<GuardApp />} />
            <Route path="family" element={<FamilyApp />} />
            <Route path="focus" element={<FocusApp />} />
            <Route path="attendance" element={<AttendanceApp />} />
            <Route path="approvals" element={<SuiteActivity />} />
          </Route>
        </Route>

        {/* Physical terminals — same component, same engine */}
        <Route path="/terminal/office/:resourceId?" element={<TerminalPage site="office" />} />
        <Route path="/terminal/hotel/:resourceId?" element={<TerminalPage site="hotel" />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
