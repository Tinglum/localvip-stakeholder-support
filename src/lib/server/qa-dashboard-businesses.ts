import type { Business } from '@/lib/types/database'
import type {
  CrmBusiness,
  CrmBusinessDetailResponse,
  CrmBusinessListItem,
  CrmBusinessOrigin,
  QaBusinessDetail,
  QaBusinessListItem,
} from '@/lib/crm-api'
import { fetchQaApi } from '@/lib/auth/qa-api'
import {
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
  return 'The QA business API request failed.'
}

function resolveOrigin(localBusiness: Business | null, qaBusiness: QaBusinessListItem | QaBusinessDetail | null): CrmBusinessOrigin {
  if (localBusiness && qaBusiness) return 'hybrid'
  if (qaBusiness) return 'qa'
  return 'local'
}

export function findQaBusinessForLocal(
  localBusiness: Business,
  qaBusinesses: QaBusinessListItem[],
) {
  return findQaAccountForLocal(localBusiness, qaBusinesses)
}

export function mergeBusinessRecord(
  localBusiness: Business | null,
  qaBusiness: QaBusinessListItem | QaBusinessDetail | null,
): CrmBusiness | null {
  if (!localBusiness && !qaBusiness) return null

  const baseMetadata = isRecord(localBusiness?.metadata) ? localBusiness.metadata : {}
  const qaApi = buildQaAccountMetadata(qaBusiness)
  const qaFields = buildQaAccountFields(qaBusiness)
  const metadata = qaApi
    ? { ...baseMetadata, qaApi, qaAccountId: qaBusiness?.id ?? null, qaBusinessId: qaBusiness?.id ?? null }
    : baseMetadata

  return {
    ...qaFields,
    id: localBusiness?.id || `qa-${qaBusiness!.id}`,
    name: qaBusiness?.name || localBusiness!.name,
    website: localBusiness?.website || null,
    email: qaFields.owner_email || localBusiness?.email || null,
    phone: qaFields.owner_phone || localBusiness?.phone || null,
    address: qaFields.full_address || joinAddress([
      qaFields.address1,
      qaFields.address2,
      qaFields.city_name,
      qaFields.state,
      qaFields.zip_code,
      qaFields.country,
    ]) || localBusiness?.address || null,
    city_id: localBusiness?.city_id || null,
    category: localBusiness?.category || null,
    brand: localBusiness?.brand || 'localvip',
    stage: localBusiness?.stage || 'lead',
    owner_id: localBusiness?.owner_id || null,
    owner_user_id: localBusiness?.owner_user_id || null,
    source: localBusiness?.source || null,
    source_detail: localBusiness?.source_detail || null,
    campaign_id: localBusiness?.campaign_id || null,
    linked_cause_id: localBusiness?.linked_cause_id || null,
    linked_material_id: localBusiness?.linked_material_id || null,
    linked_qr_code_id: localBusiness?.linked_qr_code_id || null,
    logo_url: resolveImageUrl(qaFields.image_url) || localBusiness?.logo_url || null,
    cover_photo_url: localBusiness?.cover_photo_url || null,
    linked_qr_collection_id: localBusiness?.linked_qr_collection_id || null,
    duplicate_of: localBusiness?.duplicate_of || null,
    external_id: qaBusiness ? String(qaBusiness.id) : localBusiness?.external_id || null,
    public_description: qaFields.description || localBusiness?.public_description || null,
    avg_ticket: localBusiness?.avg_ticket || null,
    products_services: localBusiness?.products_services || null,
    activation_status: localBusiness?.activation_status || null,
    launch_phase: localBusiness?.launch_phase || null,
    status: localBusiness?.status || (qaBusiness?.active ? 'active' : 'inactive'),
    metadata,
    created_at: localBusiness?.created_at || qaBusiness?.createdDate || new Date(0).toISOString(),
    updated_at: localBusiness?.updated_at || qaBusiness?.createdDate || new Date(0).toISOString(),
  }
}

