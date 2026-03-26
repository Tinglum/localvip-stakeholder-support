'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Download,
  Eye,
  File,
  FileText,
  FolderOpen,
  Grid,
  Image as ImageIcon,
  List,
  Loader2,
  Mail,
  MessageSquare,
  Printer,
  QrCode,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { MaterialPreviewFrame } from '@/components/ui/material-preview-frame'
import { MaterialPreviewDialog } from '@/components/materials/material-preview-dialog'
import { BusinessMaterialsPage } from '@/components/business/business-materials-page'
import { useAuth } from '@/lib/auth/context'
import { deleteMaterial } from '@/lib/materials/delete-material'
import { BRANDS, MATERIAL_TYPES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { useMaterialAssignments, useMaterialInsert, useMaterials } from '@/lib/supabase/hooks'
import { createClient } from '@/lib/supabase/client'
import type { Material } from '@/lib/types/database'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  one_pager: <File className="h-5 w-5" />,
  flyer: <ImageIcon className="h-5 w-5" />,
  pdf: <FileText className="h-5 w-5" />,
  script: <MessageSquare className="h-5 w-5" />,
  email_template: <Mail className="h-5 w-5" />,
  print_asset: <Printer className="h-5 w-5" />,
  qr_asset: <QrCode className="h-5 w-5" />,
  other: <FolderOpen className="h-5 w-5" />,
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function isMaterialPreviewable(mimeType?: string | null) {
  return !!mimeType && (mimeType.startsWith('image/') || mimeType === 'application/pdf')
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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
  const { insert, loading: insertLoading, error } = useMaterialInsert()

  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [type, setType] = React.useState<Material['type']>('pdf')
  const [brand, setBrand] = React.useState<'localvip' | 'hato'>('localvip')
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const loading = insertLoading || uploading
  const previewable = selectedFile ? isMaterialPreviewable(selectedFile.type) : false

  React.useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  function reset() {
    setTitle('')
    setDescription('')
    setType('pdf')
    setBrand('localvip')
    setSelectedFile(null)
    setPreviewUrl(null)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileSelect(file?: File) {
    if (!file) return

    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }

    setSelectedFile(file)
    setUploadError(null)

    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''))
    }

    if (isMaterialPreviewable(file.type)) {
      setPreviewUrl(URL.createObjectURL(file))
    } else {
      setPreviewUrl(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setUploadError(null)

    let fileUrl: string | null = null
    let fileName: string | null = null
    let fileSize: number | null = null
    let mimeType: string | null = null
    let thumbnailUrl: string | null = null

    if (selectedFile) {
      setUploading(true)

      try {
        const supabase = createClient()
        const filePath = `materials/${profile.id}/${Date.now()}-${selectedFile.name}`
        const { error: storageError } = await supabase.storage
          .from('materials')
          .upload(filePath, selectedFile, { upsert: true })

        if (storageError) {
          fileUrl = await fileToDataUrl(selectedFile)
        } else {
          const { data: urlData } = supabase.storage.from('materials').getPublicUrl(filePath)
          fileUrl = urlData.publicUrl
        }

        fileName = selectedFile.name
        fileSize = selectedFile.size
        mimeType = selectedFile.type || null
        thumbnailUrl = isMaterialPreviewable(selectedFile.type) ? fileUrl : null
      } catch (caughtError) {
        console.warn('Material upload failed', caughtError)
        setUploadError('File upload failed. Please try again.')
        setUploading(false)
        return
      }

      setUploading(false)
    }

    const result = await insert({
      title,
      description: description || null,
      type,
      brand,
      category: null,
      use_case: null,
      file_url: fileUrl,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
      thumbnail_url: thumbnailUrl,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-surface-0 shadow-xl">
        <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-surface-900">Upload Material</h2>
          <button onClick={onClose} className="text-surface-400 transition-colors hover:text-surface-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid gap-4 lg:grid-cols-[1.25fr,0.9fr]">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-surface-600">File *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={e => handleFileSelect(e.target.files?.[0] ?? undefined)}
                  className="block w-full text-sm text-surface-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 file:cursor-pointer"
                  required
                />
                {selectedFile && (
                  <p className="mt-2 text-xs text-surface-500">
                    {selectedFile.name} · {formatFileSize(selectedFile.size)}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-surface-600">Title *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Midtown coffee one-pager" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-surface-600">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-surface-300 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="What is this material for?"
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
                    {MATERIAL_TYPES.map(item => (
                      <option key={item.value} value={item.value}>{item.label}</option>
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
            </div>

            <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-surface-500">Preview</p>
              {previewUrl ? (
                <MaterialPreviewFrame
                  src={previewUrl}
                  mimeType={selectedFile?.type}
                  title={title || selectedFile?.name || 'Material preview'}
                  className="h-72 w-full rounded-lg border border-surface-200 bg-white"
                  fit="contain"
                  showPdfBadge
                  pdfClassName="h-full w-full"
                />
              ) : (
                <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-surface-300 bg-white text-center text-surface-400">
                  <div className="space-y-2 px-6">
                    <FileText className="mx-auto h-10 w-10" />
                    <p className="text-sm font-medium text-surface-600">PDFs render directly here</p>
                    <p className="text-xs text-surface-400">No separate preview image upload needed.</p>
                  </div>
                </div>
              )}
              {selectedFile && !previewable && (
                <p className="mt-3 text-xs text-surface-500">
                  This file uploads normally, but only PDFs and images render inline.
                </p>
              )}
            </div>
          </div>

          {(error || uploadError) && (
            <p className="text-xs text-danger-600">{error || uploadError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading || !title || !selectedFile}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function MyMaterialsPage() {
  const { profile } = useAuth()

  if (profile.role === 'business') {
    return <BusinessMaterialsPage />
  }

  return <StandardMaterialsPage />
}

function StandardMaterialsPage() {
  const { profile, isAdmin } = useAuth()
  const { data: allMaterials, loading: materialsLoading, error, refetch } = useMaterials()
  const { data: assignments, loading: assignmentsLoading } = useMaterialAssignments({ stakeholder_id: profile.id })
  const [uploadOpen, setUploadOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid')
  const [previewMaterial, setPreviewMaterial] = React.useState<Material | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [actionMessage, setActionMessage] = React.useState<string | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  const materials = React.useMemo(() => {
    const assignedIds = new Set(assignments.map(assignment => assignment.material_id))
    return allMaterials.filter(material => material.created_by === profile.id || assignedIds.has(material.id))
  }, [allMaterials, assignments, profile.id])

  const filtered = React.useMemo(() => {
    return materials.filter(material => {
      if (!search) return true
      const query = search.toLowerCase()
      return material.title.toLowerCase().includes(query)
        || (material.description || '').toLowerCase().includes(query)
        || (material.file_name || '').toLowerCase().includes(query)
    })
  }, [materials, search])

  const loading = materialsLoading || assignmentsLoading
  const uploadedCount = materials.filter(material => material.created_by === profile.id).length
  const assignedCount = materials.filter(material => material.created_by !== profile.id).length
  const previewableCount = materials.filter(material =>
    isMaterialPreviewable(material.mime_type) || material.file_url?.toLowerCase().includes('.pdf')
  ).length

  async function handleDelete(material: Material) {
    if (!(isAdmin || material.created_by === profile.id)) return
    if (!confirm('Delete this material? Any linked business or outreach references will be cleared when possible.')) return

    setDeletingId(material.id)
    setActionMessage(null)
    setDeleteError(null)

    const result = await deleteMaterial(material, { manageReferences: isAdmin })

    setDeletingId(null)

    if (!result.success) {
      setDeleteError(result.error || 'Failed to delete material.')
      return
    }

    setActionMessage('Material deleted.')
    refetch()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Materials"
        description="Your uploaded and assigned materials, with direct PDF previews ready for field use."
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Upload
            </Button>
            <Link href="/materials/library">
              <Button variant="outline">
                Browse Library <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        }
      />

      <UploadMaterialDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={refetch}
      />

      <MaterialPreviewDialog
        material={previewMaterial}
        open={!!previewMaterial}
        onOpenChange={(open) => {
          if (!open) setPreviewMaterial(null)
        }}
      />

      <Card className="overflow-hidden border-surface-200">
        <div className="bg-gradient-to-r from-amber-50 via-white to-pink-50 px-6 py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/80 p-3 text-brand-600 shadow-sm ring-1 ring-surface-200">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-surface-900">Field-ready materials</p>
                <p className="mt-1 max-w-2xl text-sm text-surface-600">
                  PDFs now preview directly inside the app, so the same file you upload is the same file everyone sees.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-white/85 px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Uploaded</p>
                <p className="mt-1 text-xl font-semibold text-surface-900">{uploadedCount}</p>
              </div>
              <div className="rounded-xl bg-white/85 px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Assigned</p>
                <p className="mt-1 text-xl font-semibold text-surface-900">{assignedCount}</p>
              </div>
              <div className="rounded-xl bg-white/85 px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Previewable</p>
                <p className="mt-1 text-xl font-semibold text-surface-900">{previewableCount}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search my materials..."
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

      {deleteError && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {deleteError}
        </div>
      )}

      {actionMessage && (
        <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
          {actionMessage}
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
                <div className="h-3 w-1/2 rounded bg-surface-50" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No materials yet"
          description="Upload a PDF or pull in assigned materials to start building your field kit."
          action={{ label: 'Upload Material', onClick: () => setUploadOpen(true) }}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(material => {
            const assigned = material.created_by !== profile.id
            const previewSource = material.file_url || material.thumbnail_url
            const canDelete = isAdmin || material.created_by === profile.id

            return (
              <Card key={material.id} className="group overflow-hidden transition-shadow hover:shadow-card-hover">
                <div className="relative h-48 border-b border-surface-100 bg-surface-50">
                  <MaterialPreviewFrame
                    src={previewSource}
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
                    <Badge variant="default">
                      {MATERIAL_TYPES.find(item => item.value === material.type)?.label ?? material.type}
                    </Badge>
                    <Badge variant={assigned ? 'warning' : 'success'}>
                      {assigned ? 'Assigned' : 'Uploaded by you'}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-surface-900">{material.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-surface-500">
                      {material.description || 'No description provided yet.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-surface-400">
                    <span>{formatDate(material.updated_at)}</span>
                    <span>{formatFileSize(material.file_size)}</span>
                  </div>

                  <div className="flex gap-2">
                    {(material.file_url || material.thumbnail_url) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewMaterial(material)}
                      >
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </Button>
                    )}
                    {material.file_url && (
                      <Button size="sm" asChild>
                        <a href={material.file_url} download>
                          <Download className="h-3.5 w-3.5" /> Download
                        </a>
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete"
                        onClick={() => handleDelete(material)}
                        disabled={deletingId === material.id}
                        className="text-danger-500 hover:text-danger-700"
                      >
                        {deletingId === material.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(material => {
            const assigned = material.created_by !== profile.id
            const previewSource = material.file_url || material.thumbnail_url
            const canDelete = isAdmin || material.created_by === profile.id

            return (
              <Card key={material.id} className="transition-shadow hover:shadow-card-hover">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="relative h-28 w-full overflow-hidden rounded-xl border border-surface-200 bg-surface-50 sm:h-20 sm:w-32">
                    <MaterialPreviewFrame
                      src={previewSource}
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
                      <span className="text-surface-300">{TYPE_ICONS[material.type] || <FileText className="h-4 w-4" />}</span>
                      <Badge variant={assigned ? 'warning' : 'success'}>
                        {assigned ? 'Assigned' : 'Uploaded'}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-surface-500">
                      {material.description || 'No description provided yet.'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-surface-400">
                      <span>{BRANDS[material.brand]?.label ?? material.brand}</span>
                      <span>{MATERIAL_TYPES.find(item => item.value === material.type)?.label ?? material.type}</span>
                      <span>{formatFileSize(material.file_size)}</span>
                      <span>{formatDate(material.updated_at)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {(material.file_url || material.thumbnail_url) && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Preview"
                        onClick={() => setPreviewMaterial(material)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {material.file_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={material.file_url} download>
                          <Download className="h-3.5 w-3.5" /> Download
                        </a>
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete"
                        onClick={() => handleDelete(material)}
                        disabled={deletingId === material.id}
                        className="text-danger-500 hover:text-danger-700"
                      >
                        {deletingId === material.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
