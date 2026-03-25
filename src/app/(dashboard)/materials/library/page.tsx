'use client'

import * as React from 'react'
import {
  FileText, Download, Eye, Grid, List, Search,
  Upload, FolderOpen, File, Image, Mail,
  MessageSquare, Printer, QrCode, X, Loader2,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { BRANDS, MATERIAL_TYPES, MATERIAL_USE_CASES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { useMaterials, useMaterialInsert } from '@/lib/supabase/hooks'
import type { Material } from '@/lib/types/database'

// ─── Type icons ───────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
  one_pager: <File className="h-5 w-5" />,
  flyer: <Image className="h-5 w-5" />,
  pdf: <FileText className="h-5 w-5" />,
  script: <MessageSquare className="h-5 w-5" />,
  email_template: <Mail className="h-5 w-5" />,
  print_asset: <Printer className="h-5 w-5" />,
  qr_asset: <QrCode className="h-5 w-5" />,
  other: <FolderOpen className="h-5 w-5" />,
}

// ─── Upload Dialog ────────────────────────────────────────────

function UploadMaterialDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const { profile } = useAuth()
  const { insert, loading, error } = useMaterialInsert()

  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [type, setType] = React.useState<Material['type']>('pdf')
  const [brand, setBrand] = React.useState<'localvip' | 'hato'>('localvip')
  const [category, setCategory] = React.useState('')
  const [useCase, setUseCase] = React.useState('')
  const [fileUrl, setFileUrl] = React.useState('')

  function reset() {
    setTitle('')
    setDescription('')
    setType('pdf')
    setBrand('localvip')
    setCategory('')
    setUseCase('')
    setFileUrl('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = await insert({
      title,
      description: description || null,
      type,
      brand,
      category: category || null,
      use_case: useCase || null,
      file_url: fileUrl || null,
      file_name: null,
      file_size: null,
      mime_type: null,
      thumbnail_url: null,
      target_roles: [],
      campaign_id: null,
      city_id: null,
      is_template: false,
      version: 1,
      status: 'active',
      created_by: profile.id,
      metadata: null,
    })
    if (result) {
      reset()
      onSuccess()
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-surface-0 shadow-xl">
        <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-surface-900">Upload Material</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-surface-600">Title *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Business One-Pager" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-surface-600">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-surface-300 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Brief description of this material..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600">Type *</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as Material['type'])}
                className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
              >
                {MATERIAL_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600">Brand *</label>
              <select
                value={brand}
                onChange={e => setBrand(e.target.value as 'localvip' | 'hato')}
                className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
              >
                <option value="localvip">LocalVIP</option>
                <option value="hato">HATO</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600">Category</label>
              <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Onboarding" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600">Use Case</label>
              <select
                value={useCase}
                onChange={e => setUseCase(e.target.value)}
                className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
              >
                <option value="">None</option>
                {MATERIAL_USE_CASES.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-surface-600">File URL</label>
            <Input value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder="https://..." />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading || !title}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export default function MaterialsLibraryPage() {
  const { isAdmin } = useAuth()
  const { data: materials, loading, error, refetch } = useMaterials()
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('')
  const [brandFilter, setBrandFilter] = React.useState('')
  const [useCaseFilter, setUseCaseFilter] = React.useState('')
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid')
  const [uploadOpen, setUploadOpen] = React.useState(false)

  const filtered = React.useMemo(() => {
    return materials.filter(m => {
      if (search && !m.title.toLowerCase().includes(search.toLowerCase()) &&
          !(m.description || '').toLowerCase().includes(search.toLowerCase())) return false
      if (typeFilter && m.type !== typeFilter) return false
      if (brandFilter && m.brand !== brandFilter) return false
      if (useCaseFilter && m.use_case !== useCaseFilter) return false
      return true
    })
  }, [materials, search, typeFilter, brandFilter, useCaseFilter])

  return (
    <div>
      <PageHeader
        title="Materials Library"
        description="Download flyers, scripts, templates, and print assets for your outreach."
        actions={
          isAdmin ? (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Upload Material
            </Button>
          ) : undefined
        }
      />

      <UploadMaterialDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={refetch}
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search materials..."
            className="pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
        >
          <option value="">All Types</option>
          {MATERIAL_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={brandFilter}
          onChange={e => setBrandFilter(e.target.value)}
          className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
        >
          <option value="">All Brands</option>
          <option value="localvip">LocalVIP</option>
          <option value="hato">HATO</option>
        </select>
        <select
          value={useCaseFilter}
          onChange={e => setUseCaseFilter(e.target.value)}
          className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
        >
          <option value="">All Use Cases</option>
          {MATERIAL_USE_CASES.map(u => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded-md p-1.5 ${viewMode === 'grid' ? 'bg-surface-200 text-surface-700' : 'text-surface-400 hover:text-surface-600'}`}
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-md p-1.5 ${viewMode === 'list' ? 'bg-surface-200 text-surface-700' : 'text-surface-400 hover:text-surface-600'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Count */}
      <p className="mb-4 text-xs text-surface-500">
        {loading ? 'Loading...' : `${filtered.length} material${filtered.length !== 1 ? 's' : ''}`}
      </p>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-36 bg-surface-100" />
              <CardContent className="p-4 space-y-2">
                <div className="h-4 w-2/3 rounded bg-surface-100" />
                <div className="h-3 w-full rounded bg-surface-50" />
                <div className="h-3 w-1/2 rounded bg-surface-50" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No materials found"
          description="Try adjusting your filters, or upload new materials."
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(material => (
            <Card key={material.id} className="group transition-shadow hover:shadow-card-hover">
              {/* Thumbnail */}
              <div className="flex h-36 items-center justify-center border-b border-surface-100 bg-surface-50">
                {material.thumbnail_url ? (
                  <img src={material.thumbnail_url} alt={material.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="text-surface-300">
                    {TYPE_ICONS[material.type] || <FileText className="h-10 w-10" />}
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant={material.brand === 'hato' ? 'hato' : 'info'}>
                    {BRANDS[material.brand]?.label ?? material.brand}
                  </Badge>
                  <Badge variant="default">
                    {MATERIAL_TYPES.find(t => t.value === material.type)?.label ?? material.type}
                  </Badge>
                </div>
                <h3 className="text-sm font-semibold text-surface-800 group-hover:text-brand-700 transition-colors">
                  {material.title}
                </h3>
                <p className="mt-1 text-xs text-surface-500 line-clamp-2">{material.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-surface-400">
                    {formatDate(material.updated_at)}
                  </span>
                  <div className="flex gap-1">
                    {material.file_url && (
                      <Button variant="ghost" size="icon-sm" title="Preview" asChild>
                        <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                          <Eye className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                    {material.file_url && (
                      <Button variant="ghost" size="icon-sm" title="Download" asChild>
                        <a href={material.file_url} download>
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* List view */
        <div className="space-y-2">
          {filtered.map(material => (
            <Card key={material.id} className="group transition-shadow hover:shadow-card-hover">
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100 text-surface-400">
                  {TYPE_ICONS[material.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-surface-800 truncate">{material.title}</h3>
                    <Badge variant={material.brand === 'hato' ? 'hato' : 'info'} className="shrink-0">
                      {BRANDS[material.brand]?.label ?? material.brand}
                    </Badge>
                  </div>
                  <p className="text-xs text-surface-500 truncate">{material.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs text-surface-400">
                  <span>{material.use_case ? MATERIAL_USE_CASES.find(u => u.value === material.use_case)?.label : ''}</span>
                  <span>{formatDate(material.updated_at)}</span>
                </div>
                <div className="flex shrink-0 gap-1">
                  {material.file_url && (
                    <Button variant="ghost" size="icon-sm" asChild>
                      <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                  {material.file_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={material.file_url} download>
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
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
