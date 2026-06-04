'use client'

import * as React from 'react'
import { FolderOpen, Plus, QrCode, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { BRANDS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/lib/auth/context'
import type { QrCodeCollection } from '@/lib/types/database'

function useQrCollections() {
  const [data, setData] = React.useState<QrCodeCollection[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refetchKey, setRefetchKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/qa/dashboard/qr_code_collections', { cache: 'no-store' })
        const raw = await res.json()
        const rows: QrCodeCollection[] = Array.isArray(raw) ? raw : raw?.items ?? []
        if (!cancelled) setData(rows)
      } catch {
        if (!cancelled) setData([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [refetchKey])

  return { data, loading, refetch: () => setRefetchKey(k => k + 1) }
}

export default function QrCollectionsPage() {
  const { profile } = useAuth()
  const { data: collections, loading, refetch } = useQrCollections()
  const [addOpen, setAddOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [brand, setBrand] = React.useState<string>('localvip')
  const [saving, setSaving] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/qa/dashboard/qr_code_collections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          brand,
          created_by: profile.id,
          status: 'active',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setCreateError((body as { error?: string }).error || 'Could not create collection. Backend support pending.')
        return
      }
      setAddOpen(false)
      setName('')
      setDescription('')
      setBrand('localvip')
      refetch()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="QR Collections"
        description="Organize QR codes into groups — by campaign, event, material, or team."
        actions={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> New Collection</Button>}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        </div>
      ) : collections.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-8 w-8" />}
          title="No collections yet"
          description="Create a collection to organize your QR codes by campaign or purpose."
          action={{ label: 'New Collection', onClick: () => setAddOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map(col => (
            <Card key={col.id} className="group cursor-pointer transition-shadow hover:shadow-card-hover">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="rounded-lg bg-surface-100 p-2 text-surface-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <Badge variant={col.brand === 'hato' ? 'hato' : 'info'}>
                    {BRANDS[col.brand]?.label || col.brand}
                  </Badge>
                </div>
                <h3 className="text-base font-semibold text-surface-800 group-hover:text-brand-700 transition-colors">
                  {col.name}
                </h3>
                <p className="mt-1 text-xs text-surface-500 line-clamp-2">{col.description || 'No description'}</p>
                <div className="mt-4 flex items-center justify-between border-t border-surface-100 pt-3">
                  <div className="flex items-center gap-1 text-xs text-surface-500">
                    <QrCode className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs text-surface-400">{formatDate(col.created_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Collection</DialogTitle>
            <DialogDescription>Group related QR codes together for easy management.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Collection Name *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Spring 2026 Campaign" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Description</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this collection for?" rows={3} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Brand</label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BRANDS).map(([key, b]) => (
                    <SelectItem key={key} value={key}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {createError && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {createError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? 'Creating...' : 'Create Collection'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
