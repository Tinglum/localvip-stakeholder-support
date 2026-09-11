import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse, QaApiError } from '@/lib/auth/qa-api'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

function errorResponse(error: unknown) {
  if (error instanceof QaApiError) {
    let message = error.message
    try {
      const body = JSON.parse(error.body || '{}') as { error?: string; blockers?: string[] }
      message = body.error || message
      return NextResponse.json({ error: message, blockers: body.blockers || [] }, { status: error.status })
    } catch {
      return NextResponse.json({ error: message }, { status: error.status })
    }
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Landing page request failed.' }, { status: 500 })
}

async function requireSession() {
  return getAuthenticatedSession()
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireSession()) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!/^\d+$/.test(params.id)) return NextResponse.json({ error: 'A linked cause account is required.' }, { status: 400 })
  try {
    const response = await fetchQaApi(`/api/dashboard/v1/Nonprofit/${encodeURIComponent(params.id)}/landing-page`)
    return NextResponse.json(await parseQaResponse(response, 'Could not load the landing page.'))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireSession()) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!/^\d+$/.test(params.id)) return NextResponse.json({ error: 'A linked cause account is required.' }, { status: 400 })
  try {
    const body = await request.json()
    const response = await fetchQaApi(`/api/dashboard/v1/Nonprofit/${encodeURIComponent(params.id)}/landing-page`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return NextResponse.json(await parseQaResponse(response, 'Could not save the landing page.'))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireSession()) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!/^\d+$/.test(params.id)) return NextResponse.json({ error: 'A linked cause account is required.' }, { status: 400 })
  try {
    const body = await request.json() as { action?: string }
    if (!['publish', 'unpublish'].includes(body.action || '')) {
      return NextResponse.json({ error: 'Choose publish or unpublish.' }, { status: 400 })
    }
    const response = await fetchQaApi(`/api/dashboard/v1/Nonprofit/${encodeURIComponent(params.id)}/landing-page/${body.action}`, {
      method: 'POST',
    })
    return NextResponse.json(await parseQaResponse(response, `Could not ${body.action} the landing page.`))
  } catch (error) {
    return errorResponse(error)
  }
}
