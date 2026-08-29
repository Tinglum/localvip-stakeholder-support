import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'

export async function POST(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }


  const body = await request.json()
  const { generatedMaterialId } = body as { generatedMaterialId: string }

  if (!generatedMaterialId) {
    return NextResponse.json({ error: 'generatedMaterialId is required.' }, { status: 400 })
  }

  if (session.source === 'qa') {
    try {
      const res = await fetchQaApi(
        `/api/dashboard/v1/GeneratedMaterial/${encodeURIComponent(generatedMaterialId)}/regenerate`,
        { method: 'POST' },
      )
      const result = await parseQaResponse<unknown>(res, 'Could not update material.')
      return NextResponse.json({ success: true, result })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Could not update material.' },
        { status: 400 },
      )
    }
  }

  // The non-QA path read generated_materials and stakeholders out of the
  // Supabase stub, which always returned null, so it answered a misleading
  // "Generated material not found". There is no local material store.
  return NextResponse.json(
    { error: 'Accepting a material update requires a QA-backed session.' },
    { status: 503 },
  )
}
