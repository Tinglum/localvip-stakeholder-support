'use client'

import * as React from 'react'
import { CheckCircle2, Circle, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Option = { id: string; label: string; detail: string }
type Question = { id: string; title: string; context: string; options: [Option, Option, Option] }

const QUESTIONS: Question[] = [
  {
    id: 'auto_trigger',
    title: 'When should auto-generated materials be created?',
    context: 'Controls when the system produces materials for a new or existing business/cause.',
    options: [
      {
        id: 'immediate',
        label: 'Immediately on creation',
        detail: 'Materials are generated synchronously the moment a business or cause record is created. Fast but blocks the creation flow briefly.',
      },
      {
        id: 'background',
        label: 'Queued in background',
        detail: 'A background job picks up newly created entities and generates materials within a few seconds. Non-blocking, slightly delayed.',
      },
      {
        id: 'creation_and_stage',
        label: 'On creation AND stage changes',
        detail: 'Materials generate on creation and also regenerate when the entity moves stages (e.g., contacted \u2192 interested). Most dynamic, but produces more versions.',
      },
    ],
  },
  {
    id: 'template_tiers',
    title: 'Can a template belong to multiple tiers?',
    context: 'Templates have three tiers: auto-generated, admin-assignable, and self-serve (business picks from library).',
    options: [
      {
        id: 'exclusive',
        label: 'Mutually exclusive',
        detail: 'Each template is in exactly one tier. Clean separation \u2014 auto templates never appear in the self-serve library.',
      },
      {
        id: 'multi_tier',
        label: 'Multi-tier allowed',
        detail: 'A template can be auto-generated AND also appear in the self-serve library. Businesses see it pre-made but can also browse the original in the catalog.',
      },
      {
        id: 'auto_plus_optional',
        label: 'Auto is separate, assign + self-serve overlap',
        detail: 'Auto-generate templates are their own group. Assignable and self-serve share the same pool \u2014 admin can push any template a business could also find themselves.',
      },
    ],
  },
  {
    id: 'auto_scope',
    title: 'How should auto-generate templates be scoped?',
    context: 'Determines which businesses/causes get which auto-generated templates.',
    options: [
      {
        id: 'global',
        label: 'Global defaults',
        detail: 'All businesses get the same auto-generated set. All causes get the same set. Simple, consistent, easy to manage.',
      },
      {
        id: 'by_type_brand',
        label: 'By stakeholder type + brand',
        detail: 'Different sets per type (business vs school vs cause) and brand (LocalVIP vs HATO). E.g., HATO schools get "Support School Flyer" but not "Invite Another Business".',
      },
      {
        id: 'fully_dynamic',
        label: 'Per category, city, campaign, and brand',
        detail: 'Full matrix \u2014 restaurants in Atlanta on the Spring Launch get a different auto-set than dental offices in Charlotte. Most powerful, most config overhead.',
      },
    ],
  },
  {
    id: 'qr_strategy',
    title: 'How should the QR code work per generated material?',
    context: 'Each material gets a QR code. This controls what it points to.',
    options: [
      {
        id: 'unique_direct',
        label: 'Unique QR \u2192 direct landing page',
        detail: 'Each business gets a unique QR code pointing directly to their specific page (e.g., localvip.com/atlanta/main-street-bakery). One QR per material per business.',
      },
      {
        id: 'unique_redirect',
        label: 'Unique QR \u2192 tracked redirect',
        detail: 'Each business gets a unique short-code QR that goes through a redirect (e.g., localvip.com/r/bkry-atl-26). Enables scan tracking and destination changes without reprinting.',
      },
      {
        id: 'stakeholder_connection',
        label: 'Stakeholder connection code QR',
        detail: 'QR uses the stakeholder\u2019s connection code as the redirect. Ties into the existing referral/connection system. Simplest integration with the external API.',
      },
    ],
  },
  {
    id: 'selfserve_flow',
    title: 'What does the self-serve activation flow look like?',
    context: 'When a business owner browses the template library and picks one.',
    options: [
      {
        id: 'instant',
        label: 'One-click generate',
        detail: 'Business sees a preview with their data pre-filled. One click and the material appears in their library. No editing, no friction.',
      },
      {
        id: 'preview_confirm',
        label: 'Preview then confirm',
        detail: 'Business sees a live preview with their data. They can review it but not edit. Click "Add to My Materials" to confirm. Low friction with a safety check.',
      },
      {
        id: 'preview_edit',
        label: 'Preview, edit fields, then generate',
        detail: 'Business sees a preview and can tweak certain fields (CTA text, offer description). More control for the business, more complexity to build.',
      },
    ],
  },
  {
    id: 'admin_visibility',
    title: 'Can the super admin see business-generated materials?',
    context: 'Generated materials only live in the business/cause library. But does admin get visibility?',
    options: [
      {
        id: 'full_visibility',
        label: 'Full visibility + manage',
        detail: 'Admin sees all generated materials across all businesses in a read-only audit view. Can revoke or regenerate any material.',
      },
      {
        id: 'audit_only',
        label: 'Audit log only',
        detail: 'Admin cannot browse individual business materials, but sees a log of what was generated, when, and for whom. Lighter touch.',
      },
      {
        id: 'invisible',
        label: 'Fully invisible',
        detail: 'Admin manages templates only. Once generated, materials are the business\u2019s own. Admin has no view or control over generated output.',
      },
    ],
  },
  {
    id: 'api_shape',
    title: 'What should the referral/connection code API look like?',
    context: 'External system sends email as unique identifier to set or retrieve codes.',
    options: [
      {
        id: 'upsert_codes',
        label: 'Upsert codes only',
        detail: 'POST /api/stakeholder-codes with { email, referral_code?, connection_code? }. Creates or updates codes. Returns the codes. Simple and focused.',
      },
      {
        id: 'upsert_with_materials',
        label: 'Upsert codes + return material URLs',
        detail: 'Same as above, but the response also includes URLs to all generated materials for that stakeholder. Lets the external system link directly to assets.',
      },
      {
        id: 'full_provision',
        label: 'Full provisioning endpoint',
        detail: 'POST /api/stakeholder-provision with { email, name?, type?, codes }. Creates the stakeholder if needed, sets codes, triggers auto-generation, returns everything. One call does it all.',
      },
    ],
  },
  {
    id: 'existing_fix',
    title: 'How should we fix existing businesses with no materials?',
    context: 'Current businesses get a fallback instead of real generated materials.',
    options: [
      {
        id: 'backfill_all',
        label: 'Backfill all at once',
        detail: 'Run a one-time migration that generates materials for every existing business/cause using the auto-generate templates. Immediate fix, could be heavy.',
      },
      {
        id: 'backfill_on_visit',
        label: 'Generate on first visit',
        detail: 'When a business owner opens their materials library and it\u2019s empty, auto-generate on the spot. Lazy backfill \u2014 only creates what\u2019s needed.',
      },
      {
        id: 'admin_trigger',
        label: 'Admin triggers per business',
        detail: 'Add a "Generate Materials" button on each business/cause detail page. Admin clicks to generate. Full control over which entities get backfilled.',
      },
    ],
  },
  {
    id: 'template_versioning',
    title: 'What happens when a template is updated?',
    context: 'Admin changes a template\u2019s headline or layout after materials were already generated.',
    options: [
      {
        id: 'immutable',
        label: 'Generated materials are immutable',
        detail: 'Once created, a material never changes. Template updates only affect future generations. Simple and predictable.',
      },
      {
        id: 'regenerate_all',
        label: 'Offer "Regenerate All"',
        detail: 'Admin can click "Regenerate All" to update every business\u2019s material from the new template. Overwrites previous versions.',
      },
      {
        id: 'regenerate_smart',
        label: 'Smart regenerate (skip edited)',
        detail: 'Regenerate all, but skip materials the business owner manually edited. Respects customizations while updating the rest.',
      },
    ],
  },
  {
    id: 'library_scoping',
    title: 'How should the self-serve template library be filtered?',
    context: 'Controls what templates a business or cause sees when browsing.',
    options: [
      {
        id: 'brand_type',
        label: 'By brand + stakeholder type',
        detail: 'LocalVIP businesses see LocalVIP business templates. HATO schools see HATO school templates. Clean two-axis filter.',
      },
      {
        id: 'brand_type_city',
        label: 'By brand + type + city',
        detail: 'Same as above, plus city-specific templates only show for that city. Atlanta businesses don\u2019t see Charlotte-only templates.',
      },
      {
        id: 'same_for_all',
        label: 'Same library for everyone',
        detail: 'All templates visible to all stakeholders. Business vs cause filtering happens only at the template level (stakeholder_types field). Simplest to manage.',
      },
    ],
  },
]

type Answers = Record<string, string>

interface QuestionnaireModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (answers: Answers) => void
  initialAnswers?: Answers
}

