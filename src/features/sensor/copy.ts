import type { AccessDecision } from '../../core/access/types'
import type { QualityIssue, SensorObservation } from '../../core/sensor/types'
import type { AuthPhase } from './useAuthFlow'

const ISSUE_COPY: Partial<Record<QualityIssue, string>> = {
  'multiple-faces': 'One person at a time, please',
  'eyes-closed': 'Keep your eyes open',
  'too-far': 'Move a little closer',
  'too-close': 'Move back slightly',
  'off-center': 'Center yourself in the frame',
  'too-dark': 'More light needed',
  'too-bright': 'Too much glare — adjust the light',
  'head-turned': 'Face the sensor',
  motion: 'Hold still',
}

const ISSUE_PRIORITY: QualityIssue[] = [
  'multiple-faces',
  'too-dark',
  'too-bright',
  'too-far',
  'too-close',
  'head-turned',
  'off-center',
  'eyes-closed',
  'motion',
]

export function guidanceFor(o: SensorObservation | null): string | null {
  if (!o) return null
  for (const issue of ISSUE_PRIORITY) if (o.quality.issues.includes(issue)) return ISSUE_COPY[issue] ?? null
  return null
}

export interface PhaseCopy {
  label: string
  instruction: string
}

export function authCopy(
  phase: AuthPhase,
  o: SensorObservation | null,
  decision: AccessDecision | null,
  recognizedName: string | null,
): PhaseCopy {
  const hint = guidanceFor(o)
  switch (phase) {
    case 'initializing':
      return { label: 'Initializing sensor', instruction: 'Look at the sensor' }
    case 'error':
      return { label: 'Sensor unavailable', instruction: 'The sensor could not start' }
    case 'searching':
      return {
        label: 'Locating eye',
        instruction: o?.presence === 'multiple' ? ISSUE_COPY['multiple-faces']! : 'Position yourself in front of the sensor',
      }
    case 'face':
      return { label: 'Face detected', instruction: hint ?? 'Hold still' }
    case 'eyes':
      return { label: 'Eye detected', instruction: hint ?? 'Hold still' }
    case 'analyzing':
      return { label: 'Analyzing iris', instruction: hint && hint !== 'Hold still' ? hint : 'Hold still' }
    case 'verifying':
      return { label: 'Verifying identity', instruction: 'One moment' }
    case 'authorizing':
      return { label: 'Identity verified', instruction: recognizedName ?? '' }
    case 'result':
      return { label: decision?.headline ?? '', instruction: decision?.title ?? '' }
  }
}
