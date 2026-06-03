import { NextResponse } from 'next/server'
import { fetchQaConsumerTypes } from '@/lib/auth/qa-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET() {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  try {
    const types = await fetchQaConsumerTypes()
    return NextResponse.json(types)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA consumer types could not be loaded.')
  }
}
