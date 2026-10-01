// Optic Access for Google Sign-in: background service worker.
//
// Flow
//   1. google.js (on accounts.google.com) sees a Sign in with Google page and
//      asks for verification: "optic:request".
//   2. We open a small Optic window at <opticUrl>/verify?nonce=… and remember
//      which tab/frame asked.
//   3. The Optic page runs a glance and posts its result; bridge.js (only on the
//      Optic origin) relays it here: "optic:result".
//   4. We check the nonce, the sender's origin and the bound owner account, then
//      tell the waiting Google page to continue or stay blocked.
//
// The extension never reads passwords, cookies or Google tokens. It only shows
// a prompt over Google's page and removes it after a successful glance.

const DEFAULTS = {
  enabled: true,
  mode: 'required', // 'required' blocks until verified, 'suggest' allows skipping
  opticUrl: 'https://opticaccess.vercel.app',
  ownerEmail: null,
  ownerName: null,
  notifySites: true,
}
const VERIFIED_FOR_MS = 3 * 60 * 1000

const getSettings = async () => ({ ...DEFAULTS, ...(await chrome.storage.sync.get(null)) })
const getSession = async () => chrome.storage.session.get({ pending: {}, verifiedUntil: 0, toastSeen: {} })
const normalize = (email) => (email || '').trim().toLowerCase()
const randomNonce = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')

async function notifyTab(p, message) {
  try {
    await chrome.tabs.sendMessage(p.tabId, message, { frameId: p.frameId })
  } catch {
    /* the sign-in tab was closed */
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender).then(sendResponse, (err) => sendResponse({ error: String(err) }))
  return true // async response
})

async function handle(msg, sender) {
  const settings = await getSettings()
  const session = await getSession()

  switch (msg?.type) {
    case 'optic:status':
      return {
        enabled: settings.enabled,
        mode: settings.mode,
        ownerName: settings.ownerName,
        verified: session.verifiedUntil > Date.now(),
      }

    case 'optic:request': {
      if (!sender.tab) return { ok: false }
      const nonce = randomNonce()
      const site = String(msg.site || '').slice(0, 120)
      const url = `${settings.opticUrl.replace(/\/$/, '')}/verify?nonce=${nonce}&site=${encodeURIComponent(site)}`
      const win = await chrome.windows.create({ url, type: 'popup', width: 560, height: 800, focused: true })
      session.pending[nonce] = { tabId: sender.tab.id, frameId: sender.frameId ?? 0, windowId: win.id, at: Date.now() }
      await chrome.storage.session.set({ pending: session.pending })
      return { ok: true }
    }

    case 'optic:result': {
      // Only the Optic site may report a result, and only for a nonce we issued.
      const expected = new URL(settings.opticUrl).origin
      if (!sender.url || new URL(sender.url).origin !== expected) return { ok: false, error: 'wrong origin' }
      const p = session.pending[msg.nonce]
      if (!p) return { ok: false, error: 'unknown request' }
      delete session.pending[msg.nonce]

      let ok = !!msg.ok
      let reason = msg.reason || null
      if (ok) {
        const email = normalize(msg.email)
        if (!settings.ownerEmail) {
          // First successful glance binds this browser to that Optic account.
          await chrome.storage.sync.set({ ownerEmail: email, ownerName: msg.name || email })
        } else if (email !== settings.ownerEmail) {
          ok = false
          reason = `Verified as ${msg.name || 'someone else'}, but this browser is locked to ${settings.ownerName}.`
        }
      }
      await chrome.storage.session.set({ pending: session.pending, verifiedUntil: ok ? Date.now() + VERIFIED_FOR_MS : session.verifiedUntil })
      await notifyTab(p, { type: 'optic:verified', ok, name: msg.name || null, reason })
      setTimeout(() => chrome.windows.remove(p.windowId).catch(() => {}), ok ? 900 : 2500)
      return { ok: true }
    }

    case 'optic:toast': {
      if (!settings.enabled || !settings.notifySites) return { show: false }
      const origin = String(msg.origin || '')
      if (session.toastSeen[origin]) return { show: false }
      session.toastSeen[origin] = true
      await chrome.storage.session.set({ toastSeen: session.toastSeen })
      return { show: true, mode: settings.mode }
    }

    case 'optic:reset-owner':
      await chrome.storage.sync.set({ ownerEmail: null, ownerName: null })
      await chrome.storage.session.set({ verifiedUntil: 0 })
      return { ok: true }

    default:
      return { ok: false }
  }
}

// Closing the Optic window without finishing tells the Google page it can retry.
chrome.windows.onRemoved.addListener(async (windowId) => {
  const session = await getSession()
  const entry = Object.entries(session.pending).find(([, p]) => p.windowId === windowId)
  if (!entry) return
  const [nonce, p] = entry
  delete session.pending[nonce]
  await chrome.storage.session.set({ pending: session.pending })
  await notifyTab(p, { type: 'optic:cancelled' })
})
