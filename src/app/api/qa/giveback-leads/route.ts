import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse, QaApiError } from '@/lib/auth/qa-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

/**
 * Giveback Day flyer leads awaiting approval.
 *
 * Leads are NOT businesses — they live in their own backend table precisely so
 * an anonymous public form cannot write into Accounts — so they cannot be read
 * through /api/qa/businesses and need their own route.
 */
export async function GET(request: NextRequest) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  const status = request.nextUrl.searchParams.get('status') || 'pending'

  try {
    const res = await fetchQaApi(`/api/dashboard/v1/GivebackLead?status=${encodeURIComponent(status)}`)
    const data = await parseQaJsonResponse(res, 'Failed to load Giveback Day leads.')
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof QaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return qaRouteErrorResponse(error, 'Giveback Day leads could not be loaded.')
  }
}
