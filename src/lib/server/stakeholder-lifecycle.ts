import type { PostgrestError } from '@supabase/supabase-js'
import type {
  AdminTaskStatus,
  Brand,
  Business,
  Cause,
  OnboardingFlow,
  OnboardingStage,
  Stakeholder,
  StakeholderAssignment,
  StakeholderType,
} from '@/lib/types/database'
import type { createServiceClient } from '@/lib/supabase/server'
import type { StakeholderShell } from '@/lib/stakeholder-access'

type ServiceSupabaseClient = ReturnType<typeof createServiceClient>
type OperatorShell = Extract<StakeholderShell, 'admin' | 'field' | 'launch_partner'>

const DEFAULT_BUSINESS_STEPS = [
  {
    title: 'Initial connection',
    description: 'Make the first intro and confirm the owner or decision-maker.',
  },
  {
    title: 'Owner conversation',
    description: 'Have the real conversation and understand what is needed next.',
  },
  {
    title: 'Materials + QR',
    description: 'Prepare offer, QR, and the first launch materials.',
  },
  {
    title: 'Launch decision',
    description: 'Confirm final readiness and move the business toward launch.',
  },
] as const

const DEFAULT_CAUSE_STEPS = [
  {
    title: 'Initial connection',
    description: 'Make the first intro and confirm the decision-maker.',
  },
  {
    title: 'Leader conversation',
    description: 'Confirm readiness, supporter value, and who will own next steps.',
  },
  {
    title: 'Materials + QR',
    description: 'Prepare supporter QR, referral links, and kickoff materials.',
  },
  {
    title: 'Activation decision',
    description: 'Confirm the first activation path and move the cause live.',
  },
] as const

export async function createBusinessLifecycle(
  supabase: ServiceSupabaseClient,
  input: {
    business: Partial<Business>
    actorId: string
    shell: OperatorShell
  },
) {
  const { data, error } = await (supabase.from('businesses') as any)
    .insert(input.business)
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Business could not be created.')
  }

  const business = data as Business

  await Promise.all([
    ensureBusinessClaimAssignment(supabase, business, input.actorId, input.shell),
    ensureBusinessOnboardingFlow(supabase, business, input.actorId),
    ensureBusinessStakeholderSetup(supabase, business, input.actorId),
  ])

  return business
}

export async function createCauseLifecycle(
  supabase: ServiceSupabaseClient,
  input: {
    cause: Partial<Cause>
    actorId: string
    shell: OperatorShell
  },
) {
  const { data, error } = await (supabase.from('causes') as any)
    .insert(input.cause)
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Cause could not be created.')
  }

  const cause = data as Cause

  await Promise.all([
    ensureCauseClaimAssignment(supabase, cause, input.actorId, input.shell),
    ensureCauseOnboardingFlow(supabase, cause, input.actorId),
    ensureCauseStakeholderSetup(supabase, cause, input.actorId),
  ])

  return cause
}

export async function ensureBusinessClaimAssignment(
  supabase: ServiceSupabaseClient,
  business: Business,
  actorId: string,
  shell: OperatorShell,
) {
  if (!['field', 'launch_partner'].includes(shell)) return null

  const { data: existing } = await supabase
    .from('stakeholder_assignments')
    .select('*')
    .eq('stakeholder_id', actorId)
    .eq('entity_type', 'business')
    .eq('entity_id', business.id)
    .maybeSingle()

  if (existing) return existing as StakeholderAssignment

  const payload = {
    stakeholder_id: actorId,
    entity_type: 'business',
    entity_id: business.id,
    role: 'claim_owner',
    ownership_status: 'active_owner',
    assigned_by: actorId,
    status: 'active',
    claimed_at: new Date().toISOString(),
    next_action: 'Send first outreach',
    next_action_due_date: null,
    metadata: {
      auto_created: true,
      source: 'crm_business_create',
    },
  }

  const { data, error } = await (supabase.from('stakeholder_assignments') as any)
    .insert(payload)
    .select()
    .single()

  if (error && isOwnershipConflict(error)) {
    throw new Error('This business already has an active owner.')
  }
  if (error) throw error
  return data as StakeholderAssignment
}

