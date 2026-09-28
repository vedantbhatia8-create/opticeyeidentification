import type { AccessOutcome } from '../../core/access/types'
import { Badge } from '../../ui/primitives'

export function OutcomeBadge({ outcome }: { outcome: AccessOutcome }) {
  switch (outcome) {
    case 'granted':
      return <Badge tone="ok" dot>Granted</Badge>
    case 'denied-unauthorized':
      return <Badge tone="bad" dot>Denied</Badge>
    case 'denied-unrecognized':
      return <Badge tone="bad" dot>Unrecognized</Badge>
    case 'unable':
      return <Badge tone="warn" dot>No read</Badge>
  }
}
