import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { EnrollPage } from './features/lab/EnrollPage'
import { LabAuthenticate } from './features/lab/LabAuthenticate'
import { LabHome } from './features/lab/LabHome'
import { LabLayout } from './features/lab/LabLayout'
import { LabScans } from './features/lab/LabScans'
import { useApplyTheme } from './features/shell/ThemeToggle'
import { initServices } from './state/services'

export function App() {
  useApplyTheme()
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
        <Route path="/" element={<Navigate to="/lab" replace />} />
        <Route path="/lab" element={<LabLayout />}>
          <Route index element={<LabHome />} />
          <Route path="scans" element={<LabScans />} />
        </Route>
        <Route path="/lab/enroll" element={<EnrollPage />} />
        <Route path="/lab/authenticate" element={<LabAuthenticate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