export async function ensureCauseClaimAssignment(
  supabase: ServiceSupabaseClient,
  cause: Cause,
  actorId: string,
  shell: OperatorShell,
) {
  if (!['field', 'launch_partner'].includes(shell)) return null

  const { data: existing } = await supabase
    .from('stakeholder_assignments')
    .select('*')
    .eq('stakeholder_id', actorId)
    .eq('entity_type', 'cause')
    .eq('entity_id', cause.id)
    .maybeSingle()

  if (existing) return existing as StakeholderAssignment

  const payload = {
    stakeholder_id: actorId,
    entity_type: 'cause',
    entity_id: cause.id,
    role: 'claim_owner',
    ownership_status: 'active_owner',
    assigned_by: actorId,
    status: 'active',
    claimed_at: new Date().toISOString(),
    next_action: 'Send first outreach',
    next_action_due_date: null,
    metadata: {
      auto_created: true,
      source: 'crm_cause_create',
    },
  }

  const { data, error } = await (supabase.from('stakeholder_assignments') as any)
    .insert(payload)
    .select()
    .single()

  if (error && isOwnershipConflict(error)) {
    throw new Error('This cause already has an active owner.')
  }
  if (error) throw error
  return data as StakeholderAssignment
}

export async function ensureBusinessOnboardingFlow(
  supabase: ServiceSupabaseClient,
  business: Business,
  actorId: string,
) {
  const existing = await getOnboardingFlow(supabase, 'business', business.id)
  if (existing) return existing
  return createOnboardingFlowWithSteps(supabase, {
    name: `${business.name} onboarding`,
    entityType: 'business',
    entityId: business.id,
    brand: business.brand,
    stage: business.stage,
    ownerId: actorId,
    campaignId: business.campaign_id,
    steps: DEFAULT_BUSINESS_STEPS,
    source: 'crm_business_create',
  })
}

export async function ensureCauseOnboardingFlow(
  supabase: ServiceSupabaseClient,
  cause: Cause,
  actorId: string,
) {
  const existing = await getOnboardingFlow(supabase, 'cause', cause.id)
  if (existing) return existing
  return createOnboardingFlowWithSteps(supabase, {
    name: `${cause.name} onboarding`,
    entityType: 'cause',
    entityId: cause.id,
    brand: cause.brand,
    stage: cause.stage,
    ownerId: actorId,
    campaignId: cause.campaign_id,
    steps: DEFAULT_CAUSE_STEPS,
    source: 'crm_cause_create',
  })
}

export async function ensureBusinessStakeholderSetup(
  supabase: ServiceSupabaseClient,
  business: Business,
  actorId: string,
) {
  let stakeholder = await getStakeholderByLinkedRecord(supabase, 'business', business.id)

  if (!stakeholder) {
    const { data } = await (supabase.from('stakeholders') as any)
      .insert({
        type: 'business',
        name: business.name,
        city_id: business.city_id,
        owner_user_id: actorId,
        profile_id: null,
        business_id: business.id,
        cause_id: null,
        organization_id: null,
        status: 'pending',
        metadata: {
          auto_created: true,
          source: 'crm_business_create',
        },
      })
      .select()
      .single()

    stakeholder = (data || null) as Stakeholder | null
  }

  if (!stakeholder) throw new Error('Business stakeholder setup could not be created.')

  await Promise.all([
    ensureStakeholderCodesRow(supabase, stakeholder.id),
    ensureStakeholderSetupTask(supabase, stakeholder.id, {
      title: `Complete setup for ${business.name}`,
      stakeholderType: 'business',
      linkedEntityId: business.id,
      source: 'crm_business_create',
    }),
  ])

  return stakeholder
}

export async function ensureCauseStakeholderSetup(
  supabase: ServiceSupabaseClient,
  cause: Cause,
  actorId: string,
) {
  let stakeholder = await getStakeholderByLinkedRecord(supabase, 'cause', cause.id)

  if (!stakeholder) {
    const { data } = await (supabase.from('stakeholders') as any)
      .insert({
        type: mapCauseToStakeholderType(cause),
        name: cause.name,
        city_id: cause.city_id,
        owner_user_id: actorId,
        profile_id: cause.owner_id,
        business_id: null,
        cause_id: cause.id,
        organization_id: cause.organization_id,
        status: 'pending',
        metadata: {
          auto_created: true,
          source: 'crm_cause_create',
          cause_type: cause.type,
        },
      })
      .select()
      .single()

    stakeholder = (data || null) as Stakeholder | null
  }

  if (!stakeholder) throw new Error('Cause stakeholder setup could not be created.')

  await Promise.all([
    ensureStakeholderCodesRow(supabase, stakeholder.id),
    ensureStakeholderSetupTask(supabase, stakeholder.id, {
      title: `Complete setup for ${cause.name}`,
      stakeholderType: mapCauseToStakeholderType(cause),
      linkedEntityId: cause.id,
      source: 'crm_cause_create',
    }),
  ])

  return stakeholder
}

