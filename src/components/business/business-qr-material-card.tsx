'use client'

/**
 * The Boomerang list QR and its join link. Moved here from the "My materials"
 * list — that list is uploaded/generated files, not this QR, and Boomerang now
 * has its own tab. The gate (business opted in) lives in the caller
 * (business-boomerang-page.tsx), not here, so this component has none of its own.
 */

import * as React from 'react'
import { ArrowRight, Copy, Download, QrCode } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { generateStyledQR, downloadDataURL } from '@/lib/qr/generate'
import { BOOMERANG_SURFACE, ENGAGEMENT_CODES } from '@/lib/engagement-codes'
import type { BusinessJoinResource } from '@/lib/business-join'

export function BusinessQrMaterialCard({ businessId }: { businessId: string }) {
  const [resource, setResource] = React.useState<BusinessJoinResource | null>(null)
  const [qrPreviewUrl, setQrPreviewUrl] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [message, setMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const response = await fetch(`/api/business-portal/collect?businessId=${encodeURIComponent(businessId)}`, { cache: 'no-store' })
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error || 'Could not load QR code.')
        if (!cancelled) setResource(payload as BusinessJoinResource)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [businessId])

  React.useEffect(() => {
    let cancelled = false

    async function buildQr() {
      if (!resource) {
        setQrPreviewUrl('')
        return
      }
      const next = await generateStyledQR({
        data: resource.redirectUrl || resource.joinUrl,
        size: 260,
        foregroundColor: resource.qrAppearance.foregroundColor,
        backgroundColor: resource.qrAppearance.backgroundColor,
        frameText: resource.qrAppearance.frameText,
        logoUrl: resource.qrAppearance.logoUrl || undefined,
        dotStyle: resource.qrAppearance.dotStyle,
        cornerStyle: resource.qrAppearance.cornerStyle,
        gradientType: resource.qrAppearance.gradientType,
        gradientColors: resource.qrAppearance.gradientColors,
      })
      if (!cancelled) setQrPreviewUrl(next)
    }

    void buildQr()
    return () => {
      cancelled = true
    }
  }, [resource])

  async function copyJoinLink() {
    if (!resource) return
    await navigator.clipboard.writeText(resource.joinUrl)
    setMessage('QR join link copied.')
    window.setTimeout(() => setMessage(null), 1600)
  }

  if (loading || !resource) return null

  return (
    <Card className="overflow-hidden border-brand-200 bg-brand-50/40">
      <CardContent className="grid gap-5 p-5 md:grid-cols-[180px,1fr] md:items-center">
        <div className="flex justify-center rounded-2xl border border-white bg-white p-3 shadow-sm">
          {qrPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrPreviewUrl} alt="Business customer QR code" className="h-40 w-40 object-contain" />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center text-surface-400">
              <QrCode className="h-10 w-10" />
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">Business QR</Badge>
            <Badge variant="success">Always available</Badge>
          </div>
          <div>
            <h3 className="text-base font-semibold text-surface-900">
              {ENGAGEMENT_CODES.business_capture.qrLabel}
            </h3>
            <p className="mt-1 text-sm leading-6 text-surface-600">
              {ENGAGEMENT_CODES.business_capture.outcome} {BOOMERANG_SURFACE.contrast}
            </p>
            <p className="mt-2 break-all font-mono text-xs text-surface-500">{resource.joinUrl}</p>
          </div>
          {message && <p className="text-sm font-medium text-success-700">{message}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={copyJoinLink}>
              <Copy className="h-3.5 w-3.5" /> Copy link
            </Button>
            {qrPreviewUrl && (
              <Button size="sm" variant="outline" onClick={() => downloadDataURL(qrPreviewUrl, `${resource.joinSlug}-customer-qr.png`)}>
                <Download className="h-3.5 w-3.5" /> Download QR
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <a href={resource.joinUrl} target="_blank" rel="noreferrer">
                Open join page <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
