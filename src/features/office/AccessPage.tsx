import { ArrowRight, Clock, DoorClosed, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { describeSchedule } from '../../core/authorization/engine'
import type { Schedule } from '../../core/authorization/types'
import { groupMembers, type AccessRule } from '../../domains/office/model'
import { newId, useStore } from '../../state/store'
import { Modal } from '../../ui/overlay'
import { Avatar, Badge, Button, Card, CardHeader, cx, Field, Input, Select, Toggle } from '../../ui/primitives'
import { PageHeader } from '../shell/ConsoleLayout'

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function AccessPage() {
  const office = useStore((s) => s.office)
  const upsertRule = useStore((s) => s.upsertRule)
  const [editing, setEditing] = useState<AccessRule | null>(null)

  return (
    <>
      <PageHeader
        title="Access groups"
        description="Rules read left to right: who → where → when. People inherit access from the groups they belong to."
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() =>
              setEditing({ id: newId('rule'), groupId: office.groups[0].id, doorIds: [], schedule: { type: 'weekly', days: [1, 2, 3, 4, 5], start: '08:00', end: '18:00' }, enabled: true })
            }
            data-testid="add-rule"
          >
            New rule
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <CardHeader title="Access rules" description={`${office.rules.filter((r) => r.enabled).length} active rules`} />
        <div className="border-t border-line">
          {office.rules.map((rule) => {
            const group = office.groups.find((g) => g.id === rule.groupId)
            return (
              <div
                key={rule.id}
                className={cx('grid grid-cols-1 items-center gap-3 border-b border-line px-5 py-3.5 last:border-0 md:grid-cols-[200px_24px_1fr_24px_220px_auto]', !rule.enabled && 'opacity-50')}
                data-testid="rule-row"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
                    <Users className="size-4" />
                  </span>
                  <span className="text-[14px] font-semibold text-ink">{group?.name}</span>
                </div>
                <ArrowRight className="hidden size-4 text-subtle md:block" />
                <div className="flex flex-wrap gap-1.5">
                  {rule.doorIds.map((id) => (
                    <span key={id} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2 text-[12.5px] font-medium text-ink">
                      <DoorClosed className="size-3.5 text-subtle" />
                      {office.doors.find((d) => d.id === id)?.name}
                    </span>
                  ))}
                </div>
                <ArrowRight className="hidden size-4 text-subtle md:block" />
                <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                  <Clock className="size-4 text-subtle" />
                  {describeSchedule(rule.schedule)}
                </div>
                <div className="flex items-center gap-1.5 md:justify-end">
                  <Toggle checked={rule.enabled} onChange={(enabled) => upsertRule({ ...rule, enabled })} label="Enabled" />
                  <Button size="sm" variant="ghost" onClick={() => setEditing(rule)} icon={<Pencil className="size-3.5" />} aria-label="Edit rule" />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <h2 className="mt-8 mb-3 text-[15px] font-semibold text-ink">Groups</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {office.groups.map((g) => {
          const members = g.implicit === 'visitors' ? [] : groupMembers(office, g.id)
          const doors = new Set(office.rules.filter((r) => r.groupId === g.id && r.enabled).flatMap((r) => r.doorIds))
          return (
            <Card key={g.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[14.5px] font-semibold text-ink">{g.name}</div>
                  <div className="text-[12.5px] text-muted">{g.description}</div>
                </div>
                {g.implicit && <Badge>Automatic</Badge>}
              </div>
              <div className="mt-4 flex items-center justify-between text-[12.5px] text-muted">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    {members.slice(0, 5).map((m) => (
                      <Avatar key={m.id} name={m.name} size={22} className="ring-2 ring-surface" />
                    ))}
                  </div>
                  {g.implicit === 'visitors' ? `${office.visitors.length} visitors` : `${members.length} members`}
                </div>
                <span>{doors.size} doors</span>
              </div>
            </Card>
          )
        })}
      </div>

      <RuleEditor rule={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function RuleEditor({ rule, onClose }: { rule: AccessRule | null; onClose: () => void }) {
  const office = useStore((s) => s.office)
  const upsertRule = useStore((s) => s.upsertRule)
  const removeRule = useStore((s) => s.removeRule)
  const [draft, setDraft] = useState<AccessRule | null>(rule)
  const [lastRule, setLastRule] = useState(rule)
  if (rule !== lastRule) {
    setLastRule(rule)
    setDraft(rule)
  }
  if (!draft) return <Modal open={false} onClose={onClose} title="">{null}</Modal>
  const exists = office.rules.some((r) => r.id === draft.id)
  const weekly = draft.schedule.type === 'weekly' ? draft.schedule : null
  const setSchedule = (s: Schedule) => setDraft({ ...draft, schedule: s })

  return (
    <Modal
      open={!!rule}
      onClose={onClose}
      width={560}
      title={exists ? 'Edit access rule' : 'New access rule'}
      description="Who can open which doors, and when."
      footer={
        <>
          {exists && (
            <Button
              variant="danger"
              className="mr-auto"
              icon={<Trash2 className="size-3.5" />}
              onClick={() => {
                removeRule(draft.id)
                onClose()
              }}
            >
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={draft.doorIds.length === 0}
            onClick={() => {
              upsertRule(draft)
              onClose()
            }}
            data-testid="save-rule"
          >
            Save rule
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Who">
          <Select value={draft.groupId} onChange={(e) => setDraft({ ...draft, groupId: e.target.value })}>
            {office.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-ink">Where</div>
          <div className="flex flex-wrap gap-1.5">
            {office.doors.map((d) => {
              const on = draft.doorIds.includes(d.id)
              return (
                <button
                  key={d.id}
                  onClick={() => setDraft({ ...draft, doorIds: on ? draft.doorIds.filter((x) => x !== d.id) : [...draft.doorIds, d.id] })}
                  className={cx(
                    'inline-flex h-8 items-center rounded-lg border px-2.5 text-[12.5px] font-medium transition',
                    on ? 'border-accent/40 bg-accent-soft text-accent-text' : 'border-line text-muted hover:text-ink',
                  )}
                >
                  {d.name}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-ink">When</div>
          <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
            {(['weekly', 'always'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSchedule(t === 'always' ? { type: 'always' } : { type: 'weekly', days: [1, 2, 3, 4, 5], start: '08:00', end: '18:00' })}
                className={cx(
                  'rounded-md px-3 py-1.5 text-[12.5px] font-medium',
                  draft.schedule.type === t ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-muted',
                )}
              >
                {t === 'always' ? '24/7' : 'Scheduled'}
              </button>
            ))}
          </div>
          {weekly && (
            <div className="mt-3 space-y-3">
              <div className="flex gap-1.5">
                {DAYS.map((d, i) => {
                  const on = weekly.days.includes(i)
                  return (
                    <button
                      key={i}
                      onClick={() => setSchedule({ ...weekly, days: on ? weekly.days.filter((x) => x !== i) : [...weekly.days, i] })}
                      className={cx(
                        'size-8 rounded-lg border text-[12px] font-semibold transition',
                        on ? 'border-ink bg-ink text-bg' : 'border-line text-muted hover:text-ink',
                      )}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From">
                  <Input type="time" value={weekly.start} onChange={(e) => setSchedule({ ...weekly, start: e.target.value })} />
                </Field>
                <Field label="Until">
                  <Input type="time" value={weekly.end} onChange={(e) => setSchedule({ ...weekly, end: e.target.value })} />
                </Field>
              </div>
            </div>
          )}
        </div>
        <div className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-ink">
          <b>{office.groups.find((g) => g.id === draft.groupId)?.name}</b> → {draft.doorIds.length ? draft.doorIds.map((id) => office.doors.find((d) => d.id === id)?.name).join(', ') : 'choose doors'} →{' '}
          {describeSchedule(draft.schedule)}
        </div>
      </div>
    </Modal>
  )
}
