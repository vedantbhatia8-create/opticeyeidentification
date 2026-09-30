import { OpticTerminal } from '../sensor/OpticTerminal'
import { TerminalShell } from '../sensor/TerminalShell'

/** Phase 1 authentication: who is this? (1:N against every enrolled account). */
export function LabAuthenticate() {
  return (
    <TerminalShell location="Optic Lab" exitTo="/lab">
      <OpticTerminal className="mt-4" />
    </TerminalShell>
  )
}
