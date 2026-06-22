'use client'

/**
 * QA-BACKED HOOKS (was: Supabase hooks)
 *
 * Drop-in replacement for the original Supabase hooks. Same signatures,
 * same return shapes, but all data flows through `/api/qa/dashboard/{table}`
 * which proxies to the .NET QA backend on https://localhost:5001.
 *
 * Pages don't need to change their imports — they keep calling things like
 * `useContacts()` and get backend data.
 */

import * as React from 'react'
import type {
  Business, Cause, Contact, City, Campaign, Task, OutreachActivity, Profile, QrCode, Note, Material, Organization,
  StakeholderAssignment, OnboardingFlow, OnboardingStep, OutreachScript, MaterialAssignment, QrCodeCollection,
  Offer, BusinessReferral, CityAccessRequest, AuditLog, Stakeholder, StakeholderCode, MaterialTemplate,
  GeneratedMaterial, AdminTask, Notification, TemplateRule,
} from '@/lib/types/database'

// ─── Generic fetch hook ─────────────────────────────────────

interface UseQueryResult<T> {
  data: T[]
  loading: boolean
  error: string | null
  refetch: (options?: { silent?: boolean }) => void
}

interface UseQueryOptions {
  enabled?: boolean
}

const QA_QUERY_TIMEOUT_MS = 15000

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = QA_QUERY_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then((value) => {
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        window.clearTimeout(timer)
        reject(error)
      })
  })
}

function buildQueryString(filters?: Record<string, string | number | boolean | null>) {
  if (!filters) return ''
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === undefined || v === '') continue
    params.append(k, String(v))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

