import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Popup landing page for the drop-in connector (optic.js). Optic's /connect
 * flow redirects here with the signed result; we hand it to the opener window
 * via postMessage and close. If there is no opener (opened directly), we show a
 * short message.
 */
export function ConnectReturn() {
  const [params] = useSearchParams()
  useEffect(() => {
    const payload = {
      type: 'optic-connect',
      nonce: params.get('nonce') ?? '',
      sig: params.get('sig') ?? '',
      pub: params.get('pub') ?? '',
      name: params.get('name') ?? '',
    }
    if (window.opener) {
      // We don't know the app's exact origin here; the opener validates the
      // nonce and only accepts messages from Optic's origin, so '*' is safe.
      window.opener.postMessage(payload, '*')
      setTimeout(() => window.close(), 150)
    }
  }, [params])

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-bg text-ink">
      <div className="text-center">
        <div className="text-[15px] font-medium">Verified with Optic</div>
        <div className="mt-1 text-[13px] text-muted">You can close this window.</div>
      </div>
    </div>
  )
}
