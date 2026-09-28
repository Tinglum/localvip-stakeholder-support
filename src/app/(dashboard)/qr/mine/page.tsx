'use client'

import * as React from 'react'
import NextImage from 'next/image'
import Link from 'next/link'
import {
  QrCode, Download, Copy, Grid, List,
  BarChart3, ExternalLink, Key, Plus, Trash2, FolderInput, FolderOpen, Loader2,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/lib/auth/context'
import { useQrCodes, useQrCodeDelete, useQrCodeUpdate, useQrCodeCollections } from '@/lib/supabase/hooks'
import type { QrCode as QrCodeRow } from '@/lib/types/database'

const NO_COLLECTION = '__none__'
import { BRANDS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { generateQRDataURL } from '@/lib/qr/generate'

export default function MyQrCodesPage() {
  const { localProfileId } = useAuth()
  // created_by is stamped with the numeric backend user id (localProfileId),
  // not the derived profile UUID.
  const { data: qrCodes, loading, error, refetch } = useQrCodes(
    localProfileId ? { created_by: localProfileId } : undefined,
  )
  const { remove } = useQrCodeDelete()
  const { update: updateQr } = useQrCodeUpdate()
  const { data: collections } = useQrCodeCollections()
  const collectionName = React.useMemo(() => {
    const map = new Map(collections.map(c => [String(c.id), c.name]))
    return (id: string | null | undefined) => (id ? map.get(String(id)) ?? null : null)
  }, [collections])

  const [moveTarget, setMoveTarget] = React.useState<QrCodeRow | null>(null)
  const [moveChoice, setMoveChoice] = React.useState<string>(NO_COLLECTION)
  const [moving, setMoving] = React.useState(false)
  const [moveError, setMoveError] = React.useState<string | null>(null)

  function openMove(qr: QrCodeRow) {
    setMoveTarget(qr)
    setMoveChoice(qr.collection_id && collectionName(qr.collection_id) ? String(qr.collection_id) : NO_COLLECTION)
    setMoveError(null)
  }

  async function handleMove() {
    if (!moveTarget) return
    setMoving(true)
    setMoveError(null)
    // Send the existing metadata so the backend's whole-object Metadata
    // replace keeps name/colors/etc.; only collection_id changes.
    const result = await updateQr(moveTarget.id, {
      metadata: moveTarget.metadata,
      collection_id: moveChoice === NO_COLLECTION ? null : moveChoice,
    } as Partial<QrCodeRow>)
    setMoving(false)
    if (!result) {
      setMoveError('Could not move this QR code. Please try again.')
      return
    }
    setMoveTarget(null)
    refetch()
  }

  // Sorted by name, falling back to the short code for rows that never got one.
  // Both grid and list read from this so the two views cannot disagree about
  // ordering, which they would if each sorted separately.
  const sortedQrCodes = React.useMemo(
    () => [...qrCodes].sort((a, b) =>
      (a.name || a.short_code || '').localeCompare(
        b.name || b.short_code || '', undefined, { sensitivity: 'base' })),
    [qrCodes],
  )
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid')
  const [qrPreviews, setQrPreviews] = React.useState<Record<string, string>>({})
  const [deleting, setDeleting] = React.useState<string | null>(null)

  // Generate preview images when qrCodes change
  React.useEffect(() => {
    qrCodes.forEach(async (qr) => {
      if (qrPreviews[qr.id]) return // already generated
      try {
        const dataUrl = await generateQRDataURL({
          data: qr.destination_url,
          size: 200,
          foregroundColor: qr.foreground_color,
          backgroundColor: qr.background_color,
        })
        setQrPreviews(prev => ({ ...prev, [qr.id]: dataUrl }))
      } catch {
        // silently skip preview generation errors
      }
    })
  }, [qrCodes]) // eslint-disable-line react-hooks/exhaustive-deps

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this QR code? This cannot be undone.')) return
    setDeleting(id)
    const success = await remove(id)
    setDeleting(null)
    if (success) {
      refetch()
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader
          title="My QR Codes"
          description="Your personalized, trackable QR codes. Download them for print or share the link."
          actions={
            <Link href="/qr/generator"><Button><Plus className="h-4 w-4" /> Generate New</Button></Link>
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <div className="flex items-center justify-center border-b border-surface-100 bg-surface-50 p-6">
                <div className="h-32 w-32 animate-pulse rounded bg-surface-200" />
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-surface-200" />
                <div className="h-3 w-full animate-pulse rounded bg-surface-100" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title="My QR Codes" description="Your personalized, trackable QR codes." />
        <Card>
          <CardContent className="py-8 text-center text-danger-600">
            Failed to load QR codes: {error}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="My QR Codes"
        description="Your personalized, trackable QR codes. Download them for print or share the link."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-surface-200 overflow-hidden">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 ${viewMode === 'grid' ? 'bg-surface-200 text-surface-700' : 'text-surface-400'}`}><Grid className="h-4 w-4" /></button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 ${viewMode === 'list' ? 'bg-surface-200 text-surface-700' : 'text-surface-400'}`}><List className="h-4 w-4" /></button>
            </div>
            <Link href="/qr/generator"><Button><Plus className="h-4 w-4" /> Generate New</Button></Link>
          </div>
        }
      />

      {sortedQrCodes.length === 0 ? (
        <EmptyState
          icon={<QrCode className="h-8 w-8" />}
          title="You haven't created any QR codes yet"
          description="Generate your first QR code to start tracking scans and conversions."
          action={{ label: 'Generate QR Code', onClick: () => {} }}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedQrCodes.map(qr => (
            <Card key={qr.id} className="group transition-shadow hover:shadow-card-hover">
              <div className="flex items-center justify-center border-b border-surface-100 bg-surface-50 p-6">
                {qrPreviews[qr.id] ? (
                  <NextImage
                    src={qrPreviews[qr.id]}
                    alt={qr.name}
                    width={128}
                    height={128}
                    unoptimized
                    className="h-32 w-32"
                  />
                ) : (
                  <div className="h-32 w-32 animate-pulse rounded bg-surface-200" />
                )}
              </div>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant={qr.brand === 'hato' ? 'hato' : 'info'}>{BRANDS[qr.brand]?.label ?? qr.brand}</Badge>
                  <Badge variant="outline">{qr.status}</Badge>
                  {collectionName(qr.collection_id) && (
                    <Badge variant="outline" className="gap-1"><FolderOpen className="h-3 w-3" />{collectionName(qr.collection_id)}</Badge>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-surface-800">{qr.name}</h3>
                <p className="mt-0.5 text-xs text-surface-400 truncate">{qr.destination_url}</p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs">
                    <BarChart3 className="h-3.5 w-3.5 text-surface-400" />
                    <span className="font-medium text-surface-700">{qr.scan_count}</span>
                    <span className="text-surface-400">scans</span>
                  </div>
                  <span className="text-xs text-surface-400">{formatDate(qr.created_at)}</span>
                </div>
                <div className="mt-3 flex gap-1">
                  <Button variant="ghost" size="icon-sm" title="Copy link" onClick={() => copyToClipboard(qr.redirect_url || qr.destination_url)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Move to collection"
                    aria-label="Move to collection"
                    onClick={() => openMove(qr)}
                  >
                    <FolderInput className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Delete"
                    onClick={() => handleDelete(qr.id)}
                    disabled={deleting === qr.id}
                    className="text-danger-500 hover:text-danger-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="ml-auto" onClick={() => {
                    if (qrPreviews[qr.id]) {
                      const link = document.createElement('a')
                      link.download = `${qr.name || 'qr-code'}.png`
                      link.href = qrPreviews[qr.id]
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    }
                  }}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedQrCodes.map(qr => (
            <Card key={qr.id} className="transition-shadow hover:shadow-card-hover">
              <CardContent className="flex flex-wrap items-center gap-4 py-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-50 border border-surface-100">
                  {qrPreviews[qr.id] ? (
                    <NextImage
                      src={qrPreviews[qr.id]}
                      alt={qr.name}
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10"
                    />
                  ) : (
                    <QrCode className="h-6 w-6 text-surface-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-surface-800">{qr.name}</span>
                    <Badge variant={qr.brand === 'hato' ? 'hato' : 'info'}>{BRANDS[qr.brand]?.label ?? qr.brand}</Badge>
                  </div>
                  <p className="text-xs text-surface-400 truncate">{qr.destination_url}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-surface-500 shrink-0">
                  <span className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" />{qr.scan_count} scans</span>
                  <span>{formatDate(qr.created_at)}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon-sm" onClick={() => copyToClipboard(qr.redirect_url || qr.destination_url)}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Move to collection"
                    aria-label="Move to collection"
                    onClick={() => openMove(qr)}
                  >
                    <FolderInput className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Delete"
                    onClick={() => handleDelete(qr.id)}
                    disabled={deleting === qr.id}
                    className="text-danger-500 hover:text-danger-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    if (qrPreviews[qr.id]) {
                      const link = document.createElement('a')
                      link.download = `${qr.name || 'qr-code'}.png`
                      link.href = qrPreviews[qr.id]
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    }
                  }}><Download className="h-3.5 w-3.5" /> Download</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={!!moveTarget} onOpenChange={open => { if (!open) setMoveTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to collection</DialogTitle>
            <DialogDescription>
              Choose a collection for {moveTarget?.name || 'this QR code'}, or None to leave it uncollected.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-700">Collection</label>
            <Select value={moveChoice} onValueChange={setMoveChoice}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COLLECTION}>None</SelectItem>
                {collections.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {collections.length === 0 && (
              <p className="mt-2 text-xs text-surface-500">
                No collections yet. <Link href="/qr/collections" className="rounded text-brand-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">Create one</Link>.
              </p>
            )}
          </div>
          {moveError && (
            <p className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">{moveError}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setMoveTarget(null)}>Cancel</Button>
            <Button type="button" onClick={handleMove} disabled={moving}>
              {moving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderInput className="h-4 w-4" />}
              {moving ? 'Moving...' : 'Move'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
