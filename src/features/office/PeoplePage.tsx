import { Plus, Search, Trash2, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { describeSchedule } from '../../core/authorization/engine'
import { accessSummary, employeePrincipal, groupMembers, type Employee } from '../../domains/office/model'
import { newId, useStore } from '../../state/store'
import { timeAgo } from '../../ui/format'
import { Drawer, Modal } from '../../ui/overlay'
import { Avatar, Badge, Button, cx, EmptyState, Field, Input, Select, SectionLabel, Toggle } from '../../ui/primitives'
import { Card } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'
import { OpticIdentityCard } from '../shell/OpticIdentityCard'
import { OutcomeBadge } from '../shell/OutcomeBadge'
import { useSiteEvents } from '../shell/console'

export const DEPARTMENTS = ['Engineering', 'Design', 'Executive', 'Sales', 'Marketing', 'People', 'Finance', 'Facilities', 'IT', 'Operations']

export function PeoplePage() {
  const office = useStore((s) => s.office)
  const [params, setParams] = useSearchParams()
  const openId = params.get('open')
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [creating, setCreating] = useState(false)
  const employees = office.employees.filter(
    (e) =>
      (!q || `${e.name} ${e.email} ${e.role}`.toLowerCase().includes(q.toLowerCase())) && (!dept || e.department === dept),
  )
  const selected = office.employees.find((e) => e.id === openId) ?? null
  const setOpen = (id: string | null) => setParams(id ? { open: id } : {})

  return (
    <>
      <PageHeader
        title="People"
        description="Employees who can use Optic Access at Meridian HQ."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)} data-testid="add-employee">
            Add employee
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or role" className="pl-9" />
          </div>
          <Select value={dept} onChange={(e) => setDept(e.target.value)} className="w-auto">
            <option value="">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="bg-surface-2/60 text-[12px] text-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">Name</th>
                <th className="px-3 py-2.5 font-medium">Department</th>
                <th className="px-3 py-2.5 font-medium">Access groups</th>
                <th className="px-3 py-2.5 font-medium">Optic identity</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {employees.map((e) => (
                <tr key={e.id} onClick={() => setOpen(e.id)} className="cursor-pointer transition hover:bg-surface-2/50" data-testid="employee-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={e.name} />
                      <div className="min-w-0">
                        <div className="font-medium text-ink">{e.name}</div>
                        <div className="truncate text-[12px] text-muted">{e.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-ink">{e.department}</div>
                    <div className="text-[12px] text-muted">{e.role}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {e.groupIds.length === 0 && <span className="text-[12px] text-subtle">All Employees</span>}
                      {e.groupIds.map((g) => (
                        <Badge key={g}>{office.groups.find((x) => x.id === g)?.name}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {e.identityId ? <Badge tone="ok" dot>Enrolled</Badge> : <Badge tone="warn" dot>Not enrolled</Badge>}
                  </td>
                  <td className="px-5 py-3">
                    {e.status === 'active' ? <Badge tone="ok">Active</Badge> : <Badge tone="bad">Suspended</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {employees.length === 0 && (
            <EmptyState icon={<Users className="size-5" />} title="No people match" description="Try another search or add an employee." />
          )}
        </div>
      </Card>

      <CreateEmployeeModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false)
          setOpen(id)
        }}
      />
      <Drawer open={!!selected} onClose={() => setOpen(null)}>
        {selected && <EmployeeDetail employee={selected} onClose={() => setOpen(null)} />}
      </Drawer>
    </>
  )
}

function CreateEmployeeModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const upsert = useStore((s) => s.upsertEmployee)
  const [form, setForm] = useState({ name: '', email: '', department: 'Engineering', role: '' })
  const [error, setError] = useState<string | null>(null)
  const submit = () => {
    if (!form.name.trim() || !form.email.trim()) return setError('Name and email are required.')
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid email address.')
    const id = newId('emp')
    upsert({
      id,
      name: form.name.trim(),
      email: form.email.trim(),
      department: form.department,
      role: form.role.trim() || 'Employee',
      groupIds: form.department === 'Engineering' ? ['grp_eng'] : form.department === 'Executive' ? ['grp_exec'] : [],
      status: 'active',
      identityId: null,
      createdAt: Date.now(),
    })
    setForm({ name: '', email: '', department: 'Engineering', role: '' })
    setError(null)
    onCreated(id)
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add employee"
      description="Next, enroll their Optic identity and assign access."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} icon={<UserPlus className="size-4" />} data-testid="create-employee">
            Add employee
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="Name">
          <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jordan Lee" data-testid="emp-name" />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jordan.lee@meridian.co" data-testid="emp-email" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Department">
            <Select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
          <Field label="Role">
            <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Software Engineer" />
          </Field>
        </div>
        {error && <div className="text-[13px] text-bad">{error}</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

function EmployeeDetail({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const office = useStore((s) => s.office)
  const upsert = useStore((s) => s.upsertEmployee)
  const remove = useStore((s) => s.removeEmployee)
  const events = useSiteEvents('office')
  const mine = useMemo(() => events.filter((e) => employee.identityId && e.identityId === employee.identityId).slice(0, 6), [events, employee.identityId])
  const principal = employeePrincipal(office, employee)
  const summary = accessSummary(principal, office.doors)
  const toggleable = office.groups.filter((g) => !g.implicit)

  return (
    <div className="flex h-full flex-col" data-testid="employee-detail">
      <div className="border-b border-line px-6 pt-6 pb-5">
        <div className="flex items-start gap-4">
          <Avatar name={employee.name} size={48} />
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-semibold tracking-tight text-ink">{employee.name}</div>
            <div className="text-[13px] text-muted">
              {employee.role} · {employee.department}
            </div>
            <div className="text-[13px] text-muted">{employee.email}</div>
          </div>
          <div className="flex items-center gap-2 text-[12.5px] text-muted">
            {employee.status === 'active' ? 'Active' : 'Suspended'}
            <Toggle
              checked={employee.status === 'active'}
              onChange={(v) => upsert({ ...employee, status: v ? 'active' : 'suspended' })}
              label="Active"
            />
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <section>
          <SectionLabel className="mb-2">Optic identity</SectionLabel>
          <OpticIdentityCard
            identityId={employee.identityId}
            forParam={`employee:${employee.id}`}
            onLink={(identityId) => upsert({ ...employee, identityId })}
          />
        </section>

        <section>
          <SectionLabel className="mb-2">Access groups</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex h-7 items-center rounded-lg border border-line bg-surface-2 px-2.5 text-[12.5px] text-muted">
              All Employees
            </span>
            {toggleable.map((g) => {
              const on = employee.groupIds.includes(g.id)
              return (
                <button
                  key={g.id}
                  onClick={() =>
                    upsert({ ...employee, groupIds: on ? employee.groupIds.filter((x) => x !== g.id) : [...employee.groupIds, g.id] })
                  }
                  className={cx(
                    'inline-flex h-7 items-center rounded-lg border px-2.5 text-[12.5px] font-medium transition',
                    on ? 'border-accent/40 bg-accent-soft text-accent-text' : 'border-line text-muted hover:border-line-strong hover:text-ink',
                  )}
                >
                  {g.name}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <SectionLabel className="mb-2">Access</SectionLabel>
          <div className="overflow-hidden rounded-xl border border-line">
            {summary.length === 0 && <div className="px-4 py-3 text-[13px] text-muted">No door access.</div>}
            {summary.map(({ door, grants }) => (
              <div key={door.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0">
                <div>
                  <div className="text-[13.5px] font-medium text-ink">{door.name}</div>
                  <div className="text-[12px] text-muted">via {[...new Set(grants.map((g) => g.source.label))].join(', ')}</div>
                </div>
                <span className="text-right text-[12px] text-muted">
                  {grants.some((g) => g.schedule.type === 'always') ? '24/7' : [...new Set(grants.map((g) => describeSchedule(g.schedule)))].join(' / ')}
                </span>
              </div>
            ))}
          </div>
          {employee.status !== 'active' && <p className="mt-2 text-[12.5px] text-bad">Suspended — all access is denied regardless of groups.</p>}
        </section>

        <section>
          <SectionLabel className="mb-2">Recent activity</SectionLabel>
          {mine.length === 0 ? (
            <div className="text-[13px] text-muted">No access attempts yet.</div>
          ) : (
            <ul className="space-y-1.5">
              {mine.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-ink">{e.resourceName}</span>
                  <span className="flex items-center gap-2">
                    <OutcomeBadge outcome={e.outcome} />
                    <span className="w-[70px] text-right text-[12px] text-subtle">{timeAgo(e.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <div className="flex justify-between border-t border-line px-6 py-3.5">
        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 className="size-3.5" />}
          onClick={() => {
            remove(employee.id)
            onClose()
          }}
        >
          Remove employee
        </Button>
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}

export { groupMembers }
