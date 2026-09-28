# Optic Access

**Your identity is the key.** A working prototype of identity-based physical access: look at a sensor, get verified, and the door opens if you're allowed in. It includes an office deployment (employees, doors, schedules, visitors) and a hotel deployment (guests, rooms, stays, check-out). Both run on the same access engine.

> **Prototype notice.** The prototype uses an ordinary webcam instead of dedicated near-infrared iris hardware. It demonstrates the product flow and the architecture. It is **not** production-grade biometric security and has no presentation-attack (spoof) detection.

## Run it

```bash
npm install        # also copies the on-device ML runtimes into public/vendor
npm run dev        # http://localhost:5173
```

Camera access only works on `http://localhost` or `https://`. Use a recent Chrome, Edge, Safari or Firefox.

| Where | What |
| --- | --- |
| `/` | Landing page |
| `/demo` | Guided demo script (one click per scenario) |
| `/lab` | **Phase 1:** Optic Sensor Lab. Enroll, authenticate, and manage named optic scans |
| `/office` | **Phase 2:** Office console (Meridian HQ) |
| `/hotel` | **Phase 3:** Hotel console (The Linden) |
| `/terminal/office/:doorId`, `/terminal/hotel/:roomId` | Full-screen door terminals with a virtual door |

Other commands: `npm test` (unit tests), `npm run typecheck`, `npm run build`, `npm run lint`.

## Suggested demo (≈5 minutes)

1. **Lab → Enroll identity.** Enter a name, email and user ID, then follow the five prompts (center, left, right, up, down). Name the resulting scan, e.g. "Desk · daylight".
2. **Lab → Authenticate.** You get *ACCESS GRANTED · Welcome, you*. Anyone who isn't enrolled gets *Identity could not be verified*.
3. **Demo Mode** (bottom-right button, or `/demo`). Pick **Sarah Chen**, **Emma Johnson** or **Unknown Person**. The webcam keeps tracking your face and eyes live. Only the biometric features are swapped for that persona's synthetic template, and the real matcher and policy engine make every decision.
4. **Office.** Sarah at Main Entrance → granted, and the door swings open. Sarah at Server Room → *IDENTITY VERIFIED · ACCESS DENIED*. David Kim (visitor) at 3 PM → granted; at 5 PM → *VISITOR ACCESS EXPIRED*.
5. **Hotel.** Emma at Room 814 → granted with *Stay Sep 27 – Sep 30*. Check her out at the front desk and try again → *Your hotel stay has ended.*

No camera? Choose **Simulated (no camera)** in Demo Mode. The same pipeline runs with a camera-free sensor.

## Architecture

```
Sensor ──► biometric representation ──► identity verification ──► authorization ──► access decision
```

| Layer | Path | Responsibility |
| --- | --- | --- |
| 1. Sensor | `src/core/sensor` | `BiometricSensor` interface. `WebcamSensor`, `SimulatedSensor`, `FutureIrisHardwareSensor` |
| 2. Biometric processing | `src/core/biometric` | Template building, IrisCode, 1:N matching (pure functions) |
| 3. Identity | `src/core/identity` | Identities and optic scans. Templates sealed with AES-GCM in IndexedDB |
| 4. Authorization | `src/core/authorization` | Who → where → when policy engine. No biometrics |
| 5. Access control | `src/core/access` | `AccessController` + `SiteAdapter`. Door actuation and audit log |
| 6. Application / UI | `src/features`, `src/domains` | Terminals, enrollment, office and hotel consoles |

The office and hotel products share layers 1–5 and the terminal UI. Each one only provides a `SiteAdapter` (`src/state/services.ts`) that resolves an identity to a principal (employee, visitor or guest) and supplies domain wording.

### What the webcam sensor does

- **Tracking:** MediaPipe Face Landmarker (478 landmarks, including 10 iris points) runs every frame. It drives the UI: face, eye and iris positions, openness, pose, gaze, and quality issues such as "move closer" or "one person at a time".
- **Each sample** produces:
  - a 128-d embedding of the eye-levelled face region;
  - a polar-unwrapped, Gabor-phase **IrisCode** for each eye;
  - ocular geometry ratios.
- **Decision:** a consumer webcam captures the iris at only ~20–40 px, so accept/reject relies mainly on embedding distance, with a margin against the runner-up. Iris and geometry feed into the displayed confidence. With NIR hardware, the iris Hamming distance would become the decision signal.

### Data handling

| Stage | Where | Kept? |
| --- | --- | --- |
| Raw camera input | `MediaStream` inside `WebcamSensor` | Never stored |
| Temporary processing | Per-sample canvases (face chip, iris bands) | Wiped right after extraction |
| Stored representation | `OpticTemplate`: numbers only | AES-GCM sealed with a non-extractable key |

- Admin consoles show enrollment status and a non-reversible fingerprint only. Decrypting a template is possible only through the explicit Lab inspector.
- A Content-Security-Policy (`index.html`) blocks all outbound network access, including the ML runtime's own usage telemetry.
- Every access attempt is logged with its decision and reason, never with biometric data.
- For a real deployment, swap the IndexedDB vault for a server-side store (e.g. Supabase or Postgres) with KMS-managed keys, or keep matching on-device.

### Swapping in iris hardware

`FutureIrisHardwareSensor` speaks a small JSON protocol to a local device bridge (`ws://localhost:7447/optic`, documented in the file). To use real hardware:

1. Implement that bridge, or implement `BiometricSensor` directly around the vendor SDK.
2. Emit `iris-nir-v1` samples.
3. Select the driver in `createSensor()`.

Identity, authorization, access control and the UI stay unchanged. Templates are tagged by modality, so webcam and NIR enrollments never cross-match.

## Tests

- `npm test` covers iris codes (rotation tolerance), template building, 1:N identification (enrolled people are recognized; 20 strangers are rejected), and the policy engine (schedules, overnight windows, visitor expiry, ended stays, suspension, lockdown).
- The flows were also exercised end-to-end in headless Chromium with a synthetic camera feed made from real face photos:
  - enrollment → the genuine user is recognized (embedding distance ≈ 0.02);
  - three different people are rejected (distance 0.66–0.74; threshold 0.50);
  - blocked and missing cameras show recovery screens;
  - every office and hotel scenario in `/demo` produces the expected decision.
