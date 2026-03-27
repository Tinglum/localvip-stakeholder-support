'use client'

import * as React from 'react'
import {
  Copy,
  Download,
  Eye,
  FileText,
  Grid,
  List,
  Search,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { MaterialPreviewFrame } from '@/components/ui/material-preview-frame'
import { MaterialPreviewDialog } from '@/components/materials/material-preview-dialog'
import { BRANDS, MATERIAL_TYPES } from '@/lib/constants'
import { useMaterials } from '@/lib/supabase/hooks'
import { formatDate } from '@/lib/utils'
import type { Material } from '@/lib/types/database'

function isBusinessMaterial(material: Material) {
  return (
    ['customer_capture', 'localvip_live', 'business_to_business', 'business_to_consumer'].includes(material.category || '')
    || material.target_roles.includes('business')
  )
}

function labelForBusinessCategory(category?: string | null) {
  switch (category) {
    case 'customer_capture':
      return 'Customer Capture'
    case 'localvip_live':
      return 'LocalVIP Live'
    case 'business_to_business':
      return 'Business to Business'
    default:
      return 'Business to Consumer'
  }
}

export function BusinessMaterialsPage() {
  const { data: materials, loading, error } = useMaterials()
  const [search, setSearch] = React.useState('')
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid')
  const [previewMaterial, setPreviewMaterial] = React.useState<Material | null>(null)
  const [copyMessage, setCopyMessage] = React.useState<string | null>(null)

  const filtered = React.useMemo(() => {
    return materials
      .filter(isBusinessMaterial)
      .filter((material) => {
        if (!search) return true
        const query = search.toLowerCase()
        return material.title.toLowerCase().includes(query)
          || (material.description || '').toLowerCase().includes(query)
      })
  }, [materials, search])

  const handleCopy = async (material: Material) => {
    if (!material.file_url) return
    await navigator.clipboard.writeText(material.file_url)
    setCopyMessage(`${material.title} link copied.`)
    window.setTimeout(() => setCopyMessage(null), 1800)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materials"
        description="Only the business-facing materials that help you collect your first 100 customers, explain LocalVIP live, or invite other businesses."
      />

      <MaterialPreviewDialog
        material={previewMaterial}
        open={!!previewMaterial}
        onOpenChange={(open) => {
          if (!open) setPreviewMaterial(null)
        }}
      />

      <Card className="overflow-hidden border-surface-200">
        <div className="bg-gradient-to-r from-amber-50 via-white to-lime-50 px-6 py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-surface-900">Customer-facing only</p>
              <p className="mt-1 max-w-2xl text-sm text-surface-600">
                These are the simple flyers, scripts, and handouts meant for business owners talking to real customers.
              </p>
            </div>
            <div className="rounded-2xl border border-white/90 bg-white/85 px-4 py-3 text-center shadow-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Available</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900">{filtered.length}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search materials..."
            className="pl-9"
          />
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-surface-200 bg-surface-0 p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded-md p-1.5 ${viewMode === 'grid' ? 'bg-surface-100 text-surface-700' : 'text-surface-400 hover:text-surface-600'}`}
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-md p-1.5 ${viewMode === 'list' ? 'bg-surface-100 text-surface-700' : 'text-surface-400 hover:text-surface-600'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      {copyMessage && (
        <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
          {copyMessage}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <div className="h-44 bg-surface-100" />
              <CardContent className="space-y-2 p-4">
                <div className="h-4 w-2/3 rounded bg-surface-100" />
                <div className="h-3 w-full rounded bg-surface-50" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No business materials yet"
          description="Once business-to-consumer materials are added, they will show up here automatically."
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((material) => (
            <Card key={material.id} className="overflow-hidden transition-shadow hover:shadow-card-hover">
              <div className="relative h-48 border-b border-surface-100 bg-surface-50">
                <MaterialPreviewFrame
                  src={material.file_url || material.thumbnail_url}
                  mimeType={material.mime_type}
                  title={material.title}
                  className="h-full w-full"
                  fit="contain"
                  showPdfBadge
                  pdfClassName="h-full w-full"
                />
              </div>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={material.brand === 'hato' ? 'hato' : 'info'}>
                    {BRANDS[material.brand]?.label ?? material.brand}
                  </Badge>
                  <Badge variant="success">{labelForBusinessCategory(material.category)}</Badge>
                  <Badge variant="default">
                    {MATERIAL_TYPES.find((item) => item.value === material.type)?.label ?? material.type}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-surface-900">{material.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-surface-500">
                    {material.description || 'No description yet.'}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-surface-400">
                  <span>{formatDate(material.updated_at)}</span>
                  <span>{material.file_name || 'Ready to download'}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreviewMaterial(material)}>
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </Button>
                  {material.file_url && (
                    <Button size="sm" asChild>
                      <a href={material.file_url} download>
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                    </Button>
                  )}
                  {material.file_url && (
                    <Button variant="ghost" size="icon-sm" title="Copy link" onClick={() => void handleCopy(material)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((material) => (
            <Card key={material.id} className="transition-shadow hover:shadow-card-hover">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="relative h-28 w-full overflow-hidden rounded-xl border border-surface-200 bg-surface-50 sm:h-20 sm:w-32">
                  <MaterialPreviewFrame
                    src={material.file_url || material.thumbnail_url}
                    mimeType={material.mime_type}
                    title={material.title}
                    className="h-full w-full"
                    fit="contain"
                    showPdfBadge
                    pdfClassName="h-full w-full"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-surface-900">{material.title}</h3>
                    <Badge variant="success">{labelForBusinessCategory(material.category)}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-surface-500">
                    {material.description || 'No description yet.'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" size="icon-sm" title="Preview" onClick={() => setPreviewMaterial(material)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {material.file_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={material.file_url} download>
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                    </Button>
                  )}
                  {material.file_url && (
                    <Button variant="ghost" size="icon-sm" title="Copy link" onClick={() => void handleCopy(material)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
