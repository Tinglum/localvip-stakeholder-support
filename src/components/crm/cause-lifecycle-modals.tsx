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
  Heart,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  QrCode,
  School,
  Sparkles,
  Users,
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
import type {
  Cause,
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
// 1. Cause Initial Connection Modal
// ═══════════════════════════════════════════
//  Features:
//  • Quick-edit city, email, phone, website, org type inline
//  • Readiness checklist (city + at least one contact path)
//  • Helper count + linked-businesses summary
//  • One-click complete step when ready

export interface CauseInitialConnectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cause: Cause
  city: { id: string; name: string; state: string } | null
  linkedBusinessCount: number
  helperCount: number
  onSave: (changes: Partial<Cause>) => Promise<void>
  onCompleteStep?: () => void
  readyToComplete: boolean
  saving: boolean
  blocker: string | null
  cities: City[]
}

const CAUSE_TYPES: Array<{ value: Cause['type']; label: string }> = [
  { value: 'school', label: 'School' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'church', label: 'Church' },
  { value: 'community', label: 'Community' },
  { value: 'other', label: 'Other' },
]

export function CauseInitialConnectionModal({
  open,
  onOpenChange,
  cause,
  city,
  linkedBusinessCount,
  helperCount,
  onSave,
  onCompleteStep,
  readyToComplete,
  saving,
  blocker,
  cities,
}: CauseInitialConnectionModalProps) {
  const [email, setEmail] = React.useState(cause.email || '')
  const [phone, setPhone] = React.useState(cause.phone || '')
  const [website, setWebsite] = React.useState(cause.website || '')
  const [cityId, setCityId] = React.useState(cause.city_id || '')
  const [causeType, setCauseType] = React.useState<Cause['type']>(cause.type)
  const [localSaving, setLocalSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setEmail(cause.email || '')
      setPhone(cause.phone || '')
      setWebsite(cause.website || '')
      setCityId(cause.city_id || '')
      setCauseType(cause.type)
      setSaved(false)
    }
  }, [open, cause])

  const hasCity = !!cityId
  const hasContact = !!(email.trim() || phone.trim() || website.trim())
  const allReady = hasCity && hasContact

  async function handleSave() {
    setLocalSaving(true)
    setSaved(false)
    try {
      await onSave({
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        city_id: cityId || null,
        type: causeType,
      })
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
            <School className="h-5 w-5 text-pink-500" />
            Initial Connection
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="City linked" value={city?.name || 'Not set'} ok={hasCity} />
            <Stat label="Contact path" value={hasContact ? 'Set' : 'Missing'} ok={hasContact} />
            <Stat label="Linked businesses" value={`${linkedBusinessCount}`} />
            <Stat label="Helpers" value={`${helperCount} assigned`} />
          </div>

          {blocker && !allReady && <Blocker text={blocker} />}
          {allReady && !readyToComplete && <SuccessBanner text="All prerequisites met. Save changes to enable completion." />}

          {/* Org type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-surface-700">Organization Type</label>
            <select
              value={causeType}
              onChange={(e) => setCauseType(e.target.value as Cause['type'])}
              className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              {CAUSE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* City selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-surface-700">City *</label>
            <select
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
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
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="leader@school.org" />
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
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.school.org" />
            </div>
          </div>

          {saved && <SuccessBanner text="Organization info saved." />}

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
// 2. Leader Conversation Modal
// ═══════════════════════════════════════════
//  Features:
//  • Quick log outreach with type picker, subject, notes, outcome
//  • Recent outreach timeline (last 5)
//  • Next-step scheduling with date
//  • Outreach count progress indicator

export interface LeaderConversationModalProps {
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

export function LeaderConversationModal({
  open,
  onOpenChange,
  outreach,
  profileMap,
  onLogOutreach,
  onCompleteStep,
  readyToComplete,
  saving,
  blocker,
}: LeaderConversationModalProps) {
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
            <MessageSquare className="h-5 w-5 text-pink-500" />
            Leader Conversation
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
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  {OUTREACH_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Subject</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Leadership check-in" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Outcome</label>
                <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Interested, follow-up..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-surface-600">Notes *</label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="What happened in the conversation with the leader..." />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Next step</label>
                <Input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Schedule meeting, send info..." />
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
                      <Badge variant="outline">{item.type.replace(/_/g, ' ')}</Badge>
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
// 3. Cause Materials & QR Modal
// ═══════════════════════════════════════════
//  Features:
//  • Edit referral / connection codes inline
//  • Save codes + auto-generate materials in one click
//  • View generated materials list with file links
//  • QR code count + join URL with copy
//  • Regenerate all button

export interface CauseMaterialsQrModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  codes: StakeholderCode | null
  generatedMaterials: GeneratedMaterial[]
  qrCodes: QrCodeType[]
  joinUrl: string | null
  onSaveCodes: (referralCode: string, connectionCode: string) => Promise<void>
  onGenerateMaterials: () => Promise<void>
  onRegenerateAll: () => Promise<void>
  onCompleteStep?: () => void
  readyToComplete: boolean
  saving: boolean
  blocker: string | null
  engineBusy: 'codes' | 'generate' | null
  regenBusy: boolean
}

export function CauseMaterialsQrModal({
  open,
  onOpenChange,
  codes,
  generatedMaterials,
  qrCodes,
  joinUrl,
  onSaveCodes,
  onGenerateMaterials,
  onRegenerateAll,
  onCompleteStep,
  readyToComplete,
  saving,
  blocker,
  engineBusy,
  regenBusy,
}: CauseMaterialsQrModalProps) {
  const [referral, setReferral] = React.useState(codes?.referral_code || '')
  const [connection, setConnection] = React.useState(codes?.connection_code || '')
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setReferral(codes?.referral_code || '')
      setConnection(codes?.connection_code || '')
      setSaveMsg(null)
    }
  }, [open, codes])

  const generated = generatedMaterials.filter((m) => m.generation_status === 'generated' && m.generated_file_url && m.is_active !== false && !m.is_outdated)
  const failed = generatedMaterials.filter((m) => m.generation_status === 'failed')

  async function handleSave() {
    setSaveMsg(null)
    await onSaveCodes(referral.trim(), connection.trim())
    setSaveMsg('Codes saved and materials generation triggered.')
  }

  function copyUrl() {
    if (joinUrl) {
      void navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-pink-500" />
            Materials & QR
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Referral code" value={codes?.referral_code || 'Not set'} ok={!!codes?.referral_code} />
            <Stat label="Connection code" value={codes?.connection_code || 'Not set'} ok={!!codes?.connection_code} />
            <Stat label="Generated" value={`${generated.length} files`} ok={generated.length > 0} />
            <Stat label="QR codes" value={`${qrCodes.length}`} ok={qrCodes.length > 0} />
          </div>

          {blocker && <Blocker text={blocker} />}
          {saveMsg && <SuccessBanner text={saveMsg} />}

          {/* Codes editor */}
          <div className="space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4">
            <p className="text-sm font-semibold text-surface-900">Stakeholder codes</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Referral code</label>
                <Input value={referral} onChange={(e) => setReferral(e.target.value)} placeholder="east-atlanta-school" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Connection code</label>
                <Input value={connection} onChange={(e) => setConnection(e.target.value)} placeholder="east-atlanta-school" />
              </div>
            </div>
            {joinUrl && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Support page URL</label>
                <div className="flex gap-2">
                  <Input value={joinUrl} readOnly className="text-xs" />
                  <Button variant="outline" size="sm" onClick={copyUrl}>
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={engineBusy !== null || !referral.trim() || !connection.trim()}>
                {engineBusy === 'codes' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Save codes + generate
              </Button>
              <Button variant="outline" onClick={() => void onGenerateMaterials()} disabled={engineBusy !== null || !codes?.connection_code}>
                {engineBusy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Generate materials
              </Button>
              <Button variant="outline" onClick={() => void onRegenerateAll()} disabled={regenBusy || engineBusy !== null}>
                Regenerate all
              </Button>
            </div>
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
                      <Link href={m.generated_file_url} target="_blank" className="shrink-0 text-sm font-medium text-pink-600 hover:underline">
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
// 4. Activation Decision Modal
// ═══════════════════════════════════════════
//  Features:
//  • Activation readiness checklist (codes, materials, QR, businesses)
//  • Community reach progress bar
//  • Connected business count indicator
//  • View setup status and stakeholder state
//  • Complete activation step

export interface ActivationDecisionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cause: Cause
  linkedBusinessCount: number
  generatedCount: number
  qrCount: number
  codesReady: boolean
  stakeholderReady: boolean
  onCompleteStep?: () => void
  readyToComplete: boolean
  saving: boolean
  blocker: string | null
}

export function ActivationDecisionModal({
  open,
  onOpenChange,
  cause,
  linkedBusinessCount,
  generatedCount,
  qrCount,
  codesReady,
  stakeholderReady,
  onCompleteStep,
  readyToComplete,
  saving,
  blocker,
}: ActivationDecisionModalProps) {
  const checklist = [
    { label: 'Stakeholder setup complete', done: stakeholderReady },
    { label: 'Codes assigned', done: codesReady },
    { label: 'Materials generated', done: generatedCount > 0 },
    { label: 'QR code linked', done: qrCount > 0 },
    { label: 'Businesses connected', done: linkedBusinessCount > 0 },
  ]

  const readyCount = checklist.filter((c) => c.done).length
  const communityProgress = Math.min(100, Math.round((linkedBusinessCount / 10) * 100))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            Activation Decision
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Readiness checklist */}
          <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-surface-900">Activation readiness</p>
              <Badge variant={readyCount >= 4 ? 'success' : readyCount >= 2 ? 'warning' : 'danger'}>
                {readyCount}/{checklist.length} ready
              </Badge>
            </div>
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

          {/* Community reach progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-surface-700">Community reach (businesses connected)</span>
              <span className="font-semibold text-surface-900">{linkedBusinessCount} connected</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-200">
              <div
                className="h-full rounded-full bg-pink-500 transition-all"
                style={{ width: `${communityProgress}%` }}
              />
            </div>
            <p className="text-xs text-surface-500">Goal: 10+ businesses connected before full activation</p>
          </div>

          {blocker && <Blocker text={blocker} />}

          {/* Status cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
              <p className="text-sm font-semibold text-surface-900">Setup Status</p>
              <div className="mt-3 space-y-2">
                <Stat label="Stakeholder" value={stakeholderReady ? 'Created' : 'Missing'} ok={stakeholderReady} />
                <Stat label="Codes" value={codesReady ? 'Ready' : 'Missing'} ok={codesReady} />
              </div>
            </div>
            <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
              <p className="text-sm font-semibold text-surface-900">Assets</p>
              <div className="mt-3 space-y-2">
                <Stat label="Materials" value={`${generatedCount} generated`} ok={generatedCount > 0} />
                <Stat label="QR codes" value={`${qrCount} ready`} ok={qrCount > 0} />
              </div>
            </div>
          </div>

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
