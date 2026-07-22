import type { Cause } from '@/lib/types/database'
import type {
  CrmCause,
  CrmCauseDetailResponse,
  CrmCauseListItem,
  CrmCauseOrigin,
  QaCreateCauseInput,
  QaCauseDetail,
  QaCauseListItem,
  QaRegistrationResult,
} from '@/lib/crm-api'
import { QaApiError, fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import {
  buildQaCauseLogoUrl,
  buildQaAccountFields,
  buildQaAccountMetadata,
  createAccountIndex,
  findLocalAccountForQa,
  findQaAccountForLocal,
  getQaAccountIdFromLocal,
  isRecord,
  joinAddress,
  resolveImageUrl,
} from '@/lib/server/qa-dashboard-shared'

function asErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'The QA nonprofit API request failed.'
}

function resolveOrigin(localCause: Cause | null, qaCause: QaCauseListItem | QaCauseDetail | null): CrmCauseOrigin {
  if (localCause && qaCause) return 'hybrid'
  if (qaCause) return 'qa'
  return 'local'
}

function resolveCauseType(value: string | null | undefined): Cause['type'] {
  return value === 'school'
    || value === 'nonprofit'
    || value === 'church'
    || value === 'community'
    || value === 'other'
    ? value
    : 'nonprofit'
}

export function findQaCauseForLocal(
  localCause: Cause,
  qaCauses: QaCauseListItem[],
) {
  return findQaAccountForLocal(localCause, qaCauses)
}

export function mergeCauseRecord(
  localCause: Cause | null,
  qaCause: QaCauseListItem | QaCauseDetail | null,
): CrmCause | null {
  if (!localCause && !qaCause) return null

  const baseMetadata = isRecord(localCause?.metadata) ? localCause.metadata : {}
  const qaApi = buildQaAccountMetadata(qaCause)
  const qaFields = buildQaAccountFields(qaCause)

  // CRM pipeline annotations now live on the QA Account (detail response).
  const qaCrm = (qaCause && 'crmStage' in qaCause ? qaCause : null) as QaCauseDetail | null
  const crmIdToString = (value: number | null | undefined) =>
    value === null || value === undefined ? null : String(value)
  const metadata = qaApi
    ? { ...baseMetadata, qaApi, qaAccountId: qaCause?.id ?? null, qaCauseId: qaCause?.id ?? null }
    : baseMetadata

  return {
    ...qaFields,
    id: localCause?.id || `qa-${qaCause!.id}`,
    name: qaCause?.name || localCause!.name,
    type: localCause?.type || resolveCauseType(qaCause?.category),
    organization_id: localCause?.organization_id || null,
    website: localCause?.website || null,
    email: qaFields.owner_email || localCause?.email || null,
    phone: qaFields.owner_phone || localCause?.phone || null,
    address: qaFields.full_address || joinAddress([
      qaFields.address1,
      qaFields.address2,
      qaFields.city_name,
      qaFields.state,
      qaFields.zip_code,
      qaFields.country,
    ]) || localCause?.address || null,
    city_id: localCause?.city_id || null,
    brand: localCause?.brand || 'localvip',
    stage: (qaCrm?.crmStage as Cause['stage']) || localCause?.stage || 'lead',
    owner_id: localCause?.owner_id || null,
    source: localCause?.source || null,
    source_detail: localCause?.source_detail || null,
    campaign_id: crmIdToString(qaCrm?.crmCampaignId) || localCause?.campaign_id || null,
    logo_url: buildQaCauseLogoUrl(qaCause) || resolveImageUrl(qaFields.image_url) || localCause?.logo_url || null,
    cover_photo_url: localCause?.cover_photo_url || null,
    duplicate_of: crmIdToString(qaCrm?.duplicateOfAccountId) || localCause?.duplicate_of || null,
    external_id: qaCause ? String(qaCause.id) : localCause?.external_id || null,
    status: (qaCrm?.crmStatus as Cause['status']) || localCause?.status || (qaCause?.active ? 'active' : 'inactive'),
    // The cause's referral code (now returned by the Nonprofit detail) — used by
    // the CRM Materials & QR modal as the join/connection code.
    referral_code: (localCause as { referral_code?: string | null } | null)?.referral_code
      || (qaCause && 'referralCode' in qaCause ? (qaCause as { referralCode?: string | null }).referralCode : null)
      || null,
    metadata,
    created_at: localCause?.created_at || qaCause?.createdDate || new Date(0).toISOString(),
    updated_at: localCause?.updated_at || qaCause?.createdDate || new Date(0).toISOString(),
  }
}

