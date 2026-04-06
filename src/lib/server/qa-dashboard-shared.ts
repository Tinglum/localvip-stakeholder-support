import type { QaAccountFields, QaDashboardAccountDetail, QaDashboardAccountSummary } from '@/lib/crm-api'

export interface LocalQaAccountRecord {
  id: string
  name: string
  external_id: string | null
  email?: string | null
  metadata: Record<string, unknown> | null
}

function emptyQaAccountFields(): QaAccountFields {
  return {
    qa_account_id: null,
    qa_account_type: null,
    qa_business_type: null,
    headline: null,
    description: null,
    owner_name: null,
    owner_email: null,
    owner_phone: null,
    address1: null,
    address2: null,
    city_name: null,
    state: null,
    country: null,
    zip_code: null,
    full_address: null,
    latitude: null,
    longitude: null,
    distance_meter: null,
    distance_kilometer: null,
    distance_feet: null,
    distance_mile: null,
    active: null,
    image_url: null,
    sales_tax: null,
    tax_id: null,
    marketing: null,
    tx_fee: null,
    time_zone: null,
    twilio_number: null,
    twilio_welcome_message: null,
    is_deleted: null,
    stripe_onboarding_complete: null,
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeText(value: string | null | undefined) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function normalizeName(value: string | null | undefined) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, ' ').trim()
}

export function getMetadataQaAccountId(record: Pick<LocalQaAccountRecord, 'metadata'>) {
  if (!isRecord(record.metadata)) return null

  const directId = record.metadata.qaAccountId
  if (typeof directId === 'number') return directId
  if (typeof directId === 'string' && /^\d+$/.test(directId)) return Number(directId)

  const businessId = record.metadata.qaBusinessId
  if (typeof businessId === 'number') return businessId
  if (typeof businessId === 'string' && /^\d+$/.test(businessId)) return Number(businessId)

  const causeId = record.metadata.qaCauseId
  if (typeof causeId === 'number') return causeId
  if (typeof causeId === 'string' && /^\d+$/.test(causeId)) return Number(causeId)

  const qaApi = record.metadata.qaApi
  if (isRecord(qaApi)) {
    const nestedId = qaApi.id
    if (typeof nestedId === 'number') return nestedId
    if (typeof nestedId === 'string' && /^\d+$/.test(nestedId)) return Number(nestedId)
  }

  return null
}

export function getQaAccountIdFromLocal(record: Pick<LocalQaAccountRecord, 'external_id' | 'metadata'>) {
  if (record.external_id && /^\d+$/.test(record.external_id.trim())) {
    return Number(record.external_id.trim())
  }

  return getMetadataQaAccountId(record)
}

export function createAccountIndex<T extends LocalQaAccountRecord>(localRecords: T[]) {
  const byExternalId = new Map<string, T>()
  const byName = new Map<string, T[]>()

  for (const record of localRecords) {
    const externalId = record.external_id?.trim()
    if (externalId) byExternalId.set(externalId, record)

    const metadataQaId = getMetadataQaAccountId(record)
    if (metadataQaId !== null) byExternalId.set(String(metadataQaId), record)

    const normalized = normalizeName(record.name)
    if (!normalized) continue

    const entries = byName.get(normalized) || []
    entries.push(record)
    byName.set(normalized, entries)
  }

  return { byExternalId, byName }
}

export function findLocalAccountForQa<T extends LocalQaAccountRecord>(
  qaAccount: QaDashboardAccountSummary | QaDashboardAccountDetail,
  index: ReturnType<typeof createAccountIndex<T>>,
) {
  const externalMatch = index.byExternalId.get(String(qaAccount.id))
  if (externalMatch) return externalMatch

  const nameMatches = index.byName.get(normalizeName(qaAccount.name)) || []
  if (nameMatches.length === 1) return nameMatches[0]

  const normalizedEmail = normalizeText(qaAccount.ownerEmail)
  if (!normalizedEmail) return null

  const emailMatches = nameMatches.filter(item => normalizeText(item.email) === normalizedEmail)
  return emailMatches.length === 1 ? emailMatches[0] : null
}

