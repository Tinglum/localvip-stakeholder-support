'use client'

import * as React from 'react'
import { FileText, FolderOpen, LayoutTemplate, Loader2, Search, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth/context'
import { useMaterialTemplates, useStakeholders } from '@/lib/supabase/hooks'
import { MATERIAL_LIBRARY_FOLDERS } from '@/lib/material-engine'
import type { MaterialTemplate, MaterialLibraryFolder } from '@/lib/types/database'

// ─── Helpers ───────────────────────────────────────────────

function getFolderLabel(folder: MaterialLibraryFolder) {
  return MATERIAL_LIBRARY_FOLDERS.find((f) => f.value === folder)?.label || folder
}

function getTemplateDescription(template: MaterialTemplate): string {
  const meta = template.metadata as Record<string, unknown> | null
  if (meta?.description && typeof meta.description === 'string') return meta.description
  return ''
}

function getTemplateBrand(template: MaterialTemplate): string | null {
  const meta = template.metadata as Record<string, unknown> | null
  if (meta?.brand && typeof meta.brand === 'string') return meta.brand
  return null
}

function getTemplateCity(template: MaterialTemplate): string | null {
  if (template.scope_cities?.length === 1) return template.scope_cities[0]
  return null
}

// ─── Component ─────────────────────────────────────────────

export function TemplateLibraryPage() {
  const { profile } = useAuth()

  // Resolve stakeholder for the current user — match broadly like the materials page
  const { data: stakeholders, loading: stakeholdersLoading } = useStakeholders()

  const stakeholder = React.useMemo(() => {
    if (stakeholders.length === 0) return null
    // Find any stakeholder linked to the current user
    const match = stakeholders.find((s) => {
      if (s.profile_id === profile.id || s.owner_user_id === profile.id) return true
      if (profile.business_id && s.business_id === profile.business_id) return true
      if (profile.organization_id && s.organization_id === profile.organization_id) return true
      return false
    })
    if (match) return match
    // Fallback: prefer business type
    return (
      stakeholders.find((s) => s.type === 'business') ||
      stakeholders.find((s) => ['cause', 'school'].includes(s.type)) ||
      null
    )
  }, [stakeholders, profile])

  // Fetch all active selfserve templates
  const { data: allTemplates, loading: templatesLoading } = useMaterialTemplates({
    is_active: 'true',
  } as Record<string, string>)

  // Filter to selfserve only and by stakeholder type
  const selfserveTemplates = React.useMemo(() => {
    return allTemplates.filter((t) => {
      if (!t.tiers.includes('selfserve')) return false

      // Filter by stakeholder type if we know it
      if (stakeholder && t.stakeholder_types.length > 0) {
        const st = stakeholder.type
        if (!t.stakeholder_types.includes(st)) {
          // Allow cause/school to see community templates
          if ((st === 'cause' || st === 'school') && t.stakeholder_types.includes('community')) return true
          return false
        }
      }

      return true
    })
  }, [allTemplates, stakeholder])

  // ─── Filters ─────────────────────────────────────

  const [search, setSearch] = React.useState('')
  const [brandFilter, setBrandFilter] = React.useState<string | null>(null)
  const [cityFilter, setCityFilter] = React.useState<string | null>(null)
  const [typeFilter, setTypeFilter] = React.useState<string | null>(null)

  // Derive available filter values
  const filterOptions = React.useMemo(() => {
    const brands = new Set<string>()
    const cities = new Set<string>()
    const types = new Set<string>()

    for (const t of selfserveTemplates) {
      const brand = getTemplateBrand(t)
      if (brand) brands.add(brand)
      const city = getTemplateCity(t)
      if (city) cities.add(city)
      for (const st of t.stakeholder_types) {
        types.add(st)
      }
    }

    return {
      brands: Array.from(brands).sort(),
      cities: Array.from(cities).sort(),
      types: Array.from(types).sort(),
    }
  }, [selfserveTemplates])

  // Apply filters
  const filtered = React.useMemo(() => {
    return selfserveTemplates.filter((t) => {
      if (search) {
        const q = search.toLowerCase()
        const desc = getTemplateDescription(t)
        if (
          !t.name.toLowerCase().includes(q) &&
          !desc.toLowerCase().includes(q) &&
          !t.audience_tags.some((tag) => tag.toLowerCase().includes(q))
        ) {
          return false
        }
      }

      if (brandFilter) {
        const brand = getTemplateBrand(t)
        if (brand !== brandFilter) return false
      }

      if (cityFilter) {
        if (!t.scope_cities.includes(cityFilter)) return false
      }

      if (typeFilter) {
        if (t.stakeholder_types.length > 0 && !t.stakeholder_types.includes(typeFilter as any)) {
          return false
        }
      }

      return true
    })
  }, [selfserveTemplates, search, brandFilter, cityFilter, typeFilter])

  // ─── Preview & Generate Dialog ───────────────────

  const [selectedTemplate, setSelectedTemplate] = React.useState<MaterialTemplate | null>(null)
  const [generating, setGenerating] = React.useState(false)

  async function handleGenerate() {
    if (!selectedTemplate || !stakeholder) return

    setGenerating(true)
    try {
      const res = await fetch('/api/portal/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stakeholderId: stakeholder.id,
          templateId: selectedTemplate.id,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to generate material.')
        return
      }

      toast.success(`"${selectedTemplate.name}" has been added to your materials library.`)
      setSelectedTemplate(null)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // ─── Loading / empty states ──────────────────────

  const isLoading = templatesLoading || stakeholdersLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
      </div>
    )
  }

  if (!stakeholder) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Template Library"
          description="Browse and add templates to your materials library."
        />
        <EmptyState
          icon={<LayoutTemplate className="h-10 w-10 text-surface-300" />}
          title="No stakeholder profile found"
          description="Your account does not have a stakeholder profile linked yet. Please contact support for assistance."
        />
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Template Library"
        description="Browse available templates and add them to your materials library with one click."
      />

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {(filterOptions.brands.length > 1 || filterOptions.cities.length > 1 || filterOptions.types.length > 1) && (
          <div className="flex flex-wrap items-center gap-2">
            {filterOptions.brands.length > 1 && (
              <>
                <span className="text-xs font-medium text-surface-500">Brand:</span>
                {filterOptions.brands.map((b) => (
                  <button
                    key={b}
                    onClick={() => setBrandFilter(brandFilter === b ? null : b)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      brandFilter === b
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </>
            )}

            {filterOptions.cities.length > 1 && (
              <>
                <span className="ml-2 text-xs font-medium text-surface-500">City:</span>
                {filterOptions.cities.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCityFilter(cityFilter === c ? null : c)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      cityFilter === c
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </>
            )}

            {filterOptions.types.length > 1 && (
              <>
                <span className="ml-2 text-xs font-medium text-surface-500">Type:</span>
                {filterOptions.types.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      typeFilter === t
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </>
            )}

            {(brandFilter || cityFilter || typeFilter) && (
              <button
                onClick={() => {
                  setBrandFilter(null)
                  setCityFilter(null)
                  setTypeFilter(null)
                }}
                className="ml-1 text-xs text-surface-400 hover:text-surface-600 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Template Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10 text-surface-300" />}
          title="No templates found"
          description={search || brandFilter || cityFilter || typeFilter
            ? 'Try adjusting your search or filters.'
            : 'No self-serve templates are available at this time.'}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => {
            const description = getTemplateDescription(template)
            const folderLabel = getFolderLabel(template.library_folder)

            return (
              <Card key={template.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-sm">{template.name}</CardTitle>
                  {description && (
                    <p className="text-xs text-surface-500 line-clamp-2">{description}</p>
                  )}
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    {template.audience_tags.map((tag) => (
                      <Badge key={tag} variant="default">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 text-xs text-surface-400">
                    <FolderOpen className="h-3.5 w-3.5" />
                    {folderLabel}
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedTemplate(template)}
                    className="w-full"
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Preview & Add
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {/* Preview & Add Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              {getTemplateDescription(selectedTemplate!)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedTemplate && (
              <>
                {selectedTemplate.audience_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTemplate.audience_tags.map((tag) => (
                      <Badge key={tag} variant="default">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-sm text-surface-500">
                  <FolderOpen className="h-4 w-4" />
                  {getFolderLabel(selectedTemplate.library_folder)}
                </div>

                <div className="rounded-lg border border-surface-100 bg-surface-50 p-3 text-sm text-surface-600">
                  This will be generated with your business details and QR code. The finished material
                  will appear in your materials library.
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Add to My Materials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