function toListItem(localCause: Cause | null, qaCause: QaCauseListItem | null): CrmCauseListItem {
  const origin = resolveOrigin(localCause, qaCause)
  const qaCauseId = qaCause?.id || getQaAccountIdFromLocal(localCause!) || null
  const detailHref = localCause?.id
    ? `/crm/causes/${localCause.id}${qaCauseId !== null ? `?qaId=${qaCauseId}` : ''}`
    : `/crm/causes/qa-${qaCauseId}`

  return {
    rowId: localCause?.id || `qa-${qaCauseId}`,
    detailHref,
    localCauseId: localCause?.id || null,
    qaCauseId,
    origin,
    name: qaCause?.name || localCause?.name || 'Unnamed Cause',
    type: localCause?.type || resolveCauseType(qaCause?.category),
    headline: qaCause?.headline || null,
    ownerName: qaCause?.ownerName || null,
    ownerEmail: qaCause?.ownerEmail || localCause?.email || null,
    city: qaCause?.city || null,
    owner_name: qaCause?.ownerName || null,
    owner_email: qaCause?.ownerEmail || localCause?.email || null,
    city_name: qaCause?.city || null,
    state: qaCause?.state || null,
    country: qaCause?.country || null,
    active: qaCause?.active ?? null,
    stage: (qaCause?.crmStage as Cause['stage']) || localCause?.stage || null,
    status: (qaCause?.crmStatus as Cause['status']) || localCause?.status || (qaCause ? (qaCause.active ? 'active' : 'inactive') : null),
    brand: localCause?.brand || 'localvip',
    source: localCause?.source || null,
    updatedAt: localCause?.updated_at || qaCause?.createdDate || null,
    createdAt: localCause?.created_at || qaCause?.createdDate || null,
    duplicateOf: qaCause?.duplicateOfAccountId != null
      ? String(qaCause.duplicateOfAccountId)
      : localCause?.duplicate_of || null,
  }
}

export function buildCrmCauseList(localCauses: Cause[], qaCauses: QaCauseListItem[]) {
  const index = createAccountIndex(localCauses)
  const matchedLocalIds = new Set<string>()
  const items: CrmCauseListItem[] = qaCauses.map(qaCause => {
    const localCause = findLocalAccountForQa(qaCause, index)
    if (localCause) matchedLocalIds.add(localCause.id)
    return toListItem(localCause, qaCause)
  })

  for (const localCause of localCauses) {
    if (matchedLocalIds.has(localCause.id)) continue
    items.push(toListItem(localCause, null))
  }

  return items
}

export function buildCrmCauseDetail(
  localCause: Cause | null,
  qaCause: QaCauseDetail | null,
  qaError: string | null = null,
): CrmCauseDetailResponse | null {
  const cause = mergeCauseRecord(localCause, qaCause)
  if (!cause) return null

  // All CRM features (stakeholders, codes, tasks, notes, materials, onboarding)
  // now live on the QA backend. As long as we have a QA cause id, the dashboard
  // can write to those tables — there is no longer a separate "local" record
  // that needs importing. Treat the QA id as the canonical id when no Supabase
  // row exists.
  const qaCauseId = qaCause?.id || getQaAccountIdFromLocal(localCause!) || null
  const effectiveLocalId = localCause?.id || (qaCauseId !== null ? String(qaCauseId) : null)
  const readOnly = !localCause && !qaCauseId

  return {
    cause,
    localCauseId: effectiveLocalId,
    qaCauseId,
    origin: resolveOrigin(localCause, qaCause),
    qaCause,
    qaError,
    readOnly,
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `QA nonprofit API returned ${response.status}.`)
  }

  return response.json() as Promise<T>
}

export async function fetchQaCauseList() {
  const response = await fetchQaApi('/api/dashboard/v1/Nonprofit')
  return parseJsonResponse<QaCauseListItem[]>(response)
}

export async function fetchQaCauseDetail(qaCauseId: number) {
  const response = await fetchQaApi(`/api/dashboard/v1/Nonprofit/${qaCauseId}`)
  return parseJsonResponse<QaCauseDetail>(response)
}

export async function createQaCause(payload: QaCreateCauseInput) {
  const response = await fetchQaApi('/api/dashboard/v1/Nonprofit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return parseQaResponse<QaRegistrationResult>(response, 'The QA cause could not be created.')
    .then(result => {
      if (!result) throw new QaApiError('The QA cause API returned an empty response.', response.status)
      return result
    })
}

export function qaCauseCreateError(error: unknown) {
  if (error instanceof QaApiError) {
    return { message: error.message, status: error.status }
  }
  return { message: asErrorMessage(error), status: 500 }
}

function shouldRetryLogoUpload(error: unknown) {
  return error instanceof QaApiError && (error.status === 404 || error.status === 405 || error.status === 409)
}

export async function uploadQaCauseLogo(
  qaCauseId: number,
  logoImage: File,
  method: 'POST' | 'PUT' = 'PUT',
) {
  const formData = new FormData()
  formData.append('logoImage', logoImage, logoImage.name || `nonprofit-${qaCauseId}-logo`)

  const response = await fetchQaApi(`/api/dashboard/v1/Nonprofit/${qaCauseId}/upload-logo`, {
    method,
    body: formData,
  })

  await parseQaResponse(response, 'The QA nonprofit logo upload failed.')
  return fetchQaCauseDetail(qaCauseId)
}

export async function syncQaCauseLogo(
  qaCauseId: number,
  logoImage: File,
  preferredMethod: 'POST' | 'PUT',
) {
  try {
    return await uploadQaCauseLogo(qaCauseId, logoImage, preferredMethod)
  } catch (error) {
    const fallbackMethod = preferredMethod === 'POST' ? 'PUT' : 'POST'
    if (!shouldRetryLogoUpload(error)) throw error
    return uploadQaCauseLogo(qaCauseId, logoImage, fallbackMethod)
  }
}

export function parseQaCauseId(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  return Number(trimmed)
}

export function qaCauseRouteError(error: unknown) {
  return asErrorMessage(error)
}
