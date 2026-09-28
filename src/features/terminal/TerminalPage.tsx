import { DoorClosed, Hotel } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { hotelAdapter, officeAdapter } from '../../state/services'
import { useStore } from '../../state/store'
import { DoorPanel } from './DoorPanel'
import { OpticTerminal } from '../sensor/OpticTerminal'
import { TerminalShell } from '../sensor/TerminalShell'

/**
 * A physical access terminal mounted at a door. Office doors and hotel rooms
 * use this same component and the same access engine — only the adapter differs.
 */
export function TerminalPage({ site }: { site: 'office' | 'hotel' }) {
  const { resourceId } = useParams()
  const adapter = site === 'office' ? officeAdapter : hotelAdapter
  const resource = resourceId ? adapter.getResource(resourceId) : null
  const unlocked = useStore((s) => (resourceId ? (s.unlocked[resourceId] ?? 0) > Date.now() : false))
  // Subscribe so the terminal re-renders on lockdown / offline changes.
  useStore((s) => (site === 'office' ? s.office.doors : s.hotel.rooms))
  const exitTo = site === 'office' ? '/office/doors' : '/hotel/rooms'

  if (!resourceId || !resource) return <TerminalPicker site={site} />

  const isRoom = resourceId.startsWith('room-')
  return (
    <TerminalShell location={resource.name} exitTo={exitTo}>
      <OpticTerminal
        key={resourceId}
        location={resource.name}
        adapter={adapter}
        resourceId={resourceId}
        autoResetMs={9000}
        authorizingText={isRoom ? 'Checking room access…' : 'Checking access…'}
        className="mt-2"
        aside={({ phase, decision }) => (
          <DoorPanel
            name={resource.name}
            subtitle={site === 'hotel' ? (isRoom ? 'Guest room' : 'Amenity') : 'Door'}
            unlocked={unlocked}
            phase={phase}
            decision={decision}
          />
        )}
      />
    </TerminalShell>
  )
}

function TerminalPicker({ site }: { site: 'office' | 'hotel' }) {
  const office = useStore((s) => s.office)
  const hotel = useStore((s) => s.hotel)
  const items =
    site === 'office'
      ? office.doors.map((d) => ({ id: d.id, name: d.name, sub: d.zone }))
      : [
          ...hotel.rooms.map((r) => ({ id: `room-${r.number}`, name: `Room ${r.number}`, sub: r.type })),
          ...hotel.amenities.map((a) => ({ id: a.id, name: a.name, sub: 'Amenity' })),
        ]
  return (
    <TerminalShell location="Select a terminal" exitTo={site === 'office' ? '/office' : '/hotel'}>
      <div className="mt-8 w-full max-w-4xl">
        <h1 className="text-center text-[26px] font-semibold tracking-tight">Which door is this terminal mounted on?</h1>
        <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {items.map((i) => (
            <Link
              key={i.id}
              to={`/terminal/${site}/${i.id}`}
              className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 transition hover:border-white/25 hover:bg-white/[0.03]"
            >
              {site === 'office' ? <DoorClosed className="size-4 text-white/40" /> : <Hotel className="size-4 text-white/40" />}
              <span>
                <span className="block text-[14px] text-white/85">{i.name}</span>
                <span className="block text-[11px] text-white/40">{i.sub}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </TerminalShell>
  )
}
