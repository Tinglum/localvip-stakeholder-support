import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { asUuid } from '@/lib/uuid'
import {
  ensureCauseOnboardingFlow,
  ensureCauseStakeholderSetup,
} from '@/lib/server/stakeholder-lifecycle'
import {
  generateMaterialsForStakeholder,
  listAutoGenerationTemplatesForStakeholder,
  upsertStakeholderCodes,
  regenerateAllForStakeholder,
  restoreGeneratedMaterialVersion,
} from '@/lib/server/material-engine'
import { computeCauseExecutionSteps, computeCauseStageFromSteps } from '@/lib/cause-execution'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import type { Cause, OnboardingFlow, OnboardingStep, QrCode, Stakeholder, StakeholderCode } from '@/lib/types/database'

export const runtime = 'nodejs'
export const maxDuration = 60

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('save_codes'),
    referralCode: z.string().trim().min(2, 'Referral code is required.'),
    connectionCode: z.string().trim().min(2, 'Connection code is required.'),
  }),
  z.object({
    action: z.literal('generate_materials'),
  }),
  z.object({
    action: z.literal('list_generation_templates'),
  }),
  z.object({
    action: z.literal('generate_template'),
    templateId: z.string().uuid('A template is required.'),
  }),
  z.object({
    action: z.literal('complete_step'),
    stepId: z.string().uuid('A step is required.'),
  }),
  z.object({
    action: z.literal('regenerate_all'),
  }),
  z.object({
    action: z.literal('restore_version'),
    generatedMaterialId: z.string().uuid('Generated material ID required.'),
  }),
  z.object({
    action: z.literal('upload_media'),
    mediaType: z.enum(['logo', 'cover_photo']),
    fileUrl: z.string().url('A valid file URL is required.'),
  }),
])

async function getExecutionContext(causeId: string) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }

  const { profile, localProfileId } = session
  const supabase = createServiceClient()

  const shell = getStakeholderShell(profile)
  if (!['admin', 'field', 'launch_partner'].includes(shell)) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) }
  }

  const { data: causeData } = await supabase
    .from('causes')
    .select('*')
    .eq('id', causeId)
    .single()

  const cause = (causeData || null) as Cause | null
  if (!cause) {
    return { error: NextResponse.json({ error: 'Cause not found.' }, { status: 404 }) }
  }

  const [flow, stakeholder] = await Promise.all([
    ensureCauseOnboardingFlow(supabase, cause, localProfileId),
    ensureCauseStakeholderSetup(supabase, cause, localProfileId),
  ])

  return { supabase, profile, cause, flow, stakeholder, localProfileId: localProfileId || asUuid(profile.id) }
}

async function loadExecutionState(
  supabase: ReturnType<typeof createServiceClient>,
  cause: Cause,
  flow: OnboardingFlow,
  stakeholder: Stakeholder,
) {
  const [
    stepsData,
    qrCodesData,
    generatedData,
    codesData,
    outreachData,
    linkedBusinessData,
  ] = await Promise.all([
    supabase.from('onboarding_steps').select('*').eq('flow_id', flow.id).order('sort_order', { ascending: true }),
    supabase.from('qr_codes').select('*').eq('cause_id', cause.id),
    supabase.from('generated_materials').select('*').eq('stakeholder_id', stakeholder.id).order('updated_at', { ascending: false }),
    supabase.from('stakeholder_codes').select('*').eq('stakeholder_id', stakeholder.id).maybeSingle(),
    supabase.from('outreach_activities').select('id').eq('entity_type', 'cause').eq('entity_id', cause.id),
    supabase.from('businesses').select('id').eq('linked_cause_id', cause.id),
  ])

  return {
    steps: ((stepsData.data || []) as OnboardingStep[]),
    qrCodes: (qrCodesData.data || []) as QrCode[],
    generatedMaterials: generatedData.data || [],
    codes: (codesData.data || null) as StakeholderCode | null,
    outreachCount: (outreachData.data || []).length,
    linkedBusinessCount: (linkedBusinessData.data || []).length,
  }
}

