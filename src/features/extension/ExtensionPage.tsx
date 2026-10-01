import { Check, Download, ExternalLink, EyeOff, Globe, Lock, ScanEye, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge, Card, CardHeader } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'

const ZIP = '/downloads/optic-access-extension.zip'
/** An OAuth request for a client that doesn't exist: Google shows its sign-in error page, which is enough to see the prompt. */
const TEST_URL =
  'https://accounts.google.com/o/oauth2/v2/auth?client_id=optic-extension-test.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fopticaccess.vercel.app&response_type=code&scope=openid%20email'

/** Optic for Google sign-in: download and install the browser extension. */
export function ExtensionPage() {
  const [version, setVersion] = useState<string | null>(null)
  useEffect(() => {
    const read = () => setVersion(document.documentElement.dataset.opticExtension ?? null)
    read()
    const t = setTimeout(read, 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <div>
      <PageHeader
        title="Optic for Google sign-in"
        description="A Chrome extension that asks for a glance every time a website wants you to “Sign in with Google”. If it isn’t you, Google never continues."
        actions={
          version ? (
            <Badge tone="ok" dot>Installed · v{version}</Badge>
          ) : (
            <a href={ZIP} download className="btn-glow flex h-10 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold" data-testid="extension-download">
              <Download className="size-4" /> Download extension
            </a>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="hairline">
          <CardHeader title="Install in 1 minute" description="Chrome, Edge, Brave or Arc on your computer." />
          <ol className="space-y-3 px-5 pb-5">
            {[
              <>
                <a href={ZIP} download className="text-accent-text underline-offset-4 hover:underline">Download the extension</a> and double-click the
                zip to unzip it.
              </>,
              <>
                Open <b className="font-mono text-[12.5px]">chrome://extensions</b> in a new tab and turn on <b>Developer mode</b> (top right).
              </>,
              <>
                Click <b>Load unpacked</b> and choose the unzipped <b className="font-mono text-[12.5px]">optic-access-extension</b> folder.
              </>,
              <>Pin it: click the puzzle icon in the toolbar, then the pin next to Optic Access.</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft font-mono text-[12px] text-accent">{i + 1}</span>
                <span className="pt-1 text-[14px] leading-relaxed text-muted">{step}</span>
              </li>
            ))}
          </ol>
          <div className="border-t border-line px-5 py-4 text-[13px] text-muted">
            {version ? (
              <span className="flex items-center gap-2 text-ok">
                <Check className="size-4" /> The extension is installed and connected to this site.
              </span>
            ) : (
              'Once installed, reload this page and this box turns green.'
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Try it" description="Use any website that has a “Sign in with Google” button." />
          <div className="space-y-3 px-5 pb-5 text-[13.5px] text-muted">
            <p>
              Click <b className="text-ink">Sign in with Google</b> on a site like Medium, Canva or Pinterest. Before Google shows your accounts, Optic
              covers the page and asks for a glance.
            </p>
            <a href={TEST_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-accent-text hover:underline">
              Open a test Google sign-in <ExternalLink className="size-3.5" />
            </a>
            <p className="text-[12px] text-subtle">
              The test uses a made-up app, so after you verify, Google shows an error page. That’s expected.
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {[
          { icon: Globe, title: '1 · A site asks for Google', body: 'Every “Sign in with Google” goes through Google’s sign-in page. The extension notices it and covers it with an Optic prompt.' },
          { icon: ScanEye, title: '2 · You glance', body: 'A small Optic window opens and checks your eyes against your Optic account, on this device.' },
          { icon: ShieldCheck, title: '3 · Google continues', body: 'Verified: the prompt disappears and Google carries on. Someone else: the sign-in stays blocked.' },
        ].map((s) => (
          <Card key={s.title} className="p-5">
            <span className="flex size-10 items-center justify-center rounded-2xl border border-accent/25 bg-accent-soft text-accent shadow-[var(--glow)]">
              <s.icon className="size-5" />
            </span>
            <div className="mt-4 text-[14.5px] font-semibold text-ink">{s.title}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.body}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader title="Privacy and limits" />
        <ul className="grid gap-3 px-5 pb-5 text-[13px] text-muted md:grid-cols-2">
          {[
            [Lock, 'It never reads passwords, cookies or Google tokens. It only places a prompt over Google’s page.'],
            [EyeOff, 'Your face is checked on the Optic site, on your device. The extension only receives “verified” or “not verified”.'],
            [ShieldCheck, 'Your first successful glance locks the extension to your account. Anyone else is blocked. Reset it from the toolbar icon.'],
            [ScanEye, 'Prototype: a webcam is not bank-grade security, and anyone who can open chrome://extensions can turn it off.'],
          ].map(([Icon, text], i) => {
            const I = Icon as typeof Lock
            return (
              <li key={i} className="flex gap-2.5">
                <I className="mt-0.5 size-4 shrink-0 text-accent" /> <span>{text as string}</span>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
