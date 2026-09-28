import { useSearchParams } from 'react-router-dom'
import { officeAdapter } from '../../state/services'
import { useStore } from '../../state/store'
import { OpticTerminal } from '../sensor/OpticTerminal'
import { TerminalShell } from '../sensor/TerminalShell'

/** Phase 1 authentication. Optionally tests authorization against an office door. */
export function LabAuthenticate() {
  const [params, setParams] = useSearchParams()
  const doorId = params.get('door') ?? ''
  const doors = useStore((s) => s.office.doors)
  const door = doors.find((d) => d.id === doorId)

  return (
    <TerminalShell
      location={door ? door.name : 'Optic Lab'}
      exitTo="/lab"
      topRight={
        <select
          value={doorId}
          onChange={(e) => setParams(e.target.value ? { door: e.target.value } : {})}
          className="hidden h-8 rounded-full border border-white/10 bg-transparent px-3 text-[12px] text-white/60 outline-none md:block"
          aria-label="Authorization target"
        >
          <option value="" className="bg-black">Identity only</option>
          {doors.map((d) => (
            <option key={d.id} value={d.id} className="bg-black">
              Test door · {d.name}
            </option>
          ))}
        </select>
      }
    >
      <OpticTerminal
        key={doorId}
        location={door?.name}
        adapter={door ? officeAdapter : undefined}
        resourceId={door?.id}
        className="mt-4"
      />
    </TerminalShell>
  )
}
