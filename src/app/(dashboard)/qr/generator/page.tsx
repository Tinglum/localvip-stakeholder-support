'use client'

import * as React from 'react'
import Link from 'next/link'
import NextImage from 'next/image'
import { useSearchParams } from 'next/navigation'
import {
  QrCode, Download, Settings, Palette,
  Check, ChevronDown, Sparkles, Tag, MapPin, Building2,
  Heart, Users, FolderOpen, Megaphone, ExternalLink, ArrowLeft,
  Image as ImageIcon, Mail, Phone, Wifi, ContactRound, FileUp,
  MessageSquare, Globe, Layers, Loader2, FileText,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { QrLogoEditor } from '@/components/qr/qr-logo-editor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { BRANDS } from '@/lib/constants'
import { buildStakeholderJoinUrl } from '@/lib/material-engine'
import { exportPdfWithQrPlacements } from '@/lib/materials/pdf-export'
import { getQrPlacements } from '@/lib/materials/qr-placement'
import { generateShortCode } from '@/lib/utils'
import {
  generateStyledQR, generateQRSVG, downloadDataURL, downloadSVG,
  destinationToString,
  type DotStyle, type CornerStyle, type QRDestination, type QRDestinationType,
} from '@/lib/qr/generate'
import {
  DEFAULT_QR_LOGO_EDIT_SETTINGS,
  type QrLogoEditSettings,
} from '@/lib/qr/logo-processing'
import { useAuth } from '@/lib/auth/context'
import {
  useQrCodeInsert,
  useCampaigns,
  useCities,
  useProfiles,
  useBusinesses,
  useCauses,
  useMaterials,
  useBusinessUpdate,
  useQrCodes,
  useQrCodeCollectionInsert,
  useQrCodeCollections,
  useStakeholders,
  useStakeholderCodes,
} from '@/lib/supabase/hooks'
import type { Material, QrCode as QrCodeRecord, QrCodeCollection, Stakeholder, StakeholderCode } from '@/lib/types/database'

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

const SIZE_OPTIONS = [
  { value: '256', label: '256px (Small)' },
  { value: '512', label: '512px (Medium)' },
  { value: '1024', label: '1024px (Large)' },
  { value: '2048', label: '2048px (Print)' },
]

function isPdfMaterial(material: Pick<Material, 'mime_type'>) {
  return material.mime_type === 'application/pdf' || material.mime_type?.includes('pdf')
}

function normalizeContextTags(...values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (value || '').split(','))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).join(', ')
}

function getQrMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' ? value : ''
}

interface SavedQrTemplateLayout {
  size: number
  foregroundColor: string
  backgroundColor: string
  dotStyle: DotStyle
  cornerStyle: CornerStyle
  frameText: string
  gradientType: 'none' | 'linear' | 'radial'
  gradientColors: [string, string]
}

function readSavedQrTemplateLayout(collection: QrCodeCollection): SavedQrTemplateLayout | null {
  const metadata = (collection.metadata as Record<string, unknown> | null) || null
  if (metadata?.template_kind !== 'layout_template') return null
  const layout = (metadata.layout as Record<string, unknown> | null) || null
  if (!layout) return null

  const dotStyle = layout.dotStyle
  const cornerStyle = layout.cornerStyle
  const gradientType = layout.gradientType
  const gradientColors = Array.isArray(layout.gradientColors) ? layout.gradientColors : []

  return {
    size: typeof layout.size === 'number' ? layout.size : 512,
    foregroundColor: typeof layout.foregroundColor === 'string' ? layout.foregroundColor : '#000000',
    backgroundColor: typeof layout.backgroundColor === 'string' ? layout.backgroundColor : '#ffffff',
    dotStyle: dotStyle === 'square' || dotStyle === 'rounded' || dotStyle === 'dots' || dotStyle === 'classy' || dotStyle === 'classy-rounded' || dotStyle === 'extra-rounded' ? dotStyle : 'square',
    cornerStyle: cornerStyle === 'square' || cornerStyle === 'rounded' || cornerStyle === 'dots' || cornerStyle === 'extra-rounded' ? cornerStyle : 'square',
    frameText: typeof layout.frameText === 'string' ? layout.frameText : '',
    gradientType: gradientType === 'linear' || gradientType === 'radial' ? gradientType : 'none',
    gradientColors: [
      typeof gradientColors[0] === 'string' ? gradientColors[0] : '#ffffff',
      typeof gradientColors[1] === 'string' ? gradientColors[1] : '#e2e8f0',
    ],
  }
}

