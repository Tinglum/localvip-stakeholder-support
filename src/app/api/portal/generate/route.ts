import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { generateMaterialsForStakeholder } from '@/lib/server/material-engine'
import { resolvePortalBusinessId } from '@/lib/server/portal-business'
import type { Stakeholder } from '@/lib/types/database'

export async function POST(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { profile } = session
  const supabase = createServiceClient()

  const body = await request.json()
  let { stakeholderId, templateId, businessId } = body as { stakeholderId?: string; templateId?: string; businessId?: string }
  const { qrContent, qrCodeId, qrImageBase64, qrPurpose } = body as {
    qrContent?: string
    qrCodeId?: number | string
    qrImageBase64?: string
    qrPurpose?: string
  }

  // For the QA path the business is resolved from the session below, so only the
  // templateId is required up front.
  if (!templateId) {
    return NextResponse.json({ error: 'templateId is required.' }, { status: 400 })
  }

  if (session.source === 'qa') {
    // Stakeholders were removed from the backend — generate one template directly
    // against the business (or cause) account. The GeneratedMaterial endpoint
    // embeds the business QR and renders the file.
    const causeId = (body as { causeId?: string }).causeId
    if (businessId && causeId) {
      return NextResponse.json({ error: 'Choose either a business or cause account.' }, { status: 400 })
    }

    // A portal caller may only generate for the business resolved from its
    // authenticated session. Never forward a caller-supplied account id without
    // binding it to that scope.
    if (businessId) {
      const requestedBusinessId = Number(businessId)
      const resolvedBusinessId = await resolvePortalBusinessId(session)
      if (!Number.isFinite(requestedBusinessId) || resolvedBusinessId !== requestedBusinessId) {
        return NextResponse.json({ error: 'You do not have access to that business.' }, { status: 403 })
      }
    }

    // Cause generation from this generic portal endpoint is currently an
    // operator workflow. Cause self-service needs a signed cause-scope resolver
    // before it can safely accept a cause id from the browser.
    const causeAccountId = causeId == null ? null : Number(causeId)
    if (causeId != null && (!Number.isInteger(causeAccountId) || (causeAccountId ?? 0) <= 0)) {
      return NextResponse.json({ error: 'A valid cause account is required.' }, { status: 400 })
    }
    const qaRoles = session.qaClaims?.roles.map((role) => role.toLowerCase()) ?? []
    const isCauseMaterialOperator =
      ['admin', 'super_admin', 'internal_admin'].includes(profile.role)
      || qaRoles.some((role) => role.includes('sysadmin') || role.includes('employee'))
    if (causeId && !isCauseMaterialOperator) {
      return NextResponse.json({ error: 'You do not have access to that cause.' }, { status: 403 })
    }
    // Self-serve from the business portal: resolve the business from the session
    // when no explicit id was passed (the owner just clicks Generate on a template).
    if (!businessId && !causeId) {
      // Shared resolver — respects the business this portal session was launched
      // from rather than re-deriving it from the user (which always picks the same
      // one for an owner of several businesses).
      const resolvedId = await resolvePortalBusinessId(session)
      if (resolvedId != null) businessId = String(resolvedId)
    }
    if (!businessId && !causeId) {
      return NextResponse.json({ error: 'Could not resolve your business account.' }, { status: 400 })
    }
    try {
      const payload: Record<string, unknown> = { templateId: Number(templateId) }
      if (businessId) payload.businessAccountId = Number(businessId)
      if (causeAccountId != null) payload.causeAccountId = causeAccountId
      // Optional explicit QR choice (the business picked a saved QR or made a new
      // one). Otherwise the backend falls back to the owner's default join QR.
      if (typeof qrContent === 'string' && qrContent.trim()) payload.qrContent = qrContent.trim()
      if (qrCodeId != null && String(qrCodeId).trim()) payload.qrCodeId = Number(qrCodeId)
      // A client-rendered styled QR (with the business logo) to stamp as-is.
      if (typeof qrImageBase64 === 'string' && qrImageBase64.trim()) payload.qrImageBase64 = qrImageBase64
      payload.metadata = {
        business_id: businessId || null,
        cause_id: causeId || null,
        qr_code_id: qrCodeId == null ? null : String(qrCodeId),
        qr_purpose: typeof qrPurpose === 'string' ? qrPurpose : null,
        qr_target_url: typeof qrContent === 'string' ? qrContent.trim() : null,
      }
      const res = await fetchQaApi('/api/dashboard/v1/GeneratedMaterial', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await parseQaResponse<unknown>(res, 'Could not generate material.')
      return NextResponse.json({ success: true, result })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Could not generate material.' },
        { status: 400 },
      )
    }
  }

  if (!stakeholderId && businessId) {
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
    }

    const ensuredStakeholder = await import('@/lib/server/stakeholder-lifecycle')
      .then((module) => module.ensureBusinessStakeholderSetup(supabase, business as any, profile.id))
      .catch(() => null)

    stakeholderId = ensuredStakeholder?.id || undefined
  }

  if (!stakeholderId) {
    return NextResponse.json({ error: 'A stakeholder could not be prepared for this business.' }, { status: 400 })
  }

  // Verify the user owns this stakeholder
  const { data: stakeholder } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('id', stakeholderId)
    .single<Stakeholder>()

  if (!stakeholder) {
    return NextResponse.json({ error: 'Stakeholder not found.' }, { status: 404 })
  }

  const isOwner =
    stakeholder.owner_user_id === profile.id ||
    stakeholder.profile_id === profile.id

  if (!isOwner) {
    return NextResponse.json({ error: 'You do not have access to this stakeholder.' }, { status: 403 })
  }

  // Verify the template is a selfserve template
  const { data: template } = await (supabase.from('material_templates') as any)
    .select('tiers, is_active')
    .eq('id', templateId)
    .single() as { data: { tiers: string[]; is_active: boolean } | null }

  if (!template || !template.is_active || !template.tiers.includes('selfserve')) {
    return NextResponse.json({ error: 'Template not available for self-serve.' }, { status: 400 })
  }

  try {
    const result = await generateMaterialsForStakeholder(supabase, stakeholderId, profile.id, {
      templateId,
    })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not generate material.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
