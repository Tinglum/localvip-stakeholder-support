'use client'

/**
 * MY NETWORK (business)
 * ─────────────────────
 * Everything about the business's own network in one tab: headline counts, the
 * customers who joined the team, and the full 10-level tree. The dashboard links
 * here instead of carrying a second copy of any of it.
 */

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Mail,
  Network,
  Phone,
  UserCircle2,
  Users,
} from 'lucide-react'
import { NetworkTreeView } from '@/components/network/network-tree-view'
import { BusinessNetworkLinkCard } from '@/components/business/business-network-link-card'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import {
  getBusinessQaAccountId,
  getContactDisplayName,
  getContactListStatus,
  isBoomerangEnabledForBusiness,
  resolveScopedBusiness,
} from '@/lib/business-portal'
import { BOOMERANG_SURFACE } from '@/lib/engagement-codes'
import { BUSINESS_BOOMERANG_NAV_HREF } from '@/lib/stakeholder-access'
import { useBusinesses, useContacts } from '@/lib/supabase/hooks'
import { cn, formatDate, formatNumber } from '@/lib/utils'
import type { Contact } from '@/lib/types/database'

const JOINED_SECTION_ID = 'joined-customers'
const TREE_SECTION_ID = 'network-tree'

function joinedThisMonth(contact: Contact) {
  if (!contact.joined_at) return false
  const joined = new Date(contact.joined_at)
  const now = new Date()
  return joined.getFullYear() === now.getFullYear() && joined.getMonth() === now.getMonth()
}

/** `embedded` suppresses the standalone PageHeader when the Grow hub renders
 *  this as a section. Nothing else changes. */
