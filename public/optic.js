/*
 * Optic Access — drop-in connector for your own apps.
 *
 * Add one line to any site you build:
 *   <script src="https://opticaccess.vercel.app/optic.js" data-optic-code="optic_live_xxx"></script>
 *
 * Then either:
 *   • add  data-optic-verify  to any button, and listen for the `optic:verified`
 *     event on it, or
 *   • call  window.Optic.verify().then(r => { if (r.ok) ... })
 *
 * verify() opens Optic in a popup, the person looks at their camera once, and
 * you get back { ok, name, sig, pub, nonce }. Verify `sig`/`pub` on your server
 * for real security; `ok` + `name` are enough for a friendly front-end gate.
 */
(function () {
  var self = document.currentScript
  var BASE = (function () {
    try {
      return new URL(self.src).origin
    } catch (e) {
      return 'https://opticaccess.vercel.app'
    }
  })()
  var CODE = (self && self.getAttribute('data-optic-code')) || window.OPTIC_CODE || ''

  function randomNonce() {
    var a = new Uint8Array(24)
    crypto.getRandomValues(a)
    return Array.from(a, function (b) { return (b % 36).toString(36) }).join('')
  }

  function verify(opts) {
    opts = opts || {}
    var code = opts.code || CODE
    var appName = opts.app || document.title || location.hostname
    var nonce = randomNonce()
    var ret = BASE + '/connect/return'
    var url =
      BASE + '/connect?app=' + encodeURIComponent(appName) +
      '&code=' + encodeURIComponent(code) +
      '&nonce=' + encodeURIComponent(nonce) +
      '&return=' + encodeURIComponent(ret)

    var w = 440, h = 680
    var y = window.top.outerHeight / 2 + window.top.screenY - h / 2
    var x = window.top.outerWidth / 2 + window.top.screenX - w / 2
    var popup = window.open(url, 'optic-verify', 'width=' + w + ',height=' + h + ',left=' + x + ',top=' + y)

    return new Promise(function (resolve) {
      var settled = false
      function finish(result) {
        if (settled) return
        settled = true
        window.removeEventListener('message', onMsg)
        clearInterval(poll)
        resolve(result)
      }
      function onMsg(ev) {
        if (ev.origin !== BASE) return
        var d = ev.data || {}
        if (d.type !== 'optic-connect') return
        if (d.nonce !== nonce) return
        try { popup && popup.close() } catch (e) {}
        finish({ ok: !!d.sig, name: d.name || null, sig: d.sig || null, pub: d.pub || null, nonce: nonce })
      }
      window.addEventListener('message', onMsg)
      // If the user closes the popup without verifying, resolve as not-ok.
      var poll = setInterval(function () {
        if (popup && popup.closed) finish({ ok: false, name: null, sig: null, pub: null, nonce: nonce, cancelled: true })
      }, 600)
    })
  }

  function wire() {
    var els = document.querySelectorAll('[data-optic-verify]')
    for (var i = 0; i < els.length; i++) {
      ;(function (el) {
        if (el.__opticWired) return
        el.__opticWired = true
        el.addEventListener('click', function (e) {
          e.preventDefault()
          verify({ app: el.getAttribute('data-optic-app') || undefined }).then(function (r) {
            el.dispatchEvent(new CustomEvent('optic:verified', { bubbles: true, detail: r }))
          })
        })
      })(els[i])
    }
  }

  window.Optic = { verify: verify, base: BASE, code: CODE }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire)
  else wire()
})()
