import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import {
  getBusinessReferralCandidates,
  trackBusinessReferralInvite,
  updateBusinessReferralStatus,
  userCanManageBusinessReferrals,
} from '@/lib/server/business-referrals'
import type { Business, Profile } from '@/lib/types/database'

const postSchema = z.object({
  sourceBusinessId: z.string().uuid('A business is required.'),
  targetBusinessId: z.string().uuid().nullable().optional(),
  targetBusinessName: z.string().trim().min(2, 'Business name is required.'),
  targetCategory: z.string().trim().max(120).optional().nullable(),
  targetOwnerName: z.string().trim().max(120).optional().nullable(),
  targetEmail: z.string().trim().email('Enter a valid email address.').optional().or(z.literal('')).nullable(),
  targetPhone: z.string().trim().max(40).optional().nullable(),
  channel: z.enum(['sms', 'email', 'link_share']),
  scriptType: z.enum(['nearby_business', 'complementary_business', 'places_you_already_go', 'customers_also_visit']),
  tier: z.enum(['good', 'better', 'best', 'ultra']),
  message: z.string().trim().min(10, 'Message is too short.'),
  notes: z.string().trim().max(1200).optional().or(z.literal('')).nullable(),
  fitReason: z.string().trim().max(500).optional().or(z.literal('')).nullable(),
  relationshipNote: z.string().trim().max(500).optional().or(z.literal('')).nullable(),
})

const patchSchema = z.object({
  sourceBusinessId: z.string().uuid('A business is required.'),
  referralId: z.string().uuid('A referral is required.'),
  status: z.enum(['not_contacted', 'contacted', 'responded', 'interested', 'onboarded']),
  note: z.string().trim().max(1200).optional().or(z.literal('')).nullable(),
})

type AuthorizedContext =
  | { error: NextResponse }
  | {
    supabase: ReturnType<typeof createServiceClient>
    profile: Profile
    business: Business
  }

async function getAuthorizedContext(request: NextRequest): Promise<AuthorizedContext> {
  const session = await getAuthenticatedSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }

  const { profile } = session
  const supabase = createServiceClient()

  const businessId = request.method === 'GET'
    ? request.nextUrl.searchParams.get('businessId')
    : (await request.clone().json().catch(() => null) as { sourceBusinessId?: string } | null)?.sourceBusinessId || null

  if (!businessId) {
    return { error: NextResponse.json({ error: 'businessId is required.' }, { status: 400 }) }
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single()

  if (!business) {
    return { error: NextResponse.json({ error: 'Business not found.' }, { status: 404 }) }
  }

  if (!userCanManageBusinessReferrals(profile, business)) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) }
  }

  return { supabase, profile, business }
}

export async function GET(request: NextRequest) {
  const context = await getAuthorizedContext(request)
  if ('error' in context) return context.error

  const candidates = await getBusinessReferralCandidates(context.supabase, context.business)
  return NextResponse.json({
    candidates,
    sourceBusiness: {
      id: context.business.id,
      name: context.business.name,
      category: context.business.category,
      city_id: context.business.city_id,
      brand: context.business.brand,
      stage: context.business.stage,
    },
  })
}

export async function POST(request: NextRequest) {
  const context = await getAuthorizedContext(request)
  if ('error' in context) return context.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({ error: issue?.message || 'Invalid referral payload.' }, { status: 400 })
  }

  if (parsed.data.sourceBusinessId !== context.business.id) {
    return NextResponse.json({ error: 'Business mismatch.' }, { status: 400 })
  }

  const result = await trackBusinessReferralInvite(
    context.supabase,
    context.profile,
    context.business,
    parsed.data,
  )

  return NextResponse.json({
    success: true,
    referral: result.referral,
    targetBusiness: result.targetBusiness,
    targetContact: result.targetContact,
    createdNewBusinessLead: Boolean(
      (result.referral?.metadata as Record<string, unknown> | null)?.created_new_business_lead,
    ),
  })
}

export async function PATCH(request: NextRequest) {
  const context = await getAuthorizedContext(request)
  if ('error' in context) return context.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({ error: issue?.message || 'Invalid referral update.' }, { status: 400 })
  }

  if (parsed.data.sourceBusinessId !== context.business.id) {
    return NextResponse.json({ error: 'Business mismatch.' }, { status: 400 })
  }

  try {
    const referral = await updateBusinessReferralStatus(
      context.supabase,
      context.profile,
      context.business,
      parsed.data,
    )

    return NextResponse.json({ success: true, referral })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update this referral.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
