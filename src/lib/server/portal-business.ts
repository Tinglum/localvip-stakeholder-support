import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import type { ResolvedAuthSession } from '@/lib/server/auth-session'

// Resolve the business account id for the current portal session. A business
// owner browsing the portal (or an admin viewing-as a business) is mapped to
// their Business account via the QA backend's by-user lookup. Returns null when
// the session doesn't map to a business.
export async function resolvePortalBusinessId(session: ResolvedAuthSession): Promise<number | null> {
  const candidate =
    session.viewingAs?.targetUserId ?? (session.qaClaims?.sub != null ? Number(session.qaClaims.sub) : null)
  const userId = candidate != null && Number.isFinite(Number(candidate)) ? Number(candidate) : null
  if (!userId) return null
  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Business/by-user/${userId}`)
    const byUser = await parseQaResponse<{ accountId?: number }>(res, 'Could not resolve business.')
    return byUser?.accountId != null ? Number(byUser.accountId) : null
  } catch {
    return null
  }
}
