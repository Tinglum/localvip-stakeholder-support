import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { ensureBusinessStakeholderSetup } from '@/lib/server/stakeholder-lifecycle'
import { getStakeholderShell } from '@/lib/stakeholder-access'
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

  const { data: businessData, error: businessError } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single()

  if (businessError || !businessData) {
    return { error: NextResponse.json({ error: 'Business not found.' }, { status: 404 }) }
  }

  const business = businessData as Business

  let stakeholder: Stakeholder | null = null
  const { data: stakeholderData } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('business_id', business.id)
    .maybeSingle()

  stakeholder = (stakeholderData || null) as Stakeholder | null

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const context = await getMaterialsContext(params.id)
    if ('error' in context) return context.error

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