export async function ensureStakeholderCodesRow(
  supabase: ServiceSupabaseClient,
  stakeholderId: string,
) {
  const { data: existing } = await supabase
    .from('stakeholder_codes')
    .select('*')
    .eq('stakeholder_id', stakeholderId)
    .maybeSingle()

  if (existing) return existing

  const { data, error } = await (supabase.from('stakeholder_codes') as any)
    .insert({
      stakeholder_id: stakeholderId,
      referral_code: null,
      connection_code: null,
      join_url: null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function ensureStakeholderSetupTask(
  supabase: ServiceSupabaseClient,
  stakeholderId: string,
  input: {
    title: string
    stakeholderType: StakeholderType
    linkedEntityId: string
    source: string
  },
) {
  const { data: existing } = await supabase
    .from('admin_tasks')
    .select('*')
    .eq('stakeholder_id', stakeholderId)
    .eq('task_type', 'stakeholder_setup')
    .maybeSingle()

  if (existing) return existing

  const { data, error } = await (supabase.from('admin_tasks') as any)
    .insert({
      stakeholder_id: stakeholderId,
      task_type: 'stakeholder_setup',
      title: input.title,
      status: 'needs_setup' as AdminTaskStatus,
      payload_json: {
        stakeholder_type: input.stakeholderType,
        linked_entity_id: input.linkedEntityId,
        source: input.source,
        checklist: ['Add referral code', 'Add connection code', 'Generate materials'],
      },
      due_at: null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

function mapCauseToStakeholderType(cause: Cause): StakeholderType {
  if (cause.type === 'school') return 'school'
  if (cause.type === 'community') return 'community'
  return 'cause'
}

async function createOnboardingFlowWithSteps(
  supabase: ServiceSupabaseClient,
  input: {
    name: string
    entityType: 'business' | 'cause'
    entityId: string
    brand: Brand
    stage: OnboardingStage
    ownerId: string
    campaignId: string | null
    steps: ReadonlyArray<{ title: string; description: string }>
    source: string
  },
) {
  const { data, error } = await (supabase.from('onboarding_flows') as any)
    .insert({
      name: input.name,
      entity_type: input.entityType,
      entity_id: input.entityId,
      brand: input.brand,
      stage: input.stage,
      owner_id: input.ownerId,
      campaign_id: input.campaignId,
      started_at: new Date().toISOString(),
      completed_at: null,
      metadata: {
        auto_created: true,
        source: input.source,
      },
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Onboarding flow could not be created.')
  }

  await (supabase.from('onboarding_steps') as any).insert(
    input.steps.map((step, index) => ({
      flow_id: data.id,
      title: step.title,
      description: step.description,
      sort_order: index + 1,
      is_required: true,
      is_completed: false,
      completed_by: null,
      completed_at: null,
      metadata: {
        auto_created: true,
        source: input.source,
      },
    })),
  )

  return data as OnboardingFlow
}

async function getStakeholderByLinkedRecord(
  supabase: ServiceSupabaseClient,
  entityType: 'business' | 'cause',
  entityId: string,
) {
  const column = entityType === 'business' ? 'business_id' : 'cause_id'
  const { data } = await supabase
    .from('stakeholders')
    .select('*')
    .eq(column, entityId)
    .maybeSingle()

  return (data || null) as Stakeholder | null
}

async function getOnboardingFlow(
  supabase: ServiceSupabaseClient,
  entityType: 'business' | 'cause',
  entityId: string,
) {
  const { data } = await supabase
    .from('onboarding_flows')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle()

  return (data || null) as OnboardingFlow | null
}

function isOwnershipConflict(error: PostgrestError) {
  const message = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase()
  return error.code === '23505' && message.includes('active_owner')
}
