import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import type { Notification } from '@/lib/types/database'

export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ notifications: (data || []) as Notification[] })
}

export async function PATCH(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const supabase = createServiceClient()

  let body: { id?: string; markAllRead?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }

  if (body.markAllRead) {
    const { error } = await (supabase.from('notifications') as any)
      .update({ is_read: true })
      .eq('user_id', session.userId)
      .eq('is_read', false)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  if (body.id) {
    const { error } = await (supabase.from('notifications') as any)
      .update({ is_read: true })
      .eq('id', body.id)
      .eq('user_id', session.userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Provide id or markAllRead.' }, { status: 400 })
}
