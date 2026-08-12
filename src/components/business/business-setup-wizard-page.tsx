'use client'

/**
 * FIRST-RUN SETUP WIZARD.
 *
 * This page owns NO fields of its own. Every input it shows comes from
 * `@/components/business/business-editor` — the same groups My Business
 * (`/portal/business`) renders permanently. All this file adds is the step
 * sequencing, the progress rail, per-step validation gating, and the
 * submit-for-live-review flow.
 *
 * Not in the nav any more (the nav is Home / My Business / Grow / Materials).
 * Reached from the "Needs your input" panel on Home and from `?step=` deep
 * links, which still work exactly as before.
 */

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Image as ImageIcon,
  Loader2,
  Rocket,
  Store,
  Tag,
  Wallet,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { DealManager } from '@/components/crm/deal-manager'
import { ActionSection } from '@/components/business/business-surfaces'
import {
  BrandingFields,
  CaptureFields,
  ProfileFields,
  SaveStateLabel,
  StatusPill,
  StripeFields,
  useBusinessEditor,
} from '@/components/business/business-editor'
import { BUSINESS_SETUP_CONFIG_STEPS, type BusinessSetupStepKey } from '@/lib/business-setup'
import { BOOMERANG_SURFACE } from '@/lib/engagement-codes'

type StepKey = BusinessSetupStepKey

const STEP_ICONS: Record<BusinessSetupStepKey, React.ReactNode> = {
  profile: <Store className="h-4 w-4" />,
  branding: <ImageIcon className="h-4 w-4" />,
  capture: <Tag className="h-4 w-4" />,
  cashback: <Wallet className="h-4 w-4" />,
  stripe: <CreditCard className="h-4 w-4" />,
  activate: <Rocket className="h-4 w-4" />,
}

const STEPS = BUSINESS_SETUP_CONFIG_STEPS.map((step) => ({
  key: step.key as StepKey,
  label: step.label,
  description: step.description,
  icon: STEP_ICONS[step.key],
}))
const STEP_SEQUENCE: StepKey[] = STEPS.map((step) => step.key)

function isStepKey(value: string | null): value is StepKey {
  return (
    value === 'profile'
    || value === 'branding'
    || value === 'capture'
    || value === 'cashback'
    || value === 'stripe'
    || value === 'activate'
  )
}

