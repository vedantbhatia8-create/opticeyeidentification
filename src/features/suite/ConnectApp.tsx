import { Check, Copy, Link2, Plus, Puzzle, Trash2, Unplug } from 'lucide-react'
import { useMemo, useState } from 'react'
import { timeAgo } from '../../ui/format'
import { Badge, Button, Card, CardHeader, cx, EmptyState, Field, Input } from '../../ui/primitives'
import { newConnection, toOrigin } from '../connect/connections'
import { PageHeader } from '../shell/ConsoleLayout'
import { useStore } from '../../state/store'

/**
 * Optic Connect — link any app you build to Optic Access with a code. Register
 * the app here, copy its code into the app (one <script> line, or its /optic
 * page), and "Verify with Optic" works there with a real glance.
 */
export function ConnectApp() {
  const connections = useStore((s) => s.connections)
  const addConnection = useStore((s) => s.addConnection)
  const removeConnection = useStore((s) => s.removeConnection)
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://opticaccess.vercel.app'

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const create = () => {
    const origin = toOrigin(url)
    if (!name.trim()) return setError('Give your app a name.')
    if (!origin) return setError('Enter your app’s web address, e.g. https://my-app.vercel.app')
    const c = newConnection(name, origin)
    addConnection(c)
    setName('')
    setUrl('')
    setError('')
    setSelected(c.id)
  }

  const active = connections.find((c) => c.id === selected) ?? connections[0] ?? null

  return (
    <>
      <PageHeader
        title="Optic Connect"
        description="Turn on Optic Access for any app you build. Register the app, copy its code in, and your users verify with a glance."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        {/* Register + list */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <Plus className="size-4 text-accent" /> Connect a new app
            </div>
            <div className="mt-4 space-y-3">
              <Field label="App name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My project" data-testid="connect-name" />
              </Field>
              <Field label="App web address">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://my-app.vercel.app" data-testid="connect-url" />
              </Field>
              {error && <div className="text-[12.5px] text-bad">{error}</div>}
              <Button variant="primary" icon={<Link2 className="size-4" />} onClick={create} data-testid="connect-create" className="w-full">
                Generate connection code
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Connected apps" description="Each app has its own code. Revoke a code to cut it off instantly." />
            {connections.length === 0 ? (
              <EmptyState icon={<Puzzle className="size-5" />} title="No apps connected yet" description="Register your first app above to get a code." />
            ) : (
              <ul className="divide-y divide-line border-t border-line" data-testid="connect-list">
                {connections.map((c) => (
                  <li
                    key={c.id}
                    className={cx('flex cursor-pointer items-center gap-3 px-5 py-3 transition hover:bg-surface-2/50', active?.id === c.id && 'bg-accent-soft/30')}
                    onClick={() => setSelected(c.id)}
                    data-testid="connect-item"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <Puzzle className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate text-[13.5px] font-medium text-ink">{c.name}</div>
                      <div className="truncate text-[12px] text-muted">{c.origin.replace(/^https?:\/\//, '')}</div>
                    </div>
                    {c.revoked ? (
                      <Badge tone="bad">Revoked</Badge>
                    ) : (
                      <span className="text-[11.5px] text-subtle">{c.lastUsedAt ? `used ${timeAgo(c.lastUsedAt)}` : 'never used'}</span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 className="size-3.5" />}
                      aria-label="Remove"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Remove ${c.name}? Its code stops working.`)) removeConnection(c.id)
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Integration panel */}
        {active ? (
          <IntegrationPanel base={base} code={active.code} name={active.name} />
        ) : (
          <Card className="flex items-center justify-center p-10">
            <div className="text-center text-[13.5px] text-muted">
              <Unplug className="mx-auto mb-3 size-6 text-subtle" />
              Register an app to see its code and the one line you paste in.
            </div>
          </Card>
        )}
      </div>
    </>
  )
}

function IntegrationPanel({ base, code, name }: { base: string; code: string; name: string }) {
  const script = `<script src="${base}/optic.js" data-optic-code="${code}"></script>`
  const button = `<button data-optic-verify>Verify with Optic</button>`
  const opticPage = opticPageTemplate(base, code, name)

  return (
    <Card className="p-5" data-testid="connect-integration">
      <div className="text-[14px] font-semibold text-ink">Connect “{name}”</div>
      <p className="mt-1 text-[13px] text-muted">Give this to Claude in your app’s project, or paste it in yourself.</p>

      <Snippet label="Connection code" value={code} testid="connect-code" />

      <div className="mt-4 text-[12.5px] font-medium text-ink">1 · Add Optic to your app (one line, in the page’s HTML)</div>
      <Snippet label="Script tag" value={script} mono />

      <div className="mt-4 text-[12.5px] font-medium text-ink">2 · Add a “Verify with Optic” button anywhere</div>
      <Snippet label="Button" value={button} mono />
      <p className="mt-2 text-[12px] text-muted">
        Listen for the <code className="font-mono text-accent-text">optic:verified</code> event, or call{' '}
        <code className="font-mono text-accent-text">window.Optic.verify()</code> which resolves to{' '}
        <code className="font-mono text-accent-text">{'{ ok, name, sig, pub }'}</code>.
      </p>

      <div className="mt-4 text-[12.5px] font-medium text-ink">3 · Optional: a ready-made /optic page for your app</div>
      <p className="mt-1 text-[12px] text-muted">
        Drop this in as <code className="font-mono text-accent-text">/optic</code> so you can see the connection and paste the code there.
      </p>
      <Snippet label="/optic page (paste into your app)" value={opticPage} mono collapsed />
    </Card>
  )
}

function Snippet({ label, value, mono, testid, collapsed }: { label: string; value: string; mono?: boolean; testid?: string; collapsed?: boolean }) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(!collapsed)
  const copy = () => {
    navigator.clipboard.writeText(value).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {},
    )
  }
  const short = useMemo(() => (value.length > 60 ? value.slice(0, 57) + '…' : value), [value])
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">{label}</span>
        <div className="flex items-center gap-2">
          {collapsed && (
            <button onClick={() => setOpen((o) => !o)} className="text-[11.5px] text-muted hover:text-ink">
              {open ? 'Hide' : 'Show'}
            </button>
          )}
          <button onClick={copy} className="flex items-center gap-1 text-[11.5px] text-accent-text hover:underline" data-testid={testid ? `${testid}-copy` : undefined}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      {open ? (
        <pre
          className={cx('max-h-72 overflow-auto rounded-lg border border-line bg-surface-2/70 px-3 py-2 text-[12px] text-ink', mono && 'font-mono')}
          data-testid={testid}
        >
          {value}
        </pre>
      ) : (
        <code className="block truncate rounded-lg border border-line bg-surface-2/70 px-3 py-2 font-mono text-[12px] text-muted">{short}</code>
      )}
    </div>
  )
}

/** A self-contained /optic page the user can paste into their own app. */
function opticPageTemplate(base: string, code: string, name: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Optic Access · ${name}</title>
  <style>
    body { font-family: system-ui, sans-serif; background:#0a0b0d; color:#e8eef6; margin:0; display:grid; place-items:center; min-height:100vh; }
    .card { max-width: 440px; width: calc(100% - 32px); border:1px solid #20242b; border-radius:18px; padding:28px; background:#111317; }
    h1 { font-size:20px; margin:0 0 4px; }
    p { color:#9aa4b2; font-size:14px; line-height:1.5; }
    code { background:#1a1d22; padding:2px 6px; border-radius:6px; font-size:12.5px; }
    input { width:100%; box-sizing:border-box; background:#1a1d22; border:1px solid #2a2f37; color:#e8eef6; border-radius:10px; padding:10px 12px; font-size:14px; margin:8px 0; }
    button { background:#4c8dff; color:#fff; border:0; border-radius:10px; padding:11px 18px; font-size:14px; font-weight:600; cursor:pointer; width:100%; }
    .ok { color:#3ddc97; } .muted { color:#6b7480; font-size:12px; }
    .row { display:flex; gap:8px; align-items:center; margin-top:14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Optic Access</h1>
    <p>This page connects <strong>${name}</strong> to your Optic account. Your connection code is saved below.</p>
    <input id="code" placeholder="optic_live_..." value="${code}" />
    <div class="row"><button id="save">Save code</button></div>
    <div class="row"><button id="verify" data-optic-verify>Verify with Optic</button></div>
    <p id="status" class="muted">Not verified yet.</p>
    <p class="muted">Powered by <a href="${base}" style="color:#4c8dff">Optic Access</a>.</p>
  </div>
  <script>
    var saved = localStorage.getItem('optic_code') || "${code}";
    document.getElementById('code').value = saved;
    window.OPTIC_CODE = saved;
    document.getElementById('save').onclick = function () {
      var v = document.getElementById('code').value.trim();
      localStorage.setItem('optic_code', v); window.OPTIC_CODE = v;
      document.getElementById('status').textContent = 'Code saved. Reload to apply.';
    };
  </script>
  <script src="${base}/optic.js" data-optic-code="${code}"></script>
  <script>
    document.getElementById('verify').addEventListener('optic:verified', function (e) {
      var s = document.getElementById('status');
      if (e.detail && e.detail.ok) { s.className = 'ok'; s.textContent = 'Verified as ' + (e.detail.name || 'your account') + '.'; }
      else { s.className = 'muted'; s.textContent = 'Verification cancelled.'; }
    });
  </script>
</body>
</html>`
}
