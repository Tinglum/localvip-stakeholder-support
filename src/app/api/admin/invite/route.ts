import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
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

  // QA path: delegate to backend invite endpoint.
  if (session.source === 'qa') {
    try {
      const res = await fetchQaApi(`/api/dashboard/v1/User/invite`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: parsed.data.email,
          fullName: parsed.data.fullName,
          role: parsed.data.role,
          roleSubtype: roleSubtype || null,
          brand: parsed.data.brand,
          notes: parsed.data.notes || null,
          invitedByUserId: actingProfile.id,
        }),
      })
      await parseQaResponse<unknown>(res, 'Failed to send invite.')
      return NextResponse.json({ success: true, invitedEmail: parsed.data.email })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to send invite.' },
        { status: 500 },
      )
    }
  }


  // Only a QA session can invite. The old path went through Supabase Auth,
  // whose project is gone; leaving it in place meant a demo admin hit a
  // TypeError on a method the stub never had and saw a generic "Invite
  // failed". Say what is actually wrong instead.
  return NextResponse.json(
    { error: 'Inviting users requires a QA-backed admin session. Sign in through the QA login, not the demo session.' },
    { status: 503 },
  )
}
