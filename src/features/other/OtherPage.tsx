import { ArrowUpRight, Building2, Hotel } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Backdrop } from '../../ui/Backdrop'
import { Logo } from '../../ui/Logo'
import { OTHER_APPS } from '../suite/apps'

/**
 * Parking lot for things that aren't the current priority: the Family, Focus
 * and Attendance apps, and the standalone Office and Hotel access demos. Kept
 * reachable here and out of the main nav.
 */
export function OtherPage() {
  const items = [
    ...OTHER_APPS.map((a) => ({ to: a.to, title: `Optic ${a.name}`, body: a.tagline, icon: <a.icon className="size-5" /> })),
    { to: '/office', title: 'Office access', body: 'Standalone demo: employees, doors, schedules, visitors.', icon: <Building2 className="size-5" /> },
    { to: '/hotel', title: 'Hotel access', body: 'Standalone demo: guests, rooms, stays, check-out.', icon: <Hotel className="size-5" /> },
  ]
  return (
    <div className="dark relative isolate min-h-screen bg-bg text-ink">
      <Backdrop />
      <header className="sticky top-3 z-30 px-3">
        <div className="glass mx-auto flex h-14 max-w-5xl items-center justify-between rounded-2xl pr-2 pl-4">
          <Link to="/"><Logo product="More" /></Link>
          <Link to="/apps" className="btn-glow flex h-9 items-center rounded-xl px-4 text-[13px] font-semibold">
            Back to apps
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-5 pt-12 pb-16">
        <div className="font-mono text-[11px] tracking-[0.2em] text-accent-text uppercase">Parked for now</div>
        <h1 className="mt-3 text-[34px] leading-tight font-semibold tracking-[-0.03em] sm:text-[40px]">
          More <span className="text-gradient">Optic</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          Not the current focus, but still here: Family, Focus and Attendance, plus the office and hotel access demos.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Link key={c.to} to={c.to} className="glass hairline group rounded-3xl p-5 transition duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-2xl border border-accent/25 bg-accent-soft text-accent shadow-[var(--glow)]">
                  {c.icon}
                </span>
                <ArrowUpRight className="size-4 text-subtle transition group-hover:text-accent" />
              </div>
              <div className="mt-5 text-[16px] font-semibold">{c.title}</div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{c.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
