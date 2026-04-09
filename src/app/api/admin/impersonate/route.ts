import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import type { Profile } from '@/lib/types/database'

const schema = z.object({
  userId: z.string().uuid(),
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

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid userId.' }, { status: 400 })
  }

  const { userId } = parsed.data

  if (userId === actingProfile.id) {
    return NextResponse.json({ error: 'Cannot impersonate yourself.' }, { status: 400 })
  }

  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id,email,full_name')
    .eq('id', userId)
    .single<Pick<Profile, 'id' | 'email' | 'full_name'>>()

  if (!targetProfile?.email) {
    return NextResponse.json({ error: 'Target user not found.' }, { status: 404 })
  }

  const redirectTo = new URL('/dashboard', request.nextUrl.origin).toString()

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: targetProfile.email,
    options: { redirectTo },
  })

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json(
      { error: linkError?.message || 'Failed to generate login link.' },
      { status: 500 },
    )
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: actingProfile.id,
    action: 'admin_impersonated_user',
    entity_type: 'profile',
    entity_id: userId,
    new_values: { impersonated_email: targetProfile.email },
    metadata: { admin_id: actingProfile.id, admin_email: actingProfile.email },
  })

  return NextResponse.json({ link: linkData.properties.action_link })
}
