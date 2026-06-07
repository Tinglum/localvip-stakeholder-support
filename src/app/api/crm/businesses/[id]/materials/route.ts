import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { ensureBusinessStakeholderSetup } from '@/lib/server/stakeholder-lifecycle'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import { ensureQaBusinessStakeholderContext } from '@/lib/server/qa-business-stakeholders'
import { getQaAccountIdFromLocal } from '@/lib/server/qa-dashboard-shared'
import type { Business, Stakeholder } from '@/lib/types/database'

export const runtime = 'nodejs'
export const maxDuration = 120

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('save_codes'),
    referralCode: z.string().trim().min(2, 'Referral code is required.'),
    connectionCode: z.string().trim().min(2, 'Connection code is required.'),
  }),
  z.object({
    action: z.literal('list_generation_templates'),
  }),
  z.object({
    action: z.literal('generate_template'),
    templateId: z.string().uuid('A template is required.'),
  }),
  z.object({
    action: z.literal('generate_materials'),
  }),
  z.object({
    action: z.literal('regenerate_all'),
  }),
  z.object({
    action: z.literal('restore_version'),
    generatedMaterialId: z.string().uuid('Generated material ID required.'),
  }),
])

function extractRouteError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    if ('message' in error) return String((error as { message?: unknown }).message || '')
    if ('details' in error) return String((error as { details?: unknown }).details || '')
    if ('code' in error) return `Database error (code: ${String((error as { code?: unknown }).code || '')})`
  }
  if (typeof error === 'string') return error
  return 'The material action could not be completed.'
}

async function getMaterialsContext(businessId: string) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }

  const { profile, source: authSource, localProfileId } = session
  const supabase = createServiceClient()

  const shell = getStakeholderShell(profile)
  if (!['admin', 'field', 'launch_partner'].includes(shell)) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) }
  }

  const [bizRes, stkRes] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', businessId).single(),
    supabase.from('stakeholders').select('*').eq('business_id', businessId).maybeSingle(),
  ])

  const businessData = (bizRes as any).data
  if ((bizRes as any).error || !businessData) {
    return { error: NextResponse.json({ error: 'Business not found.' }, { status: 404 }) }
  }

  const business = businessData as Business
  let stakeholder = ((stkRes as any).data || null) as Stakeholder | null

  if (!stakeholder) {
    try {
      stakeholder = await ensureBusinessStakeholderSetup(supabase, business, localProfileId)
    } catch (setupError) {
      const msg = extractRouteError(setupError)
      const debugInfo = `[auth=${authSource} profile=${(localProfileId || 'none').slice(0, 8)} email=${profile.email} role=${profile.role} shell=${shell} biz=${business.id.slice(0, 8)}]`
      console.error('[business-materials] stakeholder setup failed', msg, debugInfo)
      return { error: NextResponse.json({ error: `${msg} ${debugInfo}` }, { status: 500 }) }
    }
  }

  if (!stakeholder) {
    return { error: NextResponse.json({ error: 'Business stakeholder not found.' }, { status: 500 }) }
  }

  return { supabase, business, stakeholder, localProfileId }
}

async function handleQaMaterialsAction(
  businessId: string,
  action: z.infer<typeof actionSchema>,
): Promise<NextResponse> {
  let stakeholderId: string | null = null
  try {
    const context = await ensureQaBusinessStakeholderContext(businessId)
    stakeholderId = String(context.stakeholder.id)
  } catch { /* fall through */ }

  try {
    if (action.action === 'save_codes') {
      if (!stakeholderId) return NextResponse.json({ error: 'No stakeholder for this business yet.' }, { status: 404 })
      const res = await fetchQaApi('/api/dashboard/v1/StakeholderCode', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stakeholderId, referralCode: action.referralCode, connectionCode: action.connectionCode }),
      })
      const result = await parseQaResponse<unknown>(res, 'Failed to save codes.')
      return NextResponse.json({ success: true, result })
    }
    if (action.action === 'list_generation_templates') {
      const res = await fetchQaApi('/api/dashboard/v1/MaterialTemplate')
      const json = await parseQaResponse<unknown>(res, 'Failed to list templates.')
      const items = Array.isArray(json) ? json
        : (json && typeof json === 'object' && Array.isArray((json as Record<string, unknown>).items))
          ? (json as Record<string, unknown>).items as unknown[]
          : []
      const templates = items.map((t) => {
        const r = t as Record<string, unknown>
        return {
          id: String(r.id),
          name: String(r.name || ''),
          templateType: r.templateType ?? r.template_type ?? null,
          outputFormat: r.outputFormat ?? r.output_format ?? null,
          libraryFolder: r.libraryFolder ?? r.library_folder ?? null,
        }
      })
      return NextResponse.json({ success: true, templates })
    }
    if (action.action === 'generate_template' || action.action === 'generate_materials') {
      if (!stakeholderId) return NextResponse.json({ error: 'No stakeholder for this business yet.' }, { status: 404 })
      const payload: Record<string, unknown> = { stakeholderId }
      if (action.action === 'generate_template') payload.templateId = action.templateId
      const res = await fetchQaApi('/api/dashboard/v1/GeneratedMaterial', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      })
      const result = await parseQaResponse<unknown>(res, 'Failed to generate material.')
      return NextResponse.json({ success: true, result })
    }
    if (action.action === 'regenerate_all') {
      if (!stakeholderId) return NextResponse.json({ error: 'No stakeholder for this business yet.' }, { status: 404 })
      const listRes = await fetchQaApi(`/api/dashboard/v1/GeneratedMaterial?stakeholderId=${encodeURIComponent(stakeholderId)}`)
      const listJson = await parseQaResponse<unknown>(listRes, 'Failed to list materials.')
      const list = Array.isArray(listJson) ? listJson
        : (listJson && typeof listJson === 'object' && Array.isArray((listJson as Record<string, unknown>).items))
          ? (listJson as Record<string, unknown>).items as unknown[]
          : []
      const ids = list.map((m) => String((m as Record<string, unknown>).id))
      const results = await Promise.allSettled(ids.map((id) =>
        fetchQaApi(`/api/dashboard/v1/GeneratedMaterial/${encodeURIComponent(id)}/regenerate`, { method: 'POST' }),
      ))
      const success = results.filter((r) => r.status === 'fulfilled').length
      return NextResponse.json({ success: true, result: { regenerated: success, total: ids.length } })
    }
    if (action.action === 'restore_version') {
      const versionsRes = await fetchQaApi(`/api/dashboard/v1/GeneratedMaterial/${encodeURIComponent(action.generatedMaterialId)}/versions`)
      const versionsJson = await parseQaResponse<unknown>(versionsRes, 'Failed to list versions.')
      const versions = Array.isArray(versionsJson) ? versionsJson
        : (versionsJson && typeof versionsJson === 'object' && Array.isArray((versionsJson as Record<string, unknown>).items))
          ? (versionsJson as Record<string, unknown>).items as Array<{ id: number | string }>
          : []
      const latest = versions[0]
      if (!latest) return NextResponse.json({ error: 'No earlier version to restore.' }, { status: 404 })
      const res = await fetchQaApi(
        `/api/dashboard/v1/GeneratedMaterial/${encodeURIComponent(action.generatedMaterialId)}/restore?versionId=${encodeURIComponent(String(latest.id))}`,
        { method: 'POST' },
      )
      const result = await parseQaResponse<unknown>(res, 'Failed to restore.')
      return NextResponse.json({ success: true, result })
    }
    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'QA action failed.' }, { status: 500 })
  }
}

