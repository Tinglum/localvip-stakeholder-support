'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Palette,
  Printer,
  QrCode,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { generateStyledQR, downloadDataURL, downloadSVG } from '@/lib/qr/generate'
import {
  BUSINESS_ACCENT_BADGE_CLASS,
  BUSINESS_ACCENT_BUTTON_CLASS,
  BUSINESS_ACCENT_DARK_HEX,
  BUSINESS_ACCENT_HEX,
  BUSINESS_ACCENT_OUTLINE_BUTTON_CLASS,
  BUSINESS_ACCENT_SURFACE_CLASS,
} from '@/lib/business-theme'
import type { Business } from '@/lib/types/database'
import type { BusinessJoinQrAppearance, BusinessJoinResource } from '@/lib/business-join'

interface BusinessJoinQrCardProps {
  business: Business
  totalClients: number
  todayAdds: number
  progressPercent: number
  compact?: boolean
  className?: string
}

const QR_PRESETS: Array<{
  id: string
  label: string
  foregroundColor: string
  backgroundColor: string
  gradientType: BusinessJoinQrAppearance['gradientType']
  gradientColors: [string, string]
}> = [
  {
    id: 'business-default',
    label: 'Business Default',
    foregroundColor: BUSINESS_ACCENT_HEX,
    backgroundColor: '#ffffff',
    gradientType: 'none',
    gradientColors: [BUSINESS_ACCENT_HEX, BUSINESS_ACCENT_DARK_HEX],
  },
  {
    id: 'midnight',
    label: 'Midnight',
    foregroundColor: '#0f172a',
    backgroundColor: '#ffffff',
    gradientType: 'none',
    gradientColors: ['#0f172a', '#1e293b'],
  },
  {
    id: 'emerald',
    label: 'Emerald Fade',
    foregroundColor: '#047857',
    backgroundColor: '#ffffff',
    gradientType: 'linear',
    gradientColors: ['#10b981', '#047857'],
  },
]

const DOT_STYLE_OPTIONS: Array<{ value: BusinessJoinQrAppearance['dotStyle']; label: string }> = [
  { value: 'rounded', label: 'Rounded' },
  { value: 'square', label: 'Square' },
  { value: 'dots', label: 'Dots' },
  { value: 'classy', label: 'Classy' },
  { value: 'classy-rounded', label: 'Classy Rounded' },
  { value: 'extra-rounded', label: 'Extra Rounded' },
]

