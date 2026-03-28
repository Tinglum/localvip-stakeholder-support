import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import type { AdminTaskStatus, Brand, Business, OnboardingStage, Stakeholder } from '@/lib/types/database'

const DEFAULT_BUSINESS_STEPS = [
  { title: 'Initial connection', description: 'Make the first intro and confirm the owner or decision-maker.' },
  { title: 'Owner conversation', description: 'Have the real conversation and understand what is needed next.' },
  { title: 'Materials + QR', description: 'Prepare offer, QR, and the first launch materials.' },
  { title: 'Launch decision', description: 'Confirm final readiness and move the business toward launch.' },
]

export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabaseClient()
  const { data: authData } = await authSupabase.auth.getUser()

  if (!authData.user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
  }

  const shell = getStakeholderShell(profile)
  if (!['admin', 'field', 'launch_partner'].includes(shell)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'A business payload is required.' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'Business name is required.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const businessPayload: Partial<Business> = {
    name,
    email: asOptionalString(body.email),
    phone: asOptionalString(body.phone),
    website: asOptionalString(body.website),
    category: asOptionalString(body.category),
    source: asOptionalString(body.source),
    city_id: asOptionalString(body.city_id),
    brand: isBrand(body.brand) ? body.brand : 'localvip',
    stage: isOnboardingStage(body.stage) ? body.stage : 'lead',
    owner_id: authData.user.id,
    owner_user_id: null,
    status: 'active',
    metadata: {
      created_from: 'crm_business_create',
      created_by_shell: shell,
      created_at_source: now,
    },
  }

  const { data: createdBusiness, error: businessError } = await (supabase
    .from('businesses') as any)
    .insert(businessPayload)
    .select()
    .single()

  if (businessError || !createdBusiness) {
    return NextResponse.json({ error: businessError?.message || 'Business could not be created.' }, { status: 400 })
  }

  await Promise.all([
    ensureBusinessClaimAssignment(supabase, createdBusiness as Business, authData.user.id, shell),
    ensureBusinessOnboardingFlow(supabase, createdBusiness as Business, authData.user.id),
    ensureBusinessStakeholderSetup(supabase, createdBusiness as Business, authData.user.id),
  ])

  return NextResponse.json(createdBusiness)
}

async function ensureBusinessClaimAssignment(
  supabase: ReturnType<typeof createServiceClient>,
  business: Business,
  actorId: string,
  shell: string,
) {
  if (!['field', 'launch_partner'].includes(shell)) return

  const { data: existing } = await supabase
    .from('stakeholder_assignments')
    .select('id')
    .eq('stakeholder_id', actorId)
    .eq('entity_type', 'business')
    .eq('entity_id', business.id)
    .maybeSingle()

  if (existing) return

  await (supabase.from('stakeholder_assignments') as any).insert({
    stakeholder_id: actorId,
    entity_type: 'business',
    entity_id: business.id,
    role: 'claim_owner',
    assigned_by: actorId,
    status: 'active',
    claimed_at: new Date().toISOString(),
    next_action: 'Send first outreach',
    next_action_due_date: null,
    metadata: {
      auto_created: true,
      source: 'crm_business_create',
    },
  })
}

async function ensureBusinessOnboardingFlow(
  supabase: ReturnType<typeof createServiceClient>,
  business: Business,
  actorId: string,
) {
  const { data: existingFlow } = await supabase
    .from('onboarding_flows')
    .select('id')
    .eq('entity_type', 'business')
    .eq('entity_id', business.id)
    .maybeSingle()

  if (existingFlow) return

  const { data: createdFlow } = await (supabase.from('onboarding_flows') as any)
    .insert({
      name: `${business.name} onboarding`,
      entity_type: 'business',
      entity_id: business.id,
      brand: business.brand,
      stage: business.stage,
      owner_id: actorId,
      campaign_id: business.campaign_id,
      started_at: new Date().toISOString(),
      completed_at: null,
      metadata: {
        auto_created: true,
        source: 'crm_business_create',
      },
    })
    .select()
    .single()

  if (!createdFlow) return

  await (supabase.from('onboarding_steps') as any).insert(
    DEFAULT_BUSINESS_STEPS.map((step, index) => ({
      flow_id: createdFlow.id,
      title: step.title,
      description: step.description,
      sort_order: index + 1,
      is_required: true,
      is_completed: false,
      completed_by: null,
      completed_at: null,
      metadata: {
        auto_created: true,
        source: 'crm_business_create',
      },
    })),
  )
}

async function ensureBusinessStakeholderSetup(
  supabase: ReturnType<typeof createServiceClient>,
  business: Business,
  actorId: string,
) {
  const { data: existingStakeholder } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('type', 'business')
    .eq('business_id', business.id)
    .maybeSingle()

  let stakeholder = existingStakeholder as Stakeholder | null

  if (!stakeholder) {
    const { data: createdStakeholder } = await (supabase.from('stakeholders') as any)
      .insert({
        type: 'business',
        name: business.name,
        city_id: business.city_id,
        owner_user_id: actorId,
        profile_id: null,
        business_id: business.id,
        cause_id: null,
        organization_id: null,
        status: 'active',
        metadata: {
          auto_created: true,
          source: 'crm_business_create',
        },
      })
      .select()
      .single()

    stakeholder = (createdStakeholder || null) as Stakeholder | null
  }

  if (!stakeholder) return

  const { data: existingTask } = await supabase
    .from('admin_tasks')
    .select('id')
    .eq('stakeholder_id', stakeholder.id)
    .eq('task_type', 'stakeholder_setup')
    .maybeSingle()

  if (existingTask) return

  await (supabase.from('admin_tasks') as any).insert({
    stakeholder_id: stakeholder.id,
    task_type: 'stakeholder_setup',
    title: `Complete setup for ${business.name}`,
    status: 'needs_setup' as AdminTaskStatus,
    payload_json: {
      stakeholder_type: 'business',
      business_id: business.id,
      auto_created: true,
    },
    due_at: null,
  })
}

function asOptionalString(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function isBrand(value: unknown): value is Brand {
  return value === 'localvip' || value === 'hato'
}

function isOnboardingStage(value: unknown): value is OnboardingStage {
  return value === 'lead'
    || value === 'contacted'
    || value === 'interested'
    || value === 'in_progress'
    || value === 'onboarded'
    || value === 'live'
    || value === 'paused'
    || value === 'declined'
}
