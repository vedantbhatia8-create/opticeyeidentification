// Runs on other websites. If the page offers "Sign in with Google", show a short
// notice (once per site per browser session) that Optic Access will ask for a
// glance. It only looks for Google's sign-in button; nothing on the page is read.
;(() => {
  if (window.top !== window || window.__opticSites) return
  window.__opticSites = true

  const TEXT = /\b(sign in|log in|login|continue|sign up)\s+with\s+google\b/i
  const found = () =>
    document.querySelector('iframe[src*="accounts.google.com/gsi/button"], .g_id_signin, #g_id_onload, [data-client_id][data-login_uri]') ||
    [...document.querySelectorAll('a, button, [role="button"]')].slice(0, 400).some((el) => TEXT.test(el.textContent || ''))

  let done = false
  const check = () => {
    if (done || !found()) return
    done = true
    observer.disconnect()
    chrome.runtime.sendMessage({ type: 'optic:toast', origin: location.origin }, (r) => {
      if (!chrome.runtime.lastError && r?.show) toast(r.mode)
    })
  }
  const observer = new MutationObserver(() => check())
  observer.observe(document.documentElement, { childList: true, subtree: true })
  setTimeout(() => observer.disconnect(), 15000)
  check()

  function toast(mode) {
    const host = document.createElement('optic-access-toast')
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML = `
      <style>
        :host { all: initial; }
        .t { position: fixed; right: 18px; bottom: 18px; z-index: 2147483647; display: flex; gap: 12px; align-items: center; max-width: 340px;
          padding: 12px 14px; border-radius: 16px; background: rgba(10,14,21,.96); color: #e9f0fa; border: 1px solid rgba(84,214,255,.3);
          box-shadow: 0 18px 50px -20px rgba(0,0,0,.7), 0 0 30px -12px rgba(84,214,255,.5);
          font: 13px/1.4 Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; transition: opacity .3s, transform .3s; }
        .t.hide { opacity: 0; transform: translateY(8px); }
        svg { flex: none; width: 30px; height: 30px; filter: drop-shadow(0 0 8px rgba(84,214,255,.5)); }
        b { display: block; font-weight: 600; }
        span { color: #92a0b6; font-size: 12.5px; }
        button { flex: none; align-self: flex-start; background: none; border: 0; color: #5b667a; cursor: pointer; font-size: 16px; line-height: 1; }
      </style>
      <div class="t" role="status">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect width="32" height="32" rx="9" fill="#54d6ff"/>
          <path d="M5.5 16c2.8-4.6 6.3-6.9 10.5-6.9s7.7 2.3 10.5 6.9c-2.8 4.6-6.3 6.9-10.5 6.9S8.3 20.6 5.5 16Z" stroke="#04060a" stroke-width="1.6"/>
          <circle cx="16" cy="16" r="3.6" stroke="#04060a" stroke-width="1.6"/><circle cx="16" cy="16" r="1.2" fill="#04060a"/>
        </svg>
        <div><b>Use Optic Access here</b><span>${
          mode === 'suggest' ? 'Signing in with Google? You can verify with a glance.' : 'Signing in with Google? Optic will ask for a glance first.'
        }</span></div>
        <button type="button" aria-label="Dismiss">×</button>
      </div>`
    const el = root.querySelector('.t')
    const close = () => {
      el.classList.add('hide')
      setTimeout(() => host.remove(), 300)
    }
    root.querySelector('button').addEventListener('click', close)
    document.documentElement.appendChild(host)
    setTimeout(close, 7000)
  }
})()