const CORNER_STYLE_OPTIONS: Array<{ value: BusinessJoinQrAppearance['cornerStyle']; label: string }> = [
  { value: 'rounded', label: 'Rounded' },
  { value: 'square', label: 'Square' },
  { value: 'dots', label: 'Dots' },
  { value: 'extra-rounded', label: 'Extra Rounded' },
]

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
  const [customizeOpen, setCustomizeOpen] = React.useState(false)
  const [appearanceDraft, setAppearanceDraft] = React.useState<BusinessJoinQrAppearance | null>(null)
  const [savingAppearance, setSavingAppearance] = React.useState(false)
  const [appearanceError, setAppearanceError] = React.useState<string | null>(null)

  const previewSize = compact ? 320 : 420
  const previewAppearance = customizeOpen && appearanceDraft ? appearanceDraft : resource?.qrAppearance || null
  const previewHeight = previewSize + (previewAppearance?.frameText ? 56 : 0)

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
    if (!resource) return
    setAppearanceDraft(resource.qrAppearance)
  }, [resource])

  React.useEffect(() => {
    let cancelled = false

    async function buildPreview() {
      if (!resource || !previewAppearance) {
        setQrPreviewUrl('')
        return
      }

      const nextPreview = await generateStyledQR({
        data: resource.redirectUrl,
        size: previewSize,
        foregroundColor: previewAppearance.foregroundColor,
        backgroundColor: previewAppearance.backgroundColor,
        frameText: previewAppearance.frameText,
        logoUrl: previewAppearance.logoUrl || undefined,
        dotStyle: previewAppearance.dotStyle,
        cornerStyle: previewAppearance.cornerStyle,
        gradientType: previewAppearance.gradientType,
        gradientColors: previewAppearance.gradientColors,
      })

      if (!cancelled) {
        setQrPreviewUrl(nextPreview)
      }
    }

    void buildPreview()

    return () => {
      cancelled = true
    }
  }, [previewAppearance, previewSize, resource])

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
    if (!qrPreviewUrl || !resource) return

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${previewSize}" height="${previewHeight}" viewBox="0 0 ${previewSize} ${previewHeight}">
        <image href="${qrPreviewUrl}" x="0" y="0" width="${previewSize}" height="${previewHeight}" />
      </svg>
    `.trim()

    downloadSVG(svg, `${resource.joinSlug}-offer-qr.svg`)
  }

  function handlePrintPoster() {
    if (!resource || !qrPreviewUrl) return

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=980,height=1320')
    if (!printWindow) return

    const cityLabel = [business.address].filter(Boolean).join(' ')
    const offerDescription = resource.offerValue || resource.offerTitle || 'Scan to claim your offer'
    const instructions = 'Scan the QR, enter your details, and show your phone at checkout.'

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${business.name} Poster</title>
          <style>
            @page { size: auto; margin: 18mm; }
            body {
              margin: 0;
              font-family: Arial, sans-serif;
              color: #182033;
              background: #ffffff;
            }
            .poster {
              border: 6px solid ${BUSINESS_ACCENT_HEX};
              border-radius: 28px;
              overflow: hidden;
            }
            .hero {
              background: linear-gradient(135deg, #fbfdd9 0%, #f6ff96 100%);
              padding: 42px 40px 28px;
              text-align: center;
            }
            .eyebrow {
              letter-spacing: 0.28em;
              font-size: 12px;
              font-weight: 700;
              text-transform: uppercase;
              color: #556100;
            }
            .title {
              margin: 14px 0 10px;
              font-size: 42px;
              line-height: 1.05;
              font-weight: 800;
            }
            .subtitle {
              font-size: 20px;
              line-height: 1.5;
              color: #3c4658;
            }
            .body {
              display: grid;
              grid-template-columns: 1fr 280px;
              gap: 32px;
              padding: 36px 40px 40px;
              align-items: center;
            }
            .offer {
              border: 2px solid #e8ecf4;
              border-radius: 24px;
              padding: 24px;
              margin-bottom: 22px;
            }
            .offer-label {
              letter-spacing: 0.2em;
              font-size: 12px;
              font-weight: 700;
              text-transform: uppercase;
              color: #556100;
            }
            .offer-value {
              margin-top: 12px;
              font-size: 30px;
              line-height: 1.15;
              font-weight: 800;
            }
            .offer-copy {
              margin-top: 10px;
              font-size: 18px;
              line-height: 1.55;
              color: #425065;
            }
            .instructions {
              font-size: 18px;
              line-height: 1.7;
            }
            .qr-box {
              border: 2px dashed #d4dbe7;
              border-radius: 28px;
              padding: 18px;
              text-align: center;
            }
            .qr-box img {
              width: 100%;
              max-width: 240px;
              height: auto;
              display: block;
              margin: 0 auto;
            }
            .cta {
              margin-top: 16px;
              padding: 14px 16px;
              border-radius: 16px;
              background: ${BUSINESS_ACCENT_HEX};
              color: #182033;
              font-size: 18px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.08em;
            }
            .footer {
              padding: 0 40px 36px;
              font-size: 15px;
              color: #5b6779;
              text-align: center;
            }
            .url {
              margin-top: 10px;
              font-size: 13px;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <div class="poster">
            <div class="hero">
              <div class="eyebrow">Customer Capture Offer</div>
              <div class="title">${business.name}</div>
              <div class="subtitle">${cityLabel || 'Scan to claim this local offer today.'}</div>
            </div>
            <div class="body">
              <div>
                <div class="offer">
                  <div class="offer-label">Show this at checkout</div>
                  <div class="offer-value">${resource.offerTitle}</div>
                  <div class="offer-copy">${offerDescription}</div>
                </div>
                <div class="instructions">${instructions}</div>
              </div>
              <div class="qr-box">
                <img src="${qrPreviewUrl}" alt="${business.name} QR code" />
                <div class="cta">${resource.qrAppearance.frameText || 'Get my offer'}</div>
              </div>
            </div>
            <div class="footer">
              Scan, register, and keep the claim screen open until your offer is redeemed.
              <div class="url">${resource.displayUrl}</div>
            </div>
          </div>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  async function handleSaveAppearance() {
    if (!appearanceDraft || !resource) return

    setSavingAppearance(true)
    setAppearanceError(null)

    try {
      const response = await fetch(`/api/business-portal/collect?businessId=${business.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foregroundColor: appearanceDraft.foregroundColor,
          backgroundColor: appearanceDraft.backgroundColor,
          frameText: appearanceDraft.frameText,
          useBusinessLogo: appearanceDraft.useBusinessLogo,
          dotStyle: appearanceDraft.dotStyle,
          cornerStyle: appearanceDraft.cornerStyle,
          gradientType: appearanceDraft.gradientType,
          gradientColors: appearanceDraft.gradientColors,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'QR appearance could not be saved.')
      }

      setResource(payload as BusinessJoinResource)
      setCustomizeOpen(false)
    } catch (requestError) {
      setAppearanceError(requestError instanceof Error ? requestError.message : 'QR appearance could not be saved.')
    } finally {
      setSavingAppearance(false)
    }
  }

  function applyPreset(presetId: string) {
    const preset = QR_PRESETS.find((item) => item.id === presetId)
    if (!preset || !appearanceDraft) return

    setAppearanceDraft({
      ...appearanceDraft,
      foregroundColor: preset.foregroundColor,
      backgroundColor: preset.backgroundColor,
      gradientType: preset.gradientType,
      gradientColors: preset.gradientColors,
    })
  }

  const containerClasses = compact
    ? 'grid gap-5 lg:grid-cols-[220px,1fr]'
    : 'grid gap-6 xl:grid-cols-[260px,1fr]'

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-[#556100]" />
                Collect Customers
              </CardTitle>
              <p className="mt-2 text-sm text-surface-600">
                Place this QR code where customers can scan it to get your pre-launch customer capture offer.
              </p>
            </div>
            <Badge className={BUSINESS_ACCENT_BADGE_CLASS}>Build Your 100 List</Badge>
          </div>
        </CardHeader>
        <CardContent className={containerClasses}>
          <div className={`rounded-[1.75rem] border p-4 ${BUSINESS_ACCENT_SURFACE_CLASS.replace('bg-gradient-to-r', 'bg-gradient-to-br')}`}>
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
                  className="h-full max-h-[330px] w-full max-w-[330px] object-contain"
                />
              ) : null}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-surface-500">
              <span>{resource?.qrAppearance.logoUrl ? 'Business logo centered by default' : 'Add a logo in branding to center it in the QR'}</span>
              <Button
                variant="outline"
                size="sm"
                className={BUSINESS_ACCENT_OUTLINE_BUTTON_CLASS}
                onClick={() => setCustomizeOpen(true)}
                disabled={!resource}
              >
                <Palette className="h-3.5 w-3.5" />
                Customize QR
              </Button>
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
                  <Button
                    variant="outline"
                    size="sm"
                    className={BUSINESS_ACCENT_OUTLINE_BUTTON_CLASS}
                    onClick={() => void handleCopyLink()}
                    disabled={!resource}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? 'Copied' : 'Copy Link'}
                  </Button>
                  {resource && (
                    <Button variant="outline" size="sm" className={BUSINESS_ACCENT_OUTLINE_BUTTON_CLASS} asChild>
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
              <MetricCard label="Today's adds" value={todayAdds} />
              <MetricCard label="Progress" value={`${progressPercent}%`} />
            </div>

            <div className="rounded-[1.5rem] border border-surface-200 bg-white p-4">
              {resource?.offerTitle && (
                <Link href="/portal/setup?step=capture" className="mb-4 block rounded-2xl border border-[#d7e200] bg-[#fbfdd9] px-4 py-3 transition hover:border-[#c7d400] hover:bg-[#f6fac1]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#728000]">Customer capture offer</p>
                      <p className="mt-2 text-base font-semibold text-surface-900">{resource.offerTitle}</p>
                      {resource.offerValue && <p className="mt-1 text-sm text-surface-600">{resource.offerValue}</p>}
                    </div>
                    <Badge className={BUSINESS_ACCENT_BADGE_CLASS}>Edit offer</Badge>
                  </div>
                </Link>
              )}
              <p className="text-sm font-semibold text-surface-900">What happens next</p>
              <div className="mt-3 space-y-2 text-sm text-surface-600">
                <p>1. A customer scans the QR.</p>
                <p>2. They land on your capture-offer page.</p>
                <p>3. Their contact is added straight into Our Clients.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className={BUSINESS_ACCENT_BUTTON_CLASS} onClick={handleDownloadPng} disabled={!qrPreviewUrl}>
                <Download className="h-4 w-4" />
                Download PNG
              </Button>
              <Button variant="outline" className={BUSINESS_ACCENT_OUTLINE_BUTTON_CLASS} onClick={handleDownloadSvg} disabled={!qrPreviewUrl}>
                <Download className="h-4 w-4" />
                Download SVG
              </Button>
              <Button variant="outline" className={BUSINESS_ACCENT_OUTLINE_BUTTON_CLASS} onClick={handlePrintPoster} disabled={!resource || !qrPreviewUrl}>
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

      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Customize Your Customer QR</DialogTitle>
            <DialogDescription>
              Save the look you want once, and this capture QR will keep using it until you change it again.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
            <div className="rounded-[1.5rem] border border-surface-200 bg-surface-50 p-4">
              <div className="flex min-h-[320px] items-center justify-center rounded-[1.25rem] border border-dashed border-surface-200 bg-white p-4">
                {qrPreviewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={qrPreviewUrl} alt="QR preview" className="h-full max-h-[320px] w-full max-w-[320px] object-contain" />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-surface-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating preview...
                  </div>
                )}
              </div>
              <div className="mt-3 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-600">
                {appearanceDraft?.useBusinessLogo
                  ? resource?.logoUrl
                    ? 'Your business logo is centered in the QR by default.'
                    : 'Turn off the center logo or add one in Branding first.'
                  : 'Center logo is off for this QR.'}
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-surface-500">Quick looks</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {QR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className="rounded-2xl border border-surface-200 bg-white px-4 py-3 text-left transition hover:border-[#d7e200] hover:bg-[#f6fac1]"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-8 w-8 rounded-full border border-white shadow-sm"
                          style={{
                            background: preset.gradientType === 'none'
                              ? preset.foregroundColor
                              : `linear-gradient(135deg, ${preset.gradientColors[0]}, ${preset.gradientColors[1]})`,
                          }}
                        />
                        <div>
                          <p className="text-sm font-semibold text-surface-900">{preset.label}</p>
                          <p className="text-xs text-surface-500">{preset.gradientType === 'none' ? 'Solid color' : 'Gradient look'}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Foreground color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={appearanceDraft?.foregroundColor || '#2563eb'}
                      onChange={(event) => setAppearanceDraft((current) => current ? { ...current, foregroundColor: event.target.value } : current)}
                      className="h-11 w-16 rounded-xl border border-surface-300 bg-white p-1"
                    />
                    <Input
                      value={appearanceDraft?.foregroundColor || ''}
                      onChange={(event) => setAppearanceDraft((current) => current ? { ...current, foregroundColor: event.target.value } : current)}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Background color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={appearanceDraft?.backgroundColor || '#ffffff'}
                      onChange={(event) => setAppearanceDraft((current) => current ? { ...current, backgroundColor: event.target.value } : current)}
                      className="h-11 w-16 rounded-xl border border-surface-300 bg-white p-1"
                    />
                    <Input
                      value={appearanceDraft?.backgroundColor || ''}
                      onChange={(event) => setAppearanceDraft((current) => current ? { ...current, backgroundColor: event.target.value } : current)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Dot style</label>
                  <Select
                    value={appearanceDraft?.dotStyle || 'rounded'}
                    onValueChange={(value) => setAppearanceDraft((current) => current ? { ...current, dotStyle: value as BusinessJoinQrAppearance['dotStyle'] } : current)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOT_STYLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Corner style</label>
                  <Select
                    value={appearanceDraft?.cornerStyle || 'rounded'}
                    onValueChange={(value) => setAppearanceDraft((current) => current ? { ...current, cornerStyle: value as BusinessJoinQrAppearance['cornerStyle'] } : current)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CORNER_STYLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Gradient</label>
                  <Select
                    value={appearanceDraft?.gradientType || 'none'}
                    onValueChange={(value) => setAppearanceDraft((current) => current ? { ...current, gradientType: value as BusinessJoinQrAppearance['gradientType'] } : current)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="linear">Linear</SelectItem>
                      <SelectItem value="radial">Radial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Gradient start</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={appearanceDraft?.gradientColors[0] || '#2563eb'}
                      onChange={(event) => setAppearanceDraft((current) => current ? { ...current, gradientColors: [event.target.value, current.gradientColors[1]] } : current)}
                      className="h-11 w-16 rounded-xl border border-surface-300 bg-white p-1"
                    />
                    <Input
                      value={appearanceDraft?.gradientColors[0] || ''}
                      onChange={(event) => setAppearanceDraft((current) => current ? { ...current, gradientColors: [event.target.value, current.gradientColors[1]] } : current)}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Gradient end</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={appearanceDraft?.gradientColors[1] || '#1d4ed8'}
                      onChange={(event) => setAppearanceDraft((current) => current ? { ...current, gradientColors: [current.gradientColors[0], event.target.value] } : current)}
                      className="h-11 w-16 rounded-xl border border-surface-300 bg-white p-1"
                    />
                    <Input
                      value={appearanceDraft?.gradientColors[1] || ''}
                      onChange={(event) => setAppearanceDraft((current) => current ? { ...current, gradientColors: [current.gradientColors[0], event.target.value] } : current)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Button text below the QR</label>
                <Input
                  value={appearanceDraft?.frameText || ''}
                  onChange={(event) => setAppearanceDraft((current) => current ? { ...current, frameText: event.target.value.toUpperCase().slice(0, 40) } : current)}
                  placeholder="GET MY OFFER"
                />
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-700">
                <input
                  type="checkbox"
                  checked={appearanceDraft?.useBusinessLogo || false}
                  onChange={(event) => setAppearanceDraft((current) => current ? { ...current, useBusinessLogo: event.target.checked, logoUrl: event.target.checked ? resource?.logoUrl || null : null } : current)}
                  className="mt-1 h-4 w-4 rounded border-surface-300 text-[#728000] focus:ring-[#d7e200]"
                />
                <span>
                  <span className="block font-medium text-surface-900">Use the business logo in the middle by default</span>
                  <span className="block text-surface-500">If there is no logo yet, add one in Branding and it will show up here automatically.</span>
                </span>
              </label>

              {appearanceError && (
                <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                  {appearanceError}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" className={BUSINESS_ACCENT_OUTLINE_BUTTON_CLASS} asChild>
              <Link href="/portal/setup?step=branding">
                {resource?.logoUrl ? 'Open Branding' : 'Add Logo in Branding'}
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className={BUSINESS_ACCENT_OUTLINE_BUTTON_CLASS} onClick={() => setCustomizeOpen(false)}>
                Cancel
              </Button>
              <Button type="button" className={BUSINESS_ACCENT_BUTTON_CLASS} onClick={() => void handleSaveAppearance()} disabled={!appearanceDraft || savingAppearance}>
                {savingAppearance ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save QR style
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#d7e200] bg-[#fbfdd9] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-[#728000]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-surface-900">{value}</p>
    </div>
  )
}
