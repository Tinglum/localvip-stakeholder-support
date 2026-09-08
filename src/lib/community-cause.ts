import type { Cause, Profile } from '@/lib/types/database'

export function getCauseQaAccountId(cause: Cause | null): string | null {
  if (!cause) return null
  if (cause.external_id && /^\d+$/.test(cause.external_id.trim())) return cause.external_id.trim()
  const metadata = (cause.metadata as Record<string, unknown> | null) || {}
  const candidate = metadata.qaId ?? metadata.qaAccountId ?? metadata.qaCauseId ?? metadata.qa_account_id
  if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate)
  if (typeof candidate === 'string' && /^\d+$/.test(candidate.trim())) return candidate.trim()
  return null
}

export function resolveCommunityCause(profile: Profile, causes: Cause[]): Cause | null {
  const metadata = (profile.metadata as Record<string, unknown> | null) || {}
  const claims = metadata.qa_claims && typeof metadata.qa_claims === 'object'
    ? metadata.qa_claims as Record<string, unknown>
    : {}
  const selectedCauseId = metadata.view_as_cause_account_id
  const selectedOwnerId = metadata.view_as_target_user_id
  const signedInOwnerId = metadata.qa_subject ?? metadata.qa_user_id ?? claims.sub

  return causes.find((cause) => selectedCauseId != null && getCauseQaAccountId(cause) === String(selectedCauseId))
    || causes.find((cause) => selectedOwnerId != null && String((cause.metadata as Record<string, unknown> | null)?.ownerUserId || '') === String(selectedOwnerId))
    || causes.find((cause) => signedInOwnerId != null && String((cause.metadata as Record<string, unknown> | null)?.ownerUserId || '') === String(signedInOwnerId))
    || causes.find((cause) => cause.owner_id === profile.id || (!!profile.organization_id && cause.organization_id === profile.organization_id))
    || null
}
