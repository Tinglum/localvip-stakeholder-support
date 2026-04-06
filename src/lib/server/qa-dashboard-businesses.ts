import type { Business } from '@/lib/types/database'
import type {
  CrmBusinessDetailResponse,
  CrmBusinessListItem,
  CrmBusinessOrigin,
  QaBusinessDetail,
  QaBusinessListItem,
} from '@/lib/business-api'
import { fetchQaApi } from '@/lib/auth/qa-api'

function asErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'The QA business API request failed.'
}

function normalizeText(value: string | null | undefined) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeName(value: string | null | undefined) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, ' ').trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function getMetadataQaBusinessId(business: Business) {
  if (!isRecord(business.metadata)) return null

  const directId = business.metadata.qaBusinessId
  if (typeof directId === 'number') return directId
  if (typeof directId === 'string' && /^\d+$/.test(directId)) return Number(directId)

  const qaApi = business.metadata.qaApi
  if (isRecord(qaApi)) {
    const nestedId = qaApi.id
    if (typeof nestedId === 'number') return nestedId
    if (typeof nestedId === 'string' && /^\d+$/.test(nestedId)) return Number(nestedId)
  }

  return null
}

function getQaBusinessIdFromLocal(business: Business) {
  if (business.external_id && /^\d+$/.test(business.external_id.trim())) {
    return Number(business.external_id.trim())
  }

  return getMetadataQaBusinessId(business)
}

function createBusinessIndex(localBusinesses: Business[]) {
  const byExternalId = new Map<string, Business>()
  const byName = new Map<string, Business[]>()

  for (const business of localBusinesses) {
    const externalId = business.external_id?.trim()
    if (externalId) byExternalId.set(externalId, business)

    const metadataQaId = getMetadataQaBusinessId(business)
    if (metadataQaId !== null) byExternalId.set(String(metadataQaId), business)

    const normalizedName = normalizeName(business.name)
    if (!normalizedName) continue

    const entries = byName.get(normalizedName) || []
    entries.push(business)
    byName.set(normalizedName, entries)
  }

  return { byExternalId, byName }
}

function findLocalBusinessForQa(
  qaBusiness: QaBusinessListItem | QaBusinessDetail,
  index: ReturnType<typeof createBusinessIndex>,
) {
  const externalMatch = index.byExternalId.get(String(qaBusiness.id))
  if (externalMatch) return externalMatch

  const nameMatches = index.byName.get(normalizeName(qaBusiness.name)) || []
  if (nameMatches.length === 1) return nameMatches[0]

  const normalizedEmail = normalizeText(qaBusiness.ownerEmail)
  if (!normalizedEmail) return null

  const emailMatches = nameMatches.filter(item => normalizeText(item.email) === normalizedEmail)
  return emailMatches.length === 1 ? emailMatches[0] : null
}

export function findQaBusinessForLocal(
  localBusiness: Business,
  qaBusinesses: QaBusinessListItem[],
) {
  const qaId = getQaBusinessIdFromLocal(localBusiness)
  if (qaId !== null) {
    return qaBusinesses.find(item => item.id === qaId) || null
  }

  const normalizedName = normalizeName(localBusiness.name)
  const nameMatches = qaBusinesses.filter(item => normalizeName(item.name) === normalizedName)
  if (nameMatches.length === 1) return nameMatches[0]

  const normalizedEmail = normalizeText(localBusiness.email)
  if (!normalizedEmail) return null

  const emailMatches = nameMatches.filter(item => normalizeText(item.ownerEmail) === normalizedEmail)
  return emailMatches.length === 1 ? emailMatches[0] : null
}

function resolveOrigin(localBusiness: Business | null, qaBusiness: QaBusinessListItem | QaBusinessDetail | null): CrmBusinessOrigin {
  if (localBusiness && qaBusiness) return 'hybrid'
  if (qaBusiness) return 'qa'
  return 'local'
}

