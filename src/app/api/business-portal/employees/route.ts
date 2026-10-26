import { NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'

// Employees tab. The QA backend decides who may manage employees (the owner or a
// SysAdmin); this route only validates ids and forwards.

function readId(raw: string | null) {
  const value = (raw || '').replace(/^qa-/, '')
  const id = Number(value)
  return /^\d+$/.test(value) && Number.isSafeInteger(id) && id > 0 ? id : null
}

async function forward(request: Request, method: 'GET' | 'POST' | 'PUT' | 'DELETE') {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.source !== 'qa') return NextResponse.json({ error: 'Employees are unavailable for this account.' }, { status: 409 })

  const params = new URL(request.url).searchParams
  const businessId = readId(params.get('businessId'))
  if (!businessId) return NextResponse.json({ error: 'Invalid business.' }, { status: 400 })

  let path = `/api/dashboard/v1/BusinessEmployees/${businessId}`
  if (method === 'PUT' || method === 'DELETE') {
    const employeeId = readId(params.get('employeeId'))
    if (!employeeId) return NextResponse.json({ error: 'Invalid employee.' }, { status: 400 })
    path += `/${employeeId}`
  }

  const init: RequestInit = { method }
  if (method === 'POST' || method === 'PUT') {
    init.body = await request.text()
    init.headers = { 'content-type': 'application/json' }
  }

  try {
    const response = await fetchQaApi(path, init)
    const payload = await response.json().catch(() => ({}))
    return NextResponse.json(payload, { status: response.status, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Employees are temporarily unavailable.' }, { status: 502 })
  }
}

export const GET = (request: Request) => forward(request, 'GET')
export const POST = (request: Request) => forward(request, 'POST')
export const PUT = (request: Request) => forward(request, 'PUT')
export const DELETE = (request: Request) => forward(request, 'DELETE')
