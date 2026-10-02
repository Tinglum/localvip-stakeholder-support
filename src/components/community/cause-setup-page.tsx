'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle, Building2, CheckCircle2, Globe2, ImageIcon, MapPin, Palette,
  FileText, Rocket, Sparkles,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { useCauses } from '@/lib/supabase/hooks'
import { resolveCommunityCause } from '@/lib/community-cause'
import { CauseLoadError } from '@/components/community/cause-load-error'
import {
  defaultLandingConfig,
  isLandingOutOfDate,
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
  CAUSE_PHOTO_PROMPTS,
  getCauseSetupProgress,
  isCauseLive,
  missingCausePhotos,
  type CausePhotoSlot,
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

  const [detail, setDetail] = React.useState<CauseDetail | null>(null)
  const [landing, setLanding] = React.useState<LandingRecord | null>(null)
  const [flyerCount, setFlyerCount] = React.useState(0)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [genProgress, setGenProgress] = React.useState<string | null>(null)
  const [genError, setGenError] = React.useState<string | null>(null)

  const loadDetail = React.useCallback(async () => {
    if (!causeId) return
    const [d, l, launch] = await Promise.all([
      fetch(`/api/qa/nonprofits/${causeId}`, { cache: 'no-store' }).then((r) => readJson(r, 'Could not load your organization.')),
      fetch(`/api/crm/causes/${causeId}/landing-page`, { cache: 'no-store' }).then((r) => readJson(r, 'Could not load your landing page.')).catch(() => null),
      fetch(`/api/crm/causes/${causeId}/launch-materials`, { cache: 'no-store' }).then((r) => readJson(r, 'Could not load your flyers.')).catch(() => null),
    ])
    setDetail(d as CauseDetail)
    setLanding(l as LandingRecord | null)
    setFlyerCount(Number((launch as { flyerCount?: number } | null)?.flyerCount || 0))
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
  const photoSrc = React.useCallback((raw: string) => (
    !raw || /^(https?:)?\/\//i.test(raw) || raw.startsWith('/')
      ? raw
      : `${(process.env.NEXT_PUBLIC_QA_AUTH_BASE_URL || 'https://qa.localvip.com').replace(/\/+$/, '')}/uploads/covers/${encodeURIComponent(raw)}`
  ), [])
  // `crowd` falls back to the account's old single cover photo, so a cause that
  // uploaded one before the four slots existed keeps it and is not asked again.
  const photoUrls = React.useMemo(() => Object.fromEntries(CAUSE_PHOTO_PROMPTS.map(({ slot }) => [
    slot,
    photoSrc(landingConfig?.assets[slot]?.src || (slot === 'crowd' ? text(detail, 'coverPhotoUrl') || cause?.cover_photo_url || '' : '')),
  ])) as Record<CausePhotoSlot, string>, [cause, detail, landingConfig, photoSrc])
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
    photoUrls,
    colorsConfirmed: !!landingConfig?.brandColorsConfirmed,
    qrCount: 0,
    generatedCount: flyerCount,
    landingPublished: isLandingPublished(landing),
  }
  const progress = getCauseSetupProgress(signals)
  const missingPhotos = missingCausePhotos(signals)
  // The launch-materials job writes new photos and the rendered video into the
  // DRAFT only; an already-live page keeps serving its published revision.
  const landingOutOfDate = isLandingOutOfDate(landing)

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

  const refreshLaunchMaterials = async () => {
    if (!causeId) return
    await fetch(`/api/crm/causes/${causeId}/launch-materials`, { method: 'POST' })
      .then((r) => readJson(r, 'Your updated flyers could not be generated.'))
  }

  /**
   * `logo` and `crowd` go through the account media endpoint, so the account's
   * own logo/cover columns stay in step. The three newer slots have no account
   * column and use the landing-page asset endpoint. Either way the landing
   * draft is only updated once the upload actually returned a file URL, so a
   * failed upload can never read as success.
   */
  const upload = (target: 'logo' | CausePhotoSlot, file: File) => {
    const prompt = CAUSE_PHOTO_PROMPTS.find((p) => p.slot === target)
    const okMessage = target === 'logo'
      ? 'Logo uploaded. Review colors from your new logo, then publish the updated landing page.'
      : `${prompt?.label || 'Photo'} uploaded. Publish the updated landing page when ready.`
    return run(async () => {
      const data = new FormData()
      data.append('file', file)
      const viaAccount = target === 'logo' || target === 'crowd'
      if (viaAccount) data.append('mediaType', target === 'logo' ? 'logo' : 'cover_photo')
      else data.append('slot', target)
      const body = await fetch(
        viaAccount ? `/api/crm/causes/${causeId}/media` : `/api/crm/causes/${causeId}/landing-page/assets`,
        { method: 'POST', body: data },
      ).then((r) => readJson(r, 'The image could not be uploaded.')) as { fileUrl?: string }
      if (!body.fileUrl) throw new Error('The image upload did not return a file. Try again.')
      // Keep the landing page's copy of the image in step with the account's.
      if (landingConfig) {
        const asset = target === 'logo' ? 'mark' : target
        await saveLanding({
          assets: { ...landingConfig.assets, [asset]: { src: body.fileUrl, alt: landingConfig.assets[asset]?.alt || `${signals.name} ${prompt?.label.toLowerCase() || 'logo'}` } },
          ...(target === 'logo' ? { brandColorsConfirmed: false } : {}),
        })
      }
      refetchCauses()
    }, okMessage)
  }

  const generate = async () => {
    setBusy(true); setGenError(null); setGenProgress('Creating your audience flyers and landing page...')
    try {
      const result = await fetch(`/api/crm/causes/${causeId}/launch-materials`, { method: 'POST' })
        .then((r) => readJson(r, 'Materials could not be generated.')) as { steps?: { flyers?: { status?: string; detail?: string } } }
      await loadDetail()
      const flyers = result.steps?.flyers
      setGenProgress(flyers?.detail || 'Your flyers are ready.')
      if (flyers?.status === 'failed' || flyers?.status === 'partial') setGenError(flyers.detail || 'Some flyers could not be created.')
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

      {landingOutOfDate ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-warning-300 bg-warning-50 px-5 py-4 text-sm text-warning-800">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning-600" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Your live landing page is out of date</span>
            <span className="block">
              Your newest photos{landingConfig.video?.src ? ' and your cause video are' : ' are'} saved in your draft,
              but visitors still see the version you published last.
            </span>
          </span>
          <Link href="/community/landing-page"
            className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-warning-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-warning-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-400">
            Review and republish
          </Link>
        </div>
      ) : null}

      {missingPhotos.length > 0 ? (
        <button type="button" onClick={() => openStep('images')}
          className="flex w-full items-start gap-3 rounded-2xl border border-warning-200 bg-warning-50 px-5 py-4 text-left text-sm text-warning-800 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-400">
          <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" />
          <span>
            <span className="block font-semibold">
              {isCauseLive(signals)
                ? `${name} is live, but cannot publish pages or flyers yet`
                : `${missingPhotos.length} of your 4 photos are still missing`}
            </span>
            <span className="mt-0.5 block">
              Still needed: {missingPhotos.map((prompt) => prompt.label).join(', ')}. Publishing a landing page, a flyer
              or a shareable link needs all four, so nothing goes out built on a single photo.
            </span>
          </span>
        </button>
      ) : null}

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
                initial={{ name, category: signals.category, headline: signals.headline, description: text(detail, 'description'), parentOrganization: landingConfig.parentOrganization || '' }}
                onSave={(patch) => void run(async () => {
                  await putProfile(patch)
                  await saveLanding({ parentOrganization: patch.parentOrganization, mission: patch.headline })
                  await refreshLaunchMaterials()
                }, 'Profile saved.', 'profile')} />
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
            {activeKey === 'images' && <ImagesStep logoSrc={logoSrc} photoUrls={photoUrls} busy={busy} onUpload={(target, file) => void upload(target, file)} onContinue={() => nextAfter('images')} />}
            {activeKey === 'colors' && (
              <ColorsStep key={`k-${landingConfig.brandColorsConfirmed ? 'y' : 'n'}`} busy={busy} name={name} logoSrc={logoSrc}
                initial={brandFromPalette(landingConfig.colors)} confirmed={signals.colorsConfirmed}
                onExtract={() => extractBrandColorsFromImage(logoSrc)}
                onSave={(colors: BrandTriple) => void run(
                  async () => {
                    await saveLanding({ colors: expandBrandPalette(colors, landingConfig.colors), brandColorsConfirmed: true })
                    await refreshLaunchMaterials()
                  },
                  'Brand colors saved. Your flyers and landing page will use them.', 'colors')} />
            )}
            {activeKey === 'materials' && <MaterialsStep count={signals.generatedCount} busy={busy} progress={genProgress} error={genError} onGenerate={() => void generate()} />}
            {activeKey === 'landing' && (
              <LinkStep icon={<Globe2 className="h-5 w-5" />} done={signals.landingPublished}
                doneText="Your landing page is live. Share it anywhere, and your flyers point to it."
                todoText={missingPhotos.length > 0
                  ? `Preview your page any time. Publishing needs all four photos first — still missing: ${missingPhotos.map((prompt) => prompt.label).join(', ')}.`
                  : 'Preview your landing page with your logo, photos and colors, then publish it.'}
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
