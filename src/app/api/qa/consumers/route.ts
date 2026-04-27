import { NextResponse } from 'next/server'
import { fetchQaConsumerList } from '@/lib/auth/qa-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET() {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  try {
    const consumers = await fetchQaConsumerList()
    return NextResponse.json(consumers)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA consumer list could not be loaded.')
  }
}
