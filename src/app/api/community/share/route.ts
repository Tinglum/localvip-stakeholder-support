import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import {
  ensureCommunitySupportResource,
  userCanManageCommunitySupport,
} from '@/lib/server/community-support'

export async function GET(request: NextRequest) {
  const causeId = request.nextUrl.searchParams.get('causeId')

  if (!causeId) {
    return NextResponse.json({ error: 'causeId is required.' }, { status: 400 })
  }

  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  if (session.source === 'qa') {
    // For QA causes, derive a shareable resource from the cause's stakeholder codes.
    const { fetchQaApi, parseQaResponse } = await import('@/lib/auth/qa-api')
    try {
      const sRes = await fetchQaApi(`/api/dashboard/v1/Stakeholder?causeAccountId=${encodeURIComponent(causeId)}`)
      const sJson = await parseQaResponse<unknown>(sRes, 'Failed to load stakeholder.').catch(() => null)
      const items = Array.isArray(sJson) ? sJson
        : (sJson && typeof sJson === 'object' && Array.isArray((sJson as Record<string, unknown>).items))
          ? (sJson as Record<string, unknown>).items as Array<Record<string, unknown>>
          : []
      const stakeholder = items[0]
      if (!stakeholder?.id) {
        return NextResponse.json({ error: 'No stakeholder for this cause.' }, { status: 404 })
      }
      const cRes = await fetchQaApi(`/api/dashboard/v1/StakeholderCode/${encodeURIComponent(String(stakeholder.id))}`)
      const cJson = await parseQaResponse<unknown>(cRes, '').catch(() => null)
      const codes = Array.isArray(cJson) ? cJson
        : (cJson && typeof cJson === 'object' && Array.isArray((cJson as Record<string, unknown>).items))
          ? (cJson as Record<string, unknown>).items as Array<Record<string, unknown>>
          : []
      const code = codes[0] || {}
      return NextResponse.json({
        stakeholderId: stakeholder.id,
        joinUrl: code.joinUrl || code.JoinUrl || null,
        referralCode: code.referralCode || code.ReferralCode || null,
        connectionCode: code.connectionCode || code.ConnectionCode || null,
        causeName: stakeholder.name || null,
      })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to build share resource.' },
        { status: 500 },
      )
    }
  }

  const { profile } = session
  const supabase = createServiceClient()

  const { data: cause } = await supabase
    .from('causes')
    .select('*')
    .eq('id', causeId)
    .single()

  if (!cause) {
    return NextResponse.json({ error: 'Cause not found.' }, { status: 404 })
  }

  if (!userCanManageCommunitySupport(profile, cause)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const resource = await ensureCommunitySupportResource(supabase, cause, profile.id)
  return NextResponse.json(resource)
}
