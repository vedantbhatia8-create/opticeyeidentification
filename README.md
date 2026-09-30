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
| `/` | Platform overview with sign up / log in |
| `/demo` | Guided walkthrough (one click per scenario) |
| `/lab` | **Phase 1:** Optic Sensor Lab. Enroll, authenticate, and manage named optic scans |
| `/office` | **Phase 2:** Office console (Meridian HQ) |
| `/hotel` | **Phase 3:** Hotel console (The Linden) |
| `/terminal/office/:doorId`, `/terminal/hotel/:roomId` | Full-screen door terminals with a virtual door |
| `/apps` | **Optic Apps:** software products on the same identity engine (sign in with a glance) |

Other commands: `npm test` (unit tests), `npm run typecheck`, `npm run build`, `npm run lint`.

## Getting started (≈5 minutes)

The site starts empty: no built-in people, no fake history. Everyone in it is a real enrollment.

1. **Sign up** on the home page. Enter your name and email, then follow the five prompts (center, left, right, up, down). That enrollment is your Optic account.
2. **Log in** with a glance. Anyone who isn't enrolled gets *Identity could not be verified*.
3. **`/demo`** runs the guided walkthrough with your own eyes:
   - Office: adds you as an employee, then tries Main Entrance (granted), Server Room (*IDENTITY VERIFIED · ACCESS DENIED*) and 11 PM (outside hours).
   - Hotel: checks you in to Room 814 (granted), tries Room 816 (denied), then checks you out (*Your hotel stay has ended.*).
4. **Unknown Person** (Demo Mode, bottom-right) swaps in a never-enrolled stranger's features, so you can show a rejection without a second person.

No camera? Choose **Simulated (no camera)** in Demo Mode.

## Optic Apps (`/apps`)

These apps need no special hardware. They share one enrollment, one presence engine (who is at the screen, how many faces, whether they are looking) and "glance to approve" step-up checks.

**Accounts.** Each person has exactly one Optic account, keyed by email. Enrolling again with the same email, or with eyes that already match an account, adds another optic scan to that account instead of creating a new one. Duplicates left over from older versions are merged automatically on startup. The **Account** page (`/apps/account`) shows your profile, every optic scan, your data in every app, and lets you merge any remaining look-alike accounts.

| App | What it does |
| --- | --- |
| **Vault** | Passwords and secure notes. A glance gates access and a PIN-derived key (PBKDF2) encrypts the vault; revealing, copying or deleting needs a fresh glance |
| **Eyes-Only** | Sealed documents for chosen readers, with expiry and view limits. Content is only on screen while a verified reader is looking; for anyone else it is removed from the page, not just blurred |
| **Guard** | Walk-away lock, stranger lock and shoulder-surf shield on every app page |
| **Family** | Profiles, daily limits, allowed hours and a kids' launcher; `/apps/family/screen` switches to whoever sits down |
| **Focus** | Focus sessions that count real eyes-on-screen time, with a score and timeline |
| **Attendance** | Rosters plus a check-in kiosk running on the same access engine as the doors |

In the browser, these apps protect Optic pages only. Whole-computer enforcement (locking the Mac, controlling other apps) would need a native macOS agent.

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
