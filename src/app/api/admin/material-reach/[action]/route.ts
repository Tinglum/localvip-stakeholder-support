import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export const dynamic = 'force-dynamic'

const ALLOWED_ACTIONS = new Set(['preview', 'check', 'entity-preview', 'activate'])

export async function POST(request: NextRequest, { params }: { params: { action: string } }) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error
  if (!ALLOWED_ACTIONS.has(params.action)) return NextResponse.json({ error: 'Unknown material reach action.' }, { status: 404 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  try {
    const response = await fetchQaApi(`/api/admin/material-reach/${params.action}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    const parsedPayload = await parseQaResponse<Record<string, unknown>>(response, 'Material reach could not be calculated.')
    const payload = parsedPayload || {}
    if (params.action !== 'activate') return NextResponse.json(payload)

    const entities = Array.isArray(payload.entities)
      ? payload.entities.filter((value): value is { id: number; type: string; name?: string } => {
          if (!value || typeof value !== 'object') return false
          const row = value as Record<string, unknown>
          return typeof row.id === 'number' && typeof row.type === 'string'
        })
      : []
    const materialId = typeof payload.materialId === 'number' ? payload.materialId : null
    if (!materialId || entities.length === 0) {
      return NextResponse.json({ ...payload, generation: { generated: 0, skipped: 0, failed: 0, unsupported: 0, items: [] } })
    }

    const items: Array<{ id: number; name?: string; status: string; message?: string }> = []
    const supported = entities.filter((entity) => entity.type === 'business' || entity.type === 'cause' || entity.type === 'school')
    const unsupported = entities.length - supported.length

    // Keep a modest concurrency limit because each request renders a PDF and
    // writes its generated-material record through the existing QA pipeline.
    for (let start = 0; start < supported.length; start += 5) {
      const batch = supported.slice(start, start + 5)
      const outcomes = await Promise.all(batch.map(async (entity) => {
        try {
          const generationResponse = await fetchQaApi('/api/dashboard/v1/GeneratedMaterial/generate-for-account', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(entity.type === 'business'
              ? { businessAccountId: entity.id, templateId: materialId, regenerate: payload.mode === 'outdated' || payload.mode === 'all' }
              : { causeAccountId: entity.id, templateId: materialId, regenerate: payload.mode === 'outdated' || payload.mode === 'all' }),
          })
          const result = await parseQaResponse<Record<string, unknown>>(generationResponse, `Materials could not be generated for ${entity.name || entity.id}.`) || {}
          const generated = typeof result.generated === 'number' ? result.generated : 0
          const failed = typeof result.failed === 'number' ? result.failed : 0
          return { id: entity.id, name: entity.name, status: failed > 0 ? 'failed' : generated > 0 ? 'generated' : 'skipped' }
        } catch (error) {
          return { id: entity.id, name: entity.name, status: 'failed', message: error instanceof Error ? error.message : 'Generation failed.' }
        }
      }))
      items.push(...outcomes)
    }

    const generated = items.filter((item) => item.status === 'generated').length
    const skipped = items.filter((item) => item.status === 'skipped').length
    const failed = items.filter((item) => item.status === 'failed').length
    return NextResponse.json({
      ...payload,
      message: failed > 0
        ? `Targeting saved. Materials were generated for ${generated} accounts; ${failed} accounts need attention.`
        : `Targeting saved. Materials were generated for ${generated} accounts.`,
      generation: { generated, skipped, failed, unsupported, items },
    })
  } catch (error) {
    return qaRouteErrorResponse(error, 'Material reach could not be calculated.')
  }
}
