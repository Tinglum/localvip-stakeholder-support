'use client'

import * as React from 'react'
import { createClient } from './client'
import type { Business, Cause, Contact, City, Campaign, Task, OutreachActivity, Profile, QrCode, Note, Material } from '@/lib/types/database'

// ─── Generic fetch hook ─────────────────────────────────────

interface UseQueryResult<T> {
  data: T[]
  loading: boolean
  error: string | null
  refetch: () => void
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

  const filtersKey = JSON.stringify(options?.filters || {})

  React.useEffect(() => {
    async function fetch() {
      setLoading(true)
      setError(null)

      let query = supabase.from(table).select('*')

      if (options?.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          if (value !== null && value !== undefined && value !== '') {
            query = query.eq(key, value)
          }
        }
      }

      if (options?.orderBy) {
        query = query.order(options.orderBy, { ascending: options.orderAsc ?? false })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data: rows, error: err } = await query

      if (err) {
        setError(err.message)
        setData([])
      } else {
        setData((rows || []) as T[])
      }
      setLoading(false)
    }

    fetch()
  }, [supabase, table, options?.orderBy, options?.orderAsc, options?.limit, filtersKey, refetchKey])

  const refetch = React.useCallback(() => setRefetchKey(k => k + 1), [])

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

export function useCities() {
  return useSupabaseQuery<City>('cities', { orderBy: 'name', orderAsc: true })
}
export function useCityInsert() { return useSupabaseInsert<City>('cities') }

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

export function useProfiles() {
  return useSupabaseQuery<Profile>('profiles', { orderBy: 'full_name', orderAsc: true })
}

export function useQrCodes(filters?: Record<string, string>) {
  return useSupabaseQuery<QrCode>('qr_codes', { filters })
}
export function useQrCodeInsert() { return useSupabaseInsert<QrCode>('qr_codes') }
export function useQrCodeDelete() { return useSupabaseDelete('qr_codes') }

export function useMaterials(filters?: Record<string, string>) {
  return useSupabaseQuery<Material>('materials', { filters })
}
export function useMaterialInsert() { return useSupabaseInsert<Material>('materials') }

export function useCauseUpdate() { return useSupabaseUpdate<Cause>('causes') }

export function useNotes(filters?: Record<string, string>) {
  return useSupabaseQuery<Note>('notes', { filters })
}
export function useNoteInsert() { return useSupabaseInsert<Note>('notes') }

// ─── Count hooks ────────────────────────────────────────────

export function useCount(table: string, filters?: Record<string, string | number | boolean | null>) {
  const supabase = React.useMemo(() => createClient(), [])
  const [count, setCount] = React.useState(0)

  React.useEffect(() => {
    async function fetch() {
      let query = supabase.from(table).select('*', { count: 'exact', head: true })
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (value !== null && value !== undefined && value !== '') {
            query = query.eq(key, value)
          }
        }
      }
      const { count: c } = await query
      setCount(c || 0)
    }
    fetch()
  }, [supabase, table, JSON.stringify(filters)])

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
