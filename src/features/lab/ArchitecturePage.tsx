import { ArrowDown, Cpu } from 'lucide-react'
import { Badge, Card, cx } from '../../ui/primitives'

const LAYERS = [
  {
    n: 1,
    name: 'Sensor',
    path: 'src/core/sensor',
    contract: 'BiometricSensor → SensorObservation stream, captureSample(): BiometricSample',
    body: 'Owns the device. Raw frames never leave it. Implementations: WebcamSensor, SimulatedSensor, FutureIrisHardwareSensor.',
    tone: 'accent',
  },
  {
    n: 2,
    name: 'Biometric processing',
    path: 'src/core/biometric',
    contract: 'buildTemplate(samples) → OpticTemplate · identify(probe, candidates) → match',
    body: 'Pure functions. Fuses samples into templates; compares probes with a margin rule. No images, no I/O.',
  },
  {
    n: 3,
    name: 'Identity',
    path: 'src/core/identity',
    contract: 'IdentityService.enroll / verify(samples) → verified | not-recognized | unable',
    body: 'Who a template belongs to. Seals templates with AES-GCM in IndexedDB. Knows nothing about apps or permissions.',
  },
  {
    n: 4,
    name: 'Authorization',
    path: 'src/core/authorization',
    contract: 'authorize(principal, resource, at) → granted | no-grant | outside-schedule | window-expired | …',
    body: 'Pure policy engine: who → what → when, validity windows and status. Decides document readers, screen time and check-in windows. Knows nothing about biometrics.',
  },
  {
    n: 5,
    name: 'Access control',
    path: 'src/core/access',
    contract: 'AccessController.attempt(samples, SiteAdapter, resourceId) → AccessDecision',
    body: 'One engine for every app. Each plugs in via an adapter (documents, screen time, attendance). Writes the audit log.',
  },
  {
    n: 6,
    name: 'Application / UI',
    path: 'src/features · src/domains',
    contract: 'React: OpticTerminal, EnrollmentSession, Optic Apps',
    body: 'The apps and the sensor screens. Every app shares the same identity and presence engine.',
  },
]

export function ArchitecturePage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="font-mono text-[11px] tracking-[0.2em] text-accent-text uppercase">Sensor Lab</div>
      <h1 className="mt-3 text-[32px] leading-tight font-semibold tracking-[-0.03em] text-ink">System architecture</h1>
      <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted">
        Six layers with one-way dependencies. The sensor can be replaced by dedicated iris hardware without touching
        anything above it; every app shares every layer below the UI.
      </p>

      <div className="mt-8 space-y-2">
        {LAYERS.map((l, i) => (
          <div key={l.n}>
            <Card className={cx('grid gap-3 p-5 md:grid-cols-[220px_1fr]', l.tone === 'accent' && 'border-accent/30')}>
              <div>
                <div className="font-mono text-[11px] text-subtle">LAYER {l.n}</div>
                <div className="mt-1 text-[16px] font-semibold text-ink">{l.name}</div>
                <div className="mt-1 font-mono text-[11.5px] text-muted">{l.path}</div>
              </div>
              <div>
                <p className="text-[13.5px] leading-relaxed text-muted">{l.body}</p>
                <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2 font-mono text-[11.5px] text-ink">{l.contract}</div>
              </div>
            </Card>
            {i < LAYERS.length - 1 && (
              <div className="flex justify-center py-1 text-subtle">
                <ArrowDown className="size-4" />
              </div>
            )}
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-[18px] font-semibold text-ink">Data handling boundary</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          { title: 'Raw camera input', badge: 'never stored', tone: 'bad' as const, body: 'MediaStream frames inside WebcamSensor. The preview shown on screen is the same stream; nothing is recorded.' },
          { title: 'Temporary processing', badge: 'wiped immediately', tone: 'warn' as const, body: 'Per-sample canvases: aligned face chip, polar-unwrapped iris bands. Cleared in a finally block after feature extraction.' },
          { title: 'Stored representation', badge: 'encrypted', tone: 'ok' as const, body: 'OpticTemplate: embeddings, iris codes and geometry ratios — numbers only, sealed with a non-extractable key.' },
        ].map((b) => (
          <Card key={b.title} className="p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-semibold text-ink">{b.title}</span>
              <Badge tone={b.tone}>{b.badge}</Badge>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{b.body}</p>
          </Card>
        ))}
      </div>

      <h2 className="mt-12 text-[18px] font-semibold text-ink">Replacing the webcam with iris hardware</h2>
      <Card className="mt-4 p-5">
        <div className="flex items-start gap-3">
          <Cpu className="mt-0.5 size-5 text-muted" />
          <ol className="list-decimal space-y-1.5 pl-4 text-[13.5px] leading-relaxed text-muted">
            <li>Run the vendor’s device bridge speaking the protocol in <code className="font-mono text-ink">FutureIrisHardwareSensor.ts</code>, or implement <code className="font-mono text-ink">BiometricSensor</code> directly around the vendor SDK.</li>
            <li>Return samples with modality <code className="font-mono text-ink">iris-nir-v1</code> (IrisCodes from the device encoder).</li>
            <li>Point the matcher’s decision rule at iris Hamming distance for that modality; templates are already modality-tagged so webcam and NIR enrollments never cross-match.</li>
            <li>Select the driver in <code className="font-mono text-ink">createSensor()</code>. Identity, authorization, access control and every UI stay unchanged.</li>
          </ol>
        </div>
      </Card>

      <h2 className="mt-12 text-[18px] font-semibold text-ink">What the webcam prototype actually measures</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        MediaPipe Face Landmarker locates the face, eyes and iris (478 landmarks) in real time. For each sample the
        sensor computes (a) a 128-d embedding of the eye-levelled face region, (b) a polar-unwrapped, Gabor-phase
        IrisCode per eye, and (c) ocular geometry ratios. At webcam resolution the iris spans only ~20–40 px, so the
        accept/reject decision relies mainly on the embedding, with iris and geometry contributing to confidence. This
        is a prototype and is not production-grade biometric security.
      </p>
    </div>
  )
}
