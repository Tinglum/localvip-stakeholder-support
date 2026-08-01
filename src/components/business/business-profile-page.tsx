'use client'

/**
 * MY BUSINESS — the permanent editing surface.
 *
 * Everything a business owner can change about itself lives on this one page:
 * profile, branding, the 100-list choice and capture offer, the LocalVIP deal,
 * Stripe, and the live-review submission. It renders the SAME field groups the
 * first-run wizard renders (`@/components/business/business-editor`), so there
 * is no second copy of any input and no card that just links back into Setup.
 *
 * Every section here uses the ACCENTED treatment, because everything here is
 * editable. The only neutral card is the read-only status strip at the top.
 */

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2, Rocket, Store } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { DealManager } from '@/components/crm/deal-manager'
import { ActionSection, InfoSection, SurfaceLegend } from '@/components/business/business-surfaces'
import {
  BrandingFields,
  CaptureFields,
  ProfileFields,
  SaveStateLabel,
  StripeFields,
  useBusinessEditor,
} from '@/components/business/business-editor'
import { getActivationLabel, getActivationTone } from '@/lib/business-portal'
import { formatCashbackLabel } from '@/lib/offers'
import { useCauses } from '@/lib/supabase/hooks'

function launchPhaseLabel(value: string) {
  switch (value) {
    case 'capturing_100':
      return 'Capturing 100'
    case 'ready_to_go_live':
      return 'Ready to go live'
    case 'live':
      return 'Live'
    default:
      return 'Setup'
  }
}

export function BusinessProfilePage() {
  const editor = useBusinessEditor()
  const { data: causes } = useCauses()

  const { business, setupState, isStepComplete } = editor

  if (editor.loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your business profile...
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <EmptyState
        icon={<Store className="h-8 w-8" />}
        title="Your business profile is almost ready"
        description="We couldn't find your business details for this account yet."
      />
    )
  }

  const activationKey =
    business.activation_status
    || (editor.launchPhase === 'setup'
      ? 'not_started'
      : editor.launchPhase === 'live' || editor.launchPhase === 'ready_to_go_live'
        ? 'active'
        : 'in_progress')
  const cashbackDeal = editor.deals.find((deal) => deal.active) || editor.deals[0] || null
  const cashbackValue = cashbackDeal ? Number(cashbackDeal.cash_back) : NaN
  const cashbackLabel = Number.isFinite(cashbackValue) ? formatCashbackLabel(cashbackValue) : 'No deal configured'
  const linkedCause = causes.find((cause) => cause.id === business.linked_cause_id) || null

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Business"
        description="Everything about your business that you can change, in one place. Edits save automatically."
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={getActivationTone(activationKey)} dot>
              {getActivationLabel(activationKey)}
            </Badge>
            <SaveStateLabel editor={editor} />
          </div>
        }
      />

      <SurfaceLegend />

      {/* The only read-only card on this page. */}
      <InfoSection
        title="Where your business stands"
        description="Read-only. These values come from the sections below and from LocalVIP review."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ReadOnlyFact label="Launch phase" value={launchPhaseLabel(editor.launchPhase)} />
          <ReadOnlyFact
            label="Setup requirements"
            value={`${setupState.completedCount} of ${setupState.totalSteps} complete`}
          />
          <ReadOnlyFact label="LocalVIP deal" value={cashbackLabel} />
          <ReadOnlyFact label="Linked cause or school" value={linkedCause?.name || 'Customer chooses later'} />
        </div>
      </InfoSection>

      {editor.saveError ? (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {editor.saveError}
        </div>
      ) : null}

      <ActionSection
        id="profile"
        title="Business profile"
        description="Name, category, description, average spend, and the keywords customers search on."
        complete={isStepComplete('profile')}
      >
        <ProfileFields editor={editor} />
      </ActionSection>

      <ActionSection
        id="branding"
        title="Branding"
        description="Your logo and cover image. These appear on your LocalVIP page, QR code, and printed materials."
        complete={isStepComplete('branding')}
      >
        <BrandingFields editor={editor} />
      </ActionSection>

      <ActionSection
        id="offer"
        title="Customer capture offer"
        description="Your pre-launch offer and whether LocalVIP is helping you build your first 100 customers."
        complete={isStepComplete('capture')}
      >
        <CaptureFields editor={editor} variant="full" />
      </ActionSection>

      <ActionSection
        id="deal"
        title="LocalVIP deal"
        description="The cashback percentage and the days and times customers can shop and earn it."
        complete={isStepComplete('cashback')}
        bodyClassName="p-0"
      >
        <DealManager
          businessAccountId={String(business.id)}
          mode="portal"
          onDealsChanged={() => editor.refetchDeals({ silent: true })}
        />
      </ActionSection>

      <ActionSection
        id="stripe"
        title="Stripe payments"
        description="Where LocalVIP sends your share of customer payments."
        complete={isStepComplete('stripe')}
      >
        <StripeFields editor={editor} />
      </ActionSection>

      {!setupState.steps.find((item) => item.key === 'activate')?.complete ? (
        <ActionSection
          id="go-live"
          title="Go live"
          description="Submit your business for the final LocalVIP review."
          complete={setupState.readyToActivate}
          statusLabel={setupState.readyToActivate ? 'Ready to submit' : 'Needs your input'}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-sm leading-6 text-surface-600">
              {setupState.readyToActivate
                ? 'Every requirement is met. Submit and LocalVIP will do the final check before customers can use your deals.'
                : `${editor.missingSteps.length} requirement${editor.missingSteps.length === 1 ? '' : 's'} still need your input: ${editor.missingSteps.map((item) => item.label).join(', ')}.`}
            </p>
            <Button asChild className="shrink-0">
              <Link href="/portal/setup?step=activate">
                <Rocket className="h-4 w-4" />
                Open the go-live checklist
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </ActionSection>
      ) : null}
    </div>
  )
}

function ReadOnlyFact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-surface-900">{value}</p>
    </div>
  )
}