function joinAddress(parts: Array<string | null | undefined>) {
  const cleaned = parts.map(part => part?.trim()).filter(Boolean)
  return cleaned.length ? cleaned.join(', ') : null
}

function resolveImageUrl(imageUrl: string | null | undefined) {
  const trimmed = imageUrl?.trim()
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : null
}

function qaMetadata(qaBusiness: QaBusinessListItem | QaBusinessDetail | null) {
  if (!qaBusiness) return null

  const detailFields = 'description' in qaBusiness
    ? {
        description: qaBusiness.description,
        ownerPhone: qaBusiness.ownerPhone,
        address1: qaBusiness.address1,
        address2: qaBusiness.address2,
        zipCode: qaBusiness.zipCode,
        fullAddress: qaBusiness.fullAddress,
        imageUrl: qaBusiness.imageUrl,
        marketing: qaBusiness.marketing,
        txFee: qaBusiness.txFee,
        salesTax: qaBusiness.salesTax,
        taxId: qaBusiness.taxId,
        timeZone: qaBusiness.timeZone,
        hasStripeOnboarding: qaBusiness.hasStripeOnboarding,
      }
    : {}

  return {
    id: qaBusiness.id,
    name: qaBusiness.name,
    headline: qaBusiness.headline,
    ownerName: qaBusiness.ownerName,
    ownerEmail: qaBusiness.ownerEmail,
    city: qaBusiness.city,
    state: qaBusiness.state,
    country: qaBusiness.country,
    createdDate: qaBusiness.createdDate,
    active: qaBusiness.active,
    ...detailFields,
  }
}

export function mergeBusinessRecord(
  localBusiness: Business | null,
  qaBusiness: QaBusinessListItem | QaBusinessDetail | null,
): Business | null {
  if (!localBusiness && !qaBusiness) return null

  const baseMetadata = isRecord(localBusiness?.metadata) ? localBusiness.metadata : {}
  const qaApi = qaMetadata(qaBusiness)
  const metadata = qaApi
    ? { ...baseMetadata, qaApi, qaBusinessId: qaBusiness?.id ?? null }
    : baseMetadata

  const qaDescription = qaBusiness && 'description' in qaBusiness ? qaBusiness.description : null
  const qaPhone = qaBusiness && 'ownerPhone' in qaBusiness ? qaBusiness.ownerPhone : null
  const qaAddress = qaBusiness && 'fullAddress' in qaBusiness
    ? qaBusiness.fullAddress || joinAddress([qaBusiness.address1, qaBusiness.address2, qaBusiness.city, qaBusiness.state, qaBusiness.zipCode, qaBusiness.country])
    : null

  return {
    id: localBusiness?.id || `qa-${qaBusiness!.id}`,
    name: qaBusiness?.name || localBusiness!.name,
    website: localBusiness?.website || null,
    email: qaBusiness?.ownerEmail || localBusiness?.email || null,
    phone: qaPhone || localBusiness?.phone || null,
    address: qaAddress || localBusiness?.address || null,
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
    logo_url: localBusiness?.logo_url || (qaBusiness && 'imageUrl' in qaBusiness ? resolveImageUrl(qaBusiness.imageUrl) : null),
    cover_photo_url: localBusiness?.cover_photo_url || null,
    linked_qr_collection_id: localBusiness?.linked_qr_collection_id || null,
    duplicate_of: localBusiness?.duplicate_of || null,
    external_id: qaBusiness ? String(qaBusiness.id) : localBusiness?.external_id || null,
    public_description: qaDescription || localBusiness?.public_description || null,
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
  const qaBusinessId = qaBusiness?.id || getQaBusinessIdFromLocal(localBusiness!) || null
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
  const index = createBusinessIndex(localBusinesses)
  const matchedLocalIds = new Set<string>()
  const items: CrmBusinessListItem[] = qaBusinesses.map(qaBusiness => {
    const localBusiness = findLocalBusinessForQa(qaBusiness, index)
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
    qaBusinessId: qaBusiness?.id || getQaBusinessIdFromLocal(localBusiness!) || null,
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
