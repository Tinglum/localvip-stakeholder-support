import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import {
  ensureBusinessOnboardingFlow,
  ensureBusinessStakeholderSetup,
} from '@/lib/server/stakeholder-lifecycle'
import {
  generateMaterialsForStakeholder,
  upsertStakeholderCodesAndGenerate,
  regenerateAllForStakeholder,
  restoreGeneratedMaterialVersion,
} from '@/lib/server/material-engine'
import { computeBusinessExecutionSteps, computeBusinessStageFromSteps } from '@/lib/business-execution'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import type { Business, OnboardingFlow, OnboardingStep, Profile, QrCode, Stakeholder, StakeholderCode } from '@/lib/types/database'

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
    fileUrl: z.string().url('File URL required.'),
  }),
])

async function getExecutionContext(businessId: string) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }

  const { profile, source: authSource } = session
  const supabase = createServiceClient()

  const shell = getStakeholderShell(profile)
  if (!['admin', 'field', 'launch_partner'].includes(shell)) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) }
  }

  const { data: businessData } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single()

  const business = (businessData || null) as Business | null
  if (!business) {
    return { error: NextResponse.json({ error: 'Business not found.' }, { status: 404 }) }
  }

  try {
    const [flow, stakeholder] = await Promise.all([
      ensureBusinessOnboardingFlow(supabase, business, profile.id),
      ensureBusinessStakeholderSetup(supabase, business, profile.id),
    ])

    return { supabase, profile, business, flow, stakeholder }
  } catch (setupError) {
    // Surface full diagnostic so we can see exactly what's failing
    const msg = setupError instanceof Error ? setupError.message
      : typeof setupError === 'object' && setupError !== null && 'message' in setupError
        ? String((setupError as { message: unknown }).message)
        : String(setupError)
    const debugInfo = `[auth=${authSource} profile=${profile.id.slice(0, 8)} email=${profile.email} role=${profile.role} shell=${shell} biz=${business.id.slice(0, 8)} city=${business.city_id?.slice(0, 8) || 'null'} owner=${business.owner_id?.slice(0, 8) || 'null'} meta=${JSON.stringify(profile.metadata)}]`
    console.error('[business-execution] setup failed', msg, debugInfo)
    return { error: NextResponse.json({ error: `${msg} ${debugInfo}` }, { status: 500 }) }
  }
}

async function loadExecutionState(
  supabase: ReturnType<typeof createServiceClient>,
  business: Business,
  flow: OnboardingFlow,
  stakeholder: Stakeholder,
) {
  const [
    stepsData,
    offersData,
    qrCodesData,
    generatedData,
    codesData,
    outreachData,
  ] = await Promise.all([
    supabase.from('onboarding_steps').select('*').eq('flow_id', flow.id).order('sort_order', { ascending: true }),
    supabase.from('offers').select('*').eq('business_id', business.id),
    supabase.from('qr_codes').select('*').eq('business_id', business.id),
    supabase.from('generated_materials').select('*').eq('stakeholder_id', stakeholder.id).order('updated_at', { ascending: false }),
    supabase.from('stakeholder_codes').select('*').eq('stakeholder_id', stakeholder.id).maybeSingle(),
    supabase.from('outreach_activities').select('id').eq('entity_type', 'business').eq('entity_id', business.id),
  ])

  return {
    steps: ((stepsData.data || []) as OnboardingStep[]),
    offers: offersData.data || [],
    qrCodes: (qrCodesData.data || []) as QrCode[],
    generatedMaterials: generatedData.data || [],
    codes: (codesData.data || null) as StakeholderCode | null,
    outreachCount: (outreachData.data || []).length,
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
  return 'The business action could not be completed.'
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
      const result = await upsertStakeholderCodesAndGenerate(
        context.supabase,
        context.stakeholder.id,
        context.profile.id,
        {
          referralCode: parsed.data.referralCode,
          connectionCode: parsed.data.connectionCode,
        },
      )

      return NextResponse.json({ success: true, result })
    }

    if (parsed.data.action === 'generate_materials') {
      const result = await generateMaterialsForStakeholder(context.supabase, context.stakeholder.id, context.profile.id)
      return NextResponse.json({ success: true, result })
    }

    if (parsed.data.action === 'regenerate_all') {
      const result = await regenerateAllForStakeholder(context.supabase, context.stakeholder.id, context.profile.id)
      return NextResponse.json({ success: true, result })
    }

    if (parsed.data.action === 'restore_version') {
      const result = await restoreGeneratedMaterialVersion(context.supabase, parsed.data.generatedMaterialId)
      return NextResponse.json({ success: true, result })
    }

    if (parsed.data.action === 'upload_media') {
      const patch: Partial<Business> = parsed.data.mediaType === 'logo'
        ? { logo_url: parsed.data.fileUrl }
        : { cover_photo_url: parsed.data.fileUrl }

      const { error: updateError } = await (context.supabase.from('businesses') as any)
        .update(patch)
        .eq('id', context.business.id)
      if (updateError) throw updateError

      // Auto-regenerate materials when branding changes
      try {
        await regenerateAllForStakeholder(context.supabase, context.stakeholder.id, context.profile.id)
      } catch {
        // Regeneration failure is non-fatal for media upload
      }

      return NextResponse.json({ success: true, mediaType: parsed.data.mediaType, fileUrl: parsed.data.fileUrl })
    }

    const completeStepAction = parsed.data
    if (completeStepAction.action !== 'complete_step') {
      return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 })
    }

    const state = await loadExecutionState(context.supabase, context.business, context.flow, context.stakeholder)
    const executionSteps = computeBusinessExecutionSteps({
      business: context.business,
      steps: state.steps,
      codes: state.codes,
      generatedMaterials: state.generatedMaterials,
      qrCodes: state.qrCodes,
      offers: state.offers as any,
      outreachCount: state.outreachCount,
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
        completed_by: context.profile.id,
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
    const nextBusinessStage = computeBusinessStageFromSteps(refreshedSteps, context.business)
    const completedCount = refreshedSteps.filter((step) => step.is_completed).length

    const flowPatch: Partial<OnboardingFlow> = {
      stage: nextBusinessStage,
      completed_at: completedCount === refreshedSteps.length ? completedAt : null,
    }

    const businessPatch: Partial<Business> = {
      stage: nextBusinessStage,
      launch_phase: completedCount >= refreshedSteps.length ? 'ready_to_go_live' : completedCount >= 3 ? 'capturing_100' : 'setup',
      activation_status: completedCount >= refreshedSteps.length ? 'in_progress' : context.business.activation_status || 'not_started',
    }

    const { error: flowError } = await (context.supabase.from('onboarding_flows') as any)
      .update(flowPatch)
      .eq('id', context.flow.id)
    if (flowError) throw flowError

    const { error: businessError } = await (context.supabase.from('businesses') as any)
      .update(businessPatch)
      .eq('id', context.business.id)
    if (businessError) throw businessError

    return NextResponse.json({
      success: true,
      stepId: completeStepAction.stepId,
      completedAt,
      businessStage: nextBusinessStage,
    })
  } catch (error) {
    console.error('[business-execution] Error:', error)
    const message = extractRouteError(error)
    const status = /already in use/i.test(message) ? 409
      : /not found/i.test(message) ? 404
      : /forbidden|unauthorized/i.test(message) ? 403
      : 400
    return NextResponse.json({ error: message }, { status })
  }
}
