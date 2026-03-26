'use client'

import * as React from 'react'
import {
  Store, Upload, Image as ImageIcon, Calendar, Gift, Clock, Save,
  Check, X, Loader2, MapPin, Globe, Mail, Phone,
  Sparkles, Eye, Trash2, Star, Info,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/auth/context'
import { useBusinesses, useBusinessUpdate } from '@/lib/supabase/hooks'
import { createClient } from '@/lib/supabase/client'
import { ONBOARDING_STAGES } from '@/lib/constants'
import type { Business } from '@/lib/types/database'

// ─── Days of the week ────────────────────────────────────────

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Mon', full: 'Monday' },
  { key: 'tuesday', label: 'Tue', full: 'Tuesday' },
  { key: 'wednesday', label: 'Wed', full: 'Wednesday' },
  { key: 'thursday', label: 'Thu', full: 'Thursday' },
  { key: 'friday', label: 'Fri', full: 'Friday' },
  { key: 'saturday', label: 'Sat', full: 'Saturday' },
  { key: 'sunday', label: 'Sun', full: 'Sunday' },
]

// ─── Offer categories ────────────────────────────────────────

const OFFER_CATEGORIES = [
  'Discount',
  'BOGO (Buy One Get One)',
  'Free Item',
  'Free Service',
  'Percentage Off',
  'Dollar Amount Off',
  'Special Menu Item',
  'VIP Treatment',
  'Loyalty Points',
  'Other',
]

// ─── Business metadata types ─────────────────────────────────

interface BusinessPortalData {
  logo_url?: string
  cover_photo_url?: string
  offer_title?: string
  offer_description?: string
  offer_category?: string
  offer_value?: string
  offer_terms?: string
  offer_start_date?: string
  offer_end_date?: string
  offer_recurring?: boolean
  selected_days?: string[]
  hours_open?: string
  hours_close?: string
  special_hours_notes?: string
  tagline?: string
  description?: string
  social_facebook?: string
  social_instagram?: string
  social_tiktok?: string
  social_x?: string
}

// ─── Helper: get portal data from business metadata ──────────

function getPortalData(biz: Business): BusinessPortalData {
  return (biz.metadata as BusinessPortalData) || {}
}

// ─── Component ───────────────────────────────────────────────

