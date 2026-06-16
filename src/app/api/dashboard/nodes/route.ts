import { NextRequest, NextResponse } from 'next/server'
import { fetchQaNodes, type QaNodeType } from '@/lib/auth/qa-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

const ALLOWED_TYPES: QaNodeType[] = ['all', 'customer', 'business', 'cause']

// All nodes (customers + businesses + causes) for the CRM "Customers" view.
// Admin / field / launch-partner only — this is the operator-facing directory.
export async function GET(request: NextRequest) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  const params = request.nextUrl.searchParams
  const typeParam = (params.get('type') || 'all') as QaNodeType
  const type = ALLOWED_TYPES.includes(typeParam) ? typeParam : 'all'
  const search = params.get('search')?.trim() || ''
  const pageRaw = params.get('page')
  const pageSizeRaw = params.get('pageSize')
  const page = pageRaw && /^\d+$/.test(pageRaw) ? Math.max(Number(pageRaw), 1) : 1
  const pageSize = pageSizeRaw && /^\d+$/.test(pageSizeRaw) ? Math.min(Math.max(Number(pageSizeRaw), 1), 100) : 25

  try {
    const result = await fetchQaNodes({ type, search, page, pageSize })
    return NextResponse.json(result)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The customers list could not be loaded.')
  }
}
