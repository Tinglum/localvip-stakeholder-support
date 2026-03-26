'use client'

import * as React from 'react'
import { createClient } from './client'
import type {
  Business, Cause, Contact, City, Campaign, Task, OutreachActivity, Profile, QrCode, Note, Material, Organization,
  StakeholderAssignment, OnboardingFlow, OnboardingStep, OutreachScript, MaterialAssignment, QrCodeCollection,
} from '@/lib/types/database'

// ─── Generic fetch hook ─────────────────────────────────────

interface UseQueryResult<T> {
  data: T[]
  loading: boolean
  error: string | null
  refetch: (options?: { silent?: boolean }) => void
}

function useSupabaseQuery<T>(
  table: string,
  options?: {
    orderBy?: string
    orderAsc?: boolean
    limit?: number
    filters?: Record<string, string | number | boolean | null>
  }
): UseQueryResult<T> {
  const supabase = React.useMemo(() => createClient(), [])
  const [data, setData] = React.useState<T[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [refetchKey, setRefetchKey] = React.useState(0)
  const silentRefetchRef = React.useRef(false)
  const orderBy = options?.orderBy
  const orderAsc = options?.orderAsc ?? false
  const limit = options?.limit
  const filtersKey = JSON.stringify(options?.filters || {})
  const filterEntries = React.useMemo(
    () => Object.entries(
      JSON.parse(filtersKey) as Record<string, string | number | boolean | null>
    ).filter(([, value]) => value !== null && value !== undefined && value !== ''),
    [filtersKey]
  )

  React.useEffect(() => {
    async function fetch() {
      if (!silentRefetchRef.current) {
        setLoading(true)
      }
      setError(null)

      let query = supabase.from(table).select('*')

      for (const [key, value] of filterEntries) {
        query = query.eq(key, value as string | number | boolean)
      }

      if (orderBy) {
        query = query.order(orderBy, { ascending: orderAsc })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      if (limit) {
        query = query.limit(limit)
      }

      const { data: rows, error: err } = await query

      if (err) {
        setError(err.message)
        setData([])
      } else {
        setData((rows || []) as T[])
      }
      setLoading(false)
      silentRefetchRef.current = false
    }

    fetch()
  }, [supabase, table, orderBy, orderAsc, limit, filterEntries, refetchKey])

  const refetch = React.useCallback((options?: { silent?: boolean }) => {
    silentRefetchRef.current = !!options?.silent
    setRefetchKey(k => k + 1)
  }, [])

  return { data, loading, error, refetch }
}

// ─── Insert hook ────────────────────────────────────────────

function useSupabaseInsert<T>(table: string) {
  const supabase = React.useMemo(() => createClient(), [])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const insert = React.useCallback(async (record: Partial<T>): Promise<T | null> => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from(table)
      .insert(record as any)
      .select()
      .single()

    setLoading(false)

    if (err) {
      setError(err.message)
      return null
    }

    return data as T
  }, [supabase, table])

  return { insert, loading, error }
}

// ─── Update hook ────────────────────────────────────────────

function useSupabaseUpdate<T>(table: string) {
  const supabase = React.useMemo(() => createClient(), [])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const update = React.useCallback(async (id: string, changes: Partial<T>): Promise<T | null> => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await (supabase
      .from(table) as any)
      .update(changes)
      .eq('id', id)
      .select()
      .single()

    setLoading(false)

    if (err) {
      setError(err.message)
      return null
    }

    return data as T
  }, [supabase, table])

  return { update, loading, error }
}

// ─── Delete hook ────────────────────────────────────────────

function useSupabaseDelete(table: string) {
  const supabase = React.useMemo(() => createClient(), [])

  const remove = React.useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from(table).delete().eq('id', id)
    return !error
  }, [supabase, table])

  return { remove }
}

// ─── Typed hooks ────────────────────────────────────────────

export function useBusinesses(filters?: Record<string, string>) {
  return useSupabaseQuery<Business>('businesses', { filters })
}
export function useBusinessInsert() { return useSupabaseInsert<Business>('businesses') }
export function useBusinessUpdate() { return useSupabaseUpdate<Business>('businesses') }

export function useCauses(filters?: Record<string, string>) {
  return useSupabaseQuery<Cause>('causes', { filters })
}
export function useCauseInsert() { return useSupabaseInsert<Cause>('causes') }

export function useContacts(filters?: Record<string, string>) {
  return useSupabaseQuery<Contact>('contacts', { filters })
}
export function useContactInsert() { return useSupabaseInsert<Contact>('contacts') }
export function useContactUpdate() { return useSupabaseUpdate<Contact>('contacts') }
export function useContactDelete() { return useSupabaseDelete('contacts') }

