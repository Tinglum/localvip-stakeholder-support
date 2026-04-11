import { NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import type {
  AdminTask,
  Business,
  Campaign,
  Cause,
  City,
  Contact,
  GeneratedMaterial,
  Material,
  Note,
  OnboardingFlow,
  OnboardingStep,
  Offer,
  OutreachActivity,
  Profile,
  QrCode,
  Stakeholder,
  StakeholderAssignment,
  StakeholderCode,
  Task,
} from '@/lib/types/database'
import type { CrmBusinessLocalStateResponse } from '@/lib/crm-api'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const context = await getOperatorRouteContext(['admin', 'field', 'launch_partner'])
  if ('error' in context) return context.error

  const businessId = params.id

  const { data: businessData, error: businessError } = await context.supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .maybeSingle()

  const business = (businessData || null) as Business | null
  if (businessError || !business) {
    return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  }

  const [
    stakeholdersResult,
    flowsResult,
    assignmentsResult,
    outreachResult,
    tasksResult,
    notesResult,
    offersResult,
    contactsResult,
    qrCodesResult,
    citiesResult,
    causesResult,
    campaignsResult,
  ] = await Promise.all([
    context.supabase.from('stakeholders').select('*').eq('business_id', businessId).order('updated_at', { ascending: false }),
    context.supabase.from('onboarding_flows').select('*').eq('entity_type', 'business').eq('entity_id', businessId).order('created_at', { ascending: false }),
    context.supabase.from('stakeholder_assignments').select('*').eq('entity_type', 'business').eq('entity_id', businessId).order('created_at', { ascending: false }),
    context.supabase.from('outreach_activities').select('*').eq('entity_type', 'business').eq('entity_id', businessId).order('created_at', { ascending: false }),
    context.supabase.from('tasks').select('*').eq('entity_type', 'business').eq('entity_id', businessId).order('created_at', { ascending: false }),
    context.supabase.from('notes').select('*').eq('entity_type', 'business').eq('entity_id', businessId).order('created_at', { ascending: false }),
    context.supabase.from('offers').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
    context.supabase.from('contacts').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
    context.supabase.from('qr_codes').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
    context.supabase.from('cities').select('*').order('name', { ascending: true }),
    context.supabase.from('causes').select('*').order('created_at', { ascending: false }),
    context.supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
  ])

  const stakeholders = ((stakeholdersResult.data || []) as Stakeholder[])
  const flows = ((flowsResult.data || []) as OnboardingFlow[])
  const assignments = ((assignmentsResult.data || []) as StakeholderAssignment[])
  const outreach = ((outreachResult.data || []) as OutreachActivity[])
  const tasks = ((tasksResult.data || []) as Task[])
  const notes = ((notesResult.data || []) as Note[])
  const offers = ((offersResult.data || []) as Offer[])
  const contacts = ((contactsResult.data || []) as Contact[])
  const qrCodes = ((qrCodesResult.data || []) as QrCode[])
  const cities = ((citiesResult.data || []) as City[])
  const causes = ((causesResult.data || []) as Cause[])
  const campaigns = ((campaignsResult.data || []) as Campaign[])

  const stakeholderIds = stakeholders.map((item) => item.id)
  const flowIds = flows.map((item) => item.id)

  const [
    generatedResult,
    adminTasksResult,
    stakeholderCodesResult,
    stepsResult,
  ] = await Promise.all([
    stakeholderIds.length > 0
      ? context.supabase.from('generated_materials').select('*').in('stakeholder_id', stakeholderIds).order('updated_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    stakeholderIds.length > 0
      ? context.supabase.from('admin_tasks').select('*').in('stakeholder_id', stakeholderIds).order('updated_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    stakeholderIds.length > 0
      ? context.supabase.from('stakeholder_codes').select('*').in('stakeholder_id', stakeholderIds).order('updated_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    flowIds.length > 0
      ? context.supabase.from('onboarding_steps').select('*').in('flow_id', flowIds).order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ])

  const generatedMaterials = ((generatedResult.data || []) as GeneratedMaterial[])
  const adminTasks = ((adminTasksResult.data || []) as AdminTask[])
  const stakeholderCodes = ((stakeholderCodesResult.data || []) as StakeholderCode[])
  const steps = ((stepsResult.data || []) as OnboardingStep[])

  const materialIds = new Set<string>()
  if (business.linked_material_id) materialIds.add(business.linked_material_id)
  for (const generated of generatedMaterials) {
    if (generated.material_id) materialIds.add(generated.material_id)
  }

  let materials: Material[] = []
  if (materialIds.size > 0) {
    const { data } = await context.supabase
      .from('materials')
      .select('*')
      .in('id', Array.from(materialIds))

    materials = ((data || []) as Material[])
  }

  const profileIds = new Set<string>()
  const pushProfileId = (value: string | null | undefined) => {
    if (value) profileIds.add(value)
  }

  pushProfileId(business.owner_id)
  for (const stakeholder of stakeholders) {
    pushProfileId(stakeholder.owner_user_id)
    pushProfileId(stakeholder.profile_id)
  }
  for (const assignment of assignments) pushProfileId(assignment.stakeholder_id)
  for (const item of outreach) pushProfileId(item.performed_by)
  for (const item of tasks) {
    pushProfileId(item.assigned_to)
    pushProfileId(item.created_by)
  }
  for (const item of notes) pushProfileId(item.created_by)

  let profiles: Profile[] = []
  if (profileIds.size > 0) {
    const { data } = await context.supabase
      .from('profiles')
      .select('*')
      .in('id', Array.from(profileIds))

    profiles = ((data || []) as Profile[])
  }

  const payload: CrmBusinessLocalStateResponse = {
    businessId,
    profiles,
    cities,
    causes,
    campaigns,
    qrCodes,
    materials,
    stakeholders,
    generatedMaterials,
    assignments,
    outreach,
    tasks,
    notes,
    flows,
    steps,
    offers,
    contacts,
    adminTasks,
    stakeholderCodes,
  }

  return NextResponse.json(payload)
}