export function BusinessSetupWizardPage() {
  const searchParams = useSearchParams()
  const editor = useBusinessEditor()

  const initialStep = React.useMemo<StepKey>(() => {
    const requested = searchParams.get('step')
    return isStepKey(requested) ? requested : 'profile'
  }, [searchParams])

  // A `?step=` link means the owner asked for a specific step — always honour
  // it, even after setup is finished.
  const [step, setStep] = React.useState<StepKey>(initialStep)
  const [stepValidation, setStepValidation] = React.useState<Partial<Record<StepKey, boolean>>>({})
  const [completionAttempted, setCompletionAttempted] = React.useState(false)

  React.useEffect(() => {
    setStep(initialStep)
  }, [initialStep])

  const { business, setupState, missingSteps, isStepComplete } = editor

  if (editor.loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading business setup...
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <EmptyState
        icon={<Store className="h-8 w-8" />}
        title="Business setup will appear here"
        description="We couldn't find your business details for this account yet."
      />
    )
  }

  const readyToActivate = setupState.readyToActivate
  const activeStepMeta = STEPS.find((item) => item.key === step) || STEPS[0]
  const firstMissingSetupStep = missingSteps[0] || null

  function getNextStep(key: StepKey) {
    const currentIndex = STEP_SEQUENCE.indexOf(key)
    if (currentIndex < 0 || currentIndex === STEP_SEQUENCE.length - 1) return null
    return STEP_SEQUENCE[currentIndex + 1]
  }

  async function handleSaveAndNext(key: StepKey) {
    setStepValidation((current) => ({ ...current, [key]: true }))
    if (!isStepComplete(key)) return

    const saved = key === 'cashback' ? true : await editor.persistChanges()
    if (!saved) return

    const nextStep = getNextStep(key)
    if (!nextStep) return

    setStepValidation((current) => ({ ...current, [key]: false }))
    setStep(nextStep)
  }

  async function activatePortal() {
    if (!readyToActivate) {
      setCompletionAttempted(true)
      setStepValidation((current) => ({
        ...current,
        ...Object.fromEntries(missingSteps.map((item) => [item.key, true])),
      }))
      if (firstMissingSetupStep) setStep(firstMissingSetupStep.key)
      return
    }

    const saved = await editor.submitForLiveReview()
    if (!saved) return
    // Was the retired Grow "customers" section. Home is the right landing after a
    // live-review submission for every business, Boomerang or not.
    window.location.href = '/dashboard?review=submitted'
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Business Setup"
        description="Open any step, finish the requirements, then complete onboarding for live review. Everything here stays editable later on My Business."
        actions={<SaveStateLabel editor={editor} />}
      />

      <Card className="overflow-hidden border-surface-200">
        <CardContent className="p-0">
          <div className="border-b border-surface-200 bg-surface-50 px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Setup progress</p>
                <p className="mt-1 text-sm font-semibold text-surface-950">
                  {setupState.completedCount} of {setupState.totalSteps} steps complete
                </p>
              </div>
              <div className="flex items-center gap-3 sm:min-w-64 sm:justify-end">
                <div
                  className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-200 sm:max-w-64"
                  role="progressbar"
                  aria-label="Onboarding completion"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(setupState.ratio * 100)}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-success-500 via-teal-500 to-brand-500 transition-all duration-500"
                    style={{ width: `${setupState.ratio * 100}%` }}
                  />
                </div>
                <span className="w-12 text-right text-sm font-bold tabular-nums text-surface-800">
                  {Math.round(setupState.ratio * 100)}%
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto px-3 py-5 sm:px-5">
            <ol className="flex min-w-[840px] items-start sm:min-w-0">
              {STEPS.map((item, index) => {
                const complete = isStepComplete(item.key)
                const isActive = step === item.key
                const statusLabel = complete ? 'Complete' : isActive ? 'Current step' : 'Open step'
                return (
                  <li key={item.key} className="relative flex min-w-[140px] flex-1 justify-center">
                    {index < STEPS.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className={`absolute left-1/2 right-[-50%] top-6 h-1 -translate-y-1/2 ${complete ? 'bg-success-500' : 'bg-surface-200'}`}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setStep(item.key)}
                      className={`relative z-10 flex w-full flex-col items-center gap-2 rounded-xl px-2 py-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                        isActive ? 'bg-brand-50 text-brand-800' : complete ? 'text-success-800 hover:bg-success-50' : 'text-surface-500 hover:bg-surface-50'
                      }`}
                      aria-current={isActive ? 'step' : undefined}
                      aria-label={`${item.label}: ${statusLabel}. Open this step.`}
                    >
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-full border-2 bg-white shadow-sm ${
                          complete
                            ? 'border-success-600 bg-success-600 text-white'
                            : isActive
                              ? 'border-brand-600 bg-brand-600 text-white ring-4 ring-brand-100'
                              : 'border-surface-300 text-surface-500'
                        }`}
                      >
                        {complete ? <CheckCircle2 className="h-5 w-5" /> : isActive ? item.icon : <span className="text-sm font-bold">{index + 1}</span>}
                      </span>
                      <span className="max-w-[130px] text-xs font-bold leading-4 sm:text-sm">{item.label}</span>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
                          complete ? 'text-success-700' : isActive ? 'text-brand-700' : 'text-surface-400'
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        </CardContent>
      </Card>

      {editor.saveError ? <p className="text-sm text-danger-600">{editor.saveError}</p> : null}

      <Card className={setupState.isComplete ? 'border-success-200 bg-success-50/60' : 'border-brand-200 bg-gradient-to-r from-brand-50 via-white to-white'}>
        <CardContent className="flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${setupState.isComplete ? 'bg-success-600 text-white' : 'bg-brand-600 text-white'}`}>
              {setupState.isComplete ? <CheckCircle2 className="h-6 w-6" /> : <Rocket className="h-6 w-6" />}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-surface-950">
                {setupState.isComplete ? 'Onboarding complete' : 'Finish your onboarding'}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-surface-600">
                {setupState.isComplete
                  ? 'All setup requirements are complete and your live-review request has been submitted.'
                  : 'Click the button to check every requirement. Any missing steps will be highlighted and opened for you.'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void activatePortal()}
            disabled={editor.activating}
            className={`h-12 shrink-0 px-5 font-bold ${setupState.isComplete || readyToActivate ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-red-600 text-white hover:bg-red-700'}`}
          >
            {editor.activating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : setupState.isComplete || readyToActivate ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {editor.activating ? 'Completing...' : 'COMPLETE ONBOARDING'}
          </Button>
        </CardContent>
      </Card>

      {completionAttempted && missingSteps.length > 0 ? (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-950">Finish these steps before onboarding is complete</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {missingSteps.map((item) => (
              <Button
                key={item.key}
                type="button"
                variant="outline"
                onClick={() => setStep(item.key)}
                className="border-red-300 bg-white text-red-800 hover:bg-red-100"
              >
                {item.label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-6">
        <Card className="border-surface-200 bg-gradient-to-r from-white via-surface-50 to-white">
          <CardContent className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-surface-950">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border shadow-sm ${
                    isStepComplete(step) ? 'border-success-600 bg-success-600 text-white' : 'border-brand-500 bg-brand-500 text-white'
                  }`}
                >
                  {isStepComplete(step) ? <CheckCircle2 className="h-4 w-4" /> : activeStepMeta.icon}
                </span>
                {activeStepMeta.label}
              </div>
              <p className="text-sm text-surface-600">{activeStepMeta.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={isStepComplete(step) ? 'border-success-200 bg-success-100 text-success-800' : 'border-brand-200 bg-brand-100 text-brand-800'}>
                {isStepComplete(step) ? 'Completed' : 'Editing now'}
              </Badge>
              <span className="text-xs text-surface-500">
                Step {STEPS.findIndex((item) => item.key === step) + 1} of {STEPS.length}
              </span>
            </div>
          </CardContent>
        </Card>

        {step === 'profile' && (
          <ActionSection
            title="Business Profile"
            description="The basics customers need to understand your business."
            complete={isStepComplete('profile')}
          >
            <ProfileFields editor={editor} showValidation={!!stepValidation.profile} />
            <div className="mt-5 flex justify-end">
              <Button className="h-12 px-6 text-base font-semibold" onClick={() => void handleSaveAndNext('profile')}>
                Save and next
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </ActionSection>
        )}

        {step === 'branding' && (
          <ActionSection
            title="Branding"
            description="The logo and cover image customers see on your LocalVIP page."
            complete={isStepComplete('branding')}
          >
            <BrandingFields editor={editor} showValidation={!!stepValidation.branding} />
            <div className="mt-5 flex justify-end">
              <Button className="h-12 px-6 text-base font-semibold" onClick={() => void handleSaveAndNext('branding')}>
                Save and next
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </ActionSection>
        )}

        {step === 'capture' && (
          <ActionSection
            title={`Your ${BOOMERANG_SURFACE.tab.toLowerCase()}`}
            description="Tell us whether you want LocalVIP to help you build a list of your own customers that you can promote to directly. You can say no and keep everything else."
            complete={isStepComplete('capture')}
          >
            {/* `variant="choice"` keeps the offer copy fields hidden during
                first-run, exactly as before. They are editable on My Business. */}
            <CaptureFields editor={editor} showValidation={!!stepValidation.capture} variant="choice" />
            <div className="mt-5 flex justify-end">
              <Button className="h-12 px-6 text-base font-semibold" onClick={() => void handleSaveAndNext('capture')}>
                Save choice and continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </ActionSection>
        )}

        {step === 'cashback' && (
          <div className="space-y-5">
            <DealManager
              businessAccountId={String(business.id)}
              mode="setup"
              onDealsChanged={() => editor.refetchDeals({ silent: true })}
            />
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-surface-200 bg-white px-5 py-4">
              <p className="text-sm text-surface-600">
                {isStepComplete('cashback')
                  ? 'Your LocalVIP deal is saved and ready for the next step.'
                  : 'Save a cashback percentage and schedule before continuing.'}
              </p>
              <Button
                className="h-12 shrink-0 px-6 text-base font-semibold"
                disabled={!isStepComplete('cashback')}
                onClick={() => void handleSaveAndNext('cashback')}
              >
                Continue to Stripe
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 'stripe' && (
          <ActionSection
            title="Connect Stripe Payments"
            description="Stripe securely sends customer payments to your business bank account."
            complete={isStepComplete('stripe')}
          >
            <StripeFields editor={editor} />
            {isStepComplete('stripe') ? (
              <div className="mt-5 flex justify-end">
                <Button className="h-12 px-6 text-base font-semibold" onClick={() => setStep('activate')}>
                  Continue to Go Live
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </ActionSection>
        )}

        {step === 'activate' && (
          <ActionSection
            title="Submit for Live Review"
            description="One final LocalVIP check before customers can use your deals."
            complete={readyToActivate}
            statusLabel={readyToActivate ? 'Ready to submit' : 'Needs your input'}
          >
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <StatusPill label="Profile" ready={isStepComplete('profile')} onOpen={() => setStep('profile')} />
                <StatusPill label="Branding" ready={isStepComplete('branding')} onOpen={() => setStep('branding')} />
                <StatusPill label={`${BOOMERANG_SURFACE.tab} choice`} ready={isStepComplete('capture')} onOpen={() => setStep('capture')} />
                <StatusPill label="LocalVIP deal" ready={isStepComplete('cashback')} onOpen={() => setStep('cashback')} />
                <StatusPill label="Stripe" ready={isStepComplete('stripe')} onOpen={() => setStep('stripe')} />
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                <p className="text-sm font-semibold text-surface-900">What unlocks next</p>
                <p className="mt-2 text-sm leading-6 text-surface-600">
                  Once you submit this, LocalVIP can review the business, confirm everything looks right, and then make
                  it live in the system.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void activatePortal()} disabled={editor.activating}>
                  {editor.activating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit for live review
                      <Rocket className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <Button asChild variant="outline">
                  <Link href="/portal/business">
                    Open My Business
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </ActionSection>
        )}
      </div>
    </div>
  )
}