async function resolveQaBusinessRouteId(businessId: string) {
  if (/^\d+$/.test(businessId)) return businessId

  const supabase = createServiceClient()
  const { data: business } = await supabase
    .from('businesses')
    .select('external_id, metadata')
    .eq('id', businessId)
    .maybeSingle()

  const qaBusinessId = business ? getQaAccountIdFromLocal(business as { external_id: string | null; metadata: Record<string, unknown> | null }) : null
  if (qaBusinessId === null) {
    throw new Error('This business is not linked to a QA business yet.')
  }

  return String(qaBusinessId)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid action.' }, { status: 400 })
    }

    const probeSession = await getAuthenticatedSession()
    if (probeSession?.source === 'qa') {
      const qaBusinessId = await resolveQaBusinessRouteId(params.id)
      return handleQaMaterialsAction(qaBusinessId, parsed.data)
    }

    const context = await getMaterialsContext(params.id)
    if ('error' in context) return context.error

    const materialEngine = await import('@/lib/server/material-engine')

    if (parsed.data.action === 'save_codes') {
      const result = await materialEngine.upsertStakeholderCodes(
        context.supabase,
        context.stakeholder.id,
        {
          referralCode: parsed.data.referralCode,
          connectionCode: parsed.data.connectionCode,
        },
      )

      return NextResponse.json({ success: true, result })
    }

    if (parsed.data.action === 'list_generation_templates') {
      const templates = await materialEngine.listAutoGenerationTemplatesForStakeholder(
        context.supabase,
        context.stakeholder.id,
        { fastMode: true },
      )

      return NextResponse.json({
        success: true,
        templates: templates.map((template) => ({
          id: template.id,
          name: template.name,
          templateType: template.template_type,
          outputFormat: template.output_format,
          libraryFolder: template.library_folder,
        })),
      })
    }

    if (parsed.data.action === 'generate_template') {
      const result = await materialEngine.generateMaterialsForStakeholder(
        context.supabase,
        context.stakeholder.id,
        context.localProfileId,
        {
          templateId: parsed.data.templateId,
          fastMode: true,
        },
      )

      return NextResponse.json({ success: true, result })
    }

    if (parsed.data.action === 'generate_materials') {
      const result = await materialEngine.generateMaterialsForStakeholder(
        context.supabase,
        context.stakeholder.id,
        context.localProfileId,
        { fastMode: true },
      )

      return NextResponse.json({ success: true, result })
    }

    if (parsed.data.action === 'regenerate_all') {
      const result = await materialEngine.regenerateAllForStakeholder(
        context.supabase,
        context.stakeholder.id,
        context.localProfileId,
        { fastMode: true },
      )

      return NextResponse.json({ success: true, result })
    }

    if (parsed.data.action === 'restore_version') {
      const result = await materialEngine.restoreGeneratedMaterialVersion(
        context.supabase,
        parsed.data.generatedMaterialId,
      )

      return NextResponse.json({ success: true, result })
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 })
  } catch (error) {
    console.error('[business-materials] Error:', error)
    const message = extractRouteError(error)
    const status = /already in use/i.test(message) ? 409
      : /not found/i.test(message) ? 404
      : /forbidden|unauthorized/i.test(message) ? 403
      : 400
    return NextResponse.json({ error: message }, { status })
  }
}
