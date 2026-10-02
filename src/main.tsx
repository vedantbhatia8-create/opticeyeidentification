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

/**
 * Self-heal stale deploys. When a new version ships, Vite's code-split chunks
 * get new content-hashed names. A tab opened before the deploy still asks for
 * the old chunk URLs, which now 404 ("failed to fetch dynamically imported
 * module"). Reload once to pull the fresh index.html + current chunk names.
 */
const RELOAD_FLAG = 'optic-stale-reload'
function reloadOnceForStaleChunk() {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === '1') return // already tried; avoid a loop
    sessionStorage.setItem(RELOAD_FLAG, '1')
  } catch {
    /* storage unavailable — reload anyway */
  }
  location.reload()
}
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  reloadOnceForStaleChunk()
})

wipeStaleData()
  .then(async () => {
    const { App } = await import('./App')
    try {
      sessionStorage.removeItem(RELOAD_FLAG) // loaded cleanly; re-arm for the next deploy
    } catch {
      /* ignore */
    }
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch(() => reloadOnceForStaleChunk())
