// Runs only on the Optic Access site. Marks the page so it can tell the
// extension is installed, and relays the /verify page's glance result to the
// extension's background worker (which checks it against the request it made).
;(() => {
  document.documentElement.dataset.opticExtension = chrome.runtime.getManifest().version

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin) return
    const d = e.data
    if (!d || d.source !== 'optic-access' || d.type !== 'verify-result') return
    chrome.runtime.sendMessage({
      type: 'optic:result',
      nonce: String(d.nonce || ''),
      ok: !!d.ok,
      name: d.name ? String(d.name) : null,
      email: d.email ? String(d.email) : null,
      reason: d.reason ? String(d.reason) : null,
    })
  })
})()
