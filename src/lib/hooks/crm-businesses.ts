import * as React from 'react'
import type {
  CrmBusinessDetailResponse,
  CrmBusinessesResponse,
  CrmCauseDetailResponse,
  CrmCausesResponse,
} from '@/lib/crm-api'

interface UseApiResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

async function readError(response: Response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null)
    if (payload && typeof payload.error === 'string') return payload.error
  }

  return response.text().catch(() => 'The request failed.')
}

function useApiJson<T>(url: string | null): UseApiResult<T> {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(Boolean(url))
  const [error, setError] = React.useState<string | null>(null)
  const [refetchKey, setRefetchKey] = React.useState(0)

  React.useEffect(() => {
    if (!url) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    async function fetchData() {
      const requestUrl = url
      if (!requestUrl) return

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(requestUrl, { cache: 'no-store' })
        if (!response.ok) {
          const message = await readError(response)
          throw new Error(message || `Request failed with ${response.status}.`)
        }

        const payload = await response.json()
        if (!cancelled) setData(payload)
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'The request failed.')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [url, refetchKey])

  const refetch = React.useCallback(() => {
    setRefetchKey(current => current + 1)
  }, [])

  return { data, loading, error, refetch }
}

export function useCrmBusinesses() {
  return useApiJson<CrmBusinessesResponse>('/api/crm/businesses')
}

export function useCrmBusiness(routeId: string | null, qaBusinessId: number | null = null) {
  const url = React.useMemo(() => {
    if (!routeId) return null
    const query = qaBusinessId !== null ? `?qaId=${qaBusinessId}` : ''
    return `/api/crm/businesses/${encodeURIComponent(routeId)}${query}`
  }, [qaBusinessId, routeId])

  return useApiJson<CrmBusinessDetailResponse>(url)
}

export function useCrmCauses() {
  return useApiJson<CrmCausesResponse>('/api/crm/causes')
}

export function useCrmCause(routeId: string | null, qaCauseId: number | null = null) {
  const url = React.useMemo(() => {
    if (!routeId) return null
    const query = qaCauseId !== null ? `?qaId=${qaCauseId}` : ''
    return `/api/crm/causes/${encodeURIComponent(routeId)}${query}`
  }, [qaCauseId, routeId])

  return useApiJson<CrmCauseDetailResponse>(url)
}
