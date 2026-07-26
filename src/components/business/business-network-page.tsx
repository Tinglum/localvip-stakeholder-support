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
  resolveScopedBusiness,
} from '@/lib/business-portal'
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

export function BusinessNetworkPage() {
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
      <PageHeader
        title="My Network"
        description={`Everyone connected to ${business.name}, and the customers who joined your team.`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/portal/clients">
              Open my 100 list
              <Users className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          href={`#${JOINED_SECTION_ID}`}
          label="Customers who joined"
          value={formatNumber(joinedContacts.length)}
          hint="See each person who finished joining through your business"
        />
        <StatTile
          href="/portal/activity"
          label="Joined this month"
          value={formatNumber(joinedThisMonthCount)}
          hint="Open your activity timeline for the full history"
        />
        <StatTile
          href={`#${TREE_SECTION_ID}`}
          label="People in my 100 list"
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
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portal/clients">
                Manage my list
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {joinedContacts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-50 px-4 py-6 text-center">
              <p className="text-sm text-surface-600">
                Nobody has finished joining yet. Invite the people already on your list and they will appear here.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/portal/clients">
                  Invite people from my list
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {joinedContacts.map((contact) => (
                <JoinedCustomerRow
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
          <EmptyState
            icon={<Network className="h-8 w-8" />}
            title="Network is not connected yet"
            description="This business is not linked to a network account yet. Once it is fully set up on the platform, your downline will appear here."
          />
        )}
      </div>
    </div>
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
}: {
  contact: Contact
  open: boolean
  onToggle: () => void
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
          <Button variant="outline" size="sm" asChild>
            <Link href="/portal/clients">
              Open in my 100 list
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
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
