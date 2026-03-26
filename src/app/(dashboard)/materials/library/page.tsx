'use client'

import * as React from 'react'
import {
  FileText, Download, Eye, Grid, List, Search,
  Upload, FolderOpen, File, Image, Mail,
  MessageSquare, Printer, QrCode, X, Loader2, Move,
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
import { createClient } from '@/lib/supabase/client'
import type { Material } from '@/lib/types/database'

// ─── Helpers ──────────────────────────────────────────────────

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

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

// ─── QR Placement type ──────────────────────────────────────

interface QrPlacement {
  x: number   // percentage 0-100 from left
  y: number   // percentage 0-100 from top
  size: number // percentage of image width
}

// ─── QR Placement Picker ─────────────────────────────────────

function QrPlacementPicker({
  imageUrl,
  placement,
  onChange,
}: {
  imageUrl: string
  placement: QrPlacement | null
  onChange: (p: QrPlacement | null) => void
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = React.useState(false)

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    onChange({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, size: placement?.size || 15 })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging || !placement) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    onChange({
      ...placement,
      x: Math.max(0, Math.min(100, Math.round(x * 10) / 10)),
      y: Math.max(0, Math.min(100, Math.round(y * 10) / 10)),
    })
  }

  const handleMouseUp = () => setDragging(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-surface-600">
          <QrCode className="mr-1 inline h-3.5 w-3.5" />
          QR Code Placement Zone
        </label>
        {placement && (
          <button type="button" onClick={() => onChange(null)} className="text-xs text-red-500 hover:text-red-700">
            Remove
          </button>
        )}
      </div>
      <p className="text-xs text-surface-400">Click on the image to place the QR code zone. Drag to reposition.</p>
      <div
        ref={containerRef}
        className="relative cursor-crosshair overflow-hidden rounded-lg border-2 border-dashed border-surface-300 bg-surface-50"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img src={imageUrl} alt="Material preview" className="w-full select-none" draggable={false} />
        {placement && (
          <div
            className="absolute border-2 border-brand-500 bg-brand-500/20 rounded shadow-sm flex items-center justify-center cursor-move"
            style={{
              left: `${placement.x - placement.size / 2}%`,
              top: `${placement.y - placement.size / 2}%`,
              width: `${placement.size}%`,
              height: `${placement.size}%`,
            }}
            onMouseDown={handleMouseDown}
            onClick={e => e.stopPropagation()}
          >
            <QrCode className="h-6 w-6 text-brand-700 opacity-60" />
          </div>
        )}
      </div>
      {placement && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-surface-500">
            <Move className="h-3 w-3" />
            <span>X: {placement.x.toFixed(1)}% Y: {placement.y.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-surface-500">Size:</label>
            <input
              type="range"
              min={5}
              max={40}
              value={placement.size}
              onChange={e => onChange({ ...placement, size: Number(e.target.value) })}
              className="h-1 w-24 accent-brand-500"
              onClick={e => e.stopPropagation()}
            />
            <span className="text-xs text-surface-500 w-8">{placement.size}%</span>
          </div>
        </div>
      )}
    </div>
  )
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
  const { insert, loading: insertLoading, error } = useMaterialInsert()

  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [type, setType] = React.useState<Material['type']>('flyer')
  const [brand, setBrand] = React.useState<'localvip' | 'hato'>('localvip')
  const [category, setCategory] = React.useState('')
  const [useCase, setUseCase] = React.useState('')
  const [file, setFile] = React.useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = React.useState<string | null>(null)
  const [previewImage, setPreviewImage] = React.useState<File | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const [qrPlacement, setQrPlacement] = React.useState<QrPlacement | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const previewInputRef = React.useRef<HTMLInputElement>(null)
  const loading = insertLoading || uploading
  const isImageFile = file && file.type.startsWith('image/')

  // The image used for QR placement — either the file itself (if image) or a separate preview image
  const qrPreviewUrl = isImageFile ? filePreviewUrl : previewImageUrl

  function reset() {
    setTitle('')
    setDescription('')
    setType('flyer')
    setBrand('localvip')
    setCategory('')
    setUseCase('')
    setFile(null)
    setFilePreviewUrl(null)
    setPreviewImage(null)
    setPreviewImageUrl(null)
    setUploading(false)
    setDragOver(false)
    setQrPlacement(null)
  }

  function handleFileSelect(selectedFile: File | undefined) {
    if (!selectedFile) return
    setFile(selectedFile)
    setQrPlacement(null)
    if (!title) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '')
      setTitle(nameWithoutExt)
    }
    // Generate preview URL for image files
    if (selectedFile.type.startsWith('image/')) {
      setFilePreviewUrl(URL.createObjectURL(selectedFile))
      // Clear separate preview image since the file itself is an image
      setPreviewImage(null)
      setPreviewImageUrl(null)
    } else {
      setFilePreviewUrl(null)
    }
  }

  function handlePreviewImageSelect(selectedFile: File | undefined) {
    if (!selectedFile || !selectedFile.type.startsWith('image/')) return
    setPreviewImage(selectedFile)
    setPreviewImageUrl(URL.createObjectURL(selectedFile))
    setQrPlacement(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    handleFileSelect(e.dataTransfer.files?.[0])
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Clean up preview URLs on unmount
  React.useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
      if (previewImageUrl) URL.revokeObjectURL(previewImageUrl)
    }
  }, [filePreviewUrl, previewImageUrl])

  async function uploadFile(fileToUpload: File, folder: string): Promise<string | null> {
    try {
      const supabase = createClient()
      const filePath = `${folder}/${profile.id}/${Date.now()}-${fileToUpload.name}`
      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(filePath, fileToUpload, { upsert: true })

      if (uploadError) {
        console.warn('Storage upload failed, falling back to data URL:', uploadError.message)
        return await fileToDataUrl(fileToUpload)
      }
      const { data: urlData } = supabase.storage
        .from('materials')
        .getPublicUrl(filePath)
      return urlData.publicUrl
    } catch (err) {
      console.warn('Upload error, falling back to data URL:', err)
      return await fileToDataUrl(fileToUpload)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    let fileUrl: string | null = null
    let thumbnailUrl: string | null = null
    let fileName: string | null = null
    let fileSize: number | null = null
    let mimeType: string | null = null

    setUploading(true)

    if (file) {
      fileName = file.name
      fileSize = file.size
      mimeType = file.type || null
      fileUrl = await uploadFile(file, 'materials')

      // For image files, use the same URL as thumbnail
      if (file.type.startsWith('image/')) {
        thumbnailUrl = fileUrl
      }
    }

    // Upload separate preview image for non-image files (PDFs, etc.)
    if (previewImage && !isImageFile) {
      thumbnailUrl = await uploadFile(previewImage, 'thumbnails')
    }

    setUploading(false)

    const metadata: Record<string, unknown> = {}
    if (qrPlacement) {
      metadata.qr_placement = qrPlacement
    }

    const result = await insert({
      title,
      description: description || null,
      type,
      brand,
      category: category || null,
      use_case: useCase || null,
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
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    })
    if (result) {
      reset()
      onSuccess()
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8">
      <div className="w-full max-w-lg rounded-xl bg-surface-0 shadow-xl my-auto">
        <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-surface-900">Upload Material</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6 max-h-[70vh] overflow-y-auto">
          {/* File drop zone */}
          <div>
            <label className="mb-1 block text-xs font-medium text-surface-600">File</label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={e => handleFileSelect(e.target.files?.[0])}
            />
            {file ? (
              <div className="flex items-center gap-3 rounded-lg border border-surface-300 bg-surface-50 px-4 py-3">
                <File className="h-5 w-5 shrink-0 text-brand-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-surface-800">{file.name}</p>
                  <p className="text-xs text-surface-500">
                    {formatFileSize(file.size)} &middot; {file.type || 'unknown type'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    setFilePreviewUrl(null)
                    setPreviewImage(null)
                    setPreviewImageUrl(null)
                    setQrPlacement(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="shrink-0 text-surface-400 hover:text-surface-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 transition-colors ${
                  dragOver
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-surface-300 bg-surface-50 hover:border-brand-400 hover:bg-surface-100'
                }`}
              >
                <Upload className={`h-8 w-8 ${dragOver ? 'text-brand-500' : 'text-surface-400'}`} />
                <p className="text-sm text-surface-600">
                  <span className="font-medium text-brand-600">Click to browse</span> or drag &amp; drop
                </p>
                <p className="text-xs text-surface-400">PDF, images, documents, or any file type</p>
              </div>
            )}
          </div>

          {/* Preview image upload for non-image files (PDFs, docs, etc.) */}
          {file && !isImageFile && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
              <input
                ref={previewInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handlePreviewImageSelect(e.target.files?.[0])}
              />
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-brand-600" />
                <span className="text-xs font-medium text-surface-700">
                  Upload a preview image to set QR code placement
                </span>
              </div>
              <p className="text-xs text-surface-500">
                Upload a screenshot or design image of this material so you can mark where the QR code should go.
              </p>
              {previewImage ? (
                <div className="flex items-center gap-2 rounded border border-surface-300 bg-surface-0 px-3 py-2">
                  <Image className="h-4 w-4 text-brand-600" />
                  <span className="text-xs text-surface-700 flex-1 truncate">{previewImage.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewImage(null)
                      setPreviewImageUrl(null)
                      setQrPlacement(null)
                      if (previewInputRef.current) previewInputRef.current.value = ''
                    }}
                    className="text-surface-400 hover:text-surface-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => previewInputRef.current?.click()}
                >
                  <Image className="h-3.5 w-3.5" /> Upload Preview Image
                </Button>
              )}
            </div>
          )}

          {/* QR Placement Picker — shown when we have a preview image (from file or separate upload) */}
          {file && qrPreviewUrl && (
            <QrPlacementPicker
              imageUrl={qrPreviewUrl}
              placement={qrPlacement}
              onChange={setQrPlacement}
            />
          )}

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
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading || !title}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {uploading ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload
                </>
              )}
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
          {filtered.map(material => {
            const hasQrZone = !!(material.metadata as Record<string, unknown>)?.qr_placement
            return (
              <Card key={material.id} className="group transition-shadow hover:shadow-card-hover">
                {/* Thumbnail */}
                <div className="flex h-36 items-center justify-center border-b border-surface-100 bg-surface-50 relative overflow-hidden">
                  {material.thumbnail_url ? (
                    <img src={material.thumbnail_url} alt={material.title} className="h-full w-full object-cover" />
                  ) : material.file_url && (material.mime_type?.startsWith('image/') || material.file_url.startsWith('data:image/')) ? (
                    <img src={material.file_url} alt={material.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-surface-300">
                      {TYPE_ICONS[material.type] || <FileText className="h-10 w-10" />}
                    </div>
                  )}
                  {hasQrZone && (
                    <div className="absolute top-2 right-2 rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-medium text-white flex items-center gap-0.5">
                      <QrCode className="h-2.5 w-2.5" /> QR Zone
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
            )
          })}
        </div>
      ) : (
        /* List view */
        <div className="space-y-2">
          {filtered.map(material => {
            const hasQrZone = !!(material.metadata as Record<string, unknown>)?.qr_placement
            return (
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
                      {hasQrZone && (
                        <span className="shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 flex items-center gap-0.5">
                          <QrCode className="h-2.5 w-2.5" /> QR Zone
                        </span>
                      )}
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
            )
          })}
        </div>
      )}
    </div>
  )
}
