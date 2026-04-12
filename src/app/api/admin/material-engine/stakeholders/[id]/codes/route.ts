import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminRouteContext } from '@/lib/server/admin-access'
import { upsertStakeholderCodesAndGenerate } from '@/lib/server/material-engine'

const schema = z.object({
  referralCode: z.string().trim().min(2, 'Referral code is required.').max(64, 'Use a shorter referral code.'),
  connectionCode: z.string().trim().min(2, 'Connection code is required.').max(64, 'Use a shorter connection code.'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid code payload.' }, { status: 400 })
  }

  try {
    const result = await upsertStakeholderCodesAndGenerate(context.supabase, params.id, context.localProfileId, parsed.data)
    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save codes.'
    const status = /already in use/i.test(message) ? 409 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