export default function BusinessPortalPage() {
  const { profile } = useAuth()
  const supabase = React.useMemo(() => createClient(), [])

  // Load businesses owned by this user
  const { data: businesses, loading: bizLoading, refetch } = useBusinesses({ owner_id: profile.id })
  const { update, loading: saving } = useBusinessUpdate()

  // Selected business (first one by default, or user picks)
  const [selectedBizId, setSelectedBizId] = React.useState<string | null>(null)
  const biz = React.useMemo(() => {
    if (selectedBizId) return businesses.find(b => b.id === selectedBizId) || null
    return businesses[0] || null
  }, [businesses, selectedBizId])

  // Form state
  const [portal, setPortal] = React.useState<BusinessPortalData>({})
  const [basicInfo, setBasicInfo] = React.useState({
    name: '', email: '', phone: '', website: '', address: '',
  })
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null)
  const [coverPhotoFile, setCoverPhotoFile] = React.useState<File | null>(null)
  const [coverPhotoPreview, setCoverPhotoPreview] = React.useState<string | null>(null)
  const [uploadingBranding, setUploadingBranding] = React.useState(false)
  const [saveSuccess, setSaveSuccess] = React.useState(false)
  const [activeSection, setActiveSection] = React.useState<'info' | 'branding' | 'offer' | 'schedule' | 'preview'>('info')

  // Initialize form when business loads
  React.useEffect(() => {
    if (biz) {
      const pd = getPortalData(biz)
      setPortal(pd)
      setBasicInfo({
        name: biz.name || '',
        email: biz.email || '',
        phone: biz.phone || '',
        website: biz.website || '',
        address: biz.address || '',
      })
      setLogoPreview(pd.logo_url || null)
      setCoverPhotoPreview(pd.cover_photo_url || null)
    }
  }, [biz])

  // Logo file handler
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    safeRevokeObjectUrl(logoPreview)
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleCoverPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    safeRevokeObjectUrl(coverPhotoPreview)
    setCoverPhotoFile(file)
    setCoverPhotoPreview(URL.createObjectURL(file))
  }

  const removeLogo = () => {
    safeRevokeObjectUrl(logoPreview)
    setLogoFile(null)
    setLogoPreview(null)
    setPortal(p => ({ ...p, logo_url: undefined }))
  }

  const removeCoverPhoto = () => {
    safeRevokeObjectUrl(coverPhotoPreview)
    setCoverPhotoFile(null)
    setCoverPhotoPreview(null)
    setPortal(p => ({ ...p, cover_photo_url: undefined }))
  }

  async function uploadBrandAsset({
    file,
    folder,
    fileName,
    fallbackUrl,
  }: {
    file: File | null
    folder: string
    fileName: string
    fallbackUrl?: string
  }): Promise<string | null> {
    if (!file || !biz) return fallbackUrl || null

    try {
      const fileExt = file.name.split('.').pop() || 'png'
      const filePath = `${folder}/${biz.id}/${fileName}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('public-assets')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        console.error('Brand asset upload error:', uploadError)
        // If bucket doesn't exist, save base64 instead
        return await fileToDataUrl(file)
      }

      const { data: urlData } = supabase.storage
        .from('public-assets')
        .getPublicUrl(filePath)

      return urlData.publicUrl
    } catch {
      // Fallback: convert to data URL and store in metadata
      return await fileToDataUrl(file)
    }
  }

  // Toggle a day
  const toggleDay = (day: string) => {
    setPortal(p => {
      const days = p.selected_days || []
      return {
        ...p,
        selected_days: days.includes(day) ? days.filter(d => d !== day) : [...days, day],
      }
    })
  }

  React.useEffect(() => {
    return () => {
      safeRevokeObjectUrl(logoPreview)
      safeRevokeObjectUrl(coverPhotoPreview)
    }
  }, [logoPreview, coverPhotoPreview])

  // Save everything
  const handleSave = async () => {
    if (!biz) return

    setUploadingBranding(true)

    try {
      const logoUrl = await uploadBrandAsset({
        file: logoFile,
        folder: 'business-logos',
        fileName: 'logo',
        fallbackUrl: portal.logo_url,
      }) || undefined

      const coverPhotoUrl = await uploadBrandAsset({
        file: coverPhotoFile,
        folder: 'business-covers',
        fileName: 'cover-photo',
        fallbackUrl: portal.cover_photo_url,
      }) || undefined

      const updatedMetadata: BusinessPortalData = {
        ...portal,
        logo_url: logoUrl,
        cover_photo_url: coverPhotoUrl,
      }

      const result = await update(biz.id, {
        name: basicInfo.name || biz.name,
        email: basicInfo.email || null,
        phone: basicInfo.phone || null,
        website: basicInfo.website || null,
        address: basicInfo.address || null,
        metadata: updatedMetadata as Record<string, unknown>,
      })

      if (result) {
        setSaveSuccess(true)
        setLogoFile(null)
        setCoverPhotoFile(null)
        refetch()
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } finally {
      setUploadingBranding(false)
    }
  }

  // Loading
  if (bizLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        <span className="ml-2 text-surface-500">Loading your business...</span>
      </div>
    )
  }

  // No business assigned to this user
  if (!biz) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Business Portal"
          description="Manage your LocalVIP business profile, offer, and schedule."
        />
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Store className="mb-4 h-12 w-12 text-surface-300" />
            <h3 className="text-lg font-semibold text-surface-800">No Business Assigned</h3>
            <p className="mt-2 max-w-md text-sm text-surface-500">
              You don&apos;t have a business linked to your account yet. Contact your LocalVIP representative to get started with onboarding.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const sections = [
    { key: 'info' as const, label: 'Business Info', icon: <Store className="h-4 w-4" /> },
    { key: 'branding' as const, label: 'Logo & Branding', icon: <ImageIcon className="h-4 w-4" /> },
    { key: 'offer' as const, label: 'LocalVIP Offer', icon: <Gift className="h-4 w-4" /> },
    { key: 'schedule' as const, label: 'Schedule & Days', icon: <Calendar className="h-4 w-4" /> },
    { key: 'preview' as const, label: 'Preview', icon: <Eye className="h-4 w-4" /> },
  ]

  const resolvedLogo = logoPreview || portal.logo_url || null
  const resolvedCoverPhoto = coverPhotoPreview || portal.cover_photo_url || null
  const previewTitle = basicInfo.name || 'Your Business Name'
  const previewCategory = biz.category || 'Local Business'
  const previewDescription =
    portal.description ||
    portal.offer_description ||
    portal.tagline ||
    'Add a short description so customers quickly understand why they should visit your business.'
  const previewOfferValue = portal.offer_value || 'LocalVIP Offer'
  const selectedDaysCount = (portal.selected_days || []).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Portal"
        description="Manage your LocalVIP profile. Upload your logo and cover photo, set your offer, and choose your days."
        actions={
          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="flex items-center gap-1 text-sm text-success-600">
                <Check className="h-4 w-4" /> Saved!
              </span>
            )}
            <Button onClick={handleSave} disabled={saving || uploadingBranding}>
              {saving || uploadingBranding ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Save className="h-4 w-4" /> Save Changes</>
              )}
            </Button>
          </div>
        }
      />

      {/* Business selector (if user has multiple) */}
      {businesses.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-surface-600">Business:</label>
          <select
            value={biz.id}
            onChange={e => setSelectedBizId(e.target.value)}
            className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Onboarding Status Banner */}
      <Card className="border-l-4 border-l-brand-500">
        <CardContent className="flex items-center gap-4 py-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-surface-200 bg-white shadow-sm">
            {logoPreview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoPreview} alt={`${biz.name} logo`} className="h-full w-full object-contain p-1.5" />
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-brand-50">
                <Store className="h-5 w-5 text-brand-600" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-surface-800">{biz.name}</p>
            <p className="text-xs text-surface-500">
              Onboarding Stage: <Badge variant={biz.stage === 'live' ? 'success' : biz.stage === 'onboarded' ? 'success' : 'info'} dot>{ONBOARDING_STAGES[biz.stage]?.label}</Badge>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-surface-400">Brand</p>
            <Badge variant={biz.brand === 'hato' ? 'hato' : 'info'}>{biz.brand === 'hato' ? 'HATO' : 'LocalVIP'}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Section tabs */}
      <div className="border-b border-surface-200">
        <nav className="flex gap-1 overflow-x-auto">
          {sections.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeSection === s.key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-surface-500 hover:text-surface-700'
              }`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── SECTION: Business Info ── */}
      {activeSection === 'info' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Business Name *</label>
                <Input
                  value={basicInfo.name}
                  onChange={e => setBasicInfo(p => ({ ...p, name: e.target.value }))}
                  placeholder="Your business name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Tagline</label>
                <Input
                  value={portal.tagline || ''}
                  onChange={e => setPortal(p => ({ ...p, tagline: e.target.value }))}
                  placeholder="A short catchy tagline"
                />
                <p className="mt-1 text-xs text-surface-400">Appears on your LocalVIP listing</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Description</label>
                <Textarea
                  value={portal.description || ''}
                  onChange={e => setPortal(p => ({ ...p, description: e.target.value }))}
                  placeholder="Tell customers about your business..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                  <Mail className="h-3.5 w-3.5 text-surface-400" /> Email
                </label>
                <Input
                  type="email"
                  value={basicInfo.email}
                  onChange={e => setBasicInfo(p => ({ ...p, email: e.target.value }))}
                  placeholder="contact@yourbusiness.com"
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                  <Phone className="h-3.5 w-3.5 text-surface-400" /> Phone
                </label>
                <Input
                  type="tel"
                  value={basicInfo.phone}
                  onChange={e => setBasicInfo(p => ({ ...p, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                  <Globe className="h-3.5 w-3.5 text-surface-400" /> Website
                </label>
                <Input
                  value={basicInfo.website}
                  onChange={e => setBasicInfo(p => ({ ...p, website: e.target.value }))}
                  placeholder="www.yourbusiness.com"
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                  <MapPin className="h-3.5 w-3.5 text-surface-400" /> Address
                </label>
                <Input
                  value={basicInfo.address}
                  onChange={e => setBasicInfo(p => ({ ...p, address: e.target.value }))}
                  placeholder="123 Main St, City, ST 12345"
                />
              </div>
            </CardContent>
          </Card>

          {/* Social Media */}
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Social Media</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Facebook</label>
                  <Input
                    value={portal.social_facebook || ''}
                    onChange={e => setPortal(p => ({ ...p, social_facebook: e.target.value }))}
                    placeholder="facebook.com/yourbusiness"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Instagram</label>
                  <Input
                    value={portal.social_instagram || ''}
                    onChange={e => setPortal(p => ({ ...p, social_instagram: e.target.value }))}
                    placeholder="@yourbusiness"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">TikTok</label>
                  <Input
                    value={portal.social_tiktok || ''}
                    onChange={e => setPortal(p => ({ ...p, social_tiktok: e.target.value }))}
                    placeholder="@yourbusiness"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">X (Twitter)</label>
                  <Input
                    value={portal.social_x || ''}
                    onChange={e => setPortal(p => ({ ...p, social_x: e.target.value }))}
                    placeholder="@yourbusiness"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SECTION: Logo & Branding ── */}
      {activeSection === 'branding' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Brand Assets</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-surface-500">
                Add the two images that shape your LocalVIP presence: a cover photo for the hero area and a logo for the smaller circular badge.
              </p>

              {/* Logo Preview */}
              <div className="flex items-center gap-6">
                <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-surface-300 bg-surface-50">
                  {resolvedLogo ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolvedLogo} alt="Business logo" className="h-full w-full object-contain p-3" />
                      <button
                        onClick={removeLogo}
                        className="absolute right-1 top-1 rounded-full bg-surface-800/70 p-1 text-white hover:bg-red-600 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-8 w-8 text-surface-300" />
                      <p className="mt-2 text-xs text-surface-400">No logo yet</p>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-surface-800">Business Logo</p>
                    <p className="mt-1 text-sm text-surface-500">
                      This is the small circular image customers see on the business card, plus the logo used on QR codes and materials.
                    </p>
                  </div>
                  <label
                    htmlFor="logo-upload"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-surface-300 bg-surface-0 px-4 py-2 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-50"
                  >
                    <Upload className="h-4 w-4" />
                    {resolvedLogo ? 'Change Logo' : 'Upload Logo'}
                  </label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    className="hidden"
                  />
                  {resolvedLogo && (
                    <Button type="button" variant="ghost" size="sm" onClick={removeLogo}>
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  )}
                  <p className="text-xs text-surface-400">
                    PNG, JPG, or SVG. Recommended: 512×512px or larger.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-surface-800">Cover Photo</p>
                    <p className="mt-1 text-sm text-surface-500">
                      This becomes the large image at the top of the customer-facing business page.
                    </p>
                  </div>

                  <div className="relative aspect-[16/9] overflow-hidden rounded-[1.5rem] border-2 border-dashed border-surface-300 bg-white shadow-sm">
                    {resolvedCoverPhoto ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={resolvedCoverPhoto} alt="Business cover" className="h-full w-full object-cover" />
                        <button
                          onClick={removeCoverPhoto}
                          className="absolute right-3 top-3 rounded-full bg-surface-900/70 p-1.5 text-white transition-colors hover:bg-red-600"
                          aria-label="Remove cover photo"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 text-center">
                        <ImageIcon className="h-10 w-10 text-brand-300" />
                        <p className="mt-3 text-sm font-medium text-surface-500">No cover photo yet</p>
                        <p className="mt-1 max-w-xs text-xs text-surface-400">
                          Use a real storefront, food, service, team, or interior photo that feels local and inviting.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="cover-photo-upload"
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-surface-300 bg-surface-0 px-4 py-2 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-50"
                    >
                      <Upload className="h-4 w-4" />
                      {resolvedCoverPhoto ? 'Change Cover Photo' : 'Upload Cover Photo'}
                    </label>
                    <input
                      id="cover-photo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleCoverPhotoSelect}
                      className="hidden"
                    />
                    {resolvedCoverPhoto && (
                      <Button type="button" variant="ghost" size="sm" onClick={removeCoverPhoto}>
                        <Trash2 className="h-4 w-4" /> Remove
                      </Button>
                    )}
                  </div>

                  <p className="text-xs text-surface-400">
                    Best crop: a wide horizontal image, ideally at least 1600px wide.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Branding Tips */}
          <Card>
            <CardHeader><CardTitle>Branding Tips</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <p className="text-sm text-surface-600">Use a <strong>square logo</strong> so it reads clearly in the smaller circular badge.</p>
              </div>
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <p className="text-sm text-surface-600">Your logo appears on QR codes — make sure it&apos;s recognizable at small sizes.</p>
              </div>
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <p className="text-sm text-surface-600">High resolution (at least 512×512px) ensures crisp printing on flyers and materials.</p>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-hato-500" />
                <p className="text-sm text-surface-600">Your logo will be featured on the LocalVIP consumer app when customers browse nearby deals.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SECTION: LocalVIP Offer ── */}
      {activeSection === 'offer' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-brand-500" /> Your LocalVIP Offer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
                <p className="text-sm text-brand-800">
                  This is the deal that LocalVIP customers will see when they visit your business. Make it compelling!
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Offer Title *</label>
                <Input
                  value={portal.offer_title || ''}
                  onChange={e => setPortal(p => ({ ...p, offer_title: e.target.value }))}
                  placeholder="e.g. 20% Off Your First Visit"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Offer Category</label>
                <select
                  value={portal.offer_category || ''}
                  onChange={e => setPortal(p => ({ ...p, offer_category: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select category...</option>
                  {OFFER_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Offer Value</label>
                <Input
                  value={portal.offer_value || ''}
                  onChange={e => setPortal(p => ({ ...p, offer_value: e.target.value }))}
                  placeholder="e.g. $5 off, 20%, Buy 1 Get 1"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Description</label>
                <Textarea
                  value={portal.offer_description || ''}
                  onChange={e => setPortal(p => ({ ...p, offer_description: e.target.value }))}
                  placeholder="Describe your offer in detail. What do customers get?"
                  rows={3}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Terms & Conditions</label>
                <Textarea
                  value={portal.offer_terms || ''}
                  onChange={e => setPortal(p => ({ ...p, offer_terms: e.target.value }))}
                  placeholder="e.g. One per customer, cannot combine with other offers, valid on dine-in only"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Start Date</label>
                  <Input
                    type="date"
                    value={portal.offer_start_date || ''}
                    onChange={e => setPortal(p => ({ ...p, offer_start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">End Date</label>
                  <Input
                    type="date"
                    value={portal.offer_end_date || ''}
                    onChange={e => setPortal(p => ({ ...p, offer_end_date: e.target.value }))}
                  />
                  <p className="mt-1 text-xs text-surface-400">Leave blank for ongoing offer</p>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={portal.offer_recurring || false}
                  onChange={e => setPortal(p => ({ ...p, offer_recurring: e.target.checked }))}
                  className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-surface-700">This is a recurring/ongoing offer</span>
              </label>
            </CardContent>
          </Card>

          {/* Offer Tips */}
          <Card>
            <CardHeader><CardTitle>Offer Tips</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Star className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                  <div>
                    <p className="text-sm font-medium text-surface-700">Top performing offers</p>
                    <p className="text-xs text-surface-500">Percentage discounts (10-20%) and BOGO deals get the most engagement.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Star className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                  <div>
                    <p className="text-sm font-medium text-surface-700">Be specific</p>
                    <p className="text-xs text-surface-500">Instead of &quot;discount on food&quot;, try &quot;15% off any entrée&quot; — specific offers convert better.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Star className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                  <div>
                    <p className="text-sm font-medium text-surface-700">Exclusive feels special</p>
                    <p className="text-xs text-surface-500">Phrase it as &quot;exclusive LocalVIP offer&quot; to make customers feel they&apos;re getting something special.</p>
                  </div>
                </div>
              </div>

              {/* Offer preview card */}
              {portal.offer_title && (
                <div className="mt-4 rounded-xl border border-surface-200 bg-gradient-to-br from-brand-50 to-surface-50 p-4">
                  <p className="text-xs font-medium text-brand-600 uppercase tracking-wide">LocalVIP Exclusive</p>
                  <h4 className="mt-1 text-lg font-bold text-surface-900">{portal.offer_title}</h4>
                  {portal.offer_value && (
                    <p className="mt-0.5 text-sm font-semibold text-brand-700">{portal.offer_value}</p>
                  )}
                  {portal.offer_description && (
                    <p className="mt-2 text-sm text-surface-600">{portal.offer_description}</p>
                  )}
                  {portal.offer_terms && (
                    <p className="mt-2 text-xs text-surface-400 italic">{portal.offer_terms}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SECTION: Schedule & Days ── */}
      {activeSection === 'schedule' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-brand-500" /> Participation Days
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-surface-500">
                Select the days your business participates in the LocalVIP program. Customers will see which days your offer is available.
              </p>

              <div className="grid grid-cols-7 gap-2">
                {DAYS_OF_WEEK.map(day => {
                  const isSelected = (portal.selected_days || []).includes(day.key)
                  return (
                    <button
                      key={day.key}
                      onClick={() => toggleDay(day.key)}
                      className={`flex flex-col items-center rounded-xl border-2 px-2 py-3 text-center transition-all ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                          : 'border-surface-200 bg-surface-0 text-surface-500 hover:border-surface-300 hover:bg-surface-50'
                      }`}
                    >
                      <span className="text-xs font-medium">{day.label}</span>
                      {isSelected && <Check className="mt-1 h-4 w-4" />}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-surface-50 px-3 py-2">
                <Info className="h-4 w-4 text-surface-400" />
                <p className="text-xs text-surface-500">
                  {(portal.selected_days || []).length === 0
                    ? 'No days selected yet. Select at least one day.'
                    : `${(portal.selected_days || []).length} day${(portal.selected_days || []).length > 1 ? 's' : ''} selected: ${
                        (portal.selected_days || []).map(d => DAYS_OF_WEEK.find(w => w.key === d)?.full).join(', ')
                      }`
                  }
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPortal(p => ({ ...p, selected_days: DAYS_OF_WEEK.map(d => d.key) }))}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPortal(p => ({
                    ...p,
                    selected_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                  }))}
                >
                  Weekdays Only
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPortal(p => ({ ...p, selected_days: ['saturday', 'sunday'] }))}
                >
                  Weekends Only
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPortal(p => ({ ...p, selected_days: [] }))}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-brand-500" /> Business Hours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-surface-500">
                Set your general business hours. Customers will see when you&apos;re open.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Opens at</label>
                  <Input
                    type="time"
                    value={portal.hours_open || ''}
                    onChange={e => setPortal(p => ({ ...p, hours_open: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Closes at</label>
                  <Input
                    type="time"
                    value={portal.hours_close || ''}
                    onChange={e => setPortal(p => ({ ...p, hours_close: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Special Hours Notes</label>
                <Textarea
                  value={portal.special_hours_notes || ''}
                  onChange={e => setPortal(p => ({ ...p, special_hours_notes: e.target.value }))}
                  placeholder="e.g. Closed on holidays, Friday hours may vary, Kitchen closes 30 min before closing"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SECTION: Preview ── */}
      {activeSection === 'preview' && (
        <div className="mx-auto max-w-lg">
          <Card className="overflow-hidden">
            {/* Simulated consumer card */}
            <div className="relative h-72 overflow-hidden bg-surface-900">
              {resolvedCoverPhoto ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolvedCoverPhoto} alt={`${previewTitle} cover`} className="h-full w-full object-cover" />
                </>
              ) : (
                <div className="flex h-full items-end bg-gradient-to-br from-brand-500 via-brand-400 to-surface-900 p-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">LocalVIP Business</p>
                    <p className="mt-2 max-w-xs text-3xl font-bold leading-tight text-white">{previewTitle}</p>
                  </div>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface-900/35 to-transparent" />
            </div>

            <CardContent className="relative -mt-14 space-y-5 px-5 pb-5">
              <div className="rounded-[2rem] bg-white p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-[2rem] font-bold leading-none text-surface-900">{previewTitle}</h2>
                    <p className="mt-3 text-lg text-surface-500">{previewCategory}</p>
                  </div>
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-[5px] border-white bg-white shadow-[0_16px_30px_-18px_rgba(15,23,42,0.6)]">
                    {resolvedLogo ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={resolvedLogo} alt={`${previewTitle} logo`} className="h-full w-full object-contain p-2" />
                      </>
                    ) : (
                      <Store className="h-10 w-10 text-brand-400" />
                    )}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Badge variant="success" className="rounded-full border-0 bg-emerald-100 px-4 py-2 text-base font-semibold text-emerald-700">
                    {previewOfferValue}
                  </Badge>
                  <Badge variant="info" className="rounded-full px-4 py-2 text-base font-semibold">
                    Verified
                  </Badge>
                </div>

                <p className="mt-5 text-lg leading-8 text-surface-600">
                  {previewDescription}
                </p>

                {basicInfo.address && (
                  <div className="mt-5 flex items-start gap-3 text-surface-600">
                    <MapPin className="mt-1 h-5 w-5 shrink-0 text-surface-400" />
                    <div>
                      <p className="text-lg">{basicInfo.address}</p>
                      <p className="mt-1 text-sm text-surface-400">Featured in your local LocalVIP network</p>
                    </div>
                  </div>
                )}

                <Button className="mt-6 h-14 w-full rounded-2xl text-base font-semibold">
                  {portal.offer_title ? 'Pay Now' : 'View Offer'}
                </Button>
              </div>

              <div className="rounded-[2rem] bg-white p-6 shadow-lg">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-rose-500" />
                  <h3 className="text-2xl font-bold text-surface-900">Community Impact</h3>
                </div>
                <p className="mt-4 text-lg leading-8 text-surface-600">
                  For each transaction at {previewTitle}, LocalVIP can help connect everyday purchases back to nearby schools and causes.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div className="rounded-[1.5rem] border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-5">
                    <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Local Causes</p>
                    <p className="mt-4 text-4xl font-bold text-rose-600">$0.00</p>
                    <p className="mt-2 text-sm text-surface-500">Will grow as customers support your business.</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
                    <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Active Days</p>
                    <p className="mt-4 text-4xl font-bold text-emerald-600">{selectedDaysCount}</p>
                    <p className="mt-2 text-sm text-surface-500">
                      {selectedDaysCount > 0 ? 'Ready to show customers when your offer is available.' : 'Set your schedule to show offer availability.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="hidden">
              {/* Offer */}
              {portal.offer_title ? (
                <div className="rounded-xl border-2 border-brand-200 bg-brand-50 p-4">
                  <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-brand-600" />
                    <span className="text-xs font-bold uppercase tracking-wide text-brand-600">LocalVIP Exclusive</span>
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-surface-900">{portal.offer_title}</h3>
                  {portal.offer_value && (
                    <p className="text-sm font-semibold text-brand-700">{portal.offer_value}</p>
                  )}
                  {portal.offer_description && (
                    <p className="mt-1 text-sm text-surface-600">{portal.offer_description}</p>
                  )}
                  {portal.offer_terms && (
                    <p className="mt-2 text-xs text-surface-400">{portal.offer_terms}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-surface-300 p-4 text-center">
                  <Gift className="mx-auto h-8 w-8 text-surface-300" />
                  <p className="mt-1 text-sm text-surface-400">No offer set yet</p>
                </div>
              )}

              {/* Days */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-surface-500">Available Days</p>
                <div className="flex gap-1.5">
                  {DAYS_OF_WEEK.map(day => {
                    const isSelected = (portal.selected_days || []).includes(day.key)
                    return (
                      <div
                        key={day.key}
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${
                          isSelected
                            ? 'bg-brand-600 text-white'
                            : 'bg-surface-100 text-surface-400'
                        }`}
                      >
                        {day.label[0]}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Hours */}
              {(portal.hours_open || portal.hours_close) && (
                <div className="flex items-center gap-2 text-sm text-surface-600">
                  <Clock className="h-4 w-4 text-surface-400" />
                  <span>
                    {portal.hours_open || '?'} – {portal.hours_close || '?'}
                  </span>
                </div>
              )}

              {/* Contact */}
              <div className="space-y-1.5 border-t border-surface-100 pt-4">
                {basicInfo.address && (
                  <p className="flex items-center gap-2 text-sm text-surface-600">
                    <MapPin className="h-3.5 w-3.5 text-surface-400" /> {basicInfo.address}
                  </p>
                )}
                {basicInfo.phone && (
                  <p className="flex items-center gap-2 text-sm text-surface-600">
                    <Phone className="h-3.5 w-3.5 text-surface-400" /> {basicInfo.phone}
                  </p>
                )}
                {basicInfo.website && (
                  <p className="flex items-center gap-2 text-sm text-surface-600">
                    <Globe className="h-3.5 w-3.5 text-surface-400" /> {basicInfo.website}
                  </p>
                )}
              </div>
              </div>
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-xs text-surface-400">
            This is a preview of how your business will appear to LocalVIP customers.
          </p>
        </div>
      )}

      {/* Floating save bar */}
      <div className="sticky bottom-0 z-30 -mx-6 border-t border-surface-200 bg-surface-0/95 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm text-surface-500">
            {saveSuccess ? (
              <span className="flex items-center gap-1 text-success-600"><Check className="h-4 w-4" /> All changes saved</span>
            ) : (
              'Remember to save your changes'
            )}
          </p>
          <Button onClick={handleSave} disabled={saving || uploadingBranding}>
            {saving || uploadingBranding ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4" /> Save All Changes</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Helper ──────────────────────────────────────────────────

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function safeRevokeObjectUrl(url?: string | null) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}