export function findQaAccountForLocal<T extends LocalQaAccountRecord>(
  localRecord: T,
  qaAccounts: QaDashboardAccountSummary[],
) {
  const qaId = getQaAccountIdFromLocal(localRecord)
  if (qaId !== null) {
    return qaAccounts.find(item => item.id === qaId) || null
  }

  const normalizedName = normalizeName(localRecord.name)
  const nameMatches = qaAccounts.filter(item => normalizeName(item.name) === normalizedName)
  if (nameMatches.length === 1) return nameMatches[0]

  const normalizedEmail = normalizeText(localRecord.email)
  if (!normalizedEmail) return null

  const emailMatches = nameMatches.filter(item => normalizeText(item.ownerEmail) === normalizedEmail)
  return emailMatches.length === 1 ? emailMatches[0] : null
}

export function joinAddress(parts: Array<string | null | undefined>) {
  const cleaned = parts.map(part => part?.trim()).filter(Boolean)
  return cleaned.length ? cleaned.join(', ') : null
}

export function resolveImageUrl(imageUrl: string | null | undefined) {
  const trimmed = imageUrl?.trim()
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : null
}

export function buildQaAccountMetadata(qaAccount: QaDashboardAccountSummary | QaDashboardAccountDetail | null) {
  if (!qaAccount) return null

  const detailFields = 'description' in qaAccount
    ? {
        description: qaAccount.description,
        ownerPhone: qaAccount.ownerPhone,
        address1: qaAccount.address1,
        address2: qaAccount.address2,
        zipCode: qaAccount.zipCode,
        fullAddress: qaAccount.fullAddress,
        imageUrl: qaAccount.imageUrl,
        marketing: qaAccount.marketing,
        txFee: qaAccount.txFee,
        salesTax: qaAccount.salesTax,
        taxId: qaAccount.taxId,
        timeZone: qaAccount.timeZone,
        hasStripeOnboarding: 'hasStripeOnboarding' in qaAccount ? qaAccount.hasStripeOnboarding ?? null : null,
      }
    : {}

  return {
    id: qaAccount.id,
    name: qaAccount.name,
    headline: qaAccount.headline,
    ownerName: qaAccount.ownerName,
    ownerEmail: qaAccount.ownerEmail,
    city: qaAccount.city,
    state: qaAccount.state,
    country: qaAccount.country,
    createdDate: qaAccount.createdDate,
    active: qaAccount.active,
    ...detailFields,
  }
}

export function buildQaAccountFields(qaAccount: QaDashboardAccountSummary | QaDashboardAccountDetail | null) {
  const base = emptyQaAccountFields()
  if (!qaAccount) return base

  const detailFields = 'description' in qaAccount
    ? {
        description: qaAccount.description,
        owner_phone: qaAccount.ownerPhone,
        address1: qaAccount.address1,
        address2: qaAccount.address2,
        zip_code: qaAccount.zipCode,
        full_address: qaAccount.fullAddress || joinAddress([
          qaAccount.address1,
          qaAccount.address2,
          qaAccount.city,
          qaAccount.state,
          qaAccount.zipCode,
          qaAccount.country,
        ]),
        image_url: qaAccount.imageUrl,
        marketing: qaAccount.marketing,
        tx_fee: qaAccount.txFee,
        sales_tax: qaAccount.salesTax,
        tax_id: qaAccount.taxId,
        time_zone: qaAccount.timeZone,
        stripe_onboarding_complete: 'hasStripeOnboarding' in qaAccount
          ? (qaAccount.hasStripeOnboarding ?? null)
          : null,
      }
    : {}

  return {
    ...base,
    qa_account_id: qaAccount.id,
    headline: qaAccount.headline,
    owner_name: qaAccount.ownerName,
    owner_email: qaAccount.ownerEmail,
    city_name: qaAccount.city,
    state: qaAccount.state,
    country: qaAccount.country,
    active: qaAccount.active,
    ...detailFields,
  }
}
