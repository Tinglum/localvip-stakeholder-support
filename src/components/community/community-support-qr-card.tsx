'use client'

import * as React from 'react'
import Link from 'next/link'
import { Copy, Download, ExternalLink, Loader2, QrCode, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { generateQRSVG, generateStyledQR, downloadDataURL, downloadSVG } from '@/lib/qr/generate'
import type { Cause } from '@/lib/types/database'
import type { CommunitySupportResource } from '@/lib/community-support'

interface CommunitySupportQrCardProps {
  cause: Cause
  totalSupporters: number
}

export function CommunitySupportQrCard({ cause, totalSupporters }: CommunitySupportQrCardProps) {
  const [resource, setResource] = React.useState<CommunitySupportResource | null>(null)
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
        const response = await fetch(`/api/community/share?causeId=${cause.id}`)
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.error || 'Supporter QR could not be prepared.')
        }

        if (!cancelled) {
          setResource(payload as CommunitySupportResource)
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Supporter QR could not be prepared.')
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
  }, [cause.id])

  React.useEffect(() => {
    let cancelled = false

    async function buildPreview() {
      if (!resource) {
        setQrPreviewUrl('')
        return
      }

      const nextPreview = await generateStyledQR({
        data: resource.redirectUrl,
        size: 420,
        foregroundColor: resource.brand === 'hato' ? '#ec8012' : '#db2777',
        backgroundColor: '#ffffff',
        frameText: resource.frameText,
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
  }, [resource])

  async function handleCopyLink() {
    if (!resource) return
    await navigator.clipboard.writeText(resource.supportUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  function handleDownloadPng() {
    if (!qrPreviewUrl || !resource) return
    downloadDataURL(qrPreviewUrl, `${resource.supportSlug}-supporter-qr.png`)
  }

  function handleDownloadSvg() {
    if (!resource) return
    const svg = generateQRSVG({
      data: resource.redirectUrl,
      size: 1024,
      foregroundColor: resource.brand === 'hato' ? '#ec8012' : '#db2777',
      backgroundColor: '#ffffff',
    })
    downloadSVG(svg, `${resource.supportSlug}-supporter-qr.svg`)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-pink-600" />
              Supporter QR
            </CardTitle>
            <p className="mt-2 text-sm text-surface-600">
              Give your community a simple page they can open in seconds and share again just as easily.
            </p>
          </div>
          <Badge variant="info">Public supporter page</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 xl:grid-cols-[240px,1fr]">
        <div className="rounded-[1.75rem] border border-surface-200 bg-gradient-to-br from-pink-50 via-white to-rose-50 p-4">
          <div className="flex min-h-[280px] items-center justify-center rounded-[1.5rem] border border-dashed border-surface-200 bg-white p-4">
            {loading ? (
              <div className="flex flex-col items-center gap-3 text-surface-400">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Preparing your QR...</p>
              </div>
            ) : error ? (
              <div className="text-center text-sm text-danger-600">{error}</div>
            ) : qrPreviewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={qrPreviewUrl} alt={`${cause.name} supporter QR`} className="h-full max-h-[300px] w-full max-w-[300px] object-contain" />
            ) : null}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[1.5rem] border border-surface-200 bg-surface-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Support link</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <code className="overflow-x-auto rounded-xl bg-white px-3 py-2 font-mono text-xs text-pink-700 shadow-sm">
                {resource?.displayUrl || 'Preparing your link...'}
              </code>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void handleCopyLink()} disabled={!resource}>
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? 'Copied' : 'Copy Link'}
                </Button>
                {resource && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={resource.supportUrl} target="_blank">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Page
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Total supporters</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900">{totalSupporters}</p>
            </div>
            <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">What this does</p>
              <p className="mt-1 text-sm font-medium text-surface-900">Mobilizes your community</p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-surface-200 bg-white p-4">
            <p className="text-sm font-semibold text-surface-900">What happens next</p>
            <div className="mt-3 space-y-2 text-sm text-surface-600">
              <p>1. A supporter scans the QR.</p>
              <p>2. They land on your public supporter page.</p>
              <p>3. Their signup shows up in your supporter list.</p>
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
            <Badge variant="outline" className="self-center">
              <Users className="h-3.5 w-3.5" />
              Syncs into supporters
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
