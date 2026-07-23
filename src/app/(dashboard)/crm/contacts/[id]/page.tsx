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
import { ArrowLeft, ExternalLink, ShieldCheck, Users, AlertTriangle } from 'lucide-react'
import type { QaNodeDetail } from '@/lib/auth/qa-api'
import { AccessTab } from '@/components/admin/access-tab'

type TabKey = 'overview' | 'network' | 'access'

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id

  const [node, setNode] = React.useState<QaNodeDetail | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [tab, setTab] = React.useState<TabKey>('overview')

  React.useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/dashboard/nodes/${encodeURIComponent(id)}`, { cache: 'no-store' })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) setError(data?.error || 'The customer could not be loaded.')
        else setNode(data as QaNodeDetail)
      } catch {
        if (!cancelled) setError('The customer could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  if (loading) return <div className="p-6 text-sm text-surface-500">Loading…</div>
  if (error || !node) {
    return (
      <div className="p-6">
        <BackLink />
        <p className="mt-4 text-sm text-danger-600">{error || 'Not found.'}</p>
      </div>
    )
  }

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'network', label: 'Network' },
    { key: 'access', label: 'Access' },
  ]

  return (
    <div className="space-y-5 p-6">
      <BackLink />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-surface-900">{node.name || '—'}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-surface-500">
            <Badge>{node.type}</Badge>
            <span>{node.contact.email || '—'}</span>
            {node.consumerTypeName && node.consumerTypeName !== 'Normal' ? (
              <Badge tone="brand">{node.consumerTypeName}</Badge>
            ) : null}
            {!node.status.isEnabled ? <Badge tone="danger">Disabled</Badge> : null}
            {node.status.isLockedOut ? <Badge tone="danger">Locked out</Badge> : null}
          </p>
        </div>
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

      {tab === 'overview' ? <OverviewTab node={node} /> : null}
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-surface-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-surface-900">{title}</h2>
      {children}
    </section>
  )
}

function OverviewTab({ node }: { node: QaNodeDetail }) {
  const c = node.contact
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
          <Field label="Consumer type" value={node.consumerTypeName ?? '—'} />
          <Field label="Roles" value={node.roles.length ? node.roles.join(', ') : '—'} />
          <Field label="Joined" value={node.status.joinedAt ? new Date(node.status.joinedAt).toLocaleDateString() : '—'} />
          <Field label="Email confirmed" value={node.status.emailConfirmed ? 'Yes' : 'No'} />
          <Field label="Enabled" value={node.status.isEnabled ? 'Yes' : 'No'} />
        </dl>
      </Card>

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
                  : // Zero/absent coordinates hide a business from the consumer app's
                    // distance-based deal listing, so call it out rather than show "0, 0".
                    <span className="text-warning-700">Not geocoded</span>
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
          // No Referrals row = never placed by ReferralManager.AddReferral. Worth
          // surfacing loudly: an orphaned node earns nobody and appears in no tree.
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
