import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { getStakeholderShell } from '@/lib/stakeholder-access'

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

  // QA sessions don't use magic-link impersonation — they use the View-As
  // cookie pattern (POST /api/admin/view-as { userId }). Tell the caller.
  if (session.source === 'qa') {
    return NextResponse.json(
      {
        error: 'For QA users use the View-As picker in the topbar (POST /api/admin/view-as).',
        useViewAs: true,
      },
      { status: 400 },
    )
  }

  // Non-QA (demo) sessions used Supabase Auth magic links. That project is
  // gone and the stub silently returned no profile, so this route answered a
  // misleading 404 "Target user not found". There is no impersonation path
  // for a demo session at all.
  return NextResponse.json(
    { error: 'Impersonation requires a QA-backed admin session.' },
    { status: 503 },
  )
}
