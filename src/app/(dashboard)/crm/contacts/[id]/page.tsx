'use client'

/**
 * Customer / business / cause detail.
 *
 * Drill-down from the CRM Customers list. Deliberately reads ONE endpoint
 * (`/api/dashboard/nodes/{id}`) rather than probing Consumer/Business/NonProfit in
 * sequence — consumers exist only as AspNetUsers rows while businesses and causes
 * are Accounts joined via AccountUsers, and the caller should not have to care.
 */
import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, ExternalLink, ShieldCheck, Users, AlertTriangle, RefreshCw } from 'lucide-react'
import type { QaNodeDetail } from '@/lib/auth/qa-api'
import { AccessTab } from '@/components/admin/access-tab'
import { ROLE_TOOLS } from '@/lib/constants'
import type { UserRole } from '@/lib/types/database'
import { mapQaRoleFromSignals } from '@/lib/auth/qa-auth'
import { CustomerAssignmentsPanel } from '@/components/crm/customer-assignments-panel'
import { CustomerAdminActions } from '@/components/crm/customer-admin-actions'
import { useStakeholderAssignments } from '@/lib/supabase/hooks'
import { describeAssignmentImpact, roleUsesAssignments } from '@/lib/assignment-impact'

type TabKey = 'overview' | 'assignments' | 'manage' | 'network' | 'access'

interface ConsumerTypeOption {
  id: number
  name: string
}

const CONSUMER_TYPE_HINTS: Record<string, string> = {
  Normal: 'Regular customer account with standard community access.',
  Intern: 'Training and support workspace with tasks, scripts, and materials.',
  Volunteer: 'Community support workspace with outreach tools and volunteer materials.',
  LaunchTeamPartner: 'City-growth workspace with launch partner materials and community tools.',
  Influencer: 'Referral and promotion workspace with links, stats, and share materials.',
}

function formatConsumerTypeName(name: string | null | undefined) {
  if (!name) return 'Normal'
  return name === 'LaunchTeamPartner' ? 'Launch Team Partner' : name
}

/**
 * The role this track will actually produce at sign-in.
 *
 * Delegates to mapQaRoleFromSignals - the same function the session is built
 * with - so this preview cannot drift from reality. A hand-written copy lived
 * here and had already drifted: it returned 'intern' and 'volunteer' as roles,
 * while sign-in produces role 'field' with a subtype. The CRM therefore listed
 * ROLE_TOOLS.intern (starting "Outreach Scripts") for someone who would land on
 * ROLE_TOOLS.field (starting "My Businesses").
 */
