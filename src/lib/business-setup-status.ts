'use client'

/**
 * Live setup status for the signed-in business, read from saved records.
 * Backs the nav gating in the shell and the "you're all set" state on
 * `/portal/setup`. Completion rules themselves live in `@/lib/business-setup`.
 */

import * as React from 'react'
import { resolveScopedBusiness } from '@/lib/business-portal'
import { getBusinessSetupSignals, getBusinessSetupState, type BusinessSetupState } from '@/lib/business-setup'
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

  const state = React.useMemo(
    () => getBusinessSetupState(getBusinessSetupSignals({ business, offers, contacts })),
    [business, contacts, offers],
  )

  return {
    loading: isBusinessShell && (businessesLoading || (!!business && (contactsLoading || offersLoading))),
    business,
    state,
  }
}
