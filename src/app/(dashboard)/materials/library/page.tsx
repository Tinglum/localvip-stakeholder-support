'use client'

import * as React from 'react'
import {
  FileText, Download, Eye, Grid, List, Search,
  Upload, FolderOpen, File, Image as ImageIcon, Mail,
  MessageSquare, Printer, QrCode, X, Loader2, Move, Trash2, PencilLine,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { MaterialEditDialog } from '@/components/materials/material-edit-dialog'
import { MaterialQrZonesDialog } from '@/components/materials/material-qr-zones-dialog'
import { MaterialPreviewFrame } from '@/components/ui/material-preview-frame'
import { MaterialPreviewDialog } from '@/components/materials/material-preview-dialog'
import { QrPlacementPicker } from '@/components/materials/qr-placement-picker'
import { useAuth } from '@/lib/auth/context'
import { deleteMaterial } from '@/lib/materials/delete-material'
import {
  AUTOMATION_TEMPLATE_STAKEHOLDER_TYPES,
  getMaterialAutomationTemplateConfig,
  withUpdatedMaterialAutomationTemplate,
  type MaterialAutomationTemplateConfig,
} from '@/lib/materials/automation-template'
import {
  getMaterialCustomTags,
  getMaterialVisibilityRoleLabels,
  getMaterialVisibilitySubtypeLabels,
} from '@/lib/materials/material-targeting'
import {
  getQrPlacements,
  hasQrPlacements,
  qrPlacementMetadata,
  type QrPlacement,
} from '@/lib/materials/qr-placement'
import { BRANDS, MATERIAL_CATEGORIES, MATERIAL_TYPES, MATERIAL_USE_CASES } from '@/lib/constants'
import { MATERIAL_LIBRARY_FOLDERS } from '@/lib/material-engine'
import { formatDate } from '@/lib/utils'
import { useMaterials, useMaterialInsert } from '@/lib/supabase/hooks'
import { createClient } from '@/lib/supabase/client'
import type { Material, MaterialLibraryFolder, StakeholderType } from '@/lib/types/database'

// ─── Helpers ──────────────────────────────────────────────────

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

// ─── Type icons ───────────────────────────────────────────────

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

// ─── QR Placement type ──────────────────────────────────────

interface LegacyQrPlacement {
  x: number   // percentage 0-100 from left
  y: number   // percentage 0-100 from top
  size: number // percentage of image width
}

// ─── QR Placement Picker ─────────────────────────────────────

function LegacyQrPlacementPicker({
  previewUrl,
  previewMimeType,
  placement,
  onChange,
}: {
  previewUrl: string
  previewMimeType?: string | null
  placement: LegacyQrPlacement | null
  onChange: (p: LegacyQrPlacement | null) => void
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
        className="relative h-[28rem] cursor-crosshair overflow-hidden rounded-lg border-2 border-dashed border-surface-300 bg-surface-50"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <MaterialPreviewFrame
          src={previewUrl}
          mimeType={previewMimeType}
          title="Material preview"
          fit="contain"
          showPdfBadge
          className="h-full w-full"
          pdfClassName="h-full w-full pointer-events-none"
        />
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
  const { profile, isAdmin } = useAuth()
  const { insert, loading: insertLoading, error } = useMaterialInsert()

  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [type, setType] = React.useState<Material['type']>('flyer')
  const [brand, setBrand] = React.useState<'localvip' | 'hato'>('localvip')
  const [category, setCategory] = React.useState('')
  const [useCase, setUseCase] = React.useState('')
  const [file, setFile] = React.useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const [qrPlacements, setQrPlacements] = React.useState<QrPlacement[]>([])
  const [templateEnabled, setTemplateEnabled] = React.useState(false)
  const [templateLibraryFolder, setTemplateLibraryFolder] = React.useState<MaterialLibraryFolder>('share_with_customers')
  const [templateStakeholderTypes, setTemplateStakeholderTypes] = React.useState<StakeholderType[]>(['business'])
  const [templateAudienceTags, setTemplateAudienceTags] = React.useState('customers')
  const [templateStatus, setTemplateStatus] = React.useState<'active' | 'inactive'>('active')
  const [templateError, setTemplateError] = React.useState<string | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const loading = insertLoading || uploading
  const isPreviewableFile = file ? isMaterialPreviewable(file.type) : false

  // Use the uploaded file itself as the preview source whenever it can render inline.
  const qrPreviewUrl = isPreviewableFile ? filePreviewUrl : null

  function reset() {
    setTitle('')
    setDescription('')
    setType('flyer')
    setBrand('localvip')
    setCategory('')
    setUseCase('')
    setFile(null)
    setFilePreviewUrl(null)
    setUploading(false)
    setDragOver(false)
    setQrPlacements([])
    setTemplateEnabled(false)
    setTemplateLibraryFolder('share_with_customers')
    setTemplateStakeholderTypes(['business'])
    setTemplateAudienceTags('customers')
    setTemplateStatus('active')
    setTemplateError(null)
  }

  function handleFileSelect(selectedFile: File | undefined) {
    if (!selectedFile) return
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl)
    }
    setFile(selectedFile)
    setQrPlacements([])
    setTemplateError(null)
    if (!title) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '')
      setTitle(nameWithoutExt)
    }
    if (isMaterialPreviewable(selectedFile.type)) {
      setFilePreviewUrl(URL.createObjectURL(selectedFile))
    } else {
      setFilePreviewUrl(null)
    }
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

  function parseTemplateTags(value: string) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  function toggleTemplateStakeholderType(stakeholderType: StakeholderType) {
    setTemplateStakeholderTypes((current) =>
      current.includes(stakeholderType)
        ? current.filter((item) => item !== stakeholderType)
        : [...current, stakeholderType],
    )
  }

  // Clean up preview URLs on unmount
  React.useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
    }
  }, [filePreviewUrl])

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
    setTemplateError(null)

    if (templateEnabled && qrPlacements.length === 0) {
      setTemplateError('Add at least one QR zone before using this material as an automation template.')
      return
    }

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

      if (isMaterialPreviewable(file.type)) {
        thumbnailUrl = fileUrl
      }
    }

    setUploading(false)

    const metadata: Record<string, unknown> = {}
    if (qrPlacements.length > 0) {
      Object.assign(metadata, qrPlacementMetadata(qrPlacements))
    }

    const baseMaterial = {
      id: '',
      title,
      description: description || null,
      type,
      brand,
      file_url: fileUrl,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
      thumbnail_url: thumbnailUrl,
      category: category || null,
      use_case: useCase || null,
      target_roles: [],
      target_subtypes: [],
      campaign_id: null,
      city_id: null,
      is_template: templateEnabled,
      version: 1,
      status: 'active',
      created_by: profile.id,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      created_at: '',
      updated_at: '',
    } as Material

    const automationConfig: MaterialAutomationTemplateConfig = {
      enabled: templateEnabled,
      isActive: templateStatus === 'active',
      stakeholderTypes: templateStakeholderTypes.length > 0 ? templateStakeholderTypes : ['business'],
      audienceTags: parseTemplateTags(templateAudienceTags),
      libraryFolder: templateLibraryFolder,
    }

    const finalMetadata = templateEnabled
      ? withUpdatedMaterialAutomationTemplate(baseMaterial, automationConfig)
      : (Object.keys(metadata).length > 0 ? metadata : null)

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
      is_template: templateEnabled,
      version: 1,
      status: 'active',
      created_by: profile.id,
      metadata: finalMetadata,
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
      <div className="my-auto w-full max-w-6xl rounded-xl bg-surface-0 shadow-xl">
        <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-surface-900">Upload Material</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6 max-h-[90vh] overflow-y-auto">
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
                    setQrPlacements([])
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

          {/* Inline preview note for files that cannot render directly in-app */}
          {file && !isPreviewableFile && (
            <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-warning-700" />
                <span className="text-xs font-medium text-warning-700">
                  Inline preview is only available for PDFs and images
                </span>
              </div>
              <p className="text-xs text-warning-700/80">
                PDFs render directly here for placement, and images use their own preview. Other file types still upload normally without a separate picture step.
              </p>
            </div>
          )}

          {/* QR placement works directly against the uploaded previewable file */}
          {file && qrPreviewUrl && (
            <QrPlacementPicker
              previewUrl={qrPreviewUrl}
              previewMimeType={file?.type}
              placements={qrPlacements}
              onChange={setQrPlacements}
            />
          )}

          {isAdmin ? (
            <div className="rounded-lg border border-surface-200 bg-surface-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-surface-900">Use This As an Automation Template</p>
                  <p className="mt-1 text-xs text-surface-500">
                    This turns the uploaded material into a reusable stakeholder template. The saved QR zones become the automatic QR placement layout.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTemplateEnabled((current) => !current)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    templateEnabled
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-surface-200 bg-white text-surface-600 hover:border-brand-300 hover:text-brand-700'
                  }`}
                >
                  {templateEnabled ? 'Template Enabled' : 'Enable Template'}
                </button>
              </div>

              {templateEnabled && (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-surface-600">Delivery Folder</label>
                      <select
                        value={templateLibraryFolder}
                        onChange={(e) => setTemplateLibraryFolder(e.target.value as MaterialLibraryFolder)}
                        className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                      >
                        {MATERIAL_LIBRARY_FOLDERS.map((folder) => (
                          <option key={folder.value} value={folder.value}>{folder.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-surface-600">Template Status</label>
                      <select
                        value={templateStatus}
                        onChange={(e) => setTemplateStatus(e.target.value as 'active' | 'inactive')}
                        className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-surface-600">Stakeholder Types</label>
                    <div className="flex flex-wrap gap-2">
                      {AUTOMATION_TEMPLATE_STAKEHOLDER_TYPES.map((stakeholderType) => {
                        const active = templateStakeholderTypes.includes(stakeholderType)
                        return (
                          <button
                            key={stakeholderType}
                            type="button"
                            onClick={() => toggleTemplateStakeholderType(stakeholderType)}
                            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                              active
                                ? 'border-brand-500 bg-brand-50 text-brand-700'
                                : 'border-surface-200 bg-white text-surface-600 hover:border-brand-300 hover:text-brand-700'
                            }`}
                          >
                            {stakeholderType.replace(/_/g, ' ')}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-surface-600">Automation Audience Tags</label>
                    <Input
                      value={templateAudienceTags}
                      onChange={(e) => setTemplateAudienceTags(e.target.value)}
                      placeholder="customers, parents, pta"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : null}

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
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                >
                  <option value="">None</option>
                  {MATERIAL_CATEGORIES.map(item => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
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
          {(templateError || error) && <p className="text-xs text-red-600">{templateError || error}</p>}
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
  const { profile, isAdmin } = useAuth()
  const { data: materials, loading, error, refetch } = useMaterials()
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('')
  const [brandFilter, setBrandFilter] = React.useState('')
  const [useCaseFilter, setUseCaseFilter] = React.useState('')
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid')
  const [uploadOpen, setUploadOpen] = React.useState(false)
  const [previewMaterial, setPreviewMaterial] = React.useState<Material | null>(null)
  const [editingMaterial, setEditingMaterial] = React.useState<Material | null>(null)
  const [editingQrMaterial, setEditingQrMaterial] = React.useState<Material | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [actionMessage, setActionMessage] = React.useState<string | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  const filtered = React.useMemo(() => {
    return materials.filter(m => {
      const query = search.toLowerCase()
      const customTags = getMaterialCustomTags(m).join(' ').toLowerCase()
      if (search
        && !m.title.toLowerCase().includes(query)
        && !(m.description || '').toLowerCase().includes(query)
        && !customTags.includes(query)) return false
      if (typeFilter && m.type !== typeFilter) return false
      if (brandFilter && m.brand !== brandFilter) return false
      if (useCaseFilter && m.use_case !== useCaseFilter) return false
      return true
    })
  }, [materials, search, typeFilter, brandFilter, useCaseFilter])

  async function handleDelete(material: Material) {
    if (!confirm('Delete this material? Any linked business or outreach references will be cleared.')) return

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

      <MaterialPreviewDialog
        material={previewMaterial}
        open={!!previewMaterial}
        onOpenChange={(open) => {
          if (!open) setPreviewMaterial(null)
        }}
      />

      <MaterialEditDialog
        material={editingMaterial}
        open={!!editingMaterial}
        onOpenChange={(open) => {
          if (!open) setEditingMaterial(null)
        }}
        onSaved={() => {
          setActionMessage('Material updated.')
          setEditingMaterial(null)
          refetch()
        }}
      />

      <MaterialQrZonesDialog
        material={editingQrMaterial}
        open={!!editingQrMaterial}
        onOpenChange={(open) => {
          if (!open) setEditingQrMaterial(null)
        }}
        onSaved={() => {
          setActionMessage('QR zones saved.')
          refetch()
        }}
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

      {deleteError && (
        <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {deleteError}
        </div>
      )}

      {actionMessage && (
        <div className="mb-4 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
          {actionMessage}
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
            const qrZoneCount = getQrPlacements(material.metadata as Record<string, unknown> | null).length
            const hasQrZone = hasQrPlacements(material.metadata as Record<string, unknown> | null)
            const automationTemplate = getMaterialAutomationTemplateConfig(material)
            const visibilityLabels = getMaterialVisibilityRoleLabels(material)
            const subtypeLabels = getMaterialVisibilitySubtypeLabels(material)
            const customTags = getMaterialCustomTags(material)
            const canEdit = isAdmin || material.created_by === profile.id
            return (
              <Card key={material.id} className="group transition-shadow hover:shadow-card-hover">
                {/* Thumbnail */}
                <div className="flex h-36 items-center justify-center border-b border-surface-100 bg-surface-50 relative overflow-hidden">
                  <MaterialPreviewFrame
                    src={material.file_url || material.thumbnail_url}
                    mimeType={material.mime_type}
                    title={material.title}
                    showPdfBadge
                    imageSizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                    className="h-full w-full"
                  />
                  {hasQrZone && (
                    <div className="absolute top-2 right-2 rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-medium text-white flex items-center gap-0.5">
                      <QrCode className="h-2.5 w-2.5" /> {qrZoneCount} QR {qrZoneCount === 1 ? 'zone' : 'zones'}
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
                    {automationTemplate.enabled && (
                      <Badge variant={automationTemplate.isActive ? 'success' : 'warning'}>
                        Template
                      </Badge>
                    )}
                  </div>
                  {(visibilityLabels.length > 0 || subtypeLabels.length > 0 || customTags.length > 0) && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {visibilityLabels.slice(0, 3).map((label) => (
                        <Badge key={label} variant="info">{label}</Badge>
                      ))}
                      {subtypeLabels.slice(0, 2).map((label) => (
                        <Badge key={label} variant="success">{label}</Badge>
                      ))}
                      {customTags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="default">{tag}</Badge>
                      ))}
                    </div>
                  )}
                  <h3 className="text-sm font-semibold text-surface-800 group-hover:text-brand-700 transition-colors">
                    {material.title}
                  </h3>
                  <p className="mt-1 text-xs text-surface-500 line-clamp-2">{material.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-surface-400">
                      {formatDate(material.updated_at)}
                    </span>
                    <div className="flex gap-1">
                      {(material.file_url || material.thumbnail_url) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Preview"
                          onClick={() => setPreviewMaterial(material)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Edit tags"
                          onClick={() => setEditingMaterial(material)}
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {isAdmin && material.file_url && isMaterialPreviewable(material.mime_type) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Edit QR Zones"
                          onClick={() => setEditingQrMaterial(material)}
                        >
                          <QrCode className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {material.file_url && (
                        <Button variant="ghost" size="icon-sm" title="Download" asChild>
                          <a href={material.file_url} download>
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      {isAdmin && (
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
            const qrZoneCount = getQrPlacements(material.metadata as Record<string, unknown> | null).length
            const hasQrZone = hasQrPlacements(material.metadata as Record<string, unknown> | null)
            const automationTemplate = getMaterialAutomationTemplateConfig(material)
            const visibilityLabels = getMaterialVisibilityRoleLabels(material)
            const subtypeLabels = getMaterialVisibilitySubtypeLabels(material)
            const customTags = getMaterialCustomTags(material)
            const canEdit = isAdmin || material.created_by === profile.id
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
                      {automationTemplate.enabled && (
                        <Badge variant={automationTemplate.isActive ? 'success' : 'warning'} className="shrink-0">
                          Template
                        </Badge>
                      )}
                      {hasQrZone && (
                        <span className="shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 flex items-center gap-0.5">
                          <QrCode className="h-2.5 w-2.5" /> {qrZoneCount} QR {qrZoneCount === 1 ? 'zone' : 'zones'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-surface-500 truncate">{material.description}</p>
                    {(visibilityLabels.length > 0 || subtypeLabels.length > 0 || customTags.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {visibilityLabels.slice(0, 3).map((label) => (
                          <Badge key={label} variant="info">{label}</Badge>
                        ))}
                        {subtypeLabels.slice(0, 2).map((label) => (
                          <Badge key={label} variant="success">{label}</Badge>
                        ))}
                        {customTags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="default">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-xs text-surface-400">
                    <span>{material.use_case ? MATERIAL_USE_CASES.find(u => u.value === material.use_case)?.label : ''}</span>
                    <span>{formatDate(material.updated_at)}</span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {(material.file_url || material.thumbnail_url) && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Preview"
                        onClick={() => setPreviewMaterial(material)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Edit tags"
                        onClick={() => setEditingMaterial(material)}
                      >
                        <PencilLine className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isAdmin && material.file_url && isMaterialPreviewable(material.mime_type) && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Edit QR Zones"
                        onClick={() => setEditingQrMaterial(material)}
                      >
                        <QrCode className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {material.file_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={material.file_url} download>
                          <Download className="h-3.5 w-3.5" /> Download
                        </a>
                      </Button>
                    )}
                    {isAdmin && (
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
