'use client'

import * as React from 'react'

/**
 * The published template list behind every "pick a design and generate" surface.
 *
 * This was inlined in `TemplateLibraryPage`, which meant the Enabler Materials
 * tab and the onboarding "Generate materials" action would each have grown their
 * own copy of the same fetch — and with it their own idea of what counts as an
 * unusable template. Account-scoped callers include their verified business or
 * cause target so private campaign templates do not leak into other libraries.
 */
export interface PortalTemplate {
  id: number | string
  name: string
  sourcePath: string | null
  outputFormat?: string | null | undefined
}

export interface PortalTemplatesResult {
  templates: PortalTemplate[]
  /**
   * Templates the backend flagged but whose design file could not be loaded.
   * Surfaced as a count rather than dropped silently, so "I published it and it
   * never appeared" is answerable without reading server logs.
   */
  unusableCount: number
  loading: boolean
  error: string | null
  reload: () => void
}

export function usePortalTemplates(options?: {
  enabled?: boolean
  entityType?: 'business' | 'cause' | null
  accountId?: string | number | null
}): PortalTemplatesResult {
  const enabled = options?.enabled ?? true
  const entityType = options?.entityType ?? null
  const accountId = options?.accountId == null ? null : String(options.accountId)
  const [templates, setTemplates] = React.useState<PortalTemplate[]>([])
  const [unusableCount, setUnusableCount] = React.useState(0)
  const [loading, setLoading] = React.useState(enabled)
  const [error, setError] = React.useState<string | null>(null)

  const reload = React.useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (entityType && accountId) {
        params.set('entityType', entityType)
        params.set('accountId', accountId)
      }
      const res = await fetch(`/api/portal/templates${params.size ? `?${params}` : ''}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Could not load templates.')
      setTemplates(json.templates || [])
      setUnusableCount(Array.isArray(json.unusable) ? json.unusable.length : 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load templates.')
    } finally {
      setLoading(false)
    }
  }, [accountId, enabled, entityType])

  React.useEffect(() => { void reload() }, [reload])

  return { templates, unusableCount, loading, error, reload }
}
