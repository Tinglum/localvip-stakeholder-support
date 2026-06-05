import { NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { toFrontendShape } from '@/lib/qa/dashboard-entity-map'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const access = await requireQaRouteAccess()
  if ('error' in access) return access.error

  const flowId = parseQaRouteId(params.id)
  if (flowId === null) {
    return NextResponse.json({ error: 'A numeric QA onboarding flow id is required.' }, { status: 400 })
  }

  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Onboarding/${flowId}/steps`)
    const json = await parseQaResponse<unknown>(res, 'Failed to load onboarding steps.')
    const items = Array.isArray(json)
      ? json
      : (json && typeof json === 'object' && Array.isArray((json as Record<string, unknown>).items))
        ? (json as Record<string, unknown>).items
        : []

    return NextResponse.json(toFrontendShape('onboarding_steps', items))
  } catch (error) {
    return qaRouteErrorResponse(error, 'The onboarding steps could not be loaded.')
  }
}
