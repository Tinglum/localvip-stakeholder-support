import { NextRequest, NextResponse } from 'next/server'
import { getAdminRouteContext } from '@/lib/server/admin-access'
import { regenerateSingleGeneratedMaterial } from '@/lib/server/material-engine'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const context = await getAdminRouteContext()
  if ('error' in context) return context.error
  if (!context.localProfileId) {
    return NextResponse.json({ error: 'No local admin profile is linked to this QA session.' }, { status: 400 })
  }

  try {
    const result = await regenerateSingleGeneratedMaterial(context.supabase, params.id, context.localProfileId)
    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not regenerate material.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
