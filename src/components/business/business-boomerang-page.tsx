'use client'

/**
 * BOOMERANG LIST — the business's own customer list, on its own tab.
 *
 * This used to be a section inside Grow ("Customers"), sitting beside the
 * LocalVIP referral invites. That put two different products behind one tab and
 * was a large part of why a business could not tell which code did what: Grow is
 * about bringing people INTO LocalVIP, and this is about building a list that
 * belongs to the business.
 *
 * It is also the surface a business can decline. `hundred_list_interest` was
 * recorded during onboarding and then never consulted, so declining changed
 * nothing. This page refuses to render for a business that did not opt in, and
 * the tab that leads here is not in the nav for them either.
 */

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Lock, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BusinessMy100ListPage } from '@/components/business/business-my-100-list-page'
import { BusinessQrMaterialCard } from '@/components/business/business-qr-material-card'
import { useAuth } from '@/lib/auth/context'
import { getBusinessQaAccountId, isBoomerangEnabledForBusiness, resolveScopedBusiness } from '@/lib/business-portal'
import { useBusinesses } from '@/lib/supabase/hooks'
import { BOOMERANG_SURFACE, ENGAGEMENT_CODES } from '@/lib/engagement-codes'

export function BusinessBoomerangPage() {
  const { profile } = useAuth()
  const businessFilters = React.useMemo<Record<string, string>>(() => {
    const filters: Record<string, string> = {}
    if (profile.business_id) filters.id = profile.business_id
    else filters.owner_id = profile.id
    return filters
  }, [profile.business_id, profile.id])
  const { data: businesses, loading } = useBusinesses(businessFilters)
  const business = React.useMemo(() => resolveScopedBusiness(profile, businesses), [businesses, profile])
  const enabled = isBoomerangEnabledForBusiness(business)
  // Same resolution order the QR card used at its old home in My materials:
  // prefer the QA account id, then the business row's own id, then the
  // profile's business id as a last resort.
  const businessId = getBusinessQaAccountId(business) || (business?.id ? String(business.id) : profile.business_id || null)

  // Deciding while the business row is still in flight would flash the refusal
  // at a business that DID opt in, so nothing is claimed until it has loaded.
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title={BOOMERANG_SURFACE.pageTitle} description={BOOMERANG_SURFACE.pageDescription} />
        <div className="h-32 animate-pulse rounded-2xl border border-surface-200 bg-surface-100" />
      </div>
    )
  }

  if (!enabled) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={BOOMERANG_SURFACE.pageTitle}
          description="This is not switched on for your business."
        />
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-100 text-surface-500">
              <Lock className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-surface-900">
                You are not signed up for the {BOOMERANG_SURFACE.tab.toLowerCase()}
              </p>
              <p className="max-w-prose text-sm text-surface-500">
                {ENGAGEMENT_CODES.business_capture.outcome} If you want it turned on, tell your
                LocalVIP contact and they will set it up with you.
              </p>
              <p className="max-w-prose text-sm text-surface-500">
                Your {ENGAGEMENT_CODES.business_network_referral.linkLabel.toLowerCase()} is a
                separate thing and is unaffected — {ENGAGEMENT_CODES.business_network_referral.benefit.toLowerCase()}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/portal/grow">
                Go to Grow
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={BOOMERANG_SURFACE.pageTitle} description={BOOMERANG_SURFACE.pageDescription} />

      {/* Said once, up front: this is the part that is NOT a LocalVIP referral. */}
      <div className="flex items-start gap-3 rounded-2xl border border-surface-200 bg-surface-50 p-4">
        <Users className="mt-0.5 h-5 w-5 shrink-0 text-surface-400" />
        <div className="text-sm">
          <p className="font-semibold text-surface-900">{ENGAGEMENT_CODES.business_capture.qrLabel}</p>
          <p className="mt-0.5 max-w-prose text-surface-500">
            {BOOMERANG_SURFACE.contrast} For that, use your{' '}
            {ENGAGEMENT_CODES.business_network_referral.linkLabel.toLowerCase()} on the Grow tab.
          </p>
        </div>
      </div>

      {/* The gate (opted in) is already enforced by this branch, so the card
          takes no gate of its own — only the id it needs to fetch the QR. */}
      {businessId ? <BusinessQrMaterialCard businessId={businessId} /> : null}

      <BusinessMy100ListPage embedded />
    </div>
  )
}