function buildSavedQrTemplateLayout(input: {
  size: string
  foregroundColor: string
  backgroundColor: string
  dotStyle: DotStyle
  cornerStyle: CornerStyle
  frameText: string
  gradientType: 'none' | 'linear' | 'radial'
  gradientColors: [string, string]
}): SavedQrTemplateLayout {
  return {
    size: Number.parseInt(input.size, 10) || 512,
    foregroundColor: input.foregroundColor,
    backgroundColor: input.backgroundColor,
    dotStyle: input.dotStyle,
    cornerStyle: input.cornerStyle,
    frameText: input.frameText,
    gradientType: input.gradientType,
    gradientColors: input.gradientColors,
  }
}

function SavedQrTemplateCard({
  collection,
  layout,
  active,
  onApply,
}: {
  collection: QrCodeCollection
  layout: SavedQrTemplateLayout
  active: boolean
  onApply: (collection: QrCodeCollection, layout: SavedQrTemplateLayout) => void
}) {
  const [previewUrl, setPreviewUrl] = React.useState('')

  React.useEffect(() => {
    let cancelled = false

    async function buildPreview() {
      const nextPreview = await generateStyledQR({
        data: 'https://localvip.com/template-preview',
        size: 220,
        foregroundColor: layout.foregroundColor,
        backgroundColor: layout.gradientType !== 'none' ? 'transparent' : layout.backgroundColor,
        errorCorrectionLevel: 'H',
        dotStyle: layout.dotStyle,
        cornerStyle: layout.cornerStyle,
        frameText: layout.frameText,
        gradientType: layout.gradientType,
        gradientColors: layout.gradientColors,
      })

      if (!cancelled) {
        setPreviewUrl(nextPreview)
      }
    }

    void buildPreview()

    return () => {
      cancelled = true
    }
  }, [layout])

  return (
    <button
      type="button"
      onClick={() => onApply(collection, layout)}
      className={`rounded-3xl border p-4 text-left transition-colors ${
        active
          ? 'border-brand-400 bg-brand-50 shadow-sm'
          : 'border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-surface-900">{collection.name}</p>
          <p className="mt-1 text-xs text-surface-500">{collection.description || 'Saved QR layout template'}</p>
        </div>
        <Badge variant={active ? 'info' : 'outline'}>{active ? 'Selected' : 'Saved template'}</Badge>
      </div>
      <div className="mt-4 flex items-center justify-center rounded-2xl border border-surface-200 bg-surface-50 p-4">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={`${collection.name} preview`} className="h-44 w-44 object-contain" />
        ) : (
          <div className="flex items-center gap-2 text-xs text-surface-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Building preview...
          </div>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-surface-500">
        <div>Dots: <span className="font-medium text-surface-700">{layout.dotStyle}</span></div>
        <div>Corners: <span className="font-medium text-surface-700">{layout.cornerStyle}</span></div>
        <div>Size: <span className="font-medium text-surface-700">{layout.size}px</span></div>
        <div>Frame: <span className="font-medium text-surface-700">{layout.frameText || 'None'}</span></div>
      </div>
    </button>
  )
}

// ─── Component ──────────────────────────────────────────────

export default function QRGeneratorPage() {
  const searchParams = useSearchParams()
  const { profile } = useAuth()
  const { insert: insertQrCode, loading: savingQr, error: saveError } = useQrCodeInsert()
  const { update: updateBusiness } = useBusinessUpdate()

  // Real data from Supabase
  const { data: campaignsData } = useCampaigns()
  const { data: citiesData } = useCities()
  const { data: profilesData } = useProfiles()
  const { data: businessesData } = useBusinesses()
  const { data: causesData } = useCauses()
  const { data: qrCodesData } = useQrCodes()
  const { data: qrCollectionsData, refetch: refetchQrCollections } = useQrCodeCollections()
  const { insert: insertQrCollection, loading: savingQrTemplate, error: qrTemplateSaveError } = useQrCodeCollectionInsert()
  const { data: stakeholdersData } = useStakeholders()
  const { data: stakeholderCodesData } = useStakeholderCodes()
  const { data: materialsData } = useMaterials()

  const campaignOptions = React.useMemo(() => campaignsData.map(c => ({ value: c.id, label: c.name })), [campaignsData])
  const cityOptions = React.useMemo(() => citiesData.map(c => ({ value: c.id, label: `${c.name}, ${c.state}` })), [citiesData])
  const stakeholderOptions = React.useMemo(() => profilesData.map(p => ({ value: p.id, label: p.full_name })), [profilesData])
  const businessOptions = React.useMemo(() => businessesData.map(b => ({ value: b.id, label: b.name })), [businessesData])
  const causeOptions = React.useMemo(() => causesData.map(c => ({ value: c.id, label: c.name })), [causesData])
  const sourceBusinessId = searchParams.get('businessId')
  const sourceCauseId = searchParams.get('causeId')
  const sourceBusiness = React.useMemo(
    () => (sourceBusinessId ? businessesData.find((item) => item.id === sourceBusinessId) || null : null),
    [businessesData, sourceBusinessId],
  )
  const sourceCause = React.useMemo(
    () => (sourceCauseId ? causesData.find((item) => item.id === sourceCauseId) || null : null),
    [causesData, sourceCauseId],
  )
  const sourceEntityName = sourceBusiness?.name || sourceCause?.name || ''
  const sourceEntityType = sourceBusiness ? 'business' : sourceCause ? 'cause' : null
  const sourceReturnHref = React.useMemo(() => {
    const configured = searchParams.get('returnTo')
    if (configured?.startsWith('/')) return configured
    if (sourceBusinessId) return `/crm/businesses/${sourceBusinessId}`
    if (sourceCauseId) return `/crm/causes/${sourceCauseId}`
    return '/qr/mine'
  }, [searchParams, sourceBusinessId, sourceCauseId])
  const sourceStakeholder = React.useMemo<Stakeholder | null>(() => {
    if (sourceBusinessId) {
      return stakeholdersData.find((item) => item.business_id === sourceBusinessId) || null
    }
    if (sourceCauseId) {
      return stakeholdersData.find((item) => item.cause_id === sourceCauseId) || null
    }
    return null
  }, [sourceBusinessId, sourceCauseId, stakeholdersData])
  const sourceCodes = React.useMemo<StakeholderCode | null>(() => {
    if (!sourceStakeholder) return null
    return stakeholderCodesData.find((item) => item.stakeholder_id === sourceStakeholder.id) || null
  }, [sourceStakeholder, stakeholderCodesData])
  const sourceExistingQr = React.useMemo<QrCodeRecord | null>(() => {
    if (sourceBusiness?.linked_qr_code_id) {
      return qrCodesData.find((item) => item.id === sourceBusiness.linked_qr_code_id) || null
    }
    if (sourceBusinessId) {
      return qrCodesData.find((item) => item.business_id === sourceBusinessId) || null
    }
    if (sourceCauseId) {
      return qrCodesData.find((item) => item.cause_id === sourceCauseId) || null
    }
    return null
  }, [qrCodesData, sourceBusiness, sourceBusinessId, sourceCauseId])
  const sourceJoinUrl = React.useMemo(() => {
    if (!sourceStakeholder || !sourceCodes) return ''
    if (sourceCodes.join_url) return sourceCodes.join_url
    if (!sourceCodes.connection_code) return ''
    return buildStakeholderJoinUrl(sourceStakeholder.type, sourceCodes.connection_code)
  }, [sourceCodes, sourceStakeholder])
  const sourceStakeholderProfileId = sourceStakeholder?.owner_user_id || sourceStakeholder?.profile_id || ''

  // Materials with QR placement zones
  const materialsWithQrZone = React.useMemo(() =>
    materialsData.filter(m => {
      const meta = m.metadata as Record<string, unknown> | null
      return getQrPlacements(meta).length > 0
        && !!m.file_url
        && (m.mime_type?.startsWith('image/') || isPdfMaterial(m))
    }),
  [materialsData])

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
  const [logoEditedUrl, setLogoEditedUrl] = React.useState<string>('')
  const [logoEditSettings, setLogoEditSettings] = React.useState<QrLogoEditSettings>(DEFAULT_QR_LOGO_EDIT_SETTINGS)

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

  // File input ref
  const logoInputRef = React.useRef<HTMLInputElement>(null)
  const activeLogoUrl = logoEditedUrl || logoPreviewUrl
  const contextPrefillRef = React.useRef<string>('')

  const applySourceCodesToDraft = React.useCallback(() => {
    if (!sourceStakeholder || !sourceCodes || !sourceJoinUrl) return
    setDestType('url')
    setDestination({ type: 'url', url: sourceJoinUrl })
    setShowAssignments(true)
    setStakeholder(sourceStakeholderProfileId)
    setTags((current) => normalizeContextTags(current, sourceEntityType || undefined, sourceEntityName))

    if (sourceBusiness) {
      setBusiness(sourceBusiness.id)
      setCity(sourceBusiness.city_id || '')
      setBrand(sourceBusiness.brand)
    }

    if (sourceCause) {
      setCause(sourceCause.id)
      setCity(sourceCause.city_id || '')
      setBrand(sourceCause.brand)
    }

    setName((current) => current.trim() || `${sourceEntityName} QR Code`)
  }, [sourceCause, sourceBusiness, sourceCodes, sourceEntityName, sourceEntityType, sourceJoinUrl, sourceStakeholder, sourceStakeholderProfileId])

  const applyExistingQrToDraft = React.useCallback((qr: QrCodeRecord) => {
    const metadata = (qr.metadata as Record<string, unknown> | null) || null
    setName(qr.name)
    setBrand(qr.brand)
    setDestType('url')
    setDestination({ type: 'url', url: qr.destination_url })
    setFgColor(qr.foreground_color)
    setBgColor(qr.background_color)
    setFrameText(qr.frame_text || '')
    setCampaign(qr.campaign_id || '')
    setCity(qr.city_id || sourceBusiness?.city_id || sourceCause?.city_id || '')
    setStakeholder(qr.stakeholder_id || sourceStakeholderProfileId || '')
    setBusiness(qr.business_id || sourceBusiness?.id || '')
    setCause(qr.cause_id || sourceCause?.id || '')
    setTags(normalizeContextTags(getQrMetadataString(metadata, 'tags'), sourceEntityType || undefined, sourceEntityName))
    setDotStyle((metadata?.dot_style as DotStyle) || 'square')
    setCornerStyle((metadata?.corner_style as CornerStyle) || 'square')
    setGradientType(
      metadata?.gradient_type === 'linear' || metadata?.gradient_type === 'radial'
        ? metadata.gradient_type
        : 'none',
    )
    const gradientColors = Array.isArray(metadata?.gradient_colors) ? metadata.gradient_colors : []
    setGradientColor1(typeof gradientColors[0] === 'string' ? gradientColors[0] : '#ffffff')
    setGradientColor2(typeof gradientColors[1] === 'string' ? gradientColors[1] : '#e2e8f0')
    const sizeValue = metadata?.size
    if (typeof sizeValue === 'number' || typeof sizeValue === 'string') {
      setSize(String(sizeValue))
    }
    setSelectedTemplateCollectionId(qr.collection_id || getQrMetadataString(metadata, 'template_collection_id') || null)
    setShowAssignments(true)
  }, [sourceBusiness, sourceCause, sourceEntityName, sourceEntityType, sourceStakeholderProfileId])

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
      if (logoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreviewUrl)
      }
      setLogoFile(file)
      setLogoPreviewUrl(URL.createObjectURL(file))
      setLogoEditedUrl('')
      setLogoEditSettings(DEFAULT_QR_LOGO_EDIT_SETTINGS)
    }
  }

  function removeLogo() {
    setLogoFile(null)
    if (logoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(logoPreviewUrl)
    setLogoPreviewUrl('')
    setLogoEditedUrl('')
    setLogoEditSettings(DEFAULT_QR_LOGO_EDIT_SETTINGS)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  React.useEffect(() => {
    return () => {
      if (logoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(logoPreviewUrl)
    }
  }, [logoPreviewUrl])

  React.useEffect(() => {
    if (!sourceBusiness && !sourceCause) return

    const sourceId = sourceBusiness?.id || sourceCause?.id
    if (!sourceId) return

    const prefillKey = [
      sourceEntityType || 'context',
      sourceId,
      sourceExistingQr?.id || 'new',
      sourceCodes?.id || 'no-codes',
    ].join(':')

    if (contextPrefillRef.current === prefillKey) return

    if (sourceExistingQr) {
      applyExistingQrToDraft(sourceExistingQr)
    } else {
      setName((current) => current.trim() || `${sourceEntityName} QR Code`)
      setShowAssignments(true)
      setTags((current) => normalizeContextTags(current, sourceEntityType || undefined, sourceEntityName))

      if (sourceBusiness) {
        setBusiness(sourceBusiness.id)
        setCity(sourceBusiness.city_id || '')
        setBrand(sourceBusiness.brand)
      }

      if (sourceCause) {
        setCause(sourceCause.id)
        setCity(sourceCause.city_id || '')
        setBrand(sourceCause.brand)
      }

      if (sourceStakeholderProfileId) {
        setStakeholder(sourceStakeholderProfileId)
      }

      if (sourceJoinUrl) {
        setDestType('url')
        setDestination({ type: 'url', url: sourceJoinUrl })
      }
    }

    contextPrefillRef.current = prefillKey
  }, [
    applyExistingQrToDraft,
    sourceBusiness,
    sourceCause,
    sourceCodes?.id,
    sourceEntityName,
    sourceEntityType,
    sourceExistingQr,
    sourceJoinUrl,
    sourceStakeholderProfileId,
  ])

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
          logoUrl: activeLogoUrl || undefined,
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
  }, [encodedData, fgColor, bgColor, dotStyle, cornerStyle, frameText, activeLogoUrl, gradientType, gradientColor1, gradientColor2])

  // Generate final QR code and save to Supabase
  async function handleGenerate() {
    if (!name.trim()) return
    setIsGenerating(true)

    try {
      const code = generateShortCode(8)

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
        logoUrl: activeLogoUrl || undefined,
        gradientType,
        gradientColors: [gradientColor1, gradientColor2],
      })

      setPreviewUrl(dataUrl)

      // Save to Supabase qr_codes table
      const redirectUrl = `https://localvip.com/q/${code}`
      const savedQr = await insertQrCode({
        name: name.trim(),
        short_code: code,
        destination_url: dataToEncode,
        redirect_url: redirectUrl,
        brand: brand as 'localvip' | 'hato',
        foreground_color: fgColor,
        background_color: bgColor,
        frame_text: frameText || null,
        campaign_id: campaign || null,
        city_id: city || null,
        stakeholder_id: stakeholder || null,
        business_id: business || null,
        cause_id: cause || null,
        scan_count: 0,
        version: 1,
        status: 'active',
        created_by: profile.id,
        logo_url: null,
        collection_id: selectedTemplateCollectionId,
        destination_preset: null,
        metadata: {
          dot_style: dotStyle,
          corner_style: cornerStyle,
          gradient_type: gradientType,
          gradient_colors: [gradientColor1, gradientColor2],
          size: finalSize,
          tags,
          logo_name: logoFile?.name || null,
          logo_edit: logoFile ? logoEditSettings : null,
          source_entity_type: sourceEntityType,
          source_entity_id: sourceBusiness?.id || sourceCause?.id || null,
          referral_code: sourceCodes?.referral_code || null,
          connection_code: sourceCodes?.connection_code || null,
          join_url: sourceJoinUrl || null,
          template_collection_id: selectedTemplateCollectionId,
        },
      })

      if (savedQr && sourceBusiness && (!business || business === sourceBusiness.id)) {
        await updateBusiness(sourceBusiness.id, { linked_qr_code_id: savedQr.id })
      }

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

  function handleApplySavedTemplate(collection: QrCodeCollection, layout: SavedQrTemplateLayout) {
    setSelectedTemplateCollectionId(collection.id)
    setSize(String(layout.size))
    setFgColor(layout.foregroundColor)
    setBgColor(layout.backgroundColor)
    setDotStyle(layout.dotStyle)
    setCornerStyle(layout.cornerStyle)
    setFrameText(layout.frameText)
    setGradientType(layout.gradientType)
    setGradientColor1(layout.gradientColors[0])
    setGradientColor2(layout.gradientColors[1])
    setTemplateGalleryOpen(false)
    setTemplateMessage(`Applied template "${collection.name}".`)
    setTemplateError(null)
  }

  async function handleSaveCurrentTemplate() {
    if (!templateName.trim()) {
      setTemplateError('Template name is required.')
      return
    }

    setTemplateError(null)
    setTemplateMessage(null)

    const created = await insertQrCollection({
      name: templateName.trim(),
      description: templateDescription.trim() || null,
      brand: brand as 'localvip' | 'hato',
      created_by: profile.id,
      status: 'active',
      metadata: {
        template_kind: 'layout_template',
        layout: buildSavedQrTemplateLayout({
          size,
          foregroundColor: fgColor,
          backgroundColor: bgColor,
          dotStyle,
          cornerStyle,
          frameText,
          gradientType,
          gradientColors: [gradientColor1, gradientColor2],
        }),
        source_entity_type: sourceEntityType,
      },
    })

    if (!created) {
      setTemplateError(qrTemplateSaveError || 'The QR template could not be saved.')
      return
    }

    setSelectedTemplateCollectionId(created.id)
    setTemplateName('')
    setTemplateDescription('')
    setSaveTemplateOpen(false)
    setTemplateMessage(`Saved "${created.name}" to the template gallery.`)
    refetchQrCollections({ silent: true })
  }

  // ─── Place QR on Material (canvas compositing) ──────────
  const [compositingMaterialId, setCompositingMaterialId] = React.useState<string | null>(null)
  const [materialExportMessage, setMaterialExportMessage] = React.useState<string | null>(null)
  const [materialExportError, setMaterialExportError] = React.useState<string | null>(null)
  const [templateGalleryOpen, setTemplateGalleryOpen] = React.useState(false)
  const [saveTemplateOpen, setSaveTemplateOpen] = React.useState(false)
  const [templateName, setTemplateName] = React.useState('')
  const [templateDescription, setTemplateDescription] = React.useState('')
  const [templateMessage, setTemplateMessage] = React.useState<string | null>(null)
  const [templateError, setTemplateError] = React.useState<string | null>(null)
  const [selectedTemplateCollectionId, setSelectedTemplateCollectionId] = React.useState<string | null>(null)

  const savedTemplates = React.useMemo(
    () => qrCollectionsData
      .map((collection) => ({
        collection,
        layout: readSavedQrTemplateLayout(collection),
      }))
      .filter((item): item is { collection: QrCodeCollection; layout: SavedQrTemplateLayout } => !!item.layout),
    [qrCollectionsData],
  )

  async function handlePlaceOnMaterial(material: Material) {
    if (!previewUrl) return
    setMaterialExportMessage(null)
    setMaterialExportError(null)
    setCompositingMaterialId(material.id)

    try {
      const meta = material.metadata as Record<string, unknown>
      const placements = getQrPlacements(meta)
      if (!placements.length || !material.file_url) return

      if (isPdfMaterial(material)) {
        await exportPdfWithQrPlacements({
          pdfUrl: material.file_url,
          qrDataUrl: previewUrl,
          placements,
          filename: `${material.title}-with-qr.pdf`,
        })
        setMaterialExportMessage(`Stamped PDF download started for ${material.title}.`)
        return
      }

      const imagePlacements = placements.filter((placement) => placement.page === 1)
      if (!imagePlacements.length) return

      // Load the flyer image
      const flyerImg = await loadImage(material.file_url)
      // Load the QR code image
      const qrImg = await loadImage(previewUrl)

      // Create canvas at flyer resolution
      const canvas = document.createElement('canvas')
      canvas.width = flyerImg.naturalWidth
      canvas.height = flyerImg.naturalHeight
      const ctx = canvas.getContext('2d')!

      // Draw the flyer
      ctx.drawImage(flyerImg, 0, 0)

      // Draw every saved QR zone for this material.
      imagePlacements.forEach((placement) => {
        const qrW = (placement.size / 100) * canvas.width
        const qrH = qrW
        const qrX = (placement.x / 100) * canvas.width - qrW / 2
        const qrY = (placement.y / 100) * canvas.height - qrH / 2
        ctx.drawImage(qrImg, qrX, qrY, qrW, qrH)
      })

      // Download the composited image
      const compositeUrl = canvas.toDataURL('image/png')
      downloadDataURL(compositeUrl, `${material.title}-with-qr.png`)
      setMaterialExportMessage(`Stamped PNG download started for ${material.title}.`)
    } catch (err) {
      console.error('Composite failed:', err)
      setMaterialExportError('The material export failed. Please try again.')
    } finally {
      setCompositingMaterialId(null)
    }
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }

  function handleReset() {
    setGenerated(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Code Generator"
        description="Create trackable QR codes with custom styles, logos, and destinations"
        breadcrumb={
          sourceBusiness
            ? [
                { label: 'CRM', href: '/crm/businesses' },
                { label: 'Businesses', href: '/crm/businesses' },
                { label: sourceBusiness.name, href: sourceReturnHref },
                { label: 'QR Code Generator' },
              ]
            : sourceCause
              ? [
                  { label: 'CRM', href: '/crm/causes' },
                  { label: 'Causes', href: '/crm/causes' },
                  { label: sourceCause.name, href: sourceReturnHref },
                  { label: 'QR Code Generator' },
                ]
              : [
                  { label: 'QR Codes', href: '/qr/mine' },
                  { label: 'Generator' },
                ]
        }
        actions={
          sourceEntityName ? (
            <Link href={sourceReturnHref}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to {sourceEntityName}
              </Button>
            </Link>
          ) : undefined
        }
      />

      {sourceEntityName && (
        <Card className="border-brand-200 bg-brand-50/40">
          <CardContent className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-surface-900">
                Opened from {sourceEntityName}
              </p>
              <p className="text-sm text-surface-600">
                This generator is prefilled from the {sourceEntityType} record, and any QR you generate here will stay connected to that workflow.
              </p>
              {sourceExistingQr ? (
                <p className="text-xs text-surface-500">
                  The last saved QR settings for this record have already been loaded.
                </p>
              ) : sourceJoinUrl ? (
                <p className="text-xs text-surface-500">
                  Referral and connection codes are ready. You can apply them again at any time below.
                </p>
              ) : (
                <p className="text-xs text-surface-500">
                  This record is linked, but its referral / connection codes are still missing.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={sourceReturnHref}>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Return to record
                </Button>
              </Link>
              {sourceCodes && sourceJoinUrl ? (
                <Button variant="outline" size="sm" onClick={applySourceCodesToDraft}>
                  Add {sourceEntityName}&apos;s referral code and connection code
                </Button>
              ) : null}
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-surface-400" />
                Saved QR Templates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4 text-sm text-surface-600">
                Save the look of a QR once, then reuse that layout with any business, cause, or campaign destination.
              </div>
              {selectedTemplateCollectionId ? (
                <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
                  Using template:{' '}
                  <span className="font-semibold">
                    {savedTemplates.find((item) => item.collection.id === selectedTemplateCollectionId)?.collection.name || 'Saved layout'}
                  </span>
                </div>
              ) : null}
              {templateError ? (
                <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                  {templateError}
                </div>
              ) : null}
              {templateMessage ? (
                <div className="rounded-2xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
                  {templateMessage}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setTemplateGalleryOpen(true)}>
                  <FolderOpen className="h-4 w-4" />
                  Open Template Gallery
                </Button>
                <Button type="button" variant="outline" onClick={() => setSaveTemplateOpen(true)}>
                  <Layers className="h-4 w-4" />
                  Save as Template
                </Button>
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
              {sourceEntityName && (
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-surface-900">
                        {sourceEntityName} destination setup
                      </p>
                      <p className="text-xs leading-5 text-surface-500">
                        Pull the current referral code and connection code straight into this QR so you do not have to rebuild it manually.
                      </p>
                      {sourceCodes ? (
                        <p className="text-xs text-surface-500">
                          Referral: <span className="font-medium text-surface-700">{sourceCodes.referral_code}</span>
                          {' • '}
                          Connection: <span className="font-medium text-surface-700">{sourceCodes.connection_code}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-warning-700">
                          Codes have not been added to this stakeholder yet.
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={applySourceCodesToDraft}
                      disabled={!sourceCodes || !sourceJoinUrl}
                    >
                      Add {sourceEntityName}&apos;s referral code and connection code
                    </Button>
                  </div>
                </div>
              )}

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
                {logoPreviewUrl ? (
                  <QrLogoEditor
                    file={logoFile!}
                    sourceUrl={logoPreviewUrl}
                    editedUrl={logoEditedUrl}
                    settings={logoEditSettings}
                    onSettingsChange={setLogoEditSettings}
                    onEditedUrlChange={setLogoEditedUrl}
                    onReplace={() => logoInputRef.current?.click()}
                    onRemove={removeLogo}
                  />
                ) : (
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-surface-200 p-4 text-center hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
                  >
                    <ImageIcon className="h-8 w-8 text-surface-300" />
                    <p className="text-sm text-surface-500">Click to upload center artwork</p>
                    <p className="text-xs text-surface-400">PNG, JPG, SVG, or WebP. Wide and tall images now stay proportional.</p>
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
                      <SelectContent>{campaignOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                      <MapPin className="h-3.5 w-3.5 text-surface-400" /> City
                    </label>
                    <Select value={city} onValueChange={setCity}>
                      <SelectTrigger><SelectValue placeholder="Select city..." /></SelectTrigger>
                      <SelectContent>{cityOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                      <Users className="h-3.5 w-3.5 text-surface-400" /> Stakeholder
                    </label>
                    <Select value={stakeholder} onValueChange={setStakeholder}>
                      <SelectTrigger><SelectValue placeholder="Select stakeholder..." /></SelectTrigger>
                      <SelectContent>{stakeholderOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                      <Building2 className="h-3.5 w-3.5 text-surface-400" /> Business
                    </label>
                    <Select value={business} onValueChange={setBusiness}>
                      <SelectTrigger><SelectValue placeholder="Select business..." /></SelectTrigger>
                      <SelectContent>{businessOptions.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                      <Heart className="h-3.5 w-3.5 text-surface-400" /> Cause
                    </label>
                    <Select value={cause} onValueChange={setCause}>
                      <SelectTrigger><SelectValue placeholder="Select cause..." /></SelectTrigger>
                      <SelectContent>{causeOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
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
                    <NextImage
                      src={previewUrl}
                      alt="QR Code Preview"
                      width={224}
                      height={224}
                      unoptimized
                      className="h-56 w-56 object-contain"
                    />
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

                <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTemplateError(null)
                      setTemplateMessage(null)
                      setTemplateGalleryOpen(true)
                    }}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Open Template Gallery
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTemplateError(null)
                      setTemplateMessage(null)
                      setTemplateName((current) => current || `${name || sourceEntityName || 'QR'} Template`)
                      setTemplateDescription((current) => current || `Saved layout for ${name || sourceEntityName || 'this QR code'}.`)
                      setSaveTemplateOpen(true)
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Save as Template
                  </Button>
                </div>

                {templateError && (
                  <div className="w-full rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
                    {templateError}
                  </div>
                )}
                {templateMessage && (
                  <div className="w-full rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-xs text-success-700">
                    {templateMessage}
                  </div>
                )}
                {selectedTemplateCollectionId && (
                  <div className="w-full rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-700">
                    Template applied from your saved gallery. New QR codes from this screen will stay linked to that template.
                  </div>
                )}

                {/* Place on Material */}
                {materialsWithQrZone.length > 0 && previewUrl && (
                  <div className="w-full border-t border-surface-100 pt-3">
                    <p className="mb-2 text-xs font-medium text-surface-500 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" />
                      Place on Material
                    </p>
                    <p className="mb-2 text-xs text-surface-400">
                      Select a saved material to auto-place this QR on every saved zone. Image materials download as PNGs, and PDF materials download as stamped PDFs.
                    </p>
                    {materialExportError && (
                      <div className="mb-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
                        {materialExportError}
                      </div>
                    )}
                    {materialExportMessage && (
                      <div className="mb-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-xs text-success-700">
                        {materialExportMessage}
                      </div>
                    )}
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {materialsWithQrZone.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          disabled={!!compositingMaterialId}
                          onClick={() => handlePlaceOnMaterial(m)}
                          className="flex w-full items-center gap-2.5 rounded-lg border border-surface-200 px-3 py-2 text-left text-xs hover:bg-surface-50 transition-colors disabled:opacity-50"
                        >
                          {m.file_url && m.mime_type?.startsWith('image/') ? (
                            <NextImage
                              src={m.file_url}
                              alt=""
                              width={32}
                              height={32}
                              unoptimized
                              className="h-8 w-8 rounded object-cover shrink-0"
                            />
                          ) : isPdfMaterial(m) ? (
                            <div className="h-8 w-8 rounded bg-surface-100 flex items-center justify-center shrink-0">
                              <FileText className="h-4 w-4 text-surface-400" />
                            </div>
                          ) : (
                            <div className="h-8 w-8 rounded bg-surface-100 flex items-center justify-center shrink-0">
                              <Layers className="h-4 w-4 text-surface-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-surface-700 truncate">{m.title}</p>
                            <p className="text-surface-400">
                              {m.brand === 'hato' ? 'HATO' : 'LocalVIP'} • {isPdfMaterial(m) ? 'Downloads PDF' : 'Downloads PNG'}
                            </p>
                          </div>
                          {compositingMaterialId === m.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-500 shrink-0" />
                          ) : (
                            <Download className="h-3.5 w-3.5 text-surface-400 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                    {campaign && <Badge variant="outline">{campaignOptions.find(c => c.value === campaign)?.label}</Badge>}
                    {city && <Badge variant="outline">{cityOptions.find(c => c.value === city)?.label}</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={templateGalleryOpen} onOpenChange={setTemplateGalleryOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>QR Template Gallery</DialogTitle>
            <DialogDescription>
              Choose a saved QR layout and apply it to the QR you are building right now.
            </DialogDescription>
          </DialogHeader>
          {savedTemplates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-10 text-center text-sm text-surface-500">
              No saved QR templates yet. Save your current layout first.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {savedTemplates.map((item) => (
                <SavedQrTemplateCard
                  key={item.collection.id}
                  collection={item.collection}
                  layout={item.layout}
                  active={selectedTemplateCollectionId === item.collection.id}
                  onApply={handleApplySavedTemplate}
                />
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateGalleryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Save as QR Template</DialogTitle>
            <DialogDescription>
              Save this QR layout so you can reuse the same look with different destinations later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Template name</label>
              <Input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="e.g. Business Yellow Poster"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Description</label>
              <Textarea
                value={templateDescription}
                onChange={(event) => setTemplateDescription(event.target.value)}
                rows={3}
                placeholder="Optional note about where this layout is used."
              />
            </div>
            <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4 text-sm text-surface-600">
              This saves the QR layout only: colors, styles, frame text, and size. The actual destination stays tied to the current QR you are building.
            </div>
            {templateError ? (
              <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                {templateError}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveCurrentTemplate()} disabled={savingQrTemplate || !templateName.trim()}>
              {savingQrTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success state */}
      {generated && (
        <Card className="border-2 border-success-500 bg-success-50/30">
          <CardContent className="py-6">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <div className="shrink-0">
                {previewUrl && (
                  <NextImage
                    src={previewUrl}
                    alt="Generated QR Code"
                    width={128}
                    height={128}
                    unoptimized
                    className="h-32 w-32 rounded-lg shadow-md"
                  />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <Check className="h-5 w-5 text-success-600" />
                  <h3 className="text-lg font-semibold text-surface-900">QR Code Generated</h3>
                </div>
                <p className="text-sm text-surface-600">
                  <span className="font-medium">{name}</span> is ready to download or place on materials.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
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

    </div>
  )
}
