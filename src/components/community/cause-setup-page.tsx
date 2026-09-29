'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Building2, CheckCircle2, Globe2, ImageIcon, MapPin, Palette, QrCode,
  FileText, Rocket, Sparkles,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { useCauses, useGeneratedMaterials, useQrCodes } from '@/lib/supabase/hooks'
import { resolveCommunityCause } from '@/lib/community-cause'
import { CauseLoadError } from '@/components/community/cause-load-error'
import {
  defaultLandingConfig,
  isLandingPublished,
  qaCauseId,
  type LandingConfig,
  type LandingRecord,
} from '@/lib/cause-landing-config'
import {
  brandFromPalette,
  expandBrandPalette,
  extractBrandColorsFromImage,
  type BrandTriple,
} from '@/lib/brand-colors'
import {
  CAUSE_ACCOUNT_STEPS,
  CAUSE_BRAND_STEPS,
  getCauseSetupProgress,
  type CauseSetupSignals,
  type CauseSetupStep,
  type CauseSetupStepKey,
  type CauseSetupTrack,
} from '@/lib/cause-setup'
import {
  ColorsStep, ContactStep, GoLiveStep, ImagesStep, LinkStep,
  MaterialsStep, ProfileStep,
} from '@/components/community/cause-setup-steps'