function mapConsumerTypeToRole(consumerType: string | null | undefined): UserRole {
  return mapQaRoleFromSignals({ consumerType: consumerType || 'Normal' }).role
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id

  const [node, setNode] = React.useState<QaNodeDetail | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [tab, setTab] = React.useState<TabKey>('overview')
  const [consumerTypes, setConsumerTypes] = React.useState<ConsumerTypeOption[]>([])
  const [typeSaving, setTypeSaving] = React.useState(false)
  const [typeMessage, setTypeMessage] = React.useState<string | null>(null)

  const loadNode = React.useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/nodes/${encodeURIComponent(id)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'The customer could not be loaded.')
        setNode(null)
        return
      }
      setNode(data as QaNodeDetail)
    } catch {
      setError('The customer could not be loaded.')
      setNode(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    void loadNode()
  }, [loadNode])

  React.useEffect(() => {
    if (!node || node.type?.toLowerCase() !== 'customer') {
      setConsumerTypes([])
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/qa/consumers/types', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setConsumerTypes(Array.isArray(data) ? data as ConsumerTypeOption[] : [])
      } catch {}
    })()

    return () => { cancelled = true }
  }, [node])

  // Must be called before the early returns below: hooks run in the same order
  // on every render, and this one previously sat after `if (loading) return`,
  // which builds fine under tsc and fails the production ESLint pass.
  // `enabled` keeps it idle until there is a user to ask about.
  const { data: assignments } = useStakeholderAssignments(
    { stakeholder_id: node ? String(node.userId) : '' },
    { enabled: !!node },
  )

  if (loading) return <div className="p-6 text-sm text-surface-500">Loading…</div>
  if (error || !node) {
    return (
      <div className="p-6">
        <BackLink />
        <p className="mt-4 text-sm text-danger-600">{error || 'Not found.'}</p>
      </div>
    )
  }

  const isCustomer = node.type?.toLowerCase() === 'customer'
  const consumerTypeName = node.consumerTypeName || 'Normal'
  const trackRole = mapConsumerTypeToRole(consumerTypeName)

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'assignments', label: 'Assignments' },
    { key: 'manage', label: 'Manage' },
    { key: 'network', label: 'Network' },
    { key: 'access', label: 'Access' },
  ]

  async function handleConsumerTypeChange(nextType: ConsumerTypeOption) {
    if (!isCustomer || !node) return

    // A track change is a permission change. Assignments live on in the
    // database when someone moves to a role that cannot reach them, so the
    // person keeps owning cities and businesses they can no longer see and
    // nothing on screen says so. Name the cost before it happens.
    const impact = describeAssignmentImpact(
      assignments,
      trackRole,
      mapConsumerTypeToRole(nextType.name),
    )
    if (impact.losesAccess) {
      const ok = window.confirm(
        `${node.name || 'This person'} currently holds ${impact.summary}.

` +
        `Moving them to ${formatConsumerTypeName(nextType.name)} removes the dashboard ` +
        `that uses those assignments, so they will stay assigned but become unusable ` +
        `until the track is changed back or the work is reassigned.

` +
        `Change the track anyway?`,
      )
      if (!ok) return
    }

    setTypeSaving(true)
    setTypeMessage(null)
    try {
      const res = await fetch(`/api/qa/consumers/${node.userId}/consumer-type`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ consumerTypeId: nextType.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || 'The customer track could not be saved.')
      }
      setNode((current) => current ? { ...current, consumerTypeName: nextType.name } : current)
      setTypeMessage(`Track updated to ${formatConsumerTypeName(nextType.name)}.`)
    } catch (err) {
      setTypeMessage(err instanceof Error ? err.message : 'The customer track could not be saved.')
    } finally {
      setTypeSaving(false)
    }
  }

  return (
    <div className="space-y-5 p-6">
      <BackLink />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-surface-900">{node.name || '—'}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-surface-500">
            <Badge>{node.type}</Badge>
            <span>{node.contact.email || '—'}</span>
            {isCustomer ? <Badge tone="brand">{formatConsumerTypeName(consumerTypeName)}</Badge> : null}
            {!node.status.isEnabled ? <Badge tone="danger">Disabled</Badge> : null}
            {node.status.isLockedOut ? <Badge tone="danger">Locked out</Badge> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isCustomer ? (
            <Link
              href={`/crm/consumers/${node.userId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-sm text-surface-700 hover:bg-surface-50"
            >
              Open consumer CRM <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
          <button
            onClick={() => void loadNode()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-sm text-surface-700 hover:bg-surface-50"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={async () => {
              await fetch('/api/admin/view-as', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ userId: node.userId }),
              })
              router.push('/')
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-sm text-surface-700 hover:bg-surface-50"
          >
            <ExternalLink className="h-4 w-4" /> View as
          </button>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-surface-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === t.key
                ? 'border-brand-600 font-medium text-brand-700'
                : 'border-transparent text-surface-500 hover:text-surface-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' ? (
        <OverviewTab
          node={node}
          consumerTypeName={consumerTypeName}
          consumerTypes={consumerTypes}
          trackRole={trackRole}
          typeSaving={typeSaving}
          typeMessage={typeMessage}
          onConsumerTypeChange={handleConsumerTypeChange}
        />
      ) : null}
      {tab === 'assignments' ? (
        <CustomerAssignmentsPanel
          stakeholderId={String(node.userId)}
          stakeholderName={node.name}
          currentRole={trackRole}
          currentTrackLabel={formatConsumerTypeName(consumerTypeName)}
          // Only the tracks that actually reach the assignment dashboards are
          // offered as the fix - listing Normal here would suggest it helps.
          assignableTracks={consumerTypes.filter((t) =>
            roleUsesAssignments(mapConsumerTypeToRole(t.name)),
          )}
          onChangeTrack={handleConsumerTypeChange}
        />
      ) : null}
      {tab === 'manage' ? (
        <CustomerAdminActions
          userId={node.userId}
          email={node.contact.email}
          firstName={node.contact.firstName}
          lastName={node.contact.lastName}
          phone={node.contact.phone}
          isEnabled={node.status.isEnabled}
          onChanged={() => void loadNode()}
        />
      ) : null}
      {tab === 'network' ? <NetworkTab node={node} /> : null}
      {tab === 'access' ? <AccessTab userId={node.userId} /> : null}
    </div>
  )
}

function BackLink() {
  return (
    <Link href="/crm/contacts" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700">
      <ArrowLeft className="h-4 w-4" /> Customers
    </Link>
  )
}

function Badge({ children, tone = 'surface' }: { children: React.ReactNode; tone?: 'surface' | 'brand' | 'danger' }) {
  const tones = {
    surface: 'bg-surface-100 text-surface-700',
    brand: 'bg-brand-50 text-brand-700',
    danger: 'bg-danger-50 text-danger-700',
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tones[tone]}`}>{children}</span>
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-surface-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-surface-800">{value ?? '—'}</dd>
    </div>
  )
}

function Card({
  title,
  children,
  description,
}: {
  title: string
  children: React.ReactNode
  description?: string
}) {
  return (
    <section className="rounded-xl border border-surface-200 bg-white p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-surface-900">{title}</h2>
        {description ? <p className="mt-1 text-xs text-surface-500">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function OverviewTab({
  node,
  consumerTypeName,
  consumerTypes,
  trackRole,
  typeSaving,
  typeMessage,
  onConsumerTypeChange,
}: {
  node: QaNodeDetail
  consumerTypeName: string
  consumerTypes: ConsumerTypeOption[]
  trackRole: UserRole
  typeSaving: boolean
  typeMessage: string | null
  onConsumerTypeChange: (nextType: ConsumerTypeOption) => Promise<void>
}) {
  const c = node.contact
  const isCustomer = node.type?.toLowerCase() === 'customer'
  const roleTools = ROLE_TOOLS[trackRole] || []

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Contact">
        <dl className="grid grid-cols-2 gap-3">
          <Field label="First name" value={c.firstName} />
          <Field label="Last name" value={c.lastName} />
          <Field label="Email" value={c.email} />
          <Field label="Phone" value={c.phone} />
          <Field label="City" value={c.city} />
          <Field label="State" value={c.state} />
        </dl>
      </Card>

      <Card title="Identity">
        <dl className="grid grid-cols-2 gap-3">
          <Field label="Account type" value={`${node.accountTypeName} (${node.accountType})`} />
          <Field label="Consumer type" value={isCustomer ? formatConsumerTypeName(consumerTypeName) : (node.consumerTypeName ?? '—')} />
          <Field label="Roles" value={node.roles.length ? node.roles.join(', ') : '—'} />
          <Field label="Joined" value={node.status.joinedAt ? new Date(node.status.joinedAt).toLocaleDateString() : '—'} />
          <Field label="Email confirmed" value={node.status.emailConfirmed ? 'Yes' : 'No'} />
          <Field label="Enabled" value={node.status.isEnabled ? 'Yes' : 'No'} />
        </dl>
      </Card>

      {isCustomer ? (
        <Card
          title="Customer track"
          description="Choose what kind of stakeholder this customer should be so they land in the right dashboard and get the right tools."
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {consumerTypes.map((type) => {
                const isCurrent = type.name === consumerTypeName
                return (
                  <button
                    key={type.id}
                    type="button"
                    disabled={typeSaving || isCurrent}
                    onClick={() => void onConsumerTypeChange(type)}
                    className={
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition ' +
                      (isCurrent
                        ? 'cursor-default border-brand-300 bg-brand-50 text-brand-800'
                        : 'border-surface-300 bg-white text-surface-700 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50')
                    }
                  >
                    {formatConsumerTypeName(type.name)}
                    {isCurrent ? <span className="ml-1.5 text-brand-700">✓</span> : null}
                  </button>
                )
              })}
            </div>
            <p className="text-sm text-surface-600">
              {CONSUMER_TYPE_HINTS[consumerTypeName] || CONSUMER_TYPE_HINTS.Normal}
            </p>
            <p className="rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-600">
              Direct name, email, and phone edits still need a QA update endpoint. This page now handles the customer track, access grants, referral/network visibility, and direct links into the right workspace.
            </p>
            {typeMessage ? (
              <p className={`text-sm ${typeMessage.toLowerCase().includes('could not') ? 'text-danger-700' : 'text-emerald-700'}`}>
                {typeMessage}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {isCustomer ? (
        <Card
          title="Unlocked tools"
          description={`This customer currently maps to the ${ROLE_TOOLS[trackRole] ? trackRole.replace('_', ' ') : 'community'} workspace.`}
        >
          {roleTools.length ? (
            <div className="space-y-2">
              {roleTools.map((tool) => (
                <Link
                  key={`${trackRole}-${tool.href}`}
                  href={tool.href}
                  className="flex items-center justify-between rounded-lg border border-surface-200 px-3 py-2 transition hover:border-brand-200 hover:bg-brand-50"
                >
                  <div>
                    <p className="text-sm font-medium text-surface-900">{tool.label}</p>
                    <p className="text-xs text-surface-500">{tool.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-surface-400" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-surface-500">No workspace shortcuts are configured for this customer type yet.</p>
          )}
        </Card>
      ) : null}

      {node.account ? (
        <Card title="Linked account">
          <dl className="grid grid-cols-2 gap-3">
            <Field label="Name" value={node.account.name} />
            <Field label="Headline" value={node.account.headline} />
            <Field label="Active" value={node.account.active ? 'Yes' : 'No'} />
            <Field
              label="Location"
              value={
                node.account.latitude || node.account.longitude
                  ? `${node.account.latitude}, ${node.account.longitude}`
                  : <span className="text-warning-700">Not geocoded</span>
              }
            />
          </dl>
        </Card>
      ) : null}
    </div>
  )
}

function NetworkTab({ node }: { node: QaNodeDetail }) {
  const n = node.network
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Placement">
        {n.referrer ? (
          <dl className="grid grid-cols-2 gap-3">
            <Field
              label="Referred by"
              value={
                <Link href={`/crm/contacts/${n.referrer.userId}`} className="text-brand-700 hover:underline">
                  {n.referrer.name || n.referrer.email}
                </Link>
              }
            />
            <Field label="Referrer code" value={n.referrer.referralCode} />
          </dl>
        ) : (
          <p className="flex items-start gap-2 rounded-lg bg-warning-50 p-3 text-sm text-warning-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Not placed in the referral network.</strong> This node has no
              referral row, so it appears in no hierarchy and no referral credit flows
              through it.
            </span>
          </p>
        )}
      </Card>

      <Card title="Reach">
        <dl className="grid grid-cols-2 gap-3">
          <Field
            label="Direct referrals"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-surface-400" />
                {n.directReferralCount}
              </span>
            }
          />
          <Field label="Network depth" value={n.networkDepth} />
          <Field label="Referral code" value={n.referralCode} />
          <Field
            label="Share link"
            value={
              n.sharedUrl ? (
                <a href={n.sharedUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                  Open
                </a>
              ) : '—'
            }
          />
        </dl>
      </Card>

      <Card title="Access summary">
        <p className="flex items-center gap-2 text-sm text-surface-600">
          <ShieldCheck className="h-4 w-4 text-surface-400" />
          {node.accessGrants.length
            ? `${node.accessGrants.length} explicit grant${node.accessGrants.length === 1 ? '' : 's'}`
            : 'No explicit grants — role defaults only.'}
        </p>
      </Card>
    </div>
  )
}
