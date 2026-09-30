import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

/**
 * Bumping DATA_VERSION wipes everything this browser stored for Optic
 * (identities, optic scans, office/hotel data, app data) once, on next load.
 */
const DATA_VERSION = '2'
const VERSION_KEY = 'optic-data-version'

function wipeStaleData(): Promise<void> {
  try {
    if (localStorage.getItem(VERSION_KEY) === DATA_VERSION) return Promise.resolve()
    for (const key of Object.keys(localStorage)) if (key.startsWith('optic')) localStorage.removeItem(key)
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('optic')) sessionStorage.removeItem(key)
  } catch {
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    const done = () => {
      try {
        localStorage.setItem(VERSION_KEY, DATA_VERSION)
      } catch {
        /* storage unavailable */
      }
      resolve()
    }
    try {
      const req = indexedDB.deleteDatabase('optic-access')
      req.onsuccess = req.onerror = req.onblocked = done
    } catch {
      done()
    }
  })
}

wipeStaleData().then(async () => {
  const { App } = await import('./App')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