function extractRouteError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    if ('message' in error) return String((error as any).message)
    if ('details' in error) return String((error as any).details)
    if ('code' in error) return `Database error (code: ${(error as any).code})`
    try { return JSON.stringify(error) } catch { /* ignore */ }
  }
  if (typeof error === 'string') return error
  return 'The cause action could not be completed.'
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const context = await getExecutionContext(params.id)
    if ('error' in context) return context.error

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid action.' }, { status: 400 })
    }

    if (parsed.data.action === 'save_codes') {
      const result = await upsertStakeholderCodes(
        context.supabase,
        context.stakeholder.id,
        {
          referralCode: parsed.data.referralCode,
          connectionCode: parsed.data.connectionCode,
        },
      )

      return NextResponse.json({ success: true, result })
    }

    if (parsed.data.action === 'list_generation_templates') {
      const templates = await listAutoGenerationTemplatesForStakeholder(context.supabase, context.stakeholder.id, {
        fastMode: true,
      })
      return NextResponse.json({
        success: true,
        templates: templates.map((template) => ({
          id: template.id,
          name: template.name,
          templateType: template.template_type,
          outputFormat: template.output_format,
          libraryFolder: template.library_folder,
        })),
      })
    }

    if (parsed.data.action === 'generate_template') {
      const result = await generateMaterialsForStakeholder(
        context.supabase,
        context.stakeholder.id,
        context.localProfileId,
        {
          templateId: parsed.data.templateId,
          fastMode: true,
        },
      )
      return NextResponse.json({ success: true, result })
    }

    if (parsed.data.action === 'generate_materials') {
      const result = await generateMaterialsForStakeholder(
        context.supabase,
        context.stakeholder.id,
        context.localProfileId,
        { fastMode: true },
      )
      return NextResponse.json({ success: true, result })
    }

    if (parsed.data.action === 'regenerate_all') {
      const result = await regenerateAllForStakeholder(
        context.supabase,
        context.stakeholder.id,
        context.localProfileId,
        { fastMode: true },
      )
      return NextResponse.json({ success: true, result })
    }

    if (parsed.data.action === 'restore_version') {
      const result = await restoreGeneratedMaterialVersion(context.supabase, parsed.data.generatedMaterialId)
      return NextResponse.json({ success: true, result })
    }

    if (parsed.data.action === 'upload_media') {
      const patch: Partial<Cause> = parsed.data.mediaType === 'logo'
        ? { logo_url: parsed.data.fileUrl }
        : { cover_photo_url: parsed.data.fileUrl }

      const { error: updateError } = await (context.supabase.from('causes') as any)
        .update(patch)
        .eq('id', context.cause.id)
      if (updateError) throw updateError

      return NextResponse.json({ success: true, mediaType: parsed.data.mediaType, fileUrl: parsed.data.fileUrl })
    }

    const completeStepAction = parsed.data
    if (completeStepAction.action !== 'complete_step') {
      return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 })
    }

    const state = await loadExecutionState(context.supabase, context.cause, context.flow, context.stakeholder)
    const executionSteps = computeCauseExecutionSteps({
      cause: context.cause,
      steps: state.steps,
      codes: state.codes,
      generatedMaterials: state.generatedMaterials,
      qrCodes: state.qrCodes,
      outreachCount: state.outreachCount,
      linkedBusinessCount: state.linkedBusinessCount,
    })

    const targetSummary = executionSteps.find((item) => item.step.id === completeStepAction.stepId)
    if (!targetSummary) {
      return NextResponse.json({ error: 'Step not found.' }, { status: 404 })
    }
    if (targetSummary.state === 'locked') {
      return NextResponse.json({ error: 'Finish the earlier steps before this one.' }, { status: 409 })
    }
    if (!targetSummary.readyToComplete && targetSummary.state !== 'completed') {
      return NextResponse.json({ error: targetSummary.blocker || 'This step is not ready yet.' }, { status: 409 })
    }
    if (targetSummary.state === 'completed') {
      return NextResponse.json({ success: true, alreadyCompleted: true })
    }

    const completedAt = new Date().toISOString()

    const { error: stepError } = await (context.supabase.from('onboarding_steps') as any)
      .update({
        is_completed: true,
        completed_by: context.localProfileId,
        completed_at: completedAt,
      })
      .eq('id', completeStepAction.stepId)

    if (stepError) throw stepError

    const { data: refreshedStepsData } = await context.supabase
      .from('onboarding_steps')
      .select('*')
      .eq('flow_id', context.flow.id)
      .order('sort_order', { ascending: true })

    const refreshedSteps = (refreshedStepsData || []) as OnboardingStep[]
    const nextCauseStage = computeCauseStageFromSteps(refreshedSteps, context.cause)
    const completedCount = refreshedSteps.filter((step) => step.is_completed).length

    const flowPatch: Partial<OnboardingFlow> = {
      stage: nextCauseStage,
      completed_at: completedCount === refreshedSteps.length ? completedAt : null,
    }

    const causePatch: Partial<Cause> = {
      stage: nextCauseStage,
    }

    const { error: flowError } = await (context.supabase.from('onboarding_flows') as any)
      .update(flowPatch)
      .eq('id', context.flow.id)
    if (flowError) throw flowError

    const { error: causeError } = await (context.supabase.from('causes') as any)
      .update(causePatch)
      .eq('id', context.cause.id)
    if (causeError) throw causeError

    return NextResponse.json({
      success: true,
      stepId: completeStepAction.stepId,
      completedAt,
      causeStage: nextCauseStage,
    })
  } catch (error) {
    console.error('[cause-execution] Error:', error)
    const message = extractRouteError(error)
    const status = /already in use/i.test(message) ? 409
      : /not found/i.test(message) ? 404
      : /forbidden|unauthorized/i.test(message) ? 403
      : 400
    return NextResponse.json({ error: message }, { status })
  }
}