export function useStakeholderAssignments(filters?: Record<string, string>) {
  return useSupabaseQuery<StakeholderAssignment>('stakeholder_assignments', { filters })
}

export function useCities() {
  return useSupabaseQuery<City>('cities', { orderBy: 'name', orderAsc: true })
}
export function useCityInsert() { return useSupabaseInsert<City>('cities') }

export function useOrganizations(filters?: Record<string, string>) {
  return useSupabaseQuery<Organization>('organizations', { filters, orderBy: 'name', orderAsc: true })
}

export function useCampaigns(filters?: Record<string, string>) {
  return useSupabaseQuery<Campaign>('campaigns', { filters })
}
export function useCampaignInsert() { return useSupabaseInsert<Campaign>('campaigns') }

export function useTasks(filters?: Record<string, string>) {
  return useSupabaseQuery<Task>('tasks', { filters })
}
export function useTaskInsert() { return useSupabaseInsert<Task>('tasks') }
export function useTaskUpdate() { return useSupabaseUpdate<Task>('tasks') }

export function useOutreach(filters?: Record<string, string>) {
  return useSupabaseQuery<OutreachActivity>('outreach_activities', { filters })
}
export function useOutreachInsert() { return useSupabaseInsert<OutreachActivity>('outreach_activities') }

export function useOutreachScripts(filters?: Record<string, string>) {
  return useSupabaseQuery<OutreachScript>('outreach_scripts', { filters })
}
export function useOutreachScriptInsert() { return useSupabaseInsert<OutreachScript>('outreach_scripts') }
export function useOutreachScriptUpdate() { return useSupabaseUpdate<OutreachScript>('outreach_scripts') }

export function useProfiles() {
  return useSupabaseQuery<Profile>('profiles', { orderBy: 'full_name', orderAsc: true })
}

export function useQrCodes(filters?: Record<string, string>) {
  return useSupabaseQuery<QrCode>('qr_codes', { filters })
}
export function useQrCodeCollections(filters?: Record<string, string>) {
  return useSupabaseQuery<QrCodeCollection>('qr_code_collections', { filters })
}
export function useQrCodeInsert() { return useSupabaseInsert<QrCode>('qr_codes') }
export function useQrCodeDelete() { return useSupabaseDelete('qr_codes') }

export function useMaterials(filters?: Record<string, string>) {
  return useSupabaseQuery<Material>('materials', { filters })
}
export function useMaterialInsert() { return useSupabaseInsert<Material>('materials') }
export function useMaterialUpdate() { return useSupabaseUpdate<Material>('materials') }
export function useMaterialAssignments(filters?: Record<string, string>) {
  return useSupabaseQuery<MaterialAssignment>('material_assignments', { filters })
}

export function useCauseUpdate() { return useSupabaseUpdate<Cause>('causes') }

export function useNotes(filters?: Record<string, string>) {
  return useSupabaseQuery<Note>('notes', { filters })
}
export function useNoteInsert() { return useSupabaseInsert<Note>('notes') }

export function useOnboardingFlows(filters?: Record<string, string>) {
  return useSupabaseQuery<OnboardingFlow>('onboarding_flows', { filters })
}

export function useOnboardingSteps(filters?: Record<string, string>) {
  return useSupabaseQuery<OnboardingStep>('onboarding_steps', {
    filters,
    orderBy: 'sort_order',
    orderAsc: true,
  })
}

// ─── Count hooks ────────────────────────────────────────────

export function useCount(table: string, filters?: Record<string, string | number | boolean | null>) {
  const supabase = React.useMemo(() => createClient(), [])
  const [count, setCount] = React.useState(0)
  const filtersKey = JSON.stringify(filters || {})
  const filterEntries = React.useMemo(
    () => Object.entries(
      JSON.parse(filtersKey) as Record<string, string | number | boolean | null>
    ).filter(([, value]) => value !== null && value !== undefined && value !== ''),
    [filtersKey]
  )

  React.useEffect(() => {
    async function fetch() {
      let query = supabase.from(table).select('*', { count: 'exact', head: true })
      for (const [key, value] of filterEntries) {
        query = query.eq(key, value as string | number | boolean)
      }
      const { count: c } = await query
      setCount(c || 0)
    }
    fetch()
  }, [supabase, table, filterEntries])

  return count
}

// ─── Single record hook ─────────────────────────────────────

export function useRecord<T>(table: string, id: string | null) {
  const supabase = React.useMemo(() => createClient(), [])
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!id) { setLoading(false); return }

    async function fetch() {
      setLoading(true)
      const { data: record } = await supabase.from(table).select('*').eq('id', id!).single()
      setData(record as T | null)
      setLoading(false)
    }
    fetch()
  }, [supabase, table, id])

  return { data, loading }
}
