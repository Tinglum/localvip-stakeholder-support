'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Heart, Megaphone, QrCode, Store, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { StakeholderActionQueue } from '@/components/dashboard/stakeholder-action-queue'
import { useAuth } from '@/lib/auth/context'
import { useBusinesses, useCauses, useContacts, useGeneratedMaterials, useQrCodes, useStakeholders } from '@/lib/supabase/hooks'

export function CommunityDashboardPage() {
  const { profile, roleLabel } = useAuth()
  const { data: causes } = useCauses()
  const { data: contacts } = useContacts()
  const { data: businesses } = useBusinesses()

  const scopedCause = React.useMemo(
    () => causes.find((cause) => cause.owner_id === profile.id || cause.organization_id === profile.organization_id) || null,
    [causes, profile.id, profile.organization_id]
  )

  const supporterContacts = React.useMemo(
    () => contacts.filter((contact) => contact.cause_id && contact.cause_id === scopedCause?.id),
    [contacts, scopedCause?.id]
  )
  const { data: stakeholderRecords } = useStakeholders({ cause_id: scopedCause?.id || '__none__' })
  const scopedStakeholder = React.useMemo(
    () => stakeholderRecords.find((stakeholder) => stakeholder.cause_id === scopedCause?.id) || null,
    [scopedCause?.id, stakeholderRecords]
  )
  const { data: qrCodes } = useQrCodes({ cause_id: scopedCause?.id || '__none__' })
  const { data: generatedMaterials } = useGeneratedMaterials({ stakeholder_id: scopedStakeholder?.id || '__none__' })

  const supportingBusinesses = React.useMemo(
    () => businesses.filter((business) => business.linked_cause_id === scopedCause?.id),
    [businesses, scopedCause?.id]
  )
  const immediateItems = React.useMemo(() => {
    const items = []

    if (qrCodes.length === 0) {
      items.push({
        id: 'community-qr',
        title: 'Set up your supporter QR',
        detail: 'Your community needs one clean QR path so parents, supporters, and local families can actually join.',
        href: '/community/share',
        ctaLabel: 'Open share tools',
        priority: 'high' as const,
        badge: 'Supporter flow',
      })
    }

    if (generatedMaterials.length === 0) {
      items.push({
        id: 'community-materials',
        title: 'Make your supporter materials ready',
        detail: 'Your flyers, supporter cards, and parent/PTA materials should be ready before you ask people to share.',
        href: '/materials/mine',
        ctaLabel: 'Open materials',
        priority: 'high' as const,
        badge: 'Materials',
      })
    }

    if (supporterContacts.length < 10) {
      items.push({
        id: 'community-supporters',
        title: 'Get your first 10 supporters',
        detail: 'Start with the people who already care most about your school or cause and get them onto the supporter list.',
        href: '/community/supporters',
        ctaLabel: 'Open supporters',
        priority: 'medium' as const,
        badge: `${supporterContacts.length} supporters`,
      })
    }

    if (supportingBusinesses.length === 0) {
      items.push({
        id: 'community-businesses',
        title: 'Connect your first business',
        detail: 'You need at least one supporting business so the community story becomes real, not theoretical.',
        href: '/community/share',
        ctaLabel: 'Open community tools',
        priority: 'medium' as const,
        badge: 'Business support',
      })
    }

    return items
  }, [generatedMaterials.length, qrCodes.length, supporterContacts.length, supportingBusinesses.length])
  const suggestedItems = React.useMemo(
    () => [
      {
        id: 'community-suggestion-event',
        title: 'Share at your next event',
        detail: 'Use your QR at the next school, church, or community gathering where people already care.',
        href: '/community/share',
        ctaLabel: 'Open share tools',
      },
      {
        id: 'community-suggestion-message',
        title: 'Send the parent / PTA message again',
        detail: 'A short reminder in a parent group or newsletter often creates the next wave of supporters.',
        href: '/community/share',
        ctaLabel: 'Open message',
      },
      {
        id: 'community-suggestion-business',
        title: 'Follow up with the next business',
        detail: 'Keep building the business side so the supporter story has real local momentum behind it.',
        href: '/community/activity',
        ctaLabel: 'Open activity',
      },
    ],
    []
  )

  if (!scopedCause) {
    return (
      <EmptyState
        icon={<Heart className="h-8 w-8" />}
        title="Community dashboard coming online"
        description="Once a school or cause record is linked to this account, supporter growth and local business activity will show up here."
      />
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Support ${scopedCause.name}`}
        description={`Use this ${roleLabel.toLowerCase()} dashboard to grow supporters, share your QR, and keep the local story simple.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/community/share">
                Grow Your Supporters
                <Megaphone className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/community/supporters">
                Open supporters
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total supporters" value={supporterContacts.length} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Businesses supporting you" value={supportingBusinesses.length} icon={<Store className="h-5 w-5" />} />
        <StatCard label="QR ready" value={qrCodes.length > 0 ? 'Yes' : 'No'} icon={<QrCode className="h-5 w-5" />} />
        <StatCard label="Funds generated" value="$0.00" icon={<Heart className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <StakeholderActionQueue
          title="Immediate next steps"
          description="Anything still needed for supporter growth stays here. Once it is done, it drops out and the page suggests the next three strongest moves."
          items={immediateItems}
          suggestions={suggestedItems}
        />

        <Card>
          <CardHeader>
            <CardTitle>Supporting Businesses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {supportingBusinesses.length === 0 ? (
              <p className="text-sm text-surface-500">No businesses are linked yet.</p>
            ) : (
              supportingBusinesses.slice(0, 6).map((business) => (
                <div key={business.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-900">{business.name}</p>
                      <p className="mt-1 text-xs text-surface-500">{business.category || 'Local business'}</p>
                    </div>
                    <Badge variant={business.stage === 'live' ? 'success' : 'info'}>
                      {business.stage}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