export function BusinessNetworkPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { profile } = useAuth()
  const businessFilters = React.useMemo<Record<string, string>>(() => {
    const filters: Record<string, string> = {}
    if (profile.business_id) {
      filters.id = profile.business_id
    } else {
      filters.owner_id = profile.id
    }
    return filters
  }, [profile.business_id, profile.id])

  const { data: businesses, loading: businessesLoading } = useBusinesses(businessFilters)
  const business = React.useMemo(() => resolveScopedBusiness(profile, businesses), [businesses, profile])
  // The network is the LocalVIP side. Links to the Boomerang list only exist for
  // a business that has one.
  const boomerangEnabled = isBoomerangEnabledForBusiness(business)
  const { data: contacts, loading: contactsLoading } = useContacts({ business_id: business?.id || '__none__' })
  const [openContactId, setOpenContactId] = React.useState<string | null>(null)

  const qaAccountId = getBusinessQaAccountId(business)
  const buildNodeDetailUrl = React.useCallback(
    (nodeId: string) =>
      `/api/business-portal/network/node/${encodeURIComponent(nodeId)}?rootAccountId=${encodeURIComponent(String(qaAccountId))}`,
    [qaAccountId],
  )

  if (businessesLoading || (business && contactsLoading)) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Loading your network...
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <EmptyState
        icon={<Network className="h-8 w-8" />}
        title="Your network will show up here"
        description="We couldn't find your business details for this account yet."
      />
    )
  }

  const joinedContacts = contacts
    .filter((contact) => getContactListStatus(contact) === 'joined')
    .sort((left, right) => new Date(right.joined_at || right.created_at).getTime() - new Date(left.joined_at || left.created_at).getTime())
  const joinedThisMonthCount = joinedContacts.filter(joinedThisMonth).length

  return (
    <div className="space-y-8">
      {embedded ? null : (
        <PageHeader
          title="My Network"
          description={`Everyone connected to ${business.name}, and the customers who joined your team.`}
          actions={
            boomerangEnabled ? (
              <Button variant="outline" asChild>
                <Link href={BUSINESS_BOOMERANG_NAV_HREF}>
                  {`Open my ${BOOMERANG_SURFACE.tab.toLowerCase()}`}
                  <Users className="h-4 w-4" />
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          href={`#${JOINED_SECTION_ID}`}
          label="Customers who joined"
          value={formatNumber(joinedContacts.length)}
          hint="See each person who finished joining through your business"
        />
        <StatTile
          href="/dashboard"
          label="Joined this month"
          value={formatNumber(joinedThisMonthCount)}
          hint="Open your activity timeline for the full history"
        />
        <StatTile
          href={`#${TREE_SECTION_ID}`}
          label={`People in my ${BOOMERANG_SURFACE.tab.toLowerCase()}`}
          value={formatNumber(contacts.length)}
          hint="Jump to the level-by-level breakdown of your network"
        />
      </div>

      {/* The LocalVIP network referral link — how new members get under this
          business. It belongs with the network, not on the dashboard. */}
      <BusinessNetworkLinkCard business={business} />

      <Card id={JOINED_SECTION_ID}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Customers who joined your team</CardTitle>
              <p className="mt-1 text-sm leading-6 text-surface-500">
                These are the people who finished joining through your business. Open a row to see how to reach them.
              </p>
            </div>
            {boomerangEnabled ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={BUSINESS_BOOMERANG_NAV_HREF}>
                  Manage my list
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {joinedContacts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-50 px-4 py-6 text-center">
              <p className="text-sm text-surface-600">
                Nobody has finished joining yet. Invite the people already on your list and they will appear here.
              </p>
              {boomerangEnabled ? (
                <Button className="mt-4" asChild>
                  <Link href={BUSINESS_BOOMERANG_NAV_HREF}>
                    Invite people from my list
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              {joinedContacts.map((contact) => (
                <JoinedCustomerRow
                  boomerangEnabled={boomerangEnabled}
                  key={contact.id}
                  contact={contact}
                  open={openContactId === contact.id}
                  onToggle={() => setOpenContactId((current) => (current === contact.id ? null : contact.id))}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div id={TREE_SECTION_ID} className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-surface-900">Your network, level by level</h2>
          <p className="mt-1 text-sm leading-6 text-surface-500">
            Everyone connected to {business.name} across up to 10 levels, and the tracked spend tied to each member.
            Open any member to see their details.
          </p>
        </div>
        {qaAccountId ? (
          <NetworkTreeView accountId={qaAccountId} nodeLabel="business" buildNodeDetailUrl={buildNodeDetailUrl} />
        ) : (
          <UnlinkedNetworkPanel businessName={business.name} />
        )}
      </div>
    </div>
  )
}

/**
 * Shown only when the business genuinely has no network account id — a local or
 * demo record that was never linked to a platform account. There is no tree to
 * draw, so the panel gives the business the one thing that still works today
 * (their own referral link, already on this page) and says what unlocks the rest,
 * instead of dead-ending on "not connected".
 */
function UnlinkedNetworkPanel({ businessName }: { businessName: string }) {
  return (
    <Card className="border-surface-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-4 w-4 text-brand-600" />
          Your network is still being set up
        </CardTitle>
        <p className="mt-1 text-sm leading-6 text-surface-500">
          {businessName} does not have a platform account behind it yet, so there is nothing to lay out level by level.
          Everything you do now still counts — invites are recorded against your referral link and will appear here as
          soon as the account is linked.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-3">
          <UnlinkedStep
            number="1"
            title="Share your referral link"
            description="It is on this page, just above. Anyone who joins through it — a customer, a business, or a cause — comes in under you."
          />
          <UnlinkedStep
            number="2"
            title="Invite people directly"
            description="Use Grow to invite customers, other businesses, and causes by name. Each invite is tracked with its own referral code."
          />
          <UnlinkedStep
            number="3"
            title="Finish your business setup"
            description="Completing setup and going live is what links this business to a platform account and turns this section into your live network."
          />
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/portal/grow">
              Invite someone
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/portal/business">
              Finish business setup
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function UnlinkedStep({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <li className="flex gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700"
      >
        {number}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-surface-900">{title}</p>
        <p className="mt-1 text-sm leading-6 text-surface-500">{description}</p>
      </div>
    </li>
  )
}

function StatTile({
  href,
  label,
  value,
  hint,
}: {
  href: string
  label: string
  value: string
  hint: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group block rounded-2xl border border-surface-200 bg-white p-5 shadow-sm transition-all',
        'hover:-translate-y-0.5 hover:shadow-card-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
      )}
      aria-label={`${label}: ${value}. ${hint}`}
    >
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-surface-900">{value}</p>
      <p className="mt-2 flex items-center gap-1 text-sm text-surface-500">
        {hint}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </p>
    </Link>
  )
}

function JoinedCustomerRow({
  contact,
  open,
  onToggle,
  boomerangEnabled,
}: {
  contact: Contact
  open: boolean
  onToggle: () => void
  /** Passed down so the "open in my list" link stays absent without a list. */
  boomerangEnabled: boolean
}) {
  const panelId = `joined-contact-${contact.id}`
  const name = getContactDisplayName(contact)

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-200 bg-surface-50">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${open ? 'Hide' : 'Show'} details for ${name}`}
        className={cn(
          'flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors',
          'hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
          open && 'bg-surface-100',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <UserCircle2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-surface-900">{name}</p>
            <p className="mt-0.5 text-xs text-surface-500">
              {contact.joined_at ? `Joined ${formatDate(contact.joined_at)}` : 'Joined through your business'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Badge variant="success">Joined</Badge>
          {open ? <ChevronDown className="h-4 w-4 text-surface-400" /> : <ChevronRight className="h-4 w-4 text-surface-400" />}
        </div>
      </button>
      {open ? (
        <div id={panelId} className="space-y-3 border-t border-surface-200 bg-surface-0 px-4 py-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <ContactFact icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={contact.email} />
            <ContactFact icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={contact.phone} />
            <ContactFact
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Added to your list"
              value={contact.created_at ? formatDate(contact.created_at) : null}
            />
            <ContactFact
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Invited"
              value={contact.invited_at ? formatDate(contact.invited_at) : 'Not recorded'}
            />
          </div>
          {boomerangEnabled ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={BUSINESS_BOOMERANG_NAV_HREF}>
                {`Open in my ${BOOMERANG_SURFACE.tab.toLowerCase()}`}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ContactFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | null
}) {
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-surface-500">
        {icon}
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium text-surface-900">{value || 'Not provided'}</p>
    </div>
  )
}
