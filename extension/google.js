// Runs on accounts.google.com. When the page is part of a "Sign in with Google"
// flow for some website, cover it with an Optic prompt until the person at the
// computer is verified with a glance. Nothing on Google's page is read or
// changed; the prompt is removed after verification and Google continues as usual.
;(() => {
  if (window.__opticGoogleGuard) return
  window.__opticGoogleGuard = true

  const path = location.pathname
  const href = decodeURIComponent(location.href)
  const isOAuth =
    path.startsWith('/o/oauth2') ||
    path.startsWith('/signin/oauth') ||
    path.startsWith('/gsi/select') ||
    path.startsWith('/gsi/iframe/select') ||
    (/^\/(v3\/signin|AccountChooser|ServiceLogin|signin)/.test(path) && /oauth|client_id=/i.test(href))
  if (!isOAuth) return

  const compact = window.top !== window // One Tap renders inside a small iframe
  const site = requestingSite()

  chrome.runtime.sendMessage({ type: 'optic:status' }, (status) => {
    if (chrome.runtime.lastError || !status || !status.enabled || status.verified) return
    mount(status)
  })

  /** The website asking for Google sign-in, from the OAuth parameters when present. */
  function requestingSite() {
    const params = new URLSearchParams(location.search)
    for (const key of ['redirect_uri', 'origin', 'client_origin', 'continue']) {
      const v = params.get(key)
      if (!v) continue
      try {
        const u = new URL(v)
        if (u.hostname && !u.hostname.endsWith('google.com')) return u.hostname
        const inner = u.searchParams.get('redirect_uri') || u.searchParams.get('origin')
        if (inner) return new URL(inner).hostname
      } catch {
        /* not a URL */
      }
    }
    return ''
  }

  function mount(status) {
    const host = document.createElement('optic-access-guard')
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:block'
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML = `
      <style>
        :host { all: initial; }
        .wrap { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center;
          background: radial-gradient(60% 50% at 50% 0%, rgba(84,214,255,.16), transparent 70%), rgba(4,6,10,.975);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; color: #e9f0fa; padding: 16px; }
        .card { width: 100%; max-width: ${compact ? '360px' : '420px'}; border-radius: 24px; padding: ${compact ? '18px' : '28px'};
          background: rgba(10,14,21,.92); border: 1px solid rgba(233,240,250,.1);
          box-shadow: 0 0 0 1px rgba(84,214,255,.18), 0 30px 80px -30px rgba(0,0,0,.8), 0 0 60px -20px rgba(84,214,255,.35); text-align: center; }
        .logo { width: ${compact ? '36px' : '48px'}; height: ${compact ? '36px' : '48px'}; margin: 0 auto; filter: drop-shadow(0 0 12px rgba(84,214,255,.55)); }
        .eyebrow { margin-top: 14px; font: 500 10.5px/1 ui-monospace, 'JetBrains Mono', Menlo, monospace; letter-spacing: .22em; text-transform: uppercase; color: #8fe4ff; }
        h1 { margin: 10px 0 0; font-size: ${compact ? '17px' : '21px'}; line-height: 1.25; font-weight: 600; letter-spacing: -.02em; }
        p { margin: 8px 0 0; font-size: 13.5px; line-height: 1.5; color: #92a0b6; }
        .site { color: #e9f0fa; font-weight: 600; }
        button.primary { margin-top: 20px; width: 100%; height: 46px; border: 0; border-radius: 14px; cursor: pointer;
          font: 600 15px Inter, ui-sans-serif, system-ui, sans-serif; color: #021018;
          background: linear-gradient(120deg, #54d6ff, #7a9dff); box-shadow: 0 0 0 1px rgba(84,214,255,.6), 0 10px 30px -10px rgba(84,214,255,.8); }
        button.primary:hover { filter: brightness(1.08); }
        button.primary:disabled { opacity: .6; cursor: default; }
        button.link { margin-top: 12px; background: none; border: 0; color: #5b667a; font: 12.5px Inter, ui-sans-serif, system-ui, sans-serif; cursor: pointer; text-decoration: underline; }
        .state { margin-top: 14px; min-height: 18px; font: 500 11.5px ui-monospace, 'JetBrains Mono', Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; }
        .ok { color: #34e0a1; } .bad { color: #ff5f7a; } .wait { color: #8fe4ff; }
        .note { margin-top: 16px; font-size: 11.5px; color: #5b667a; }
      </style>
      <div class="wrap" role="dialog" aria-modal="true" aria-label="Optic Access verification">
        <div class="card">
          <svg class="logo" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="9" fill="#54d6ff"/>
            <path d="M5.5 16c2.8-4.6 6.3-6.9 10.5-6.9s7.7 2.3 10.5 6.9c-2.8 4.6-6.3 6.9-10.5 6.9S8.3 20.6 5.5 16Z" stroke="#04060a" stroke-width="1.6"/>
            <circle cx="16" cy="16" r="3.6" stroke="#04060a" stroke-width="1.6"/><circle cx="16" cy="16" r="1.2" fill="#04060a"/>
          </svg>
          <div class="eyebrow">Optic Access</div>
          <h1>Verify it's you before signing in with Google</h1>
          <p>${site ? `<span class="site">${escapeHtml(site)}</span> wants you to sign in with Google.` : 'A website wants you to sign in with Google.'}
             One glance and Google continues${status.ownerName ? ` as <span class="site">${escapeHtml(status.ownerName)}</span>` : ''}.</p>
          <button class="primary" type="button">Verify with a glance</button>
          <div class="state" aria-live="polite"></div>
          ${status.mode === 'suggest' ? '<button class="link skip" type="button">Continue without Optic</button>' : ''}
          <div class="note">${status.mode === 'suggest' ? 'Optic is suggested for Google sign-ins.' : 'Required by the Optic Access extension.'}</div>
        </div>
      </div>`

    const btn = root.querySelector('button.primary')
    const state = root.querySelector('.state')
    const setState = (text, cls) => {
      state.textContent = text
      state.className = `state ${cls || ''}`
    }

    // Keep keyboard input from reaching Google's page while the prompt is up.
    const trap = (e) => {
      if (!host.isConnected) return
      if (e.composedPath().includes(host)) return
      e.stopImmediatePropagation()
      e.preventDefault()
    }
    for (const t of ['keydown', 'keypress', 'keyup']) window.addEventListener(t, trap, true)
    const unmount = () => {
      for (const t of ['keydown', 'keypress', 'keyup']) window.removeEventListener(t, trap, true)
      host.remove()
    }

    btn.addEventListener('click', () => {
      btn.disabled = true
      setState('Look at the Optic window…', 'wait')
      chrome.runtime.sendMessage({ type: 'optic:request', site }, (r) => {
        if (chrome.runtime.lastError || !r?.ok) {
          btn.disabled = false
          setState('Could not open Optic. Try again.', 'bad')
        }
      })
    })
    root.querySelector('button.skip')?.addEventListener('click', unmount)

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === 'optic:verified') {
        if (msg.ok) {
          setState(`Verified${msg.name ? ` · ${msg.name}` : ''}`, 'ok')
          setTimeout(unmount, 700)
        } else {
          btn.disabled = false
          btn.textContent = 'Try again'
          setState(msg.reason || 'Not verified. Sign-in blocked.', 'bad')
        }
      } else if (msg?.type === 'optic:cancelled') {
        btn.disabled = false
        setState('Verification cancelled.', 'bad')
      }
    })

    const attach = () => (document.documentElement || document).appendChild(host)
    if (document.documentElement) attach()
    else document.addEventListener('readystatechange', attach, { once: true })
    btn.focus()
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  }
})()
