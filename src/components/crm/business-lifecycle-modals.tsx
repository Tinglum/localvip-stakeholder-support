'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  QrCode,
  RefreshCw,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/utils'
import { downloadDataURL, generateStyledQR } from '@/lib/qr/generate'
import type {
  Business,
  City,
  GeneratedMaterial,
  OutreachActivity,
  Profile,
  QrCode as QrCodeType,
  StakeholderCode,
} from '@/lib/types/database'

// ═══════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════

function Stat({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-surface-500">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-sm font-semibold text-surface-900">{value}</p>
        {ok !== undefined && (
          <span className={`h-2 w-2 rounded-full ${ok ? 'bg-success-500' : 'bg-warning-400'}`} />
        )}
      </div>
    </div>
  )
}

function Blocker({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
      <AlertTriangle className="h-4 w-4 shrink-0 text-warning-600" />
      {text}
    </div>
  )
}

function SuccessBanner({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" />
      {text}
    </div>
  )
}

// ═══════════════════════════════════════════
// 1. Initial Connection Modal
// ═══════════════════════════════════════════
//  Features:
//  • Quick-edit city, email, phone, website inline
//  • Readiness checklist (city + at least one contact path)
//  • Helper count + linked-cause summary
//  • One-click complete step when ready

export interface InitialConnectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  biz: Business
  city: City | null
  linkedCause: { name: string } | null
  helperCount: number
  onSave: (changes: Partial<Business>) => Promise<void>
  onCompleteStep?: () => void
  readyToComplete: boolean
  saving: boolean
  blocker: string | null
  cities: City[]
}

