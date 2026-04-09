import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { getStakeholderShell, normalizeSubtypeForRole } from '@/lib/stakeholder-access'
import type { UserRole } from '@/lib/types/database'

const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  fullName: z.string().trim().min(2, 'Full name is required.').max(120, 'Use a shorter name.'),
  role: z.enum(['admin', 'business', 'field', 'launch_partner', 'community', 'influencer']),
  roleSubtype: z.enum(['super', 'internal', 'intern', 'volunteer', 'school', 'cause']).nullable().optional(),
  brand: z.enum(['localvip', 'hato']),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
})

export async function POST(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const actingProfile = session.profile
  if (getStakeholderShell(actingProfile) !== 'admin') {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const supabase = createServiceClient()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return NextResponse.json({ error: firstIssue?.message || 'Invalid invite payload.' }, { status: 400 })
  }

  const roleSubtype = normalizeSubtypeForRole(parsed.data.role as UserRole, parsed.data.roleSubtype || null)
  const redirectTo = new URL('/login', request.nextUrl.origin).toString()

  const { data: invitedUser, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: {
        full_name: parsed.data.fullName,
        role: parsed.data.role,
        role_subtype: roleSubtype || undefined,
        brand_context: parsed.data.brand,
        invited_by: actingProfile.id,
      },
      redirectTo,
    },
  )

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 })
  }

  const invitedProfileId = invitedUser.user?.id
  if (invitedProfileId) {
    const { error: profileError } = await (supabase
      .from('profiles') as any)
      .upsert(
        {
          id: invitedProfileId,
          email: parsed.data.email,
          full_name: parsed.data.fullName,
          role: parsed.data.role,
          role_subtype: roleSubtype,
          brand_context: parsed.data.brand,
          organization_id: null,
          city_id: null,
          business_id: null,
          phone: null,
          referral_code: null,
          status: 'pending',
          metadata: {
            invited_by: actingProfile.id,
            invite_notes: parsed.data.notes || null,
            portal_role: parsed.data.role,
          },
        },
        { onConflict: 'id' },
      )

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    await (supabase.from('audit_logs') as any).insert({
      user_id: actingProfile.id,
      action: 'invited_stakeholder',
      entity_type: 'profile',
      entity_id: invitedProfileId,
      new_values: {
        role: parsed.data.role,
        role_subtype: roleSubtype,
        brand_context: parsed.data.brand,
        status: 'pending',
      },
      metadata: {
        invited_email: parsed.data.email,
        invite_notes: parsed.data.notes || null,
      },
    })
  }

  return NextResponse.json({
    success: true,
    invitedEmail: parsed.data.email,
  })
}
