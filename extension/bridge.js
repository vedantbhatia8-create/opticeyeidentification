// Runs only on the Optic Access site. Marks the page so it can tell the
// extension is installed, and relays the /verify page's glance result to the
// extension's background worker (which checks it against the request it made).
;(() => {
  document.documentElement.dataset.opticExtension = chrome.runtime.getManifest().version

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin) return
    const d = e.data
    if (!d || d.source !== 'optic-access') return
    if (d.type === 'verify-result') {
      chrome.runtime.sendMessage({
        type: 'optic:result',
        nonce: String(d.nonce || ''),
        ok: !!d.ok,
        name: d.name ? String(d.name) : null,
        email: d.email ? String(d.email) : null,
        reason: d.reason ? String(d.reason) : null,
      })
    } else if (d.type === 'optic-fill') {
      // From the in-tab passwords panel (an iframe of the Optic site). Credentials
      // go only through the extension to the host page's filler, never via the host DOM.
      chrome.runtime.sendMessage({ type: 'optic:fill', username: String(d.username || ''), password: String(d.password || '') })
    } else if (d.type === 'optic-close') {
      chrome.runtime.sendMessage({ type: 'optic:close-panel' })
    }
  })
})()
