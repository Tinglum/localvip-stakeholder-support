import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import {
  isPortalAdminSession,
  resolvePortalUserId,
  resolveScopedPortalBusinessId,
  userIsAssignedToAccount,
} from '@/lib/server/portal-business'

export const dynamic = 'force-dynamic'

// Templates for the business portal browser. A "template" is a dashboard
// material flagged IsTemplate (the team uploads a design and marks it as a
// template). The list endpoint omits FileUrl (data URLs can be MBs), so we
// fetch each flagged material's detail to get its design source path. The
// business then clicks Generate and its QR is stamped onto that design.
function positiveAccountId(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function numericList(value: unknown) {
  if (!Array.isArray(value)) return [] as number[]
  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isSafeInteger(entry) && entry > 0)
}

export async function GET(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    const requestedType = request.nextUrl.searchParams.get('entityType')
    const requestedAccountId = positiveAccountId(request.nextUrl.searchParams.get('accountId'))
    const entityType = requestedType === 'business' || requestedType === 'cause' ? requestedType : null
    if ((requestedType || request.nextUrl.searchParams.has('accountId')) && (!entityType || !requestedAccountId)) {
      return NextResponse.json({ error: 'A valid business or cause scope is required.' }, { status: 400 })
    }

    let scopedAccount: { entityType: 'business' | 'cause'; accountId: number } | null = null
    if (entityType && requestedAccountId) {
      if (entityType === 'business') {
        const resolved = await resolveScopedPortalBusinessId(session, requestedAccountId)
        if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
        scopedAccount = { entityType, accountId: resolved.businessId }
      } else if (isPortalAdminSession(session)) {
        scopedAccount = { entityType, accountId: requestedAccountId }
      } else {
        const userId = resolvePortalUserId(session)
        const assigned = userId != null && await userIsAssignedToAccount(userId, requestedAccountId, 'cause')
        if (!assigned) return NextResponse.json({ error: 'You do not have access to that cause.' }, { status: 403 })
        scopedAccount = { entityType, accountId: requestedAccountId }
      }
    } else if (session.profile.business_id) {
      const resolved = await resolveScopedPortalBusinessId(session, session.profile.business_id)
      if (resolved.ok) scopedAccount = { entityType: 'business', accountId: resolved.businessId }
    }

    const res = await fetchQaApi('/api/dashboard/v1/Material?isTemplate=true')
    const json = await parseQaResponse<unknown>(res, 'Could not load templates.')
    const raw = Array.isArray(json) ? json : ((json as { items?: unknown[] })?.items || [])

    const templates = await Promise.all(
      raw.map(async (t) => {
        const r = t as Record<string, unknown>
        const id = r.id
        const name = String(r.title ?? r.name ?? '')
        const hasFile = r.hasFile
        let sourcePath: string | null = null
        let outputFormat: string | null = null
        let metadata: Record<string, unknown> = {}
        // Pull the design source from the material detail (list omits FileUrl).
        if (id != null && hasFile !== false) {
          try {
            const dRes = await fetchQaApi(`/api/dashboard/v1/Material/${id}`)
            const d = (await parseQaResponse<Record<string, unknown>>(dRes, 'Could not load template.')) || {}
            sourcePath = (d.fileUrl ?? d.file_url ?? null) as string | null
            outputFormat = (d.mimeType ?? d.mime_type ?? null) as string | null
            metadata = parseMetadata(d.metadata)
          } catch {
            /* Falls through to sourcePath === null and is counted as unusable below. */
          }
        }
        return { id, name, sourcePath, outputFormat, metadata }
      }),
    )

    const visibleTemplates = templates.filter((template) => {
      const businessIds = numericList(template.metadata.allowed_business_account_ids)
      const causeIds = numericList(template.metadata.allowed_cause_account_ids)
      const restricted = businessIds.length > 0 || causeIds.length > 0
      if (!restricted) return true
      if (!scopedAccount) return isPortalAdminSession(session)
      return scopedAccount.entityType === 'business'
        ? businessIds.includes(scopedAccount.accountId)
        : causeIds.includes(scopedAccount.accountId)
    })

    // A template with no loadable design cannot be generated from, so it is not
    // offered. Silently dropping it meant an admin could flag a material as a
    // template, see nothing appear in the portal, and have no way to tell whether
    // the flag failed or the design was missing. Report the count so both sides
    // can be told the list is incomplete.
    const usable = visibleTemplates.filter((t) => t.sourcePath)
    const unusable = visibleTemplates
      .filter((t) => !t.sourcePath)
      .map((t) => ({ id: t.id, name: t.name }))
    if (unusable.length > 0) {
      console.warn(
        '[portal/templates] %d template(s) flagged IsTemplate have no loadable design and were hidden: %s',
        unusable.length,
        unusable.map((t) => `${t.name || 'Untitled'} (#${t.id})`).join(', '),
      )
    }
    return NextResponse.json({
      templates: usable.map(({ metadata: _metadata, ...template }) => template),
      unusable,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load templates.' }, { status: 400 })
  }
}
