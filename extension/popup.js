const DEFAULTS = { enabled: true, mode: 'required', opticUrl: 'https://opticaccess.vercel.app', ownerEmail: null, ownerName: null, notifySites: true }
const $ = (id) => document.getElementById(id)

async function render() {
  const s = { ...DEFAULTS, ...(await chrome.storage.sync.get(null)) }
  $('enabled').setAttribute('aria-checked', String(s.enabled))
  $('notify').setAttribute('aria-checked', String(s.notifySites))
  for (const b of $('mode').querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === s.mode)
  $('modeHint').textContent = s.mode === 'required' ? 'Google waits until you are verified.' : 'You can skip the glance.'
  $('owner').textContent = s.ownerEmail ? `${s.ownerName} · ${s.ownerEmail}` : 'Nobody yet: your first glance locks it to you.'
  $('owner').className = s.ownerEmail ? 'owner' : 'muted'
  $('reset').hidden = !s.ownerEmail
  $('open').href = `${s.opticUrl.replace(/\/$/, '')}/apps/extension`
  if (document.activeElement !== $('url')) $('url').value = s.opticUrl
}

$('passwords').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'optic:open-passwords' })
  window.close()
})
if (!/Mac/i.test(navigator.platform)) $('kbd').textContent = 'Ctrl+Shift+Y'

$('enabled').addEventListener('click', async () => {
  const { enabled = true } = await chrome.storage.sync.get('enabled')
  await chrome.storage.sync.set({ enabled: !enabled })
  render()
})
$('notify').addEventListener('click', async () => {
  const { notifySites = true } = await chrome.storage.sync.get('notifySites')
  await chrome.storage.sync.set({ notifySites: !notifySites })
  render()
})
$('mode').addEventListener('click', async (e) => {
  const v = e.target?.dataset?.v
  if (v) await chrome.storage.sync.set({ mode: v })
  render()
})
$('reset').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'optic:reset-owner' })
  render()
})
$('url').addEventListener('change', async () => {
  try {
    const u = new URL($('url').value.trim())
    await chrome.storage.sync.set({ opticUrl: u.origin })
  } catch {
    /* ignore invalid input */
  }
  render()
})

render()
