'use client'

import * as React from 'react'
import NextImage from 'next/image'
import Link from 'next/link'
import {
  QrCode, Download, Copy, Grid, List,
  BarChart3, ExternalLink, Key, Plus, Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { useQrCodes, useQrCodeDelete } from '@/lib/supabase/hooks'
import { createClient } from '@/lib/supabase/client'
import { BRANDS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { generateQRDataURL } from '@/lib/qr/generate'

interface StakeholderCodeEntry {
  stakeholder_id: string
  referral_code: string | null
  connection_code: string | null
  join_url: string | null
}

export default function MyQrCodesPage() {
  const { profile } = useAuth()
  const supabase = React.useMemo(() => createClient(), [])
  const { data: qrCodes, loading, error, refetch } = useQrCodes({ created_by: profile.id })
  const { remove } = useQrCodeDelete()
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid')
  const [qrPreviews, setQrPreviews] = React.useState<Record<string, string>>({})
  const [deleting, setDeleting] = React.useState<string | null>(null)
  const [stakeholderCodes, setStakeholderCodes] = React.useState<Map<string, StakeholderCodeEntry>>(new Map())

  // Load stakeholder codes for the listed QR codes
  React.useEffect(() => {
    const ids = qrCodes.map(q => q.stakeholder_id).filter(Boolean) as string[]
    if (ids.length === 0) return
    void (supabase as any)
      .from('stakeholder_codes')
      .select('stakeholder_id, referral_code, connection_code, join_url')
      .in('stakeholder_id', ids)
      .then(({ data }: { data: StakeholderCodeEntry[] | null }) => {
        setStakeholderCodes(new Map((data || []).map(c => [c.stakeholder_id, c])))
      })
  }, [supabase, qrCodes])

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

      {qrCodes.length === 0 ? (
        <EmptyState
          icon={<QrCode className="h-8 w-8" />}
          title="You haven't created any QR codes yet"
          description="Generate your first QR code to start tracking scans and conversions."
          action={{ label: 'Generate QR Code', onClick: () => {} }}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {qrCodes.map(qr => (
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
                {/* Codes display */}
                {qr.stakeholder_id && stakeholderCodes.get(qr.stakeholder_id) && (() => {
                  const c = stakeholderCodes.get(qr.stakeholder_id!)!
                  return (
                    <div className="mt-3 rounded-lg border border-surface-100 bg-surface-50 p-2.5 space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wide font-medium text-surface-400 flex items-center gap-1">
                        <Key className="h-2.5 w-2.5" /> Referral codes
                      </p>
                      {c.referral_code && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-surface-500">Referral</span>
                          <div className="flex items-center gap-1">
                            <code className="rounded bg-white border border-surface-200 px-1.5 py-0.5 text-xs font-mono text-surface-800">{c.referral_code}</code>
                            <button onClick={() => copyToClipboard(c.referral_code!)} className="text-surface-300 hover:text-brand-600 transition-colors" title="Copy"><Copy className="h-3 w-3" /></button>
                          </div>
                        </div>
                      )}
                      {c.connection_code && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-surface-500">Connection</span>
                          <div className="flex items-center gap-1">
                            <code className="rounded bg-white border border-surface-200 px-1.5 py-0.5 text-xs font-mono text-surface-800">{c.connection_code}</code>
                            <button onClick={() => copyToClipboard(c.connection_code!)} className="text-surface-300 hover:text-brand-600 transition-colors" title="Copy"><Copy className="h-3 w-3" /></button>
                          </div>
                        </div>
                      )}
                      {c.join_url && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-surface-500">Join URL</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => copyToClipboard(c.join_url!)} className="text-surface-300 hover:text-brand-600 transition-colors" title="Copy link"><Copy className="h-3 w-3" /></button>
                            <a href={c.join_url} target="_blank" rel="noopener noreferrer" className="text-surface-300 hover:text-brand-600 transition-colors" title="Open join page"><ExternalLink className="h-3 w-3" /></a>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
                <div className="mt-3 flex gap-1">
                  <Button variant="ghost" size="icon-sm" title="Copy link" onClick={() => copyToClipboard(qr.redirect_url || qr.destination_url)}>
                    <Copy className="h-3.5 w-3.5" />
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
          {qrCodes.map(qr => (
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
                  {/* Inline codes for list view */}
                  {qr.stakeholder_id && stakeholderCodes.get(qr.stakeholder_id) && (() => {
                    const c = stakeholderCodes.get(qr.stakeholder_id!)!
                    return (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {c.referral_code && (
                          <span className="flex items-center gap-1 text-[10px] text-surface-500">
                            <Key className="h-2.5 w-2.5" />
                            <code className="rounded bg-surface-100 px-1 py-0.5 font-mono">{c.referral_code}</code>
                            <button onClick={() => copyToClipboard(c.referral_code!)} className="text-surface-300 hover:text-brand-600" title="Copy referral code"><Copy className="h-2.5 w-2.5" /></button>
                          </span>
                        )}
                        {c.join_url && (
                          <span className="flex items-center gap-1 text-[10px] text-surface-500">
                            <a href={c.join_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-brand-600 hover:underline">
                              <ExternalLink className="h-2.5 w-2.5" /> Join page
                            </a>
                            <button onClick={() => copyToClipboard(c.join_url!)} className="text-surface-300 hover:text-brand-600" title="Copy join URL"><Copy className="h-2.5 w-2.5" /></button>
                          </span>
                        )}
                      </div>
                    )
                  })()}
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
    </div>
  )
}
