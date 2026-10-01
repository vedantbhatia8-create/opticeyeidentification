// Runs on every website (top frame). Detects a login form, shows an Optic chip
// by the password box, and opens an in-tab panel (an iframe of the Optic site's
// glance-to-unlock passwords page) right on the page — no separate tab or window.
// After a glance, the chosen credentials arrive from the extension background
// (never through this page's own scripts) and fill the form.
;(() => {
  if (window.top !== window || window.__opticVault) return
  window.__opticVault = true

  let opticOrigin = 'https://opticaccess.vercel.app'
  chrome.storage.sync.get({ opticUrl: opticOrigin }).then((s) => {
    try {
      opticOrigin = new URL(s.opticUrl).origin
    } catch {
      /* keep default */
    }
  })

  // ── Find the login fields ──────────────────────────────────────────────────
  const visible = (el) => {
    if (!el) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
  }
  const passwordField = () => [...document.querySelectorAll('input[type="password"]')].find(visible) || null
  function usernameField(pw) {
    const scope = pw?.form || document
    const cands = [...scope.querySelectorAll('input')].filter(
      (i) => visible(i) && ['text', 'email', 'tel', ''].includes((i.type || '').toLowerCase()),
    )
    if (pw) {
      // Prefer the last eligible input before the password box.
      const before = cands.filter((i) => pw.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_PRECEDING)
      if (before.length) return before[before.length - 1]
    }
    return (
      cands.find((i) => /user|email|login|account/i.test(`${i.name} ${i.id} ${i.autocomplete} ${i.placeholder}`)) ||
      cands[0] ||
      null
    )
  }

  // React/Vue ignore a plain value assignment, so set via the native setter + events.
  function setValue(el, value) {
    if (!el) return
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    el.focus()
    setter ? setter.call(el, value) : (el.value = value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
  }

  function doFill(username, password) {
    const pw = passwordField()
    const user = usernameField(pw)
    if (user && username) setValue(user, username)
    if (pw && password) setValue(pw, password)
    closePanel()
    if (pw) pw.style.outline = '2px solid #54d6ff'
    setTimeout(() => pw && (pw.style.outline = ''), 1200)
  }

  // ── In-tab panel (iframe of the Optic passwords page) ───────────────────────
  let panel = null
  function openPanel() {
    if (panel) return
    panel = document.createElement('div')
    panel.style.cssText =
      'position:fixed;top:16px;right:16px;z-index:2147483647;width:420px;max-width:calc(100vw - 32px);height:640px;max-height:calc(100vh - 32px);' +
      'border-radius:20px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(0,0,0,.7),0 0 0 1px rgba(84,214,255,.35),0 0 50px -20px rgba(84,214,255,.6);background:#04060a'
    const bar = document.createElement('div')
    bar.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;padding:8px 10px 8px 14px;background:#070a10;color:#e9f0fa;font:600 12px Inter,system-ui,sans-serif;border-bottom:1px solid rgba(233,240,250,.08)'
    bar.innerHTML = '<span style="letter-spacing:.14em;text-transform:uppercase;font-size:10.5px;color:#8fe4ff">Optic passwords</span>'
    const close = document.createElement('button')
    close.textContent = '✕'
    close.setAttribute('aria-label', 'Close')
    close.style.cssText = 'background:none;border:0;color:#92a0b6;font-size:15px;cursor:pointer;padding:4px 6px'
    close.addEventListener('click', closePanel)
    bar.appendChild(close)
    const frame = document.createElement('iframe')
    frame.src = `${opticOrigin}/p?embed=1`
    frame.allow = `camera ${opticOrigin}; microphone ${opticOrigin}`
    frame.style.cssText = 'width:100%;height:calc(100% - 37px);border:0;background:#04060a;display:block'
    panel.appendChild(bar)
    panel.appendChild(frame)
    document.documentElement.appendChild(panel)
    document.addEventListener('keydown', onEsc, true)
  }
  function closePanel() {
    if (!panel) return
    panel.remove()
    panel = null
    document.removeEventListener('keydown', onEsc, true)
  }
  const onEsc = (e) => {
    if (e.key === 'Escape') closePanel()
  }

  // ── Auto-prompt chip by the password box ────────────────────────────────────
  let chip = null
  function showChip(pw) {
    if (chip || !pw) return
    chip = document.createElement('div')
    const root = chip.attachShadow({ mode: 'open' })
    root.innerHTML = `
      <style>
        .c{position:fixed;z-index:2147483646;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:14px;cursor:pointer;
          background:rgba(10,14,21,.97);color:#e9f0fa;border:1px solid rgba(84,214,255,.4);
          box-shadow:0 14px 40px -16px rgba(0,0,0,.7),0 0 26px -12px rgba(84,214,255,.7);
          font:600 13px Inter,system-ui,-apple-system,sans-serif;transition:opacity .2s,transform .2s}
        .c:hover{transform:translateY(-1px)}
        svg{width:20px;height:20px;filter:drop-shadow(0 0 6px rgba(84,214,255,.6))}
        small{font-weight:500;color:#92a0b6;font-size:11.5px}
        button{margin-left:4px;background:none;border:0;color:#5b667a;cursor:pointer;font-size:14px}
      </style>
      <div class="c" part="c">
        <svg viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="9" fill="#54d6ff"/>
          <path d="M5.5 16c2.8-4.6 6.3-6.9 10.5-6.9s7.7 2.3 10.5 6.9c-2.8 4.6-6.3 6.9-10.5 6.9S8.3 20.6 5.5 16Z" stroke="#04060a" stroke-width="1.6"/>
          <circle cx="16" cy="16" r="3.6" stroke="#04060a" stroke-width="1.6"/><circle cx="16" cy="16" r="1.2" fill="#04060a"/></svg>
        <span>Fill with a glance <small>Optic</small></span>
        <button part="x" aria-label="Dismiss">✕</button>
      </div>`
    const c = root.querySelector('.c')
    const place = () => {
      const r = pw.getBoundingClientRect()
      if (r.width === 0) return closeChip()
      c.style.top = `${Math.max(8, r.bottom + 8)}px`
      c.style.left = `${Math.min(r.left, window.innerWidth - 240)}px`
    }
    c.addEventListener('click', (e) => {
      if (e.target.getAttribute('part') === 'x') return closeChip()
      openPanel()
    })
    document.documentElement.appendChild(chip)
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    chip._place = place
  }
  function closeChip() {
    if (!chip) return
    window.removeEventListener('scroll', chip._place, true)
    window.removeEventListener('resize', chip._place)
    chip.remove()
    chip = null
  }

  let shownFor = false
  const scan = () => {
    const pw = passwordField()
    if (pw && !shownFor) {
      shownFor = true
      showChip(pw)
    }
  }
  const obs = new MutationObserver(scan)
  obs.observe(document.documentElement, { childList: true, subtree: true })
  setTimeout(() => obs.disconnect(), 20000)
  scan()

  // ── Messages from the extension (trusted) ───────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'optic:open-panel') {
      closeChip()
      openPanel()
    } else if (msg?.type === 'optic:do-fill') {
      doFill(msg.username, msg.password)
    } else if (msg?.type === 'optic:close-panel') {
      closePanel()
    }
  })
})()
