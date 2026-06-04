import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { toFrontendShape } from '@/lib/qa/dashboard-entity-map'
import type { Notification } from '@/lib/types/database'

export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  if (session.source === 'qa') {
    try {
      const res = await fetchQaApi(`/api/dashboard/v1/Notification?userId=${encodeURIComponent(session.userId)}&pageSize=50`)
      const json = await parseQaResponse<unknown>(res, 'Failed to load notifications.')
      const items =
        Array.isArray(json) ? json
        : (json && typeof json === 'object' && Array.isArray((json as Record<string, unknown>).items))
          ? (json as Record<string, unknown>).items
          : []
      const shaped = (toFrontendShape('notifications', items) as Notification[]) || []
      return NextResponse.json({ notifications: shaped })
    } catch {
      return NextResponse.json({ notifications: [] })
    }
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notifications: (data || []) as Notification[] })
}

export async function PATCH(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let body: { id?: string; markAllRead?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }

  if (session.source === 'qa') {
    try {
      if (body.markAllRead) {
        await fetchQaApi(`/api/dashboard/v1/Notification/mark-all-read?userId=${encodeURIComponent(session.userId)}`, { method: 'POST' })
      } else if (body.id) {
        await fetchQaApi(`/api/dashboard/v1/Notification/${encodeURIComponent(body.id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ isRead: true }),
        })
      } else {
        return NextResponse.json({ error: 'Provide id or markAllRead.' }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to mark notification read.' },
        { status: 500 },
      )
    }
  }

  const supabase = createServiceClient()

  if (body.markAllRead) {
    const { error } = await (supabase.from('notifications') as any)
      .update({ is_read: true })
      .eq('user_id', session.userId)
      .eq('is_read', false)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.id) {
    const { error } = await (supabase.from('notifications') as any)
      .update({ is_read: true })
      .eq('id', body.id)
      .eq('user_id', session.userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Provide id or markAllRead.' }, { status: 400 })
}
