/**
 * Access-decision clock. Demo Mode can shift it (e.g. to show a visitor's
 * access expiring) without touching the system clock.
 */
let offsetMs = 0

export const clock = {
  now: () => Date.now() + offsetMs,
  setOffset(ms: number) {
    offsetMs = ms
  },
  getOffset: () => offsetMs,
}
