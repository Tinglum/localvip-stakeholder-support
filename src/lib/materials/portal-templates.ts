'use client'

import * as React from 'react'

/**
 * The published template list behind every "pick a design and generate" surface.
 *
 * This was inlined in `TemplateLibraryPage`, which meant the Enabler Materials
 * tab and the onboarding "Generate materials" action would each have grown their
 * own copy of the same fetch — and with it their own idea of what counts as an
 * unusable template. `/api/portal/templates` is authenticated-only (it is not
 * business-scoped), so every role that can reach a generate surface can list it.
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

export function usePortalTemplates(options?: { enabled?: boolean }): PortalTemplatesResult {
  const enabled = options?.enabled ?? true
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
      const res = await fetch('/api/portal/templates', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Could not load templates.')
      setTemplates(json.templates || [])
      setUnusableCount(Array.isArray(json.unusable) ? json.unusable.length : 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load templates.')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  React.useEffect(() => { void reload() }, [reload])

  return { templates, unusableCount, loading, error, reload }
}
