'use client'

import * as React from 'react'
import {
  QrCode, Download, Copy, Link, Settings, Palette,
  Check, ChevronDown, Sparkles, Tag, MapPin, Building2,
  Heart, Users, FolderOpen, Megaphone, ExternalLink,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { QR_DESTINATION_PRESETS, BRANDS } from '@/lib/constants'
import { generateShortCode } from '@/lib/utils'
import { generateQRDataURL, generateQRSVG, generateQRWithFrame, downloadDataURL, downloadSVG } from '@/lib/qr/generate'

// ─── Demo dropdown data ─────────────────────────────────────

const DEMO_CAMPAIGNS = [
  { value: 'spring-2026', label: 'Spring 2026 Launch' },
  { value: 'back-to-school', label: 'Back to School 2026' },
  { value: 'holiday-giving', label: 'Holiday Giving Drive' },
  { value: 'atlanta-expansion', label: 'Atlanta Expansion' },
]

const DEMO_CITIES = [
  { value: 'atlanta', label: 'Atlanta, GA' },
  { value: 'charlotte', label: 'Charlotte, NC' },
  { value: 'nashville', label: 'Nashville, TN' },
  { value: 'miami', label: 'Miami, FL' },
  { value: 'austin', label: 'Austin, TX' },
]

const DEMO_STAKEHOLDERS = [
  { value: 'alex-rivera', label: 'Alex Rivera' },
  { value: 'casey-adams', label: 'Casey Adams' },
  { value: 'jordan-taylor', label: 'Jordan Taylor' },
  { value: 'sarah-johnson', label: 'Dr. Sarah Johnson' },
]

const DEMO_BUSINESSES = [
  { value: 'main-street-bakery', label: 'Main Street Bakery' },
  { value: 'river-cafe', label: 'River Cafe' },
  { value: 'summit-fitness', label: 'Summit Fitness' },
]

const DEMO_CAUSES = [
  { value: 'oak-hill-elementary', label: 'Oak Hill Elementary' },
  { value: 'community-strong', label: 'CommunityStrong Foundation' },
  { value: 'bright-futures', label: 'Bright Futures Academy' },
]

const DEMO_COLLECTIONS = [
  { value: 'spring-flyers', label: 'Spring Flyers' },
  { value: 'business-cards', label: 'Business Card QRs' },
  { value: 'event-materials', label: 'Event Materials' },
]

const SIZE_OPTIONS = [
  { value: '256', label: '256px (Small)' },
  { value: '512', label: '512px (Medium)' },
  { value: '1024', label: '1024px (Large)' },
  { value: '2048', label: '2048px (Print)' },
]

// ─── Component ──────────────────────────────────────────────

export default function QRGeneratorPage() {
  // Form state
  const [name, setName] = React.useState('')
  const [destinationPreset, setDestinationPreset] = React.useState('')
  const [customUrl, setCustomUrl] = React.useState('')
  const [brand, setBrand] = React.useState<string>('localvip')
  const [fgColor, setFgColor] = React.useState('#000000')
  const [bgColor, setBgColor] = React.useState('#ffffff')
  const [frameText, setFrameText] = React.useState('')
  const [campaign, setCampaign] = React.useState('')
  const [city, setCity] = React.useState('')
  const [stakeholder, setStakeholder] = React.useState('')
  const [business, setBusiness] = React.useState('')
  const [cause, setCause] = React.useState('')
  const [collection, setCollection] = React.useState('')
  const [tags, setTags] = React.useState('')
  const [size, setSize] = React.useState('512')

  // Preview state
  const [previewUrl, setPreviewUrl] = React.useState<string>('')
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [generated, setGenerated] = React.useState(false)
  const [shortCode, setShortCode] = React.useState('')
  const [copied, setCopied] = React.useState(false)

  // Expanded sections (progressive disclosure)
  const [showAssignments, setShowAssignments] = React.useState(false)

  // Resolve destination URL
  const resolvedUrl = React.useMemo(() => {
    if (destinationPreset === 'custom') return customUrl
    const preset = QR_DESTINATION_PRESETS.find(p => p.value === destinationPreset)
    if (!preset) return 'https://localvip.com'
    return preset.urlTemplate.replace('{code}', 'demo').replace('{slug}', 'demo')
  }, [destinationPreset, customUrl])

  // Live preview — debounced
  const previewTimerRef = React.useRef<ReturnType<typeof setTimeout>>()

  React.useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current)

    const urlToEncode = resolvedUrl || 'https://localvip.com'

    previewTimerRef.current = setTimeout(async () => {
      try {
        if (frameText) {
          const dataUrl = await generateQRWithFrame({
            data: urlToEncode,
            size: 280,
            foregroundColor: fgColor,
            backgroundColor: bgColor,
            errorCorrectionLevel: 'H',
            frameText,
          })
          setPreviewUrl(dataUrl)
        } else {
          const dataUrl = await generateQRDataURL({
            data: urlToEncode,
            size: 280,
            foregroundColor: fgColor,
            backgroundColor: bgColor,
            errorCorrectionLevel: 'H',
          })
          setPreviewUrl(dataUrl)
        }
      } catch {
        // Silently fail preview
      }
    }, 200)

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    }
  }, [resolvedUrl, fgColor, bgColor, frameText])

  // Generate final QR code
  async function handleGenerate() {
    if (!name.trim()) return
    setIsGenerating(true)

    try {
      const code = generateShortCode(8)
      setShortCode(code)

      const finalSize = parseInt(size)
      const urlToEncode = resolvedUrl || 'https://localvip.com'

      let dataUrl: string
      if (frameText) {
        dataUrl = await generateQRWithFrame({
          data: urlToEncode,
          size: finalSize,
          foregroundColor: fgColor,
          backgroundColor: bgColor,
          errorCorrectionLevel: 'H',
          frameText,
        })
      } else {
        dataUrl = await generateQRDataURL({
          data: urlToEncode,
          size: finalSize,
          foregroundColor: fgColor,
          backgroundColor: bgColor,
          errorCorrectionLevel: 'H',
        })
      }

      setPreviewUrl(dataUrl)
      setGenerated(true)
    } catch (err) {
      console.error('QR generation failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  // Download handlers
  function handleDownloadPNG() {
    if (!previewUrl) return
    const filename = `${name || 'qr-code'}-${size}px.png`
    downloadDataURL(previewUrl, filename)
  }

  function handleDownloadSVG() {
    const urlToEncode = resolvedUrl || 'https://localvip.com'
    const svg = generateQRSVG({
      data: urlToEncode,
      size: parseInt(size),
      foregroundColor: fgColor,
      backgroundColor: bgColor,
      errorCorrectionLevel: 'H',
    })
    downloadSVG(svg, `${name || 'qr-code'}.svg`)
  }

  function handleCopyLink() {
    const link = `https://localvip.com/q/${shortCode || 'preview'}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleReset() {
    setGenerated(false)
    setShortCode('')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Code Generator"
        description="Create trackable QR codes for any campaign, stakeholder, or business"
        breadcrumb={[
          { label: 'QR Codes', href: '/qr/mine' },
          { label: 'Generator' },
        ]}
      />

      {/* Success state */}
      {generated && (
        <Card className="border-2 border-success-500 bg-success-50/30">
          <CardContent className="py-6">
            <div className="flex flex-col items-center text-center gap-4 sm:flex-row sm:text-left">
              <div className="shrink-0">
                {previewUrl && (
                  <img src={previewUrl} alt="Generated QR Code" className="h-32 w-32 rounded-lg shadow-md" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <Check className="h-5 w-5 text-success-600" />
                  <h3 className="text-lg font-semibold text-surface-900">QR Code Generated</h3>
                </div>
                <p className="text-sm text-surface-600">
                  <span className="font-medium">{name}</span> is ready to use. Share the short link or download the image.
                </p>
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <code className="rounded-md bg-surface-100 px-3 py-1 text-sm font-mono text-brand-700">
                    localvip.com/q/{shortCode}
                  </code>
                  <Button variant="ghost" size="icon-sm" onClick={handleCopyLink}>
                    {copied ? <Check className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button onClick={handleDownloadPNG} size="sm">
                  <Download className="h-4 w-4" /> Download PNG
                </Button>
                <Button variant="outline" onClick={handleDownloadSVG} size="sm">
                  <Download className="h-4 w-4" /> Download SVG
                </Button>
                <Button variant="ghost" onClick={handleReset} size="sm">
                  Create Another
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main two-panel layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left panel: form */}
        <div className="lg:col-span-3 space-y-5">
          {/* Basics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-surface-400" />
                Basics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">
                  QR Code Name <span className="text-danger-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Spring Flyer - Main Street Bakery"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="mt-1 text-xs text-surface-400">Internal name for organization. Not shown to scanners.</p>
              </div>

              {/* Destination */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">
                  Destination
                </label>
                <Select value={destinationPreset} onValueChange={setDestinationPreset}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a destination..." />
                  </SelectTrigger>
                  <SelectContent>
                    {QR_DESTINATION_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom URL */}
              {destinationPreset === 'custom' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">
                    Custom Destination URL
                  </label>
                  <Input
                    placeholder="https://example.com/your-page"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    type="url"
                  />
                </div>
              )}

              {/* Brand */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Brand</label>
                <Select value={brand} onValueChange={setBrand}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BRANDS).map(([key, b]) => (
                      <SelectItem key={key} value={key}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-surface-400" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Foreground color */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">
                    Foreground Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded-lg border border-surface-300"
                    />
                    <Input
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      className="flex-1 font-mono text-xs"
                      maxLength={7}
                    />
                  </div>
                </div>

                {/* Background color */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">
                    Background Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded-lg border border-surface-300"
                    />
                    <Input
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="flex-1 font-mono text-xs"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>

              {/* Quick color presets */}
              <div>
                <label className="mb-1.5 block text-xs text-surface-400">Quick Presets</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { fg: '#000000', bg: '#ffffff', label: 'Classic' },
                    { fg: '#2563eb', bg: '#ffffff', label: 'LocalVIP Blue' },
                    { fg: '#ec8012', bg: '#ffffff', label: 'HATO Orange' },
                    { fg: '#16a34a', bg: '#ffffff', label: 'Green' },
                    { fg: '#7c3aed', bg: '#ffffff', label: 'Purple' },
                    { fg: '#ffffff', bg: '#1e293b', label: 'Inverted' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => { setFgColor(preset.fg); setBgColor(preset.bg) }}
                      className="flex items-center gap-1.5 rounded-full border border-surface-200 px-2.5 py-1 text-xs text-surface-600 hover:bg-surface-50 transition-colors"
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-surface-200"
                        style={{ backgroundColor: preset.fg }}
                      />
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frame text */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">
                  Frame Text (CTA)
                </label>
                <Input
                  placeholder="e.g. SCAN FOR DEALS"
                  value={frameText}
                  onChange={(e) => setFrameText(e.target.value)}
                  maxLength={40}
                />
                <p className="mt-1 text-xs text-surface-400">
                  Optional call-to-action displayed below the QR code. {frameText.length}/40
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Assignments (progressive disclosure) */}
          <Card>
            <CardHeader>
              <button
                onClick={() => setShowAssignments(!showAssignments)}
                className="flex w-full items-center justify-between"
              >
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-surface-400" />
                  Assignments &amp; Tracking
                </CardTitle>
                <ChevronDown className={`h-4 w-4 text-surface-400 transition-transform ${showAssignments ? 'rotate-180' : ''}`} />
              </button>
              {!showAssignments && (
                <p className="text-xs text-surface-400 mt-1">Link this QR code to campaigns, cities, stakeholders, and more</p>
              )}
            </CardHeader>
            {showAssignments && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Campaign */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                      <Megaphone className="h-3.5 w-3.5 text-surface-400" /> Campaign
                    </label>
                    <Select value={campaign} onValueChange={setCampaign}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select campaign..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DEMO_CAMPAIGNS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* City */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                      <MapPin className="h-3.5 w-3.5 text-surface-400" /> City
                    </label>
                    <Select value={city} onValueChange={setCity}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select city..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DEMO_CITIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Stakeholder */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                      <Users className="h-3.5 w-3.5 text-surface-400" /> Stakeholder
                    </label>
                    <Select value={stakeholder} onValueChange={setStakeholder}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select stakeholder..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DEMO_STAKEHOLDERS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Business */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                      <Building2 className="h-3.5 w-3.5 text-surface-400" /> Business
                    </label>
                    <Select value={business} onValueChange={setBusiness}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select business..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DEMO_BUSINESSES.map((b) => (
                          <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cause */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                      <Heart className="h-3.5 w-3.5 text-surface-400" /> Cause
                    </label>
                    <Select value={cause} onValueChange={setCause}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select cause..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DEMO_CAUSES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Collection */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                      <FolderOpen className="h-3.5 w-3.5 text-surface-400" /> Collection
                    </label>
                    <Select value={collection} onValueChange={setCollection}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select collection..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DEMO_COLLECTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Tags</label>
                  <Input
                    placeholder="e.g. flyer, spring, downtown (comma separated)"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={!name.trim() || isGenerating}
            size="lg"
            className="w-full"
          >
            {isGenerating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate QR Code
              </>
            )}
          </Button>
        </div>

        {/* Right panel: live preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-surface-400" />
                  Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                {/* QR Preview */}
                <div
                  className="flex items-center justify-center rounded-xl border-2 border-dashed border-surface-200 p-4"
                  style={{ backgroundColor: bgColor }}
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="QR Code Preview"
                      className="h-56 w-56 object-contain"
                    />
                  ) : (
                    <div className="flex h-56 w-56 flex-col items-center justify-center text-center text-surface-300">
                      <QrCode className="mb-2 h-16 w-16" />
                      <p className="text-sm">Your QR code will appear here</p>
                    </div>
                  )}
                </div>

                {/* Resolved URL */}
                {resolvedUrl && (
                  <div className="w-full rounded-lg bg-surface-50 px-3 py-2">
                    <p className="text-xs text-surface-400 mb-0.5">Destination</p>
                    <p className="flex items-center gap-1 text-xs font-mono text-surface-600 truncate">
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      {resolvedUrl}
                    </p>
                  </div>
                )}

                {/* Size selector */}
                <div className="w-full">
                  <label className="mb-1.5 block text-xs font-medium text-surface-500">Export Size</label>
                  <Select value={size} onValueChange={setSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SIZE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Download actions */}
                <div className="grid w-full grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={handleDownloadPNG}
                    disabled={!previewUrl}
                    className="w-full"
                    size="sm"
                  >
                    <Download className="h-3.5 w-3.5" /> PNG
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDownloadSVG}
                    disabled={!resolvedUrl}
                    className="w-full"
                    size="sm"
                  >
                    <Download className="h-3.5 w-3.5" /> SVG
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  onClick={handleCopyLink}
                  className="w-full"
                  size="sm"
                  disabled={!generated}
                >
                  {copied ? (
                    <><Check className="h-3.5 w-3.5 text-success-600" /> Copied!</>
                  ) : (
                    <><Link className="h-3.5 w-3.5" /> Copy Short Link</>
                  )}
                </Button>

                {/* Current config summary */}
                <div className="w-full space-y-2 border-t border-surface-100 pt-3">
                  <p className="text-xs font-medium text-surface-500">Configuration</p>
                  <div className="flex flex-wrap gap-1.5">
                    {name && <Badge variant="info">{name}</Badge>}
                    <Badge>{BRANDS[brand as keyof typeof BRANDS]?.label || brand}</Badge>
                    <Badge variant="outline">{size}px</Badge>
                    {frameText && <Badge variant="outline">CTA: {frameText}</Badge>}
                    {campaign && <Badge variant="outline">{DEMO_CAMPAIGNS.find(c => c.value === campaign)?.label}</Badge>}
                    {city && <Badge variant="outline">{DEMO_CITIES.find(c => c.value === city)?.label}</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
