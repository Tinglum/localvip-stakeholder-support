'use client'

import * as React from 'react'
import {
  FileText, Download, Eye, ArrowRight, Sparkles, Loader2,
  File, Image, Mail, MessageSquare, Printer, QrCode, FolderOpen,
  Upload, X,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { BRANDS, MATERIAL_TYPES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { useMaterials, useMaterialInsert } from '@/lib/supabase/hooks'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Material } from '@/lib/types/database'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  one_pager: <File className="h-6 w-6" />,
  flyer: <Image className="h-6 w-6" />,
  pdf: <FileText className="h-6 w-6" />,
  script: <MessageSquare className="h-6 w-6" />,
  email_template: <Mail className="h-6 w-6" />,
  print_asset: <Printer className="h-6 w-6" />,
  qr_asset: <QrCode className="h-6 w-6" />,
  other: <FolderOpen className="h-6 w-6" />,
}

// ─── Helpers ──────────────────────────────────────────────────

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
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
  const { insert, loading: inserting, error: insertError } = useMaterialInsert()

  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [type, setType] = React.useState<Material['type']>('pdf')
  const [brand, setBrand] = React.useState<'localvip' | 'hato'>('localvip')
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const loading = inserting || uploading
  const error = insertError || uploadError

  function reset() {
    setTitle('')
    setDescription('')
    setType('pdf')
    setBrand('localvip')
    setSelectedFile(null)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setUploadError(null)

    let fileUrl: string | null = null
    let fileName: string | null = null
    let fileSize: number | null = null
    let mimeType: string | null = null

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
          const { data: urlData } = supabase.storage
            .from('materials')
            .getPublicUrl(filePath)
          fileUrl = urlData.publicUrl
        }

        fileName = selectedFile.name
        fileSize = selectedFile.size
        mimeType = selectedFile.type || null
      } catch (err) {
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
          <div>
            <label className="mb-1 block text-xs font-medium text-surface-600">File *</label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-surface-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 file:cursor-pointer"
                required
              />
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="shrink-0 text-surface-400 hover:text-surface-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {selectedFile && (
              <p className="mt-1 text-xs text-surface-500">
                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
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

// ─── Main page ────────────────────────────────────────────────

export default function MyMaterialsPage() {
  const { profile } = useAuth()
  const { data: materials, loading, error, refetch } = useMaterials({ created_by: profile.id })
  const [uploadOpen, setUploadOpen] = React.useState(false)

  return (
    <div>
      <PageHeader
        title="My Materials"
        description="Your uploaded and assigned marketing materials. Download what you need."
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

      {/* Recommended action */}
      <Card className="mb-6 border-l-4 border-l-brand-500">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="rounded-lg bg-brand-50 p-2.5 text-brand-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-surface-800">Ready for outreach?</p>
            <p className="text-xs text-surface-500">Download your outreach script and one-pager before visiting businesses.</p>
          </div>
          <Link href="/materials/library">
            <Button size="sm">
              <Download className="h-3.5 w-3.5" /> Browse Materials
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-12 w-12 rounded-lg bg-surface-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-surface-100" />
                  <div className="h-3 w-2/3 rounded bg-surface-50" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : materials.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No materials yet"
          description="You haven't uploaded any materials yet. Browse the library or upload new materials."
          action={{ label: 'Upload Material', onClick: () => setUploadOpen(true) }}
        />
      ) : (
        <div className="space-y-3">
          {materials.map(material => (
            <Card key={material.id} className="transition-shadow hover:shadow-card-hover">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-100 text-surface-400">
                  {TYPE_ICONS[material.type] || <FileText className="h-6 w-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-surface-800">{material.title}</h3>
                  <p className="text-xs text-surface-500">{material.description}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={material.brand === 'hato' ? 'hato' : 'info'}>
                      {BRANDS[material.brand]?.label ?? material.brand}
                    </Badge>
                    <Badge variant="default">
                      {MATERIAL_TYPES.find(t => t.value === material.type)?.label ?? material.type}
                    </Badge>
                    <span className="text-xs text-surface-400">
                      {formatDate(material.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {material.file_url && (
                    <Button variant="ghost" size="icon-sm" title="Preview" asChild>
                      <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4" />
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
