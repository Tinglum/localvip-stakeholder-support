'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Printer,
  QrCode,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { generateQRSVG, generateStyledQR, downloadDataURL, downloadSVG } from '@/lib/qr/generate'
import type { Business } from '@/lib/types/database'
import type { BusinessJoinResource } from '@/lib/business-join'

interface BusinessJoinQrCardProps {
  business: Business
  totalClients: number
  todayAdds: number
  progressPercent: number
  compact?: boolean
  className?: string
}

export function BusinessJoinQrCard({
  business,
  totalClients,
  todayAdds,
  progressPercent,
  compact = false,
  className,
}: BusinessJoinQrCardProps) {
  const [resource, setResource] = React.useState<BusinessJoinResource | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [qrPreviewUrl, setQrPreviewUrl] = React.useState('')
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/business-portal/collect?businessId=${business.id}`)
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.error || 'Customer capture could not be prepared.')
        }

        if (!cancelled) {
          setResource(payload as BusinessJoinResource)
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Customer capture could not be prepared.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [business.id])

  React.useEffect(() => {
    let cancelled = false

    async function buildPreview() {
      if (!resource) {
        setQrPreviewUrl('')
        return
      }

      const nextPreview = await generateStyledQR({
        data: resource.redirectUrl,
        size: compact ? 320 : 420,
        foregroundColor: resource.brand === 'hato' ? '#ec8012' : '#2563eb',
        backgroundColor: '#ffffff',
        frameText: resource.frameText,
        logoUrl: resource.logoUrl || undefined,
        dotStyle: 'rounded',
        cornerStyle: 'rounded',
      })

      if (!cancelled) {
        setQrPreviewUrl(nextPreview)
      }
    }

    void buildPreview()

    return () => {
      cancelled = true
    }
  }, [compact, resource])

  async function handleCopyLink() {
    if (!resource) return
    await navigator.clipboard.writeText(resource.joinUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  function handleDownloadPng() {
    if (!qrPreviewUrl || !resource) return
    downloadDataURL(qrPreviewUrl, `${resource.joinSlug}-offer-qr.png`)
  }

  function handleDownloadSvg() {
    if (!resource) return
    const svg = generateQRSVG({
      data: resource.redirectUrl,
      size: 1024,
      foregroundColor: resource.brand === 'hato' ? '#ec8012' : '#2563eb',
      backgroundColor: '#ffffff',
    })
    downloadSVG(svg, `${resource.joinSlug}-offer-qr.svg`)
  }

  const containerClasses = compact
    ? 'grid gap-5 lg:grid-cols-[220px,1fr]'
    : 'grid gap-6 xl:grid-cols-[260px,1fr]'

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-brand-600" />
              Collect Customers
            </CardTitle>
            <p className="mt-2 text-sm text-surface-600">
              Place this QR code where customers can scan it to get your pre-launch customer capture offer.
            </p>
          </div>
          <Badge variant="info">Build Your 100 List</Badge>
        </div>
      </CardHeader>
      <CardContent className={containerClasses}>
        <div className="rounded-[1.75rem] border border-surface-200 bg-gradient-to-br from-surface-50 via-white to-brand-50 p-4">
          <div className="flex min-h-[260px] items-center justify-center rounded-[1.5rem] border border-dashed border-surface-200 bg-white p-4">
            {loading ? (
              <div className="flex flex-col items-center gap-3 text-surface-400">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Preparing your QR code...</p>
              </div>
            ) : error ? (
              <div className="text-center text-sm text-danger-600">{error}</div>
            ) : qrPreviewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrPreviewUrl}
                alt={`${business.name} customer capture QR`}
                className="h-full max-h-[290px] w-full max-w-[290px] object-contain"
              />
            ) : null}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[1.5rem] border border-surface-200 bg-surface-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Offer link</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <code className="overflow-x-auto rounded-xl bg-white px-3 py-2 font-mono text-xs text-brand-700 shadow-sm">
                {resource?.displayUrl || 'Preparing your link...'}
              </code>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void handleCopyLink()} disabled={!resource}>
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? 'Copied' : 'Copy Link'}
                </Button>
                {resource && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={resource.joinUrl} target="_blank">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Page
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Total clients" value={totalClients} />
            <MetricCard label="Today’s adds" value={todayAdds} />
            <MetricCard label="Progress" value={`${progressPercent}%`} />
          </div>

          <div className="rounded-[1.5rem] border border-surface-200 bg-white p-4">
            {resource?.offerTitle && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Customer capture offer</p>
                <p className="mt-2 text-base font-semibold text-surface-900">{resource.offerTitle}</p>
                {resource.offerValue && <p className="mt-1 text-sm text-surface-600">{resource.offerValue}</p>}
              </div>
            )}
            <p className="text-sm font-semibold text-surface-900">What happens next</p>
            <div className="mt-3 space-y-2 text-sm text-surface-600">
              <p>1. A customer scans the QR.</p>
              <p>2. They land on your capture-offer page.</p>
              <p>3. Their contact is added straight into Our Clients.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleDownloadPng} disabled={!qrPreviewUrl}>
              <Download className="h-4 w-4" />
              Download PNG
            </Button>
            <Button variant="outline" onClick={handleDownloadSvg} disabled={!resource}>
              <Download className="h-4 w-4" />
              Download SVG
            </Button>
            <Button variant="outline" disabled>
              <Printer className="h-4 w-4" />
              Print Poster
            </Button>
            <Badge variant="outline" className="self-center">
              <Users className="h-3.5 w-3.5" />
              Auto-syncs into Our Clients
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-surface-900">{value}</p>
    </div>
  )
}