function OptionCard({
  option,
  selected,
  onSelect,
  index,
}: {
  option: Option
  selected: boolean
  onSelect: () => void
  index: number
}) {
  const labels = ['A', 'B', 'C']
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative w-full rounded-lg border-2 p-4 text-left transition-all',
        selected
          ? 'border-brand-500 bg-brand-50 shadow-sm'
          : 'border-surface-200 bg-surface-0 hover:border-surface-300 hover:bg-surface-50'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
            selected
              ? 'bg-brand-600 text-white'
              : 'bg-surface-100 text-surface-500 group-hover:bg-surface-200'
          )}
        >
          {labels[index]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-semibold',
                selected ? 'text-brand-700' : 'text-surface-800'
              )}
            >
              {option.label}
            </span>
            {selected && <CheckCircle2 className="h-4 w-4 text-brand-600" />}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-surface-500">{option.detail}</p>
        </div>
      </div>
    </button>
  )
}

export function MaterialEngineQuestionnaire({
  open,
  onOpenChange,
  onComplete,
  initialAnswers,
}: QuestionnaireModalProps) {
  const [step, setStep] = React.useState(0)
  const [answers, setAnswers] = React.useState<Answers>(initialAnswers || {})

  const question = QUESTIONS[step]
  const totalSteps = QUESTIONS.length
  const currentAnswer = answers[question.id] || null
  const answeredCount = Object.keys(answers).length

  const canGoNext = !!currentAnswer
  const isLast = step === totalSteps - 1
  const allAnswered = answeredCount === totalSteps

  function handleSelect(optionId: string) {
    setAnswers((prev) => ({ ...prev, [question.id]: optionId }))
  }

  function handleNext() {
    if (isLast && allAnswered) {
      onComplete(answers)
    } else if (canGoNext) {
      setStep((prev) => Math.min(prev + 1, totalSteps - 1))
    }
  }

  function handleBack() {
    setStep((prev) => Math.max(prev - 1, 0))
  }

  function handleStepClick(target: number) {
    if (target <= step || answers[QUESTIONS[target - 1]?.id]) {
      setStep(target)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        {/* Progress bar */}
        <div className="flex items-center gap-1 px-6 pt-5 pb-0">
          {QUESTIONS.map((q, i) => (
            <button
              key={q.id}
              type="button"
              onClick={() => handleStepClick(i)}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-all',
                i === step
                  ? 'bg-brand-500'
                  : answers[q.id]
                    ? 'bg-brand-300 hover:bg-brand-400'
                    : 'bg-surface-200'
              )}
            />
          ))}
        </div>

        <div className="px-6 pt-3 pb-1">
          <DialogHeader>
            <div className="flex items-center gap-2 text-xs font-medium text-surface-400">
              <Sparkles className="h-3.5 w-3.5" />
              Question {step + 1} of {totalSteps}
            </div>
            <DialogTitle className="text-base">{question.title}</DialogTitle>
            <DialogDescription>{question.context}</DialogDescription>
          </DialogHeader>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-3 px-6 py-4">
          {question.options.map((option, i) => (
            <OptionCard
              key={option.id}
              option={option}
              selected={currentAnswer === option.id}
              onSelect={() => handleSelect(option.id)}
              index={i}
            />
          ))}
        </div>

        <DialogFooter className="border-t border-surface-100 bg-surface-50 px-6 py-4 mt-0">
          <div className="flex w-full items-center justify-between">
            <div className="text-xs text-surface-400">
              {answeredCount}/{totalSteps} answered
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                disabled={step === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleNext}
                disabled={!canGoNext}
              >
                {isLast && allAnswered ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Apply Configuration
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { QUESTIONS }
export type { Answers }
