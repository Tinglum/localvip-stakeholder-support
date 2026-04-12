import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminRouteContext } from '@/lib/server/admin-access'
import { createStakeholderRecord } from '@/lib/server/material-engine'

const schema = z.object({
  type: z.enum(['business', 'school', 'cause', 'launch_partner', 'influencer', 'field', 'community']),
  name: z.string().trim().min(2, 'Name is required.').max(120, 'Use a shorter name.'),
  cityId: z.string().uuid().nullable().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  profileId: z.string().uuid().nullable().optional(),
  businessId: z.string().uuid().nullable().optional(),
  causeId: z.string().uuid().nullable().optional(),
  organizationId: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'inactive', 'pending', 'archived']).optional(),
})

export async function POST(request: NextRequest) {
  const context = await getAdminRouteContext()
  if ('error' in context) return context.error
  if (!context.localProfileId) {
    return NextResponse.json({ error: 'No local admin profile is linked to this QA session.' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid stakeholder payload.' }, { status: 400 })
  }

  const stakeholder = await createStakeholderRecord(context.supabase, {
    type: parsed.data.type,
    name: parsed.data.name,
    cityId: parsed.data.cityId || null,
    ownerUserId: parsed.data.ownerUserId || null,
    profileId: parsed.data.profileId || null,
    businessId: parsed.data.businessId || null,
    causeId: parsed.data.causeId || null,
    organizationId: parsed.data.organizationId || null,
    status: parsed.data.status || 'pending',
    metadata: {
      created_via: 'admin_material_engine',
      created_by: context.localProfileId,
    },
  })

  return NextResponse.json({
    success: true,
    stakeholder,
  })
}
