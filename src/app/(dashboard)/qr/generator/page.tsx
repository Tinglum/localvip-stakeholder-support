'use client'

import * as React from 'react'
import {
  QrCode, Download, Copy, Link, Settings, Palette,
  Check, ChevronDown, Sparkles, Tag, MapPin, Building2,
  Heart, Users, FolderOpen, Megaphone, ExternalLink,
  Image, Mail, Phone, Wifi, ContactRound, FileUp,
  MessageSquare, Globe,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { BRANDS } from '@/lib/constants'
import { generateShortCode } from '@/lib/utils'
import {
  generateStyledQR, generateQRSVG, downloadDataURL, downloadSVG,
  destinationToString,
  type DotStyle, type CornerStyle, type QRDestination, type QRDestinationType,
} from '@/lib/qr/generate'

// ─── Constants ──────────────────────────────────────────────

const DESTINATION_TYPES: { value: QRDestinationType; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'url', label: 'Website URL', icon: Globe, description: 'Link to any web page' },
  { value: 'email', label: 'Email', icon: Mail, description: 'Pre-filled email compose' },
  { value: 'phone', label: 'Phone Call', icon: Phone, description: 'Dial a phone number' },
  { value: 'sms', label: 'SMS / Text', icon: MessageSquare, description: 'Pre-filled text message' },
  { value: 'wifi', label: 'WiFi Network', icon: Wifi, description: 'Auto-join WiFi network' },
  { value: 'vcard', label: 'Contact Card', icon: ContactRound, description: 'Save contact info' },
  { value: 'file', label: 'File / Document', icon: FileUp, description: 'Link to uploaded file' },
]

const DOT_STYLES: { value: DotStyle; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'dots', label: 'Dots' },
  { value: 'classy', label: 'Classy' },
  { value: 'classy-rounded', label: 'Classy Rounded' },
  { value: 'extra-rounded', label: 'Extra Rounded' },
]

const CORNER_STYLES: { value: CornerStyle; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'dots', label: 'Circle' },
  { value: 'extra-rounded', label: 'Extra Rounded' },
]

const COLOR_PRESETS = [
  { fg: '#000000', bg: '#ffffff', label: 'Classic' },
  { fg: '#2563eb', bg: '#ffffff', label: 'LocalVIP Blue' },
  { fg: '#ec8012', bg: '#ffffff', label: 'HATO Orange' },
  { fg: '#16a34a', bg: '#ffffff', label: 'Green' },
  { fg: '#7c3aed', bg: '#ffffff', label: 'Purple' },
  { fg: '#dc2626', bg: '#ffffff', label: 'Red' },
  { fg: '#ffffff', bg: '#1e293b', label: 'Dark Mode' },
  { fg: '#0f172a', bg: '#f8fafc', label: 'Soft' },
]

const DEMO_CAMPAIGNS = [
  { value: 'spring-2026', label: 'Spring 2026 Launch' },
  { value: 'back-to-school', label: 'Back to School 2026' },
  { value: 'holiday-giving', label: 'Holiday Giving Drive' },
]

const DEMO_CITIES = [
  { value: 'atlanta', label: 'Atlanta, GA' },
  { value: 'charlotte', label: 'Charlotte, NC' },
  { value: 'nashville', label: 'Nashville, TN' },
]

const DEMO_STAKEHOLDERS = [
  { value: 'alex-rivera', label: 'Alex Rivera' },
  { value: 'casey-adams', label: 'Casey Adams' },
  { value: 'jordan-taylor', label: 'Jordan Taylor' },
]

const DEMO_BUSINESSES = [
  { value: 'main-street-bakery', label: 'Main Street Bakery' },
  { value: 'river-cafe', label: 'River Cafe' },
  { value: 'summit-fitness', label: 'Summit Fitness' },
]

const DEMO_CAUSES = [
  { value: 'oak-hill-elementary', label: 'Oak Hill Elementary' },
  { value: 'community-strong', label: 'CommunityStrong Foundation' },
]