export function InitialConnectionModal({
  open,
  onOpenChange,
  biz,
  city,
  linkedCause,
  helperCount,
  onSave,
  onCompleteStep,
  readyToComplete,
  saving,
  blocker,
  cities,
}: InitialConnectionModalProps) {
  const [email, setEmail] = React.useState(biz.email || '')
  const [phone, setPhone] = React.useState(biz.phone || '')
  const [website, setWebsite] = React.useState(biz.website || '')
  const [cityId, setCityId] = React.useState(biz.city_id || '')
  const [localSaving, setLocalSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setEmail(biz.email || '')
      setPhone(biz.phone || '')
      setWebsite(biz.website || '')
      setCityId(biz.city_id || '')
      setSaved(false)
    }
  }, [open, biz])

  const hasCity = !!cityId
  const hasContact = !!(email.trim() || phone.trim() || website.trim())
  const allReady = hasCity && hasContact

  async function handleSave() {
    setLocalSaving(true)
    setSaved(false)
    try {
      await onSave({ email: email.trim() || null, phone: phone.trim() || null, website: website.trim() || null, city_id: cityId || null })
      setSaved(true)
    } finally {
      setLocalSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-brand-500" />
            Initial Connection
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Readiness indicators */}
          <div className="grid grid-cols-2 gap-3">
            <Stat label="City linked" value={city?.name || 'Not set'} ok={hasCity} />
            <Stat label="Contact path" value={hasContact ? 'Set' : 'Missing'} ok={hasContact} />
            <Stat label="Linked cause" value={linkedCause?.name || 'None'} />
            <Stat label="Helpers" value={`${helperCount} assigned`} />
          </div>

          {blocker && !allReady && <Blocker text={blocker} />}
          {allReady && !readyToComplete && <SuccessBanner text="All prerequisites met. Save changes to enable completion." />}

          {/* City selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-surface-700">City *</label>
            <select
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select a city...</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}, {c.state}</option>
              ))}
            </select>
          </div>

          {/* Contact fields */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-surface-700">
                <Mail className="h-3.5 w-3.5 text-surface-400" /> Email
              </label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@biz.com" />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-surface-700">
                <Phone className="h-3.5 w-3.5 text-surface-400" /> Phone
              </label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(404) 555-0000" />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-surface-700">
                <Globe className="h-3.5 w-3.5 text-surface-400" /> Website
              </label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.biz.com" />
            </div>
          </div>

          {saved && <SuccessBanner text="Contact info saved." />}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 border-t border-surface-100 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave} disabled={localSaving || saving}>
                {localSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save info
              </Button>
              {readyToComplete && onCompleteStep && (
                <Button onClick={onCompleteStep} disabled={saving}>
                  <CheckCircle2 className="h-4 w-4" /> Complete step
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════
// 2. Owner Conversation Modal
// ═══════════════════════════════════════════
//  Features:
//  • Quick log outreach with type picker, subject, notes, outcome
//  • Recent outreach timeline (last 5)
//  • Next-step scheduling with date
//  • Outreach count progress indicator

export interface OwnerConversationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  outreach: OutreachActivity[]
  profileMap: Map<string, Profile>
  onLogOutreach: (data: { type: string; subject: string; body: string; outcome: string; nextStep: string; nextStepDate: string }) => Promise<void>
  onCompleteStep?: () => void
  readyToComplete: boolean
  saving: boolean
  blocker: string | null
}

const OUTREACH_TYPES = [
  { value: 'call', label: 'Phone Call' },
  { value: 'email', label: 'Email' },
  { value: 'text', label: 'Text / SMS' },
  { value: 'in_person', label: 'In Person' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
]

export function OwnerConversationModal({
  open,
  onOpenChange,
  outreach,
  profileMap,
  onLogOutreach,
  onCompleteStep,
  readyToComplete,
  saving,
  blocker,
}: OwnerConversationModalProps) {
  const [type, setType] = React.useState('call')
  const [subject, setSubject] = React.useState('')
  const [body, setBody] = React.useState('')
  const [outcome, setOutcome] = React.useState('')
  const [nextStep, setNextStep] = React.useState('')
  const [nextStepDate, setNextStepDate] = React.useState('')
  const [logBusy, setLogBusy] = React.useState(false)
  const [logDone, setLogDone] = React.useState(false)

  React.useEffect(() => {
    if (open) { setSubject(''); setBody(''); setOutcome(''); setNextStep(''); setNextStepDate(''); setLogDone(false) }
  }, [open])

  async function handleLog() {
    setLogBusy(true)
    setLogDone(false)
    try {
      await onLogOutreach({ type, subject, body, outcome, nextStep, nextStepDate })
      setSubject(''); setBody(''); setOutcome(''); setNextStep(''); setNextStepDate('')
      setLogDone(true)
    } finally {
      setLogBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-brand-500" />
            Owner Conversation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Total outreach" value={`${outreach.length}`} ok={outreach.length > 0} />
            <Stat label="Last contact" value={outreach[0] ? formatDateTime(outreach[0].created_at) : 'Never'} />
            <Stat label="Step status" value={readyToComplete ? 'Ready' : 'Needs outreach'} ok={readyToComplete} />
          </div>

          {blocker && <Blocker text={blocker} />}
          {logDone && <SuccessBanner text="Outreach logged successfully." />}

          {/* Log form */}
          <div className="space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4">
            <p className="text-sm font-semibold text-surface-900">Log new outreach</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {OUTREACH_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Subject</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Quick check-in" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Outcome</label>
                <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Interested, follow-up..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-surface-600">Notes *</label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="What happened in the conversation..." />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Next step</label>
                <Input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Schedule demo, send pricing..." />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Follow-up date</label>
                <Input type="date" value={nextStepDate} onChange={(e) => setNextStepDate(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleLog} disabled={logBusy || !body.trim()}>
              {logBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              Log outreach
            </Button>
          </div>

          {/* Recent outreach timeline */}
          {outreach.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-surface-900">Recent activity</p>
              {outreach.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-xl border border-surface-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{(item.type || '').replace(/_/g, ' ')}</Badge>
                      <p className="text-sm font-semibold text-surface-900">{item.subject || 'Outreach'}</p>
                    </div>
                    <p className="text-xs text-surface-500">{formatDateTime(item.created_at)}</p>
                  </div>
                  {item.body && <p className="mt-2 text-sm text-surface-600 line-clamp-2">{item.body}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.outcome && <Badge variant="info">{item.outcome}</Badge>}
                    {item.next_step && (
                      <Badge variant="warning">
                        Next: {item.next_step}{item.next_step_date ? ` (${item.next_step_date})` : ''}
                      </Badge>
                    )}
                    <Badge variant="outline">{profileMap.get(item.performed_by)?.full_name || 'Team member'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 border-t border-surface-100 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            {readyToComplete && onCompleteStep && (
              <Button onClick={onCompleteStep} disabled={saving}>
                <CheckCircle2 className="h-4 w-4" /> Complete step
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════
// 3. Materials & QR Modal
// ═══════════════════════════════════════════
//  Features:
//  • Edit referral / connection codes inline
//  • Save codes + auto-generate materials in one click
//  • View generated materials list with file links
//  • QR code count + join URL with copy
//  • Regenerate all button

export interface MaterialsQrModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  generatedMaterials: GeneratedMaterial[]
  qrCodes: QrCodeType[]
  engagementAssets?: {
    customerCapture?: {
      captureCode?: string | null
      captureUrl?: string | null
      qrCode?: {
        id?: string | null
        targetUrl?: string | null
        qrImageUrl?: string | null
        logoUrl?: string | null
        destination_url?: string | null
        redirect_url?: string | null
      } | null
    } | null
    networkReferral?: {
      networkReferralCode?: string | null
      networkReferralUrl?: string | null
      qrCode?: {
        id?: string | null
        targetUrl?: string | null
        qrImageUrl?: string | null
        logoUrl?: string | null
        destination_url?: string | null
        redirect_url?: string | null
      } | null
    } | null
  } | null
  assetStatus?: 'idle' | 'loading' | 'ready' | 'error'
  assetError?: string | null
  /** Referral/connection code problem. Never rendered as a QR problem. */
  codeIssue?: string | null
  /** QR provisioning problem, reported independently of codeIssue. */
  qrIssue?: string | null
  onEnsureAssets?: () => Promise<void>
  onGenerateMaterials: (assetKind: 'customer_capture' | 'network_referral') => Promise<void>
  onRegenerateAll: (assetKind: 'customer_capture' | 'network_referral') => Promise<void>
  onCompleteStep?: () => void
  readyToComplete: boolean
  saving: boolean
  blocker: string | null
  engineBusy: 'codes' | 'generate' | null
  regenBusy: boolean
}

export function MaterialsQrModal({
  open,
  onOpenChange,
  generatedMaterials,
  qrCodes,
  engagementAssets = null,
  assetStatus = 'idle',
  assetError = null,
  codeIssue = null,
  qrIssue = null,
  onEnsureAssets,
  onGenerateMaterials,
  onRegenerateAll,
  onCompleteStep,
  readyToComplete,
  saving,
  blocker,
  engineBusy,
  regenBusy,
}: MaterialsQrModalProps) {
  const [copied, setCopied] = React.useState(false)
  const [clientQrPreviewUrl, setClientQrPreviewUrl] = React.useState('')
  const [qrPreviewLoading, setQrPreviewLoading] = React.useState(false)
  const [qrPreviewError, setQrPreviewError] = React.useState<string | null>(null)

  const generated = generatedMaterials.filter((m) => m.generation_status === 'generated' && m.generated_file_url && m.is_active !== false && !m.is_outdated)
  const failed = generatedMaterials.filter((m) => m.generation_status === 'failed')
  const captureCode = engagementAssets?.customerCapture?.captureCode || ''
  const effectiveJoinUrl = engagementAssets?.customerCapture?.captureUrl || ''
  const networkReferralCode = engagementAssets?.networkReferral?.networkReferralCode || ''
  const networkReferralUrl = engagementAssets?.networkReferral?.networkReferralUrl || ''
  const storedCanonicalQr = qrCodes.find((qr) => qr.metadata?.purpose === 'business_capture') || null
  const canonicalQr = engagementAssets?.customerCapture?.qrCode || null
  const networkQr = engagementAssets?.networkReferral?.qrCode || null
  const qrImageUrl = canonicalQr?.qrImageUrl || null
  const canonicalQrMetadata = storedCanonicalQr?.metadata || {}
  const canonicalQrAppearance =
    canonicalQrMetadata.qr_appearance && typeof canonicalQrMetadata.qr_appearance === 'object'
      ? canonicalQrMetadata.qr_appearance as Record<string, unknown>
      : {}
  const businessLogoUrl =
    canonicalQr?.logoUrl
    || storedCanonicalQr?.logo_url
    || (typeof canonicalQrMetadata.logo_url === 'string' ? canonicalQrMetadata.logo_url : null)
    || (typeof canonicalQrAppearance.logoUrl === 'string' ? canonicalQrAppearance.logoUrl : null)
    || null
  const qrDestination =
    canonicalQr?.targetUrl
    || canonicalQr?.destination_url
    || storedCanonicalQr?.destination_url
    || effectiveJoinUrl
  const qrTrackingUrl =
    canonicalQr?.redirect_url
    || storedCanonicalQr?.redirect_url
    || qrDestination
  const displayedQrImageUrl = qrImageUrl || clientQrPreviewUrl

  React.useEffect(() => {
    let cancelled = false

    async function buildClientQrPreview() {
      if (!open || !qrDestination || qrImageUrl) {
        setClientQrPreviewUrl('')
        setQrPreviewError(null)
        setQrPreviewLoading(false)
        return
      }

      setQrPreviewLoading(true)
      setQrPreviewError(null)
      try {
        const preview = await generateStyledQR({
          data: qrTrackingUrl || qrDestination,
          size: 640,
          foregroundColor: storedCanonicalQr?.foreground_color || '#111827',
          backgroundColor: storedCanonicalQr?.background_color || '#ffffff',
          errorCorrectionLevel: 'H',
          dotStyle: 'rounded',
          cornerStyle: 'rounded',
          logoUrl: businessLogoUrl || undefined,
        })
        if (!cancelled) setClientQrPreviewUrl(preview)
      } catch (error) {
        if (!cancelled) {
          setClientQrPreviewUrl('')
          setQrPreviewError(error instanceof Error ? error.message : 'The QR preview could not be generated.')
        }
      } finally {
        if (!cancelled) setQrPreviewLoading(false)
      }
    }

    void buildClientQrPreview()
    return () => {
      cancelled = true
    }
  }, [
    businessLogoUrl,
    open,
    qrDestination,
    qrImageUrl,
    qrTrackingUrl,
    storedCanonicalQr?.background_color,
    storedCanonicalQr?.foreground_color,
  ])

  function copyUrl() {
    if (effectiveJoinUrl) {
      void navigator.clipboard.writeText(effectiveJoinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function downloadQr() {
    if (!clientQrPreviewUrl) return
    const safeCode = (captureCode || storedCanonicalQr?.short_code || 'business')
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
    downloadDataURL(clientQrPreviewUrl, `${safeCode || 'business'}-capture-qr.png`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-brand-500" />
            Materials & QR
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Capture link" value={effectiveJoinUrl ? 'Ready' : 'Creating'} ok={!!effectiveJoinUrl} />
            <Stat label="Network referral" value={networkReferralUrl ? 'Ready' : 'Unavailable'} ok={!!networkReferralUrl} />
            <Stat label="Generated" value={`${generated.length} files`} ok={generated.length > 0} />
            <Stat label="Capture QR" value={canonicalQr || storedCanonicalQr ? 'Ready' : 'Creating'} ok={!!(canonicalQr || storedCanonicalQr)} />
          </div>

          {blocker && <Blocker text={blocker} />}
          {assetStatus === 'loading' && (
            <div className="flex items-center gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800" role="status">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              Preparing the separate customer-capture and network-referral assets...
            </div>
          )}
          {assetStatus === 'ready' && !codeIssue && !qrIssue && (
            <SuccessBanner text="Customer capture and network referral assets are ready." />
          )}
          {assetStatus === 'error' && (
            <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800" role="alert">
              <p className="font-semibold">Automatic check on open: engagement assets could not be prepared.</p>
              <p className="mt-1">
                This check runs by itself whenever this panel opens, so nothing you just did caused it.
              </p>
              <p className="mt-1">{assetError || 'Use "Retry assets" below to run the check again.'}</p>
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-surface-900">Customer list capture</p>
                <p className="mt-1 text-xs text-surface-500">
                  This link and QR only collect details for this business&apos;s pre-launch 100-list. They never register a LocalVIP network referral.
                </p>
              </div>
              <Button
                variant={assetStatus === 'error' || !captureCode || !effectiveJoinUrl ? 'default' : 'outline'}
                size="sm"
                onClick={() => void onEnsureAssets?.()}
                disabled={assetStatus === 'loading' || !onEnsureAssets}
              >
                {assetStatus === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {assetStatus === 'error' ? 'Retry assets' : captureCode && effectiveJoinUrl ? 'Refresh capture assets' : 'Create capture assets'}
              </Button>
            </div>
            {/* Code clashes live with the code fields, never beside the QR tiles — operators
                previously read "code already in use" as the QR being in use. */}
            {codeIssue && (
              <div className="rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm text-amber-900" role="alert">
                <p className="font-semibold">Referral / connection code needs attention</p>
                <p className="mt-1 text-xs text-surface-600">
                  Found by the automatic check that runs when this panel opens. It is about the text codes
                  below, not the QR code or the capture link.
                </p>
                <p className="mt-1">{codeIssue}</p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Capture code</label>
                <Input value={captureCode} readOnly placeholder="Created from the business join slug" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Capture URL</label>
                <Input value={effectiveJoinUrl} readOnly placeholder="Creating capture URL" className="text-xs" />
              </div>
            </div>
            {effectiveJoinUrl && <Button variant="outline" size="sm" onClick={copyUrl}><Copy className="h-3.5 w-3.5" />{copied ? 'Copied!' : 'Copy capture URL'}</Button>}
          </div>

          <div className="rounded-xl border border-surface-200 bg-white p-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div
                className="flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-surface-200 bg-surface-50 bg-contain bg-center bg-no-repeat"
                style={displayedQrImageUrl ? { backgroundImage: `url("${displayedQrImageUrl}")` } : undefined}
                role="img"
                aria-label={displayedQrImageUrl ? 'Customer capture QR code preview' : 'QR code preview unavailable'}
              >
                {qrPreviewLoading
                  ? <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                  : !displayedQrImageUrl && <QrCode className="h-16 w-16 text-surface-300" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-surface-900">Customer capture QR</p>
                <p className="mt-1 text-xs text-surface-500">
                  The QR uses high error correction, rounded styling, and the business logo centered in the downloadable image.
                </p>
                {qrDestination && <p className="mt-3 break-all text-xs text-surface-600">{qrDestination}</p>}
                {qrPreviewError && <p className="mt-2 text-xs font-medium text-danger-700" role="alert">{qrPreviewError}</p>}
                {qrIssue && <p className="mt-2 text-xs font-medium text-danger-700" role="alert">{qrIssue}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {displayedQrImageUrl && (
                    <a href={displayedQrImageUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4" /> Open QR image
                      </Button>
                    </a>
                  )}
                  {clientQrPreviewUrl && (
                    <Button variant="outline" size="sm" onClick={downloadQr}>
                      <QrCode className="h-4 w-4" /> Download QR
                    </Button>
                  )}
                  {qrTrackingUrl && (
                    <a href={qrTrackingUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4" /> Test capture link
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
            <div>
              <p className="text-sm font-semibold text-surface-900">Grow the LocalVIP network</p>
              <p className="mt-1 text-xs leading-5 text-surface-600">
                This is for registering consumers, businesses, and causes under this business&apos;s network. It is separate from the 100-list capture link above.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Network referral code</label>
                <Input value={networkReferralCode} readOnly placeholder="Waiting for QA owner referral code" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Network referral URL</label>
                <Input value={networkReferralUrl} readOnly placeholder="Waiting for QA Branch URL" className="text-xs" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {networkReferralUrl && <a href={networkReferralUrl} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm"><ExternalLink className="h-4 w-4" /> Test network link</Button></a>}
              {networkQr?.qrImageUrl && <a href={networkQr.qrImageUrl} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm"><QrCode className="h-4 w-4" /> Open network QR</Button></a>}
              <Button variant="outline" size="sm" onClick={() => void onGenerateMaterials('network_referral')} disabled={engineBusy !== null || !networkQr}>
                <Sparkles className="h-4 w-4" /> Generate network materials
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void onGenerateMaterials('customer_capture')} disabled={engineBusy !== null || !effectiveJoinUrl}>
              {engineBusy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate capture materials
            </Button>
            <Button variant="outline" onClick={() => void onRegenerateAll('customer_capture')} disabled={regenBusy || engineBusy !== null || generated.length === 0}>
              {regenBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Regenerate capture materials
            </Button>
          </div>

          {/* Generated materials list */}
          {generated.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-surface-900">Generated materials ({generated.length})</p>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-surface-200 p-3">
                {generated.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-surface-100 bg-white px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-900">{m.generated_file_name || 'Asset'}</p>
                      <p className="text-xs text-surface-500">{m.library_folder.replace(/_/g, ' ')} {m.version_number > 1 ? `· v${m.version_number}` : ''}</p>
                    </div>
                    {m.generated_file_url && (
                      <Link href={m.generated_file_url} target="_blank" className="shrink-0 text-sm font-medium text-brand-600 hover:underline">
                        Open <ExternalLink className="ml-1 inline h-3 w-3" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {failed.length > 0 && (
            <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {failed.length} material{failed.length > 1 ? 's' : ''} failed generation. Check the workspace for details.
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-surface-100 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            {readyToComplete && onCompleteStep && (
              <Button onClick={onCompleteStep} disabled={saving}>
                <CheckCircle2 className="h-4 w-4" /> Complete step
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════
// 4. Launch Decision Modal
// ═══════════════════════════════════════════
//  Features:
//  • Edit capture offer headline, description, value label
//  • Edit cashback percentage with visual indicator
//  • Launch readiness checklist summary
//  • 100-list progress bar
//  • Save and complete in one flow

export interface LaunchDecisionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  biz: Business
  captureOffer: { headline: string; description: string | null; value_label: string | null; cashback_percent: number | null }
  joinedCount: number
  generatedCount: number
  qrCount: number
  onSaveOffers: (data: { headline: string; description: string; valueLabel: string }) => Promise<void>
  onCompleteStep?: () => void
  readyToComplete: boolean
  saving: boolean
  blocker: string | null
}

export function LaunchDecisionModal({
  open,
  onOpenChange,
  biz,
  captureOffer,
  joinedCount,
  generatedCount,
  qrCount,
  onSaveOffers,
  onCompleteStep,
  readyToComplete,
  saving,
  blocker,
}: LaunchDecisionModalProps) {
  const [headline, setHeadline] = React.useState(captureOffer.headline || '')
  const [description, setDescription] = React.useState(captureOffer.description || '')
  const [valueLabel, setValueLabel] = React.useState(captureOffer.value_label || '')
  const [offerSaved, setOfferSaved] = React.useState(false)
  const [localSaving, setLocalSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setHeadline(captureOffer.headline || '')
      setDescription(captureOffer.description || '')
      setValueLabel(captureOffer.value_label || '')
      setOfferSaved(false)
    }
  }, [open, captureOffer])

  const captureReady = !!headline.trim()
  const listProgress = Math.min(100, Math.round((joinedCount / 100) * 100))

  const checklist = [
    { label: 'Capture offer set', done: captureReady },
    { label: 'Materials generated', done: generatedCount > 0 },
    { label: 'QR code linked', done: qrCount > 0 },
    { label: '100-list growing', done: joinedCount > 0 },
  ]

  async function handleSave() {
    setLocalSaving(true)
    setOfferSaved(false)
    try {
      await onSaveOffers({ headline, description, valueLabel })
      setOfferSaved(true)
    } finally {
      setLocalSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-brand-500" />
            Launch Decision
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Readiness checklist */}
          <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
            <p className="mb-3 text-sm font-semibold text-surface-900">Launch readiness</p>
            <div className="space-y-2">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full ${item.done ? 'bg-success-100 text-success-600' : 'bg-surface-200 text-surface-400'}`}>
                    {item.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                  </span>
                  <span className={`text-sm ${item.done ? 'text-surface-800' : 'text-surface-500'}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 100-list progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-surface-700">100-list progress</span>
              <span className="font-semibold text-surface-900">{joinedCount} / 100</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-200">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${listProgress}%` }}
              />
            </div>
          </div>

          {blocker && <Blocker text={blocker} />}
          {offerSaved && <SuccessBanner text="Offer settings saved." />}

          {/* Offer editor */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4">
              <p className="text-sm font-semibold text-surface-900">Capture offer</p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Headline *</label>
                <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Get 10% off your first visit" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Description</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Details about the offer..." />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Value label</label>
                <Input value={valueLabel} onChange={(e) => setValueLabel(e.target.value)} placeholder="10% off" />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
              <p className="text-sm font-semibold text-surface-900">Live LocalVIP offers</p>
              <p className="text-sm leading-6 text-surface-600">
                Cashback, dates, times, and availability are managed as scheduled live deals. They are not part of this pre-launch customer-capture offer.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Launch phase" value={biz.launch_phase || 'setup'} />
                <Stat label="Status" value={biz.activation_status || 'inactive'} />
              </div>
              {/* /portal/business resolves the business from the SIGNED-IN account, so an
                  admin working someone else's record landed on "We couldn't find your
                  business details for this account yet". Go to this business's own deal
                  workspace instead. */}
              <Button variant="outline" size="sm" asChild>
                <Link href={`/crm/businesses/${biz.id}?workspaceTab=deal`}>Manage live offers</Link>
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-surface-100 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave} disabled={localSaving || saving}>
                {localSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                Save offers
              </Button>
              {readyToComplete && onCompleteStep && (
                <Button onClick={onCompleteStep} disabled={saving}>
                  <CheckCircle2 className="h-4 w-4" /> Complete step
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
