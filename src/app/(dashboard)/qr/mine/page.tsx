'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  QrCode, Download, Copy, Link as LinkIcon, Grid, List,
  BarChart3, ExternalLink, Edit, ArrowRight, Plus,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { BRANDS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { generateQRDataURL } from '@/lib/qr/generate'

interface QrCodeItem {
  id: string
  name: string
  short_code: string
  destination_url: string
  brand: 'localvip' | 'hato'
  scan_count: number
  foreground_color: string
  background_color: string
  campaign: string | null
  created_at: string
}

const DEMO_QR_CODES: QrCodeItem[] = [
  { id: 'qr-001', name: 'My LocalVIP Referral', short_code: 'alex-ref1', destination_url: 'https://localvip.com/ref/alex-biz', brand: 'localvip', scan_count: 234, foreground_color: '#2563eb', background_color: '#ffffff', campaign: 'Spring 2026', created_at: '2026-02-01' },
  { id: 'qr-002', name: 'Atlanta Business Card QR', short_code: 'atl-bcard', destination_url: 'https://localvip.com/business', brand: 'localvip', scan_count: 156, foreground_color: '#000000', background_color: '#ffffff', campaign: 'Atlanta Expansion', created_at: '2026-02-15' },
  { id: 'qr-003', name: 'HATO School Flyer', short_code: 'hato-fly1', destination_url: 'https://helpateacherout.com', brand: 'hato', scan_count: 89, foreground_color: '#b0450c', background_color: '#ffffff', campaign: 'Back to School', created_at: '2026-03-01' },
  { id: 'qr-004', name: 'Main Street Campaign', short_code: 'main-st', destination_url: 'https://localvip.com/c/main-street', brand: 'localvip', scan_count: 445, foreground_color: '#1e40af', background_color: '#ffffff', campaign: 'Spring 2026', created_at: '2026-01-20' },
  { id: 'qr-005', name: 'Volunteer Table Tent', short_code: 'vol-tent', destination_url: 'https://localvip.com/volunteer', brand: 'localvip', scan_count: 67, foreground_color: '#15803d', background_color: '#ffffff', campaign: null, created_at: '2026-03-10' },
  { id: 'qr-006', name: 'HATO Donation Poster', short_code: 'hato-don', destination_url: 'https://helpateacherout.com/donate', brand: 'hato', scan_count: 312, foreground_color: '#ec8012', background_color: '#ffffff', campaign: 'Holiday Giving', created_at: '2025-11-15' },
]

export default function MyQrCodesPage() {
  const { profile } = useAuth()
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid')
  const [qrPreviews, setQrPreviews] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    DEMO_QR_CODES.forEach(async (qr) => {
      const dataUrl = await generateQRDataURL({
        data: qr.destination_url,
        size: 200,
        foregroundColor: qr.foreground_color,
        backgroundColor: qr.background_color,
      })
      setQrPreviews(prev => ({ ...prev, [qr.id]: dataUrl }))
    })
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
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

      {DEMO_QR_CODES.length === 0 ? (
        <EmptyState
          icon={<QrCode className="h-8 w-8" />}
          title="You haven't created any QR codes yet"
          description="Generate your first QR code to start tracking scans and conversions."
          action={{ label: 'Generate QR Code', onClick: () => {} }}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_QR_CODES.map(qr => (
            <Card key={qr.id} className="group transition-shadow hover:shadow-card-hover">
              <div className="flex items-center justify-center border-b border-surface-100 bg-surface-50 p-6">
                {qrPreviews[qr.id] ? (
                  <img src={qrPreviews[qr.id]} alt={qr.name} className="h-32 w-32" />
                ) : (
                  <div className="h-32 w-32 animate-pulse rounded bg-surface-200" />
                )}
              </div>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant={qr.brand === 'hato' ? 'hato' : 'info'}>{BRANDS[qr.brand].label}</Badge>
                  {qr.campaign && <Badge variant="outline">{qr.campaign}</Badge>}
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
                  <Button variant="ghost" size="icon-sm" title="Copy link" onClick={() => copyToClipboard(qr.destination_url)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" title="Edit URL">
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="ml-auto">
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {DEMO_QR_CODES.map(qr => (
            <Card key={qr.id} className="transition-shadow hover:shadow-card-hover">
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-50 border border-surface-100">
                  {qrPreviews[qr.id] ? (
                    <img src={qrPreviews[qr.id]} alt={qr.name} className="h-10 w-10" />
                  ) : (
                    <QrCode className="h-6 w-6 text-surface-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-surface-800">{qr.name}</span>
                    <Badge variant={qr.brand === 'hato' ? 'hato' : 'info'}>{BRANDS[qr.brand].label}</Badge>
                  </div>
                  <p className="text-xs text-surface-400 truncate">{qr.destination_url}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-surface-500 shrink-0">
                  <span className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" />{qr.scan_count} scans</span>
                  <span>{formatDate(qr.created_at)}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon-sm" onClick={() => copyToClipboard(qr.destination_url)}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" /> Download</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