/** Raw /api/qa/nonprofits/{id} detail (backend camelCase, passed through). */
type CauseDetail = Record<string, unknown>
const text = (detail: CauseDetail | null, key: string) => {
  const value = detail?.[key]
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

const STEP_ICONS: Record<CauseSetupStepKey, React.ReactNode> = {
  profile: <Building2 className="h-5 w-5" />,
  contact: <MapPin className="h-5 w-5" />,
  golive: <Rocket className="h-5 w-5" />,
  images: <ImageIcon className="h-5 w-5" />,
  colors: <Palette className="h-5 w-5" />,
  qr: <QrCode className="h-5 w-5" />,
  materials: <FileText className="h-5 w-5" />,
  landing: <Globe2 className="h-5 w-5" />,
}

const ALL_STEPS = [...CAUSE_ACCOUNT_STEPS, ...CAUSE_BRAND_STEPS]
const isStepKey = (value: string | null): value is CauseSetupStepKey => ALL_STEPS.some((s) => s.key === value)

async function readJson(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error((body as { error?: string }).error || fallback)
  return body
}

export function CauseSetupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile } = useAuth()
  const { data: causes, loading: causesLoading, error: causesError, refetch: refetchCauses } = useCauses()
  const cause = React.useMemo(() => resolveCommunityCause(profile, causes), [profile, causes])
  const causeId = cause ? qaCauseId(cause) : null
  const idFilter = React.useMemo(() => ({ cause_id: String(causeId ?? '__none__') }), [causeId])
  const { data: qrCodes, refetch: refetchQr } = useQrCodes(idFilter, { enabled: causeId != null })
  const { data: generated, refetch: refetchGenerated } = useGeneratedMaterials(idFilter, { enabled: causeId != null })

  const [detail, setDetail] = React.useState<CauseDetail | null>(null)
  const [landing, setLanding] = React.useState<LandingRecord | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [genProgress, setGenProgress] = React.useState<string | null>(null)
  const [genError, setGenError] = React.useState<string | null>(null)

  const loadDetail = React.useCallback(async () => {
    if (!causeId) return
    const [d, l] = await Promise.all([
      fetch(`/api/qa/nonprofits/${causeId}`, { cache: 'no-store' }).then((r) => readJson(r, 'Could not load your organization.')),
      fetch(`/api/crm/causes/${causeId}/landing-page`, { cache: 'no-store' }).then((r) => readJson(r, 'Could not load your landing page.')).catch(() => null),
    ])
    setDetail(d as CauseDetail)
    setLanding(l as LandingRecord | null)
  }, [causeId])

  React.useEffect(() => {
    loadDetail().catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load your setup.'))
  }, [loadDetail])

  const landingConfig: LandingConfig | null = React.useMemo(() => {
    if (!cause || !causeId) return null
    return landing?.draft || landing?.published || defaultLandingConfig(cause, causeId)
  }, [cause, causeId, landing])

  const logoSrc = causeId && (text(detail, 'imageUrl') || text(detail, 'logoUrl') || cause?.logo_url)
    ? `/api/qa/nonprofits/${causeId}/logo?v=${encodeURIComponent(text(detail, 'imageUrl') || text(detail, 'logoUrl'))}`
    : ''
  // The account stores a bare file name; the backend serves it from /uploads/covers.
  const rawCover = landingConfig?.assets.crowd.src || text(detail, 'coverPhotoUrl') || cause?.cover_photo_url || ''
  const coverSrc = !rawCover || /^(https?:)?\/\//i.test(rawCover) || rawCover.startsWith('/')
    ? rawCover
    : `${(process.env.NEXT_PUBLIC_QA_AUTH_BASE_URL || 'https://qa.localvip.com').replace(/\/+$/, '')}/uploads/covers/${encodeURIComponent(rawCover)}`
  const referralCode = text(detail, 'referralCode')

  const signals: CauseSetupSignals = {
    name: text(detail, 'name') || cause?.name || '',
    category: text(detail, 'category'),
    headline: text(detail, 'headline'),
    city: text(detail, 'city'),
    email: text(detail, 'ownerEmail'),
    phone: text(detail, 'ownerPhone'),
    referralCode,
    crmStage: text(detail, 'crmStage'),
    crmStatus: text(detail, 'crmStatus'),
    logoUrl: logoSrc,
    coverUrl: coverSrc,
    colorsConfirmed: !!landingConfig?.brandColorsConfirmed,
    qrCount: qrCodes.length,
    generatedCount: generated.filter((m) => !!m.generated_file_url).length,
    landingPublished: isLandingPublished(landing),
  }
  const progress = getCauseSetupProgress(signals)

  // Active step: ?step= deep link, else the first unfinished step.
  const requested = searchParams.get('step')
  const [step, setStep] = React.useState<CauseSetupStepKey | null>(isStepKey(requested) ? requested : null)
  const activeKey: CauseSetupStepKey = step ?? progress.nextStep?.key ?? 'profile'
  const activeStep = ALL_STEPS.find((s) => s.key === activeKey) as CauseSetupStep
  const openStep = React.useCallback((key: CauseSetupStepKey) => {
    setStep(key); setMessage(null)
    const params = new URLSearchParams(searchParams.toString())
    params.set('step', key)
    router.replace(`/community/setup?${params.toString()}`, { scroll: false })
  }, [router, searchParams])
  // After a save, move to the next step in the same track.
  const nextAfter = (key: CauseSetupStepKey) => {
    const track = ALL_STEPS.find((s) => s.key === key)?.track
    const list = track === 'brand' ? CAUSE_BRAND_STEPS : CAUSE_ACCOUNT_STEPS
    const next = list[list.findIndex((s) => s.key === key) + 1]
    if (next) openStep(next.key)
  }

  /* ── Saves ── */
  const run = async (fn: () => Promise<void>, ok: string, then?: CauseSetupStepKey) => {
    setBusy(true); setMessage(null)
    try {
      await fn()
      await loadDetail()
      setMessage({ tone: 'ok', text: ok })
      if (then) nextAfter(then)
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'That could not be saved. Try again.' })
    } finally { setBusy(false) }
  }

  const putProfile = (payload: Record<string, unknown>) => fetch(`/api/qa/nonprofits/${causeId}`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  }).then((r) => readJson(r, 'Your changes could not be saved.'))

  const saveLanding = async (patch: Partial<LandingConfig>) => {
    if (!landingConfig) return
    const config = { ...landingConfig, ...patch }
    await fetch(`/api/crm/causes/${causeId}/landing-page`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: config.slug, config }),
    }).then((r) => readJson(r, 'Your brand settings could not be saved.'))
  }

  const upload = (kind: 'logo' | 'cover_photo', file: File) => run(async () => {
    const data = new FormData()
    data.append('file', file)
    data.append('mediaType', kind)
    const body = await fetch(`/api/crm/causes/${causeId}/media`, { method: 'POST', body: data })
      .then((r) => readJson(r, 'The image could not be uploaded.')) as { fileUrl?: string }
    // Keep the landing page's copy of the image in step with the account's.
    if (body.fileUrl && landingConfig) {
      const asset = kind === 'logo' ? 'mark' : 'crowd'
      await saveLanding({ assets: { ...landingConfig.assets, [asset]: { src: body.fileUrl, alt: landingConfig.assets[asset].alt } } })
    }
    refetchCauses()
  }, kind === 'logo' ? 'Logo uploaded.' : 'Cover photo uploaded.')

  const generate = async () => {
    setBusy(true); setGenError(null); setGenProgress('Finding your templates...')
    const call = (payload: Record<string, unknown>) => fetch(`/api/crm/causes/${causeId}/execution`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    }).then((r) => readJson(r, 'Materials could not be generated.'))
    try {
      const list = await call({ action: 'list_generation_templates' }) as { templates?: Array<{ id: string; name: string }> }
      const templates = Array.isArray(list.templates) ? list.templates : []
      if (templates.length === 0) { setGenProgress(null); setGenError('No flyer templates are switched on for causes yet. Ask your LocalVIP representative.'); return }
      let failed = 0
      for (const [i, t] of templates.entries()) {
        setGenProgress(`Creating ${i + 1} of ${templates.length}: ${t.name}`)
        try { await call({ action: 'generate_template', templateId: t.id }) } catch { failed += 1 }
      }
      refetchGenerated()
      setGenProgress(failed ? `${templates.length - failed} of ${templates.length} materials created.` : 'Your materials are ready.')
      if (failed === templates.length) setGenError('None of the materials could be created. Try again, or contact LocalVIP.')
    } catch (e) {
      setGenProgress(null); setGenError(e instanceof Error ? e.message : 'Materials could not be generated.')
    } finally { setBusy(false) }
  }

  /* ── Render ── */
  if (causesLoading) return <div role="status" className="animate-pulse p-8 text-sm text-surface-500">Loading your setup...</div>
  if (causesError) return <CauseLoadError onRetry={() => refetchCauses()} />
  if (!cause || !causeId) return <EmptyState icon={<Building2 className="h-8 w-8" />} title="Your organization is not linked yet" description="Your setup appears here as soon as this login is linked to your school or cause." />
  if (loadError) return <EmptyState icon={<Building2 className="h-8 w-8" />} title="Setup could not load" description={loadError} action={{ label: 'Try again', onClick: () => { setLoadError(null); void loadDetail().catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load your setup.')) } }} />
  if (!detail || !landingConfig) return <div role="status" className="animate-pulse p-8 text-sm text-surface-500">Loading your setup...</div>

  const name = signals.name

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title={`Set up ${name}`}
        description="Two parts: set up your account so LocalVIP can take you live, then get your logo, colors and materials ready to promote. Everything stays editable later."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <TrackCard track="account" title="1. Set up your account" subtitle="Required before you go live"
          done={progress.accountDone} total={progress.accountTotal} active={activeStep.track === 'account'}
          onOpen={() => openStep(progress.account.find((s) => !s.complete)?.key ?? 'profile')} />
        <TrackCard track="brand" title="2. Brand & materials" subtitle="Get ready to promote. Start any time."
          done={progress.brandDone} total={progress.brandTotal} active={activeStep.track === 'brand'}
          onOpen={() => openStep(progress.brand.find((s) => !s.complete)?.key ?? 'images')} />
      </div>

      <Card className="overflow-hidden border-surface-200">
        <CardContent className="p-0">
          <StepRail steps={activeStep.track === 'account' ? progress.account : progress.brand} activeKey={activeKey} onOpen={openStep} />
          <div className="border-t border-surface-200 px-5 py-6 sm:px-8">
            <div className="mb-6 flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white">{STEP_ICONS[activeKey]}</span>
              <div>
                <h2 className="text-lg font-semibold text-surface-950">{activeStep.label}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-surface-600">{activeStep.description}</p>
              </div>
            </div>

            {message ? (
              <p role={message.tone === 'error' ? 'alert' : 'status'} className={`mb-5 rounded-xl px-4 py-3 text-sm ${message.tone === 'error' ? 'border border-danger-200 bg-danger-50 text-danger-700' : 'border border-success-200 bg-success-50 text-success-800'}`}>
                {message.text}
              </p>
            ) : null}

            {activeKey === 'profile' && (
              <ProfileStep key={`p-${text(detail, 'updatedDate')}`} busy={busy}
                initial={{ name, category: signals.category, headline: signals.headline, description: text(detail, 'description') }}
                onSave={(patch) => void run(() => putProfile(patch), 'Profile saved.', 'profile')} />
            )}
            {activeKey === 'contact' && (
              <ContactStep key={`c-${text(detail, 'updatedDate')}`} busy={busy} email={signals.email}
                initial={{ city: signals.city, state: text(detail, 'state'), phone: signals.phone, website: text(detail, 'website') }}
                onSave={(patch) => void run(() => putProfile(patch), 'Location and contact saved.', 'contact')} />
            )}
            {activeKey === 'golive' && (
              <GoLiveStep name={name} signals={signals} busy={busy} onOpenStep={openStep}
                onSubmit={() => void run(() => putProfile({ status: 'pending_live_review' }), 'Submitted. LocalVIP will review your account.')} />
            )}
            {activeKey === 'images' && <ImagesStep logoSrc={logoSrc} coverSrc={coverSrc} busy={busy} onUpload={(kind, file) => void upload(kind, file)} onContinue={() => nextAfter('images')} />}
            {activeKey === 'colors' && (
              <ColorsStep key={`k-${landingConfig.brandColorsConfirmed ? 'y' : 'n'}`} busy={busy} name={name} logoSrc={logoSrc}
                initial={brandFromPalette(landingConfig.colors)} confirmed={signals.colorsConfirmed}
                onExtract={() => extractBrandColorsFromImage(logoSrc)}
                onSave={(colors: BrandTriple) => void run(
                  () => saveLanding({ colors: expandBrandPalette(colors, landingConfig.colors), brandColorsConfirmed: true }),
                  'Brand colors saved. Your flyers and landing page will use them.', 'colors')} />
            )}
            {activeKey === 'qr' && (
              <LinkStep icon={<QrCode className="h-5 w-5" />} done={signals.qrCount > 0}
                doneText={`You have ${signals.qrCount} QR code${signals.qrCount === 1 ? '' : 's'}. Every scan signs someone up with your code.`}
                todoText="Create your QR code. It points to your sign-up link, so every scan is credited to you."
                actionHref="/community/qr" actionLabel={signals.qrCount > 0 ? 'Manage QR codes' : 'Create my QR code'}
                secondary={<button type="button" onClick={() => refetchQr()} className="text-sm font-medium text-brand-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">I made one, refresh</button>} />
            )}
            {activeKey === 'materials' && <MaterialsStep count={signals.generatedCount} busy={busy} progress={genProgress} error={genError} onGenerate={() => void generate()} />}
            {activeKey === 'landing' && (
              <LinkStep icon={<Globe2 className="h-5 w-5" />} done={signals.landingPublished}
                doneText="Your landing page is live. Share it anywhere, and your flyers point to it."
                todoText="Preview your landing page with your logo, photo and colors, then publish it."
                actionHref="/community/landing-page" actionLabel={signals.landingPublished ? 'Edit landing page' : 'Open landing page editor'} />
            )}
          </div>
        </CardContent>
      </Card>

      {progress.allDone ? (
        <div className="flex items-center gap-3 rounded-2xl border border-success-200 bg-success-50 px-5 py-4 text-sm text-success-900">
          <Sparkles className="h-5 w-5 text-success-600" /> Everything is set up. You are live and ready to promote.
        </div>
      ) : null}
    </div>
  )
}

function TrackCard({ title, subtitle, done, total, active, onOpen }: {
  track: CauseSetupTrack; title: string; subtitle: string; done: number; total: number; active: boolean; onOpen: () => void
}) {
  const pct = Math.round((done / total) * 100)
  const complete = done === total
  return (
    <button type="button" onClick={onOpen} aria-pressed={active}
      className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 active:translate-y-0 ${active ? 'border-brand-400 ring-2 ring-brand-100' : 'border-surface-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-surface-950">{title}</p>
          <p className="mt-0.5 text-sm text-surface-500">{subtitle}</p>
        </div>
        {complete
          ? <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2.5 py-1 text-xs font-semibold text-success-800"><CheckCircle2 className="h-3.5 w-3.5" />Done</span>
          : <span className="text-sm font-bold tabular-nums text-surface-800">{done}/{total}</span>}
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-100" role="progressbar" aria-label={`${title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className={`h-full rounded-full transition-all duration-500 ${complete ? 'bg-success-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </button>
  )
}

function StepRail({ steps, activeKey, onOpen }: {
  steps: Array<CauseSetupStep & { complete: boolean }>; activeKey: CauseSetupStepKey; onOpen: (key: CauseSetupStepKey) => void
}) {
  return (
    <div className="overflow-x-auto px-3 py-5 sm:px-5">
      <ol className="flex min-w-[640px] items-start sm:min-w-0">
        {steps.map((item, index) => {
          const isActive = item.key === activeKey
          const status = item.complete ? 'Complete' : isActive ? 'Current step' : 'Open step'
          return (
            <li key={item.key} className="relative flex min-w-[120px] flex-1 justify-center">
              {index < steps.length - 1 ? (
                <span aria-hidden="true" className={`absolute left-1/2 right-[-50%] top-6 h-1 -translate-y-1/2 ${item.complete ? 'bg-success-500' : 'bg-surface-200'}`} />
              ) : null}
              <button type="button" onClick={() => onOpen(item.key)} aria-current={isActive ? 'step' : undefined} aria-label={`${item.label}: ${status}. Open this step.`}
                className={`relative z-10 flex w-full flex-col items-center gap-2 rounded-xl px-2 py-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${isActive ? 'bg-brand-50 text-brand-800' : item.complete ? 'text-success-800 hover:bg-success-50' : 'text-surface-500 hover:bg-surface-50'}`}>
                <span className={`flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-sm ${item.complete ? 'border-success-600 bg-success-600 text-white' : isActive ? 'border-brand-600 bg-brand-600 text-white ring-4 ring-brand-100' : 'border-surface-300 bg-white text-surface-500'}`}>
                  {item.complete ? <CheckCircle2 className="h-5 w-5" /> : isActive ? STEP_ICONS[item.key] : <span className="text-sm font-bold">{index + 1}</span>}
                </span>
                <span className="max-w-[120px] text-xs font-bold leading-4 sm:text-sm">{item.label}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${item.complete ? 'text-success-700' : isActive ? 'text-brand-700' : 'text-surface-400'}`}>{status}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