function toListItem(localBusiness: Business | null, qaBusiness: QaBusinessListItem | null): CrmBusinessListItem {
  const origin = resolveOrigin(localBusiness, qaBusiness)
  const qaBusinessId = qaBusiness?.id || getQaAccountIdFromLocal(localBusiness!) || null
  const detailHref = localBusiness?.id
    ? `/crm/businesses/${localBusiness.id}${qaBusinessId !== null ? `?qaId=${qaBusinessId}` : ''}`
    : `/crm/businesses/qa-${qaBusinessId}`

  return {
    rowId: localBusiness?.id || `qa-${qaBusinessId}`,
    detailHref,
    localBusinessId: localBusiness?.id || null,
    qaBusinessId,
    origin,
    name: qaBusiness?.name || localBusiness?.name || 'Unnamed Business',
    headline: qaBusiness?.headline || null,
    ownerName: qaBusiness?.ownerName || null,
    ownerEmail: qaBusiness?.ownerEmail || localBusiness?.email || null,
    city: qaBusiness?.city || null,
    owner_name: qaBusiness?.ownerName || null,
    owner_email: qaBusiness?.ownerEmail || localBusiness?.email || null,
    city_name: qaBusiness?.city || null,
    state: qaBusiness?.state || null,
    country: qaBusiness?.country || null,
    active: qaBusiness?.active ?? null,
    stage: localBusiness?.stage || null,
    status: localBusiness?.status || (qaBusiness ? (qaBusiness.active ? 'active' : 'inactive') : null),
    category: localBusiness?.category || null,
    source: localBusiness?.source || null,
    updatedAt: localBusiness?.updated_at || qaBusiness?.createdDate || null,
    createdAt: localBusiness?.created_at || qaBusiness?.createdDate || null,
    duplicateOf: localBusiness?.duplicate_of || null,
  }
}

export function buildCrmBusinessList(localBusinesses: Business[], qaBusinesses: QaBusinessListItem[]) {
  const index = createAccountIndex(localBusinesses)
  const matchedLocalIds = new Set<string>()
  const items: CrmBusinessListItem[] = qaBusinesses.map(qaBusiness => {
    const localBusiness = findLocalAccountForQa(qaBusiness, index)
    if (localBusiness) matchedLocalIds.add(localBusiness.id)
    return toListItem(localBusiness, qaBusiness)
  })

  for (const localBusiness of localBusinesses) {
    if (matchedLocalIds.has(localBusiness.id)) continue
    items.push(toListItem(localBusiness, null))
  }

  return items
}

export function buildCrmBusinessDetail(
  localBusiness: Business | null,
  qaBusiness: QaBusinessDetail | null,
  qaError: string | null = null,
): CrmBusinessDetailResponse | null {
  const business = mergeBusinessRecord(localBusiness, qaBusiness)
  if (!business) return null

  return {
    business,
    localBusinessId: localBusiness?.id || null,
    qaBusinessId: qaBusiness?.id || getQaAccountIdFromLocal(localBusiness!) || null,
    origin: resolveOrigin(localBusiness, qaBusiness),
    qaBusiness,
    qaError,
    readOnly: !localBusiness,
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `QA business API returned ${response.status}.`)
  }

  return response.json() as Promise<T>
}

export async function fetchQaBusinessList() {
  const response = await fetchQaApi('/api/dashboard/v1/Business')
  return parseJsonResponse<QaBusinessListItem[]>(response)
}

export async function fetchQaBusinessDetail(qaBusinessId: number) {
  const response = await fetchQaApi(`/api/dashboard/v1/Business/${qaBusinessId}`)
  return parseJsonResponse<QaBusinessDetail>(response)
}

export function parseQaBusinessId(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  return Number(trimmed)
}

export function qaBusinessRouteError(error: unknown) {
  return asErrorMessage(error)
}