function mapQaBusinessRecordToBusiness(b: Record<string, unknown>): Business {
  return {
    id: String(b.id),
    name: String(b.name || ''),
    email: (b.ownerEmail as string) || null,
    phone: (b.ownerPhone as string) || null,
    website: null,
    category: null,
    public_description: (b.description as string) || null,
    address: (b.fullAddress as string) || (b.address1 as string) || null,
    city: (b.city as string) || null,
    state: (b.state as string) || null,
    country: (b.country as string) || null,
    zip: (b.zipCode as string) || null,
    owner_id: null,
    owner_user_id: null,
    city_id: null,
    brand: 'localvip',
    stage: 'lead',
    status: b.active ? 'active' : 'inactive',
    // Route QA filenames through same-origin proxies so setup previews and
    // completion state can rehydrate after a page reload.
    logo_url: b.imageUrl
      ? (/^https?:\/\//i.test(String(b.imageUrl)) ? String(b.imageUrl) : `/api/qa/businesses/${b.id}/logo`)
      : null,
    cover_photo_url: b.coverPhotoUrl
      ? (/^https?:\/\//i.test(String(b.coverPhotoUrl)) ? String(b.coverPhotoUrl) : `/api/qa/businesses/${b.id}/cover`)
      : null,
    metadata: { qaId: b.id, qaBusinessId: b.id, headline: b.headline },
    created_at: (b.createdDate as string) || new Date().toISOString(),
    updated_at: (b.updatedDate as string) || new Date().toISOString(),
  } as unknown as Business
}

function useQaQuery<T>(
  table: string,
  options?: {
    orderBy?: string
    orderAsc?: boolean
    limit?: number
    filters?: Record<string, string | number | boolean | null>
    enabled?: boolean
  },
): UseQueryResult<T> {
  const [data, setData] = React.useState<T[]>([])
  const [loading, setLoading] = React.useState(options?.enabled ?? true)
  const [error, setError] = React.useState<string | null>(null)
  const [refetchKey, setRefetchKey] = React.useState(0)
  const silentRefetchRef = React.useRef(false)

  const enabled = options?.enabled ?? true
  const filtersKey = JSON.stringify(options?.filters || {})

  React.useEffect(() => {
    if (!enabled) {
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    async function run() {
      if (!silentRefetchRef.current) setLoading(true)
      setError(null)

      try {
        const filters = JSON.parse(filtersKey) as Record<string, string | number | boolean | null>
        const qs = buildQueryString(filters)
        const res = await withTimeout(
          fetch(`/api/qa/dashboard/${table}${qs}`, { cache: 'no-store' }),
          `${table} query`,
        )

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(text || `${table} request failed with ${res.status}`)
        }

        const json = await res.json().catch(() => [])
        const rows = Array.isArray(json) ? json : []

        if (cancelled) return

        // Client-side sort if orderBy provided
        let sorted = rows as T[]
        if (options?.orderBy) {
          const orderBy = options.orderBy
          const orderAsc = options.orderAsc ?? false
          sorted = [...sorted].sort((a, b) => {
            const av = (a as Record<string, unknown>)[orderBy]
            const bv = (b as Record<string, unknown>)[orderBy]
            if (av === bv) return 0
            if (av == null) return orderAsc ? -1 : 1
            if (bv == null) return orderAsc ? 1 : -1
            if (av < bv) return orderAsc ? -1 : 1
            return orderAsc ? 1 : -1
          })
        }

        // Client-side limit
        if (options?.limit && sorted.length > options.limit) {
          sorted = sorted.slice(0, options.limit)
        }

        setData(sorted)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : `Failed to load ${table}.`)
        setData([])
      } finally {
        if (!cancelled) {
          setLoading(false)
          silentRefetchRef.current = false
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [table, filtersKey, options?.orderBy, options?.orderAsc, options?.limit, enabled, refetchKey])

  const refetch = React.useCallback((opts?: { silent?: boolean }) => {
    silentRefetchRef.current = !!opts?.silent
    setRefetchKey((k) => k + 1)
  }, [])

  return { data, loading, error, refetch }
}

function useQaInsert<T>(table: string) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const insert = React.useCallback(async (record: Partial<T>): Promise<T | null> => {
    setLoading(true)
    setError(null)

    try {
      const res = await withTimeout(
        fetch(`/api/qa/dashboard/${table}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(record),
        }),
        `${table} create`,
      )

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        let msg = `${table} create failed with ${res.status}`
        try {
          const parsed = JSON.parse(text)
          msg = parsed?.error || msg
        } catch {
          if (text) msg = text
        }
        setError(msg)
        return null
      }

      return (await res.json()) as T
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to create ${table}.`)
      return null
    } finally {
      setLoading(false)
    }
  }, [table])

  return { insert, loading, error }
}

function useQaUpdate<T>(table: string) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const update = React.useCallback(async (id: string | number, changes: Partial<T>): Promise<T | null> => {
    setLoading(true)
    setError(null)

    try {
      const res = await withTimeout(
        fetch(`/api/qa/dashboard/${table}/${id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(changes),
        }),
        `${table} update`,
      )

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        setError(text || `${table} update failed with ${res.status}`)
        return null
      }

      return (await res.json()) as T
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to update ${table}.`)
      return null
    } finally {
      setLoading(false)
    }
  }, [table])

  return { update, loading, error }
}

function useQaDelete(table: string) {
  const remove = React.useCallback(async (id: string | number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/qa/dashboard/${table}/${id}`, { method: 'DELETE' })
      return res.ok
    } catch {
      return false
    }
  }, [table])

  return { remove }
}

// ─── Typed hooks (drop-in replacements for the original Supabase hooks) ────

function useQaArrayEndpoint<T>(
  url: string | null,
  options?: {
    orderBy?: string
    orderAsc?: boolean
    enabled?: boolean
  },
): UseQueryResult<T> {
  const [data, setData] = React.useState<T[]>([])
  const [loading, setLoading] = React.useState(options?.enabled ?? true)
  const [error, setError] = React.useState<string | null>(null)
  const [refetchKey, setRefetchKey] = React.useState(0)
  const silentRefetchRef = React.useRef(false)
  const enabled = options?.enabled ?? true

  React.useEffect(() => {
    if (!enabled || !url) {
      setLoading(false)
      if (!url) setData([])
      return
    }

    let cancelled = false

    async function run() {
      if (!silentRefetchRef.current) setLoading(true)
      setError(null)

      try {
        const requestUrl = url
        if (!requestUrl) return
        const res = await withTimeout(fetch(requestUrl, { cache: 'no-store' }), `${requestUrl} query`)
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(text || `Request failed with ${res.status}`)
        }

        const json = await res.json().catch(() => null)
        const rows = Array.isArray(json) ? json : json == null ? [] : [json]

        let sorted = rows as T[]
        if (options?.orderBy) {
          const orderBy = options.orderBy
          const orderAsc = options.orderAsc ?? false
          sorted = [...sorted].sort((a, b) => {
            const av = (a as Record<string, unknown>)[orderBy]
            const bv = (b as Record<string, unknown>)[orderBy]
            if (av === bv) return 0
            if (av == null) return orderAsc ? -1 : 1
            if (bv == null) return orderAsc ? 1 : -1
            if (av < bv) return orderAsc ? -1 : 1
            return orderAsc ? 1 : -1
          })
        }

        if (!cancelled) setData(sorted)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data.')
          setData([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          silentRefetchRef.current = false
        }
      }
    }

    run()
    return () => { cancelled = true }
  }, [url, enabled, options?.orderBy, options?.orderAsc, refetchKey])

  const refetch = React.useCallback((opts?: { silent?: boolean }) => {
    silentRefetchRef.current = !!opts?.silent
    setRefetchKey((k) => k + 1)
  }, [])

  return { data, loading, error, refetch }
}

export function useBusinesses(filters?: Record<string, string>, options?: UseQueryOptions) {
  // businesses live in /api/qa/businesses (existing route) — not /api/qa/dashboard/businesses
  const [data, setData] = React.useState<Business[]>([])
  const [loading, setLoading] = React.useState(options?.enabled ?? true)
  const [error, setError] = React.useState<string | null>(null)
  const [refetchKey, setRefetchKey] = React.useState(0)
  const enabled = options?.enabled ?? true
  const filtersKey = JSON.stringify(filters || {})

  React.useEffect(() => {
    if (!enabled) { setLoading(false); return }
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const parsedFilters = JSON.parse(filtersKey) as Record<string, string>
        const scopedId = (parsedFilters.id || parsedFilters.qaId || '').trim()
        const endpoint = /^\d+$/.test(scopedId)
          ? `/api/qa/businesses/${scopedId}`
          : `/api/qa/businesses${buildQueryString(parsedFilters)}`
        const res = await fetch(endpoint, { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load businesses.')
        const json = await res.json()
        const arr = Array.isArray(json) ? json : (json ? [json] : [])
        // QA list shape → Supabase Business shape (best effort)
        const mapped: Business[] = arr.map((b: Record<string, unknown>) => mapQaBusinessRecordToBusiness(b))
        if (!cancelled) setData(mapped)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [filtersKey, enabled, refetchKey])

  const refetch = React.useCallback((_opts?: { silent?: boolean }) => setRefetchKey((k) => k + 1), [])
  return { data, loading, error, refetch }
}
export function useBusinessInsert() {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const insert = React.useCallback(async (record: Partial<Business>): Promise<Business | null> => {
    setLoading(true)
    setError(null)
    try {
      const res = await withTimeout(
        fetch('/api/qa/businesses', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(record),
        }),
        'business create',
      )
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `business create failed with ${res.status}`)
      }
      return (await res.json()) as Business
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create business.')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { insert, loading, error }
}
export function useBusinessUpdate() {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const update = React.useCallback(async (id: string | number, changes: Partial<Business>): Promise<Business | null> => {
    setLoading(true)
    setError(null)

    try {
      const res = await withTimeout(
        fetch(`/api/qa/businesses/${id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(changes),
        }),
        'business update',
      )

      if (!res.ok) {
        const contentType = res.headers.get('content-type') || ''
        const message = contentType.includes('application/json')
          ? ((await res.json().catch(() => ({}))) as { error?: string }).error
          : await res.text().catch(() => '')
        setError(message || `business update failed with ${res.status}`)
        return null
      }

      return (await res.json()) as Business
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update business.')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { update, loading, error }
}

export function useCauses(filters?: Record<string, string>, options?: UseQueryOptions) {
  const [data, setData] = React.useState<Cause[]>([])
  const [loading, setLoading] = React.useState(options?.enabled ?? true)
  const [error, setError] = React.useState<string | null>(null)
  const [refetchKey, setRefetchKey] = React.useState(0)
  const enabled = options?.enabled ?? true
  const filtersKey = JSON.stringify(filters || {})

  React.useEffect(() => {
    if (!enabled) { setLoading(false); return }
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/qa/nonprofits', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load causes.')
        const json = await res.json()
        const arr = Array.isArray(json) ? json : []
        const mapped: Cause[] = arr.map((c: Record<string, unknown>) => ({
          id: String(c.id),
          name: String(c.name || ''),
          email: (c.ownerEmail as string) || null,
          phone: (c.ownerPhone as string) || null,
          city: (c.city as string) || null,
          state: (c.state as string) || null,
          country: (c.country as string) || null,
          type: 'nonprofit',
          owner_id: null,
          owner_user_id: null,
          city_id: null,
          brand: 'localvip',
          stage: 'lead',
          status: c.active ? 'active' : 'inactive',
          metadata: { qaId: c.id, headline: c.headline },
          created_at: (c.createdDate as string) || new Date().toISOString(),
          updated_at: (c.updatedDate as string) || new Date().toISOString(),
        } as unknown as Cause))
        if (!cancelled) setData(mapped)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [filtersKey, enabled, refetchKey])

  const refetch = React.useCallback((_opts?: { silent?: boolean }) => setRefetchKey((k) => k + 1), [])
  return { data, loading, error, refetch }
}
export function useCauseInsert() { return useQaInsert<Cause>('causes') }
export function useCauseUpdate() { return useQaUpdate<Cause>('causes') }

export function useContacts(filters?: Record<string, string>, options?: UseQueryOptions) {
  return useQaQuery<Contact>('contacts', { filters, enabled: options?.enabled })
}
export function useContactInsert() { return useQaInsert<Contact>('contacts') }
export function useContactUpdate() { return useQaUpdate<Contact>('contacts') }
export function useContactDelete() { return useQaDelete('contacts') }

export function useStakeholderAssignments(_filters?: Record<string, string>, _options?: UseQueryOptions) {
  return useQaQuery<StakeholderAssignment>('stakeholder_assignments')
}
export function useStakeholders(filters?: Record<string, string>, options?: UseQueryOptions) {
  return useQaQuery<Stakeholder>('stakeholders', { filters, orderBy: 'updated_at', enabled: options?.enabled })
}
export function useStakeholderInsert() { return useQaInsert<Stakeholder>('stakeholders') }
export function useStakeholderUpdate() { return useQaUpdate<Stakeholder>('stakeholders') }
export function useStakeholderCodes(filters?: Record<string, string>, options?: UseQueryOptions) {
  const stakeholderId = filters?.stakeholder_id
  const useDirectPath = !!stakeholderId && /^\d+$/.test(stakeholderId)
  const direct = useQaArrayEndpoint<StakeholderCode>(
    useDirectPath ? `/api/qa/dashboard/stakeholder_codes/${encodeURIComponent(stakeholderId)}` : null,
    { orderBy: 'updated_at', enabled: (options?.enabled ?? true) && useDirectPath },
  )
  const fallback = useQaQuery<StakeholderCode>('stakeholder_codes', {
    filters,
    orderBy: 'updated_at',
    enabled: (options?.enabled ?? true) && !useDirectPath,
  })
  return useDirectPath ? direct : fallback
}
export function useStakeholderCodeInsert() { return useQaInsert<StakeholderCode>('stakeholder_codes') }
export function useStakeholderCodeUpdate() { return useQaUpdate<StakeholderCode>('stakeholder_codes') }

export function useMaterialTemplates(filters?: Record<string, string>) {
  return useQaQuery<MaterialTemplate>('material_templates', { filters, orderBy: 'updated_at' })
}
export function useMaterialTemplateInsert() { return useQaInsert<MaterialTemplate>('material_templates') }
export function useMaterialTemplateUpdate() { return useQaUpdate<MaterialTemplate>('material_templates') }

export function useGeneratedMaterials(filters?: Record<string, string>, options?: UseQueryOptions) {
  return useQaQuery<GeneratedMaterial>('generated_materials', { filters, orderBy: 'updated_at', enabled: options?.enabled })
}
export function useGeneratedMaterialInsert() { return useQaInsert<GeneratedMaterial>('generated_materials') }
export function useGeneratedMaterialUpdate() { return useQaUpdate<GeneratedMaterial>('generated_materials') }

export function useAdminTasks(_filters?: Record<string, string>, _options?: UseQueryOptions) {
  return useQaQuery<AdminTask>('admin_tasks')
}
export function useAdminTaskInsert() { return useQaInsert<AdminTask>('admin_tasks') }
export function useAdminTaskUpdate() { return useQaUpdate<AdminTask>('admin_tasks') }

export function useBusinessReferrals(_filters?: Record<string, string>) {
  return useQaQuery<BusinessReferral>('business_referrals')
}
export function useBusinessReferralInsert() { return useQaInsert<BusinessReferral>('business_referrals') }

export function useCityAccessRequests(_filters?: Record<string, string>) {
  return useQaQuery<CityAccessRequest>('city_access_requests')
}
export function useCityAccessRequestInsert() { return useQaInsert<CityAccessRequest>('city_access_requests') }
export function useCityAccessRequestUpdate() { return useQaUpdate<CityAccessRequest>('city_access_requests') }

export function useCities(options?: UseQueryOptions) {
  return useQaQuery<City>('cities', { orderBy: 'name', orderAsc: true, enabled: options?.enabled })
}
export function useCityInsert() { return useQaInsert<City>('cities') }

export function useOrganizations(_filters?: Record<string, string>) {
  return useQaQuery<Organization>('organizations')
}

export function useCampaigns(filters?: Record<string, string>, options?: UseQueryOptions) {
  return useQaQuery<Campaign>('campaigns', { filters, enabled: options?.enabled })
}
export function useCampaignInsert() { return useQaInsert<Campaign>('campaigns') }

export function useOffers(filters?: Record<string, string>, options?: UseQueryOptions) {
  return useQaQuery<Offer>('offers', { filters, enabled: options?.enabled })
}
export function useOfferInsert() { return useQaInsert<Offer>('offers') }
export function useOfferUpdate() { return useQaUpdate<Offer>('offers') }

// LocalVIP Deal (the consumer-app cashback deal) — distinct from the 100-list Offer.
export interface QaDealRow {
  id: string
  business_account_id: string | null
  cash_back: number
  description: string | null
  active: boolean
  is_recurring: boolean
  days_of_week_mask: number | null
  daily_start_minutes: number | null
  daily_end_minutes: number | null
  start_date: string | null
  end_date: string | null
  updated_date?: string | null
}
export function useDeals(filters?: Record<string, string>, options?: UseQueryOptions) {
  return useQaQuery<QaDealRow>('deals', { filters, enabled: options?.enabled })
}
export function useDealInsert() { return useQaInsert<QaDealRow>('deals') }
export function useDealUpdate() { return useQaUpdate<QaDealRow>('deals') }
export function useDealDelete() { return useQaDelete('deals') }

export function useTasks(filters?: Record<string, string>, options?: UseQueryOptions) {
  return useQaQuery<Task>('tasks', { filters, enabled: options?.enabled })
}
export function useTaskInsert() { return useQaInsert<Task>('tasks') }
export function useTaskUpdate() { return useQaUpdate<Task>('tasks') }

export function useOutreach(filters?: Record<string, string>, options?: UseQueryOptions) {
  return useQaQuery<OutreachActivity>('outreach_activities', { filters, enabled: options?.enabled })
}
export function useOutreachInsert() { return useQaInsert<OutreachActivity>('outreach_activities') }

export function useOutreachScripts(_filters?: Record<string, string>) {
  return useQaQuery<OutreachScript>('outreach_scripts')
}
export function useOutreachScriptInsert() { return useQaInsert<OutreachScript>('outreach_scripts') }
export function useOutreachScriptUpdate() { return useQaUpdate<OutreachScript>('outreach_scripts') }

export function useProfiles(options?: UseQueryOptions) {
  return useQaQuery<Profile>('profiles', { orderBy: 'full_name', orderAsc: true, enabled: options?.enabled })
}
export function useProfileUpdate() { return useQaUpdate<Profile>('profiles') }

export function useQrCodes(filters?: Record<string, string>, options?: UseQueryOptions) {
  const normalizedFilters = React.useMemo(() => {
    if (!filters) return filters
    if (filters.entity_id || filters.entity_type) return filters
    if (filters.business_id) {
      const { business_id, ...rest } = filters
      return { ...rest, entity_type: 'business', entity_id: business_id }
    }
    if (filters.cause_id) {
      const { cause_id, ...rest } = filters
      return { ...rest, entity_type: 'cause', entity_id: cause_id }
    }
    if (filters.contact_id) {
      const { contact_id, ...rest } = filters
      return { ...rest, entity_type: 'contact', entity_id: contact_id }
    }
    return filters
  }, [filters])

  const createdBy = normalizedFilters?.created_by || null
  const backendFilters = React.useMemo(() => {
    if (!normalizedFilters) return normalizedFilters
    if (!createdBy) return normalizedFilters

    const { created_by: _createdBy, ...rest } = normalizedFilters
    return { ...rest, pageSize: 250 }
  }, [createdBy, normalizedFilters])
  const query = useQaQuery<QrCode>('qr_codes', { filters: backendFilters, enabled: options?.enabled })
  const data = React.useMemo(() => {
    if (!createdBy) return query.data
    return query.data.filter((item) => String(item.created_by || '') === String(createdBy))
  }, [createdBy, query.data])

  return { ...query, data }
}
export function useQrCodeCollections(_filters?: Record<string, string>) {
  return useQaQuery<QrCodeCollection>('qr_code_collections')
}
export function useQrCodeCollectionInsert() { return useQaInsert<QrCodeCollection>('qr_code_collections') }
export function useQrCodeCollectionUpdate() { return useQaUpdate<QrCodeCollection>('qr_code_collections') }
export function useQrCodeInsert() { return useQaInsert<QrCode>('qr_codes') }
export function useQrCodeDelete() { return useQaDelete('qr_codes') }

export function useMaterials(_filters?: Record<string, string>, _options?: UseQueryOptions) {
  return useQaQuery<Material>('materials')
}
export function useMaterialInsert() { return useQaInsert<Material>('materials') }
export function useMaterialUpdate() { return useQaUpdate<Material>('materials') }
export function useMaterialAssignments(_filters?: Record<string, string>) {
  return useQaQuery<MaterialAssignment>('material_assignments')
}

export function useStakeholderAssignmentInsert() { return useQaInsert<StakeholderAssignment>('stakeholder_assignments') }
export function useStakeholderAssignmentUpdate() { return useQaUpdate<StakeholderAssignment>('stakeholder_assignments') }
export function useStakeholderAssignmentDelete() { return useQaDelete('stakeholder_assignments') }
export function useAuditLogInsert() { return useQaInsert<AuditLog>('audit_logs') }

export function useNotifications(filters?: Record<string, string>) {
  return useQaQuery<Notification>('notifications', { filters })
}
export function useNotificationUpdate() { return useQaUpdate<Notification>('notifications') }

export function useTemplateRules(_filters?: Record<string, string>) {
  return useQaQuery<TemplateRule>('template_rules', { orderBy: 'priority' })
}
export function useTemplateRuleInsert() { return useQaInsert<TemplateRule>('template_rules') }
export function useTemplateRuleUpdate() { return useQaUpdate<TemplateRule>('template_rules') }
export function useTemplateRuleDelete() { return useQaDelete('template_rules') }

export function useNotes(filters?: Record<string, string>, options?: UseQueryOptions) {
  return useQaQuery<Note>('notes', { filters, enabled: options?.enabled })
}
export function useNoteInsert() { return useQaInsert<Note>('notes') }

export function useOnboardingFlows(filters?: Record<string, string>, options?: UseQueryOptions) {
  return useQaQuery<OnboardingFlow>('onboarding_flows', { filters, enabled: options?.enabled })
}
export function useOnboardingFlowInsert() { return useQaInsert<OnboardingFlow>('onboarding_flows') }
export function useOnboardingFlowUpdate() { return useQaUpdate<OnboardingFlow>('onboarding_flows') }

export function useOnboardingSteps(filters?: Record<string, string>, options?: UseQueryOptions) {
  const flowId = filters?.flow_id
  const useDirectPath = !!flowId && /^\d+$/.test(flowId)
  const direct = useQaArrayEndpoint<OnboardingStep>(
    useDirectPath ? `/api/qa/onboarding-flows/${encodeURIComponent(flowId)}/steps` : null,
    { orderBy: 'sort_order', orderAsc: true, enabled: (options?.enabled ?? true) && useDirectPath },
  )
  const fallback = useQaQuery<OnboardingStep>('onboarding_steps', {
    filters,
    orderBy: 'sort_order',
    orderAsc: true,
    enabled: (options?.enabled ?? true) && !useDirectPath,
  })
  return useDirectPath ? direct : fallback
}
export function useOnboardingStepInsert() { return useQaInsert<OnboardingStep>('onboarding_steps') }
export function useOnboardingStepUpdate() { return useQaUpdate<OnboardingStep>('onboarding_steps') }

// ─── Count hooks ────────────────────────────────────────────

const COUNT_ROUTE_OVERRIDES: Record<string, string> = {
  businesses: '/api/qa/businesses',
  causes: '/api/qa/nonprofits',
}

export function useCount(table: string, filters?: Record<string, string | number | boolean | null>) {
  const [count, setCount] = React.useState(0)
  const filtersKey = JSON.stringify(filters || {})

  React.useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const filters = JSON.parse(filtersKey) as Record<string, string | number | boolean | null>
        const qs = buildQueryString(filters)
        const baseUrl = COUNT_ROUTE_OVERRIDES[table] || `/api/qa/dashboard/${table}`
        const res = await fetch(baseUrl + qs, { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        const arr = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : []
        if (!cancelled) setCount(arr.length)
      } catch {
        if (!cancelled) setCount(0)
      }
    }
    run()
    return () => { cancelled = true }
  }, [table, filtersKey])

  return count
}

// ─── Single record hook ─────────────────────────────────────

export function useRecord<T>(table: string, id: string | null) {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!id) { setLoading(false); return }
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const res = await fetch(`/api/qa/dashboard/${table}/${id}`, { cache: 'no-store' })
        if (!res.ok) { if (!cancelled) setData(null); return }
        const json = await res.json()
        if (!cancelled) setData(json as T)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [table, id])

  return { data, loading }
}
