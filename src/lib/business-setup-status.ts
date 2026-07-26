'use client'

/**
 * Live setup status for the signed-in business, read from saved records.
 * Backs the nav gating in the shell and the "you're all set" state on
 * `/portal/setup`. Completion rules themselves live in `@/lib/business-setup`.
 */

import * as React from 'react'
import { getBusinessQaAccountId, resolveScopedBusiness } from '@/lib/business-portal'
import { getBusinessSetupSignals, getBusinessSetupState, type BusinessSetupState } from '@/lib/business-setup'
import { parseStripeOnboardingStatus } from '@/lib/stripe-onboarding'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import { useBusinesses, useContacts, useOffers } from '@/lib/supabase/hooks'
import type { Business, Profile } from '@/lib/types/database'

export interface BusinessSetupStatus {
  loading: boolean
  business: Business | null
  state: BusinessSetupState
}

export function useBusinessSetupStatus(profile: Profile): BusinessSetupStatus {
  const isBusinessShell = getStakeholderShell(profile) === 'business'

  const businessFilters = React.useMemo<Record<string, string>>(() => {
    const filters: Record<string, string> = {}
    if (profile.business_id) {
      filters.id = profile.business_id
    } else {
      filters.owner_id = profile.id
    }
    return filters
  }, [profile.business_id, profile.id])

  const { data: businesses, loading: businessesLoading } = useBusinesses(businessFilters, { enabled: isBusinessShell })
  const business = React.useMemo(
    () => (isBusinessShell ? resolveScopedBusiness(profile, businesses) : null),
    [businesses, isBusinessShell, profile],
  )

  const scopeId = business?.id || '__none__'
  const { data: contacts, loading: contactsLoading } = useContacts(
    { business_id: scopeId },
    { enabled: isBusinessShell && !!business },
  )
  const { data: offers, loading: offersLoading } = useOffers(
    { business_id: scopeId },
    { enabled: isBusinessShell && !!business },
  )

  const [stripeConnected, setStripeConnected] = React.useState<boolean | null>(null)
  React.useEffect(() => {
    let cancelled = false
    const qaBusinessId = getBusinessQaAccountId(business)
    if (!isBusinessShell || !business || !qaBusinessId) {
      setStripeConnected(false)
      return () => { cancelled = true }
    }

    setStripeConnected(null)
    fetch(`/api/business-portal/stripe-onboarding?businessId=${encodeURIComponent(qaBusinessId)}`, { cache: 'no-store' })
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (cancelled) return
        const status = response.ok ? parseStripeOnboardingStatus(payload) : null
        setStripeConnected(status?.status === 'complete')
      })
      .catch(() => { if (!cancelled) setStripeConnected(false) })

    return () => { cancelled = true }
  }, [business, isBusinessShell])

  const state = React.useMemo(
    () => getBusinessSetupState({
      ...getBusinessSetupSignals({ business, offers, contacts }),
      // Cached account flags are display hints only. Readiness comes from the
      // current business-scoped Stripe status response above.
      stripeConnected: stripeConnected === true,
    }),
    [business, contacts, offers, stripeConnected],
  )

  return {
    loading: isBusinessShell && (businessesLoading || (!!business && (contactsLoading || offersLoading || stripeConnected === null))),
    business,
    state,
  }
}
