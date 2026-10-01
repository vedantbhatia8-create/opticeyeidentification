import { Crown, ShieldCheck, ShieldX, UserCog, UserMinus, Users } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { identityService } from '../../core/identity/IdentityService'
import { useStore } from '../../state/store'
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Select } from '../../ui/primitives'
import { ownerId, useIsAdmin, useIsOwner } from '../admin/admin'
import { PageHeader } from '../shell/ConsoleLayout'
import { useIdentities } from '../sensor/hooks'
import { useSession } from './store'

/**
 * Admin console — owner + admins only. Manage who can administer Optic and use
 * the test-as-account override to sign in as any account for testing.
 */
export function AdminPage() {
  const isAdmin = useIsAdmin()
  const isOwner = useIsOwner()
  const { identities } = useIdentities()
  const sessionId = useSession((s) => s.identityId)
  const adminIds = useStore((s) => s.settings.adminIds)
  const setSettings = useStore((s) => s.setSettings)
  const demo = useStore((s) => s.demo)
  const setDemo = useStore((s) => s.setDemo)

  if (!isAdmin) return <Navigate to="/apps" replace />

  const owner = ownerId(identities)
  const real = identities.filter((i) => !i.synthetic && i.status === 'active').sort((a, b) => a.createdAt - b.createdAt)

  const roleOf = (id: string): 'owner' | 'admin' | 'member' => (id === owner ? 'owner' : adminIds.includes(id) ? 'admin' : 'member')
  const setAdmin = (id: string, on: boolean) =>
    setSettings({ adminIds: on ? [...new Set([...adminIds, id])] : adminIds.filter((x) => x !== id) })

  return (
    <>
      <PageHeader
        title="Admin console"
        description="Owner and admin controls. Manage who can administer Optic, and sign in as any account to test."
        actions={<Badge tone="accent">{isOwner ? 'Owner' : 'Admin'}</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Accounts" value={real.length} icon={<Users className="size-4" />} />
        <Stat label="Admins" value={real.filter((i) => roleOf(i.id) !== 'member').length} icon={<ShieldCheck className="size-4" />} />
        <Stat label="Override" value={demo.overrideIdentityId ? 'On' : 'Off'} tone={demo.overrideIdentityId ? 'bad' : 'ok'} icon={<UserCog className="size-4" />} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Test-as-account override */}
        <Card>
          <CardHeader
            title="Test as account"
            description="A real scan signs you in as the chosen account. For testing only — turn off for real use."
          />
          <div className="p-5 pt-0">
            <Select
              value={demo.overrideIdentityId ?? ''}
              onChange={(e) => setDemo({ overrideIdentityId: e.target.value || null })}
              data-testid="admin-override"
            >
              <option value="">Me — real scan match (off)</option>
              {real.map((i) => (
                <option key={i.id} value={i.id}>
                  Act as {i.name}
                  {i.email ? ` · ${i.email}` : ''}
                </option>
              ))}
            </Select>
            {demo.overrideIdentityId && (
              <p className="mt-2 text-[12.5px] leading-relaxed text-warn">
                Override active: any real scan will sign you in as{' '}
                <strong>{real.find((i) => i.id === demo.overrideIdentityId)?.name ?? 'that account'}</strong>.
              </p>
            )}
          </div>
        </Card>

        {/* People + roles */}
        <Card>
          <CardHeader title="People" description="Everyone with an Optic account. The owner can grant or remove admin." />
          {real.length === 0 ? (
            <EmptyState icon={<Users className="size-5" />} title="No accounts yet" description="Enrolled accounts will appear here." />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {real.map((i) => {
                const role = roleOf(i.id)
                return (
                  <li key={i.id} className="flex items-center gap-3 px-5 py-3" data-testid="admin-person">
                    <Avatar name={i.name} size={32} />
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="flex items-center gap-2 truncate text-[13.5px] font-medium text-ink">
                        {i.name}
                        {i.id === sessionId && <span className="text-[11px] text-subtle">(you)</span>}
                      </div>
                      {i.email && <div className="truncate text-[12px] text-muted">{i.email}</div>}
                    </div>
                    {role === 'owner' ? (
                      <Badge tone="accent"><Crown className="size-3" /> Owner</Badge>
                    ) : (
                      <>
                        <Badge tone={role === 'admin' ? 'ok' : 'neutral'}>{role === 'admin' ? 'Admin' : 'Member'}</Badge>
                        {isOwner &&
                          (role === 'admin' ? (
                            <Button variant="ghost" icon={<UserMinus className="size-4" />} onClick={() => setAdmin(i.id, false)}>
                              Remove
                            </Button>
                          ) : (
                            <Button variant="ghost" icon={<ShieldCheck className="size-4" />} onClick={() => setAdmin(i.id, true)}>
                              Make admin
                            </Button>
                          ))}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {isOwner && real.length > 1 && (
        <Card className="mt-4">
          <CardHeader title="Danger zone" description="Revoke an account's access. Their scans stop matching immediately." />
          <ul className="divide-y divide-line border-t border-line">
            {real
              .filter((i) => i.id !== owner)
              .map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-5 py-3">
                  <ShieldX className="size-4 text-denied" />
                  <span className="flex-1 text-[13.5px] text-ink">{i.name}</span>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Revoke ${i.name}'s access? Their optic scans will stop matching.`))
                        void identityService.updateIdentity(i.id, { status: 'revoked' })
                    }}
                  >
                    Revoke access
                  </Button>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </>
  )
}

function Stat({ label, value, icon, tone }: { label: string; value: React.ReactNode; icon: React.ReactNode; tone?: 'ok' | 'bad' }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span
        className={
          'flex size-9 items-center justify-center rounded-xl ' +
          (tone === 'bad' ? 'bg-denied/10 text-denied' : tone === 'ok' ? 'bg-granted/10 text-granted' : 'bg-accent-soft text-accent')
        }
      >
        {icon}
      </span>
      <div className="leading-tight">
        <div className="text-[18px] font-semibold text-ink">{value}</div>
        <div className="text-[12px] text-muted">{label}</div>
      </div>
    </Card>
  )
}