const SIZE_OPTIONS = [
  { value: '256', label: '256px (Small)' },
  { value: '512', label: '512px (Medium)' },
  { value: '1024', label: '1024px (Large)' },
  { value: '2048', label: '2048px (Print)' },
]

// ─── Component ──────────────────────────────────────────────

export default function QRGeneratorPage() {
  // Core
  const [name, setName] = React.useState('')
  const [brand, setBrand] = React.useState<string>('localvip')
  const [size, setSize] = React.useState('512')

  // Destination
  const [destType, setDestType] = React.useState<QRDestinationType>('url')
  const [destination, setDestination] = React.useState<QRDestination>({ type: 'url', url: '' })

  // Appearance
  const [fgColor, setFgColor] = React.useState('#000000')
  const [bgColor, setBgColor] = React.useState('#ffffff')
  const [dotStyle, setDotStyle] = React.useState<DotStyle>('square')
  const [cornerStyle, setCornerStyle] = React.useState<CornerStyle>('square')
  const [frameText, setFrameText] = React.useState('')
  const [gradientType, setGradientType] = React.useState<'none' | 'linear' | 'radial'>('none')
  const [gradientColor1, setGradientColor1] = React.useState('#ffffff')
  const [gradientColor2, setGradientColor2] = React.useState('#e2e8f0')

  // Logo
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = React.useState<string>('')

  // Assignments
  const [showAssignments, setShowAssignments] = React.useState(false)
  const [campaign, setCampaign] = React.useState('')
  const [city, setCity] = React.useState('')
  const [stakeholder, setStakeholder] = React.useState('')
  const [business, setBusiness] = React.useState('')
  const [cause, setCause] = React.useState('')
  const [tags, setTags] = React.useState('')

  // State
  const [previewUrl, setPreviewUrl] = React.useState<string>('')
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [generated, setGenerated] = React.useState(false)
  const [shortCode, setShortCode] = React.useState('')
  const [copied, setCopied] = React.useState(false)

  // File input ref
  const logoInputRef = React.useRef<HTMLInputElement>(null)

  // Handle destination type change
  function handleDestTypeChange(type: QRDestinationType) {
    setDestType(type)
    setDestination({ type })
  }

  // Update destination field
  function updateDest(field: string, value: string | boolean) {
    setDestination(prev => ({ ...prev, [field]: value }))
  }

  // Handle logo upload
  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      setLogoPreviewUrl(URL.createObjectURL(file))
    }
  }

  function removeLogo() {
    setLogoFile(null)
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl)
    setLogoPreviewUrl('')
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  // Resolve encoded data
  const encodedData = React.useMemo(() => {
    return destinationToString(destination)
  }, [destination])

  // Live preview — debounced
  const previewTimerRef = React.useRef<ReturnType<typeof setTimeout>>()

  React.useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current)

    const dataToEncode = encodedData || 'https://localvip.com'

    previewTimerRef.current = setTimeout(async () => {
      try {
        const dataUrl = await generateStyledQR({
          data: dataToEncode,
          size: 280,
          foregroundColor: fgColor,
          backgroundColor: gradientType !== 'none' ? 'transparent' : bgColor,
          errorCorrectionLevel: 'H',
          dotStyle,
          cornerStyle,
          frameText,
          logoFile,
          gradientType,
          gradientColors: [gradientColor1, gradientColor2],
        })
        setPreviewUrl(dataUrl)
      } catch {
        // Silently fail preview
      }
    }, 300)

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    }
  }, [encodedData, fgColor, bgColor, dotStyle, cornerStyle, frameText, logoFile, gradientType, gradientColor1, gradientColor2])

  // Generate final QR code
  async function handleGenerate() {
    if (!name.trim()) return
    setIsGenerating(true)

    try {
      const code = generateShortCode(8)
      setShortCode(code)

      const finalSize = parseInt(size)
      const dataToEncode = encodedData || 'https://localvip.com'

      const dataUrl = await generateStyledQR({
        data: dataToEncode,
        size: finalSize,
        foregroundColor: fgColor,
        backgroundColor: gradientType !== 'none' ? 'transparent' : bgColor,
        errorCorrectionLevel: 'H',
        dotStyle,
        cornerStyle,
        frameText,
        logoFile,
        gradientType,
        gradientColors: [gradientColor1, gradientColor2],
      })

      setPreviewUrl(dataUrl)
      setGenerated(true)
    } catch (err) {
      console.error('QR generation failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  function handleDownloadPNG() {
    if (!previewUrl) return
    downloadDataURL(previewUrl, `${name || 'qr-code'}-${size}px.png`)
  }

  function handleDownloadSVG() {
    const dataToEncode = encodedData || 'https://localvip.com'
    const svg = generateQRSVG({
      data: dataToEncode,
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
        description="Create trackable QR codes with custom styles, logos, and destinations"
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
                  <span className="font-medium">{name}</span> is ready. Share the short link or download.
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

          {/* ── Basics ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-surface-400" />
                Basics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">
                  QR Code Name <span className="text-danger-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Spring Flyer - Main Street Bakery"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="mt-1 text-xs text-surface-400">Internal name. Not shown to scanners.</p>
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
            </CardContent>
          </Card>

          {/* ── Destination ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-surface-400" />
                Destination
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Destination type selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DESTINATION_TYPES.map((dt) => {
                  const Icon = dt.icon
                  return (
                    <button
                      key={dt.value}
                      type="button"
                      onClick={() => handleDestTypeChange(dt.value)}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors ${
                        destType === dt.value
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-surface-200 text-surface-500 hover:bg-surface-50'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-medium">{dt.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Dynamic destination fields */}
              <div className="space-y-3">
                {destType === 'url' && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700">URL</label>
                    <Input
                      placeholder="https://example.com/page"
                      value={destination.url || ''}
                      onChange={(e) => updateDest('url', e.target.value)}
                      type="url"
                    />
                  </div>
                )}

                {destType === 'email' && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-surface-700">Email Address</label>
                      <Input
                        placeholder="hello@example.com"
                        value={destination.emailTo || ''}
                        onChange={(e) => updateDest('emailTo', e.target.value)}
                        type="email"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-surface-700">Subject (optional)</label>
                      <Input
                        placeholder="I scanned your QR code!"
                        value={destination.emailSubject || ''}
                        onChange={(e) => updateDest('emailSubject', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-surface-700">Body (optional)</label>
                      <Textarea
                        placeholder="Pre-filled email body..."
                        value={destination.emailBody || ''}
                        onChange={(e) => updateDest('emailBody', e.target.value)}
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {destType === 'phone' && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700">Phone Number</label>
                    <Input
                      placeholder="+1 (404) 555-0101"
                      value={destination.phone || ''}
                      onChange={(e) => updateDest('phone', e.target.value)}
                      type="tel"
                    />
                  </div>
                )}

                {destType === 'sms' && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-surface-700">Phone Number</label>
                      <Input
                        placeholder="+1 (404) 555-0101"
                        value={destination.phone || ''}
                        onChange={(e) => updateDest('phone', e.target.value)}
                        type="tel"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-surface-700">Message (optional)</label>
                      <Textarea
                        placeholder="Pre-filled text message..."
                        value={destination.smsBody || ''}
                        onChange={(e) => updateDest('smsBody', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </>
                )}

                {destType === 'wifi' && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-surface-700">Network Name (SSID)</label>
                      <Input
                        placeholder="MyWiFiNetwork"
                        value={destination.wifiSsid || ''}
                        onChange={(e) => updateDest('wifiSsid', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-surface-700">Password</label>
                      <Input
                        placeholder="WiFi password"
                        value={destination.wifiPassword || ''}
                        onChange={(e) => updateDest('wifiPassword', e.target.value)}
                        type="password"
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Encryption</label>
                        <Select value={destination.wifiEncryption || 'WPA'} onValueChange={(v) => updateDest('wifiEncryption', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WPA">WPA/WPA2</SelectItem>
                            <SelectItem value="WEP">WEP</SelectItem>
                            <SelectItem value="nopass">No Password</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 text-sm text-surface-600">
                          <input
                            type="checkbox"
                            checked={destination.wifiHidden || false}
                            onChange={(e) => updateDest('wifiHidden', e.target.checked)}
                            className="rounded border-surface-300"
                          />
                          Hidden network
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {destType === 'vcard' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Full Name</label>
                        <Input
                          placeholder="John Smith"
                          value={destination.vcardName || ''}
                          onChange={(e) => updateDest('vcardName', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Phone</label>
                        <Input
                          placeholder="+1 555-0101"
                          value={destination.vcardPhone || ''}
                          onChange={(e) => updateDest('vcardPhone', e.target.value)}
                          type="tel"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Email</label>
                        <Input
                          placeholder="john@example.com"
                          value={destination.vcardEmail || ''}
                          onChange={(e) => updateDest('vcardEmail', e.target.value)}
                          type="email"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Organization</label>
                        <Input
                          placeholder="Company name"
                          value={destination.vcardOrg || ''}
                          onChange={(e) => updateDest('vcardOrg', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Title</label>
                        <Input
                          placeholder="Job title"
                          value={destination.vcardTitle || ''}
                          onChange={(e) => updateDest('vcardTitle', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Website</label>
                        <Input
                          placeholder="https://example.com"
                          value={destination.vcardUrl || ''}
                          onChange={(e) => updateDest('vcardUrl', e.target.value)}
                          type="url"
                        />
                      </div>
                    </div>
                  </>
                )}

                {destType === 'file' && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700">File URL</label>
                    <Input
                      placeholder="https://storage.example.com/file.pdf"
                      value={destination.fileUrl || ''}
                      onChange={(e) => updateDest('fileUrl', e.target.value)}
                      type="url"
                    />
                    <p className="mt-1 text-xs text-surface-400">Upload your file to Supabase Storage or another host, then paste the URL here.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Appearance ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-surface-400" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Colors */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Foreground</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded-lg border border-surface-300"
                    />
                    <Input value={fgColor} onChange={(e) => setFgColor(e.target.value)} className="flex-1 font-mono text-xs" maxLength={7} />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Background</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded-lg border border-surface-300"
                    />
                    <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="flex-1 font-mono text-xs" maxLength={7} />
                  </div>
                </div>
              </div>

              {/* Color presets */}
              <div>
                <label className="mb-1.5 block text-xs text-surface-400">Quick Presets</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => { setFgColor(preset.fg); setBgColor(preset.bg) }}
                      className="flex items-center gap-1.5 rounded-full border border-surface-200 px-2.5 py-1 text-xs text-surface-600 hover:bg-surface-50 transition-colors"
                    >
                      <span className="h-3 w-3 rounded-full border border-surface-200" style={{ backgroundColor: preset.fg }} />
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Gradient */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Background Gradient</label>
                <div className="flex gap-2">
                  {(['none', 'linear', 'radial'] as const).map((gt) => (
                    <button
                      key={gt}
                      type="button"
                      onClick={() => setGradientType(gt)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        gradientType === gt
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-surface-200 text-surface-500 hover:bg-surface-50'
                      }`}
                    >
                      {gt === 'none' ? 'Solid' : gt === 'linear' ? 'Linear' : 'Radial'}
                    </button>
                  ))}
                </div>
                {gradientType !== 'none' && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-surface-500">Color 1</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={gradientColor1} onChange={(e) => setGradientColor1(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-surface-300" />
                        <Input value={gradientColor1} onChange={(e) => setGradientColor1(e.target.value)} className="flex-1 font-mono text-xs" maxLength={7} />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-surface-500">Color 2</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={gradientColor2} onChange={(e) => setGradientColor2(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-surface-300" />
                        <Input value={gradientColor2} onChange={(e) => setGradientColor2(e.target.value)} className="flex-1 font-mono text-xs" maxLength={7} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Dot Style */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Dot Style</label>
                <div className="flex flex-wrap gap-2">
                  {DOT_STYLES.map((ds) => (
                    <button
                      key={ds.value}
                      type="button"
                      onClick={() => setDotStyle(ds.value)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        dotStyle === ds.value
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-surface-200 text-surface-500 hover:bg-surface-50'
                      }`}
                    >
                      {ds.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Corner Style */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Corner Eyes</label>
                <div className="flex flex-wrap gap-2">
                  {CORNER_STYLES.map((cs) => (
                    <button
                      key={cs.value}
                      type="button"
                      onClick={() => setCornerStyle(cs.value)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        cornerStyle === cs.value
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-surface-200 text-surface-500 hover:bg-surface-50'
                      }`}
                    >
                      {cs.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Logo Upload */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">
                  <span className="flex items-center gap-1.5"><Image className="h-3.5 w-3.5" /> Center Logo</span>
                </label>
                {logoPreviewUrl ? (
                  <div className="flex items-center gap-3">
                    <img src={logoPreviewUrl} alt="Logo preview" className="h-14 w-14 rounded-lg border border-surface-200 object-contain p-1" />
                    <div className="flex-1">
                      <p className="text-sm text-surface-700 font-medium">{logoFile?.name}</p>
                      <p className="text-xs text-surface-400">{logoFile ? `${(logoFile.size / 1024).toFixed(1)} KB` : ''}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={removeLogo} className="text-danger-500">Remove</Button>
                  </div>
                ) : (
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-surface-200 p-4 text-center hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
                  >
                    <Image className="h-8 w-8 text-surface-300" />
                    <p className="text-sm text-surface-500">Click to upload logo</p>
                    <p className="text-xs text-surface-400">PNG, JPG, or SVG. Recommended: square, under 500KB</p>
                  </div>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>

              {/* Frame text */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Frame Text (CTA)</label>
                <Input
                  placeholder="e.g. SCAN FOR DEALS"
                  value={frameText}
                  onChange={(e) => setFrameText(e.target.value)}
                  maxLength={40}
                />
                <p className="mt-1 text-xs text-surface-400">
                  Call-to-action displayed below the QR code. {frameText.length}/40
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ── Assignments ── */}
          <Card>
            <CardHeader>
              <button type="button" onClick={() => setShowAssignments(!showAssignments)} className="flex w-full items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-surface-400" />
                  Assignments &amp; Tracking
                </CardTitle>
                <ChevronDown className={`h-4 w-4 text-surface-400 transition-transform ${showAssignments ? 'rotate-180' : ''}`} />
              </button>
              {!showAssignments && (
                <p className="text-xs text-surface-400 mt-1">Link to campaigns, cities, stakeholders</p>
              )}
            </CardHeader>
            {showAssignments && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                      <Megaphone className="h-3.5 w-3.5 text-surface-400" /> Campaign
                    </label>
                    <Select value={campaign} onValueChange={setCampaign}>
                      <SelectTrigger><SelectValue placeholder="Select campaign..." /></SelectTrigger>
                      <SelectContent>{DEMO_CAMPAIGNS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                      <MapPin className="h-3.5 w-3.5 text-surface-400" /> City
                    </label>
                    <Select value={city} onValueChange={setCity}>
                      <SelectTrigger><SelectValue placeholder="Select city..." /></SelectTrigger>
                      <SelectContent>{DEMO_CITIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                      <Users className="h-3.5 w-3.5 text-surface-400" /> Stakeholder
                    </label>
                    <Select value={stakeholder} onValueChange={setStakeholder}>
                      <SelectTrigger><SelectValue placeholder="Select stakeholder..." /></SelectTrigger>
                      <SelectContent>{DEMO_STAKEHOLDERS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                      <Building2 className="h-3.5 w-3.5 text-surface-400" /> Business
                    </label>
                    <Select value={business} onValueChange={setBusiness}>
                      <SelectTrigger><SelectValue placeholder="Select business..." /></SelectTrigger>
                      <SelectContent>{DEMO_BUSINESSES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                      <Heart className="h-3.5 w-3.5 text-surface-400" /> Cause
                    </label>
                    <Select value={cause} onValueChange={setCause}>
                      <SelectTrigger><SelectValue placeholder="Select cause..." /></SelectTrigger>
                      <SelectContent>{DEMO_CAUSES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Tags</label>
                  <Input placeholder="e.g. flyer, spring, downtown (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
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
                <div
                  className="flex items-center justify-center rounded-xl border-2 border-dashed border-surface-200 p-4"
                  style={{ backgroundColor: gradientType !== 'none' ? undefined : bgColor }}
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="QR Code Preview" className="h-56 w-56 object-contain" />
                  ) : (
                    <div className="flex h-56 w-56 flex-col items-center justify-center text-center text-surface-300">
                      <QrCode className="mb-2 h-16 w-16" />
                      <p className="text-sm">Your QR code will appear here</p>
                    </div>
                  )}
                </div>

                {/* Encoded data preview */}
                {encodedData && (
                  <div className="w-full rounded-lg bg-surface-50 px-3 py-2">
                    <p className="text-xs text-surface-400 mb-0.5">
                      {DESTINATION_TYPES.find(d => d.value === destType)?.label || 'Destination'}
                    </p>
                    <p className="flex items-center gap-1 text-xs font-mono text-surface-600 truncate">
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      {encodedData.length > 80 ? encodedData.substring(0, 80) + '...' : encodedData}
                    </p>
                  </div>
                )}

                {/* Size selector */}
                <div className="w-full">
                  <label className="mb-1.5 block text-xs font-medium text-surface-500">Export Size</label>
                  <Select value={size} onValueChange={setSize}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SIZE_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Download actions */}
                <div className="grid w-full grid-cols-2 gap-2">
                  <Button variant="outline" onClick={handleDownloadPNG} disabled={!previewUrl} className="w-full" size="sm">
                    <Download className="h-3.5 w-3.5" /> PNG
                  </Button>
                  <Button variant="outline" onClick={handleDownloadSVG} disabled={!encodedData} className="w-full" size="sm">
                    <Download className="h-3.5 w-3.5" /> SVG
                  </Button>
                </div>

                <Button variant="ghost" onClick={handleCopyLink} className="w-full" size="sm" disabled={!generated}>
                  {copied ? <><Check className="h-3.5 w-3.5 text-success-600" /> Copied!</> : <><Link className="h-3.5 w-3.5" /> Copy Short Link</>}
                </Button>

                {/* Config summary */}
                <div className="w-full space-y-2 border-t border-surface-100 pt-3">
                  <p className="text-xs font-medium text-surface-500">Configuration</p>
                  <div className="flex flex-wrap gap-1.5">
                    {name && <Badge variant="info">{name}</Badge>}
                    <Badge>{BRANDS[brand as keyof typeof BRANDS]?.label || brand}</Badge>
                    <Badge variant="outline">{size}px</Badge>
                    <Badge variant="outline">{DOT_STYLES.find(d => d.value === dotStyle)?.label} dots</Badge>
                    <Badge variant="outline">{CORNER_STYLES.find(c => c.value === cornerStyle)?.label} corners</Badge>
                    {logoFile && <Badge variant="outline">Logo: {logoFile.name}</Badge>}
                    {frameText && <Badge variant="outline">CTA: {frameText}</Badge>}
                    {gradientType !== 'none' && <Badge variant="outline">{gradientType} gradient</Badge>}
                    {destType !== 'url' && <Badge variant="info">{DESTINATION_TYPES.find(d => d.value === destType)?.label}</Badge>}
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
