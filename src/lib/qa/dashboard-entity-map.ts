/**
 * Maps Supabase-style table names to QA backend endpoints, and translates
 * between snake_case (frontend) and camelCase (backend) shapes.
 *
 * This is the single source of truth for the dashboard's data layer when
 * running against the .NET QA server.
 */

export type QaEntityKey =
  | 'stakeholders'
  | 'stakeholder_codes'
  | 'contacts'
  | 'tasks'
  | 'notes'
  | 'campaigns'
  | 'outreach_activities'
  | 'cities'
  | 'qr_codes'
  | 'material_templates'
  | 'generated_materials'
  | 'onboarding_flows'
  | 'onboarding_steps'
  | 'offers'
  | 'audit_logs'
  | 'notifications'
  | 'profiles'
  | 'qr_code_collections'
  | 'outreach_scripts'
  | 'material_assignments'
  | 'materials'
  | 'organizations'
  | 'stakeholder_assignments'
  | 'admin_tasks'
  | 'business_referrals'
  | 'city_access_requests'
  | 'template_rules'

export interface QaEntityConfig {
  /** Backend endpoint path under /api/dashboard/v1 */
  endpoint: string
  /** If the GET list response is wrapped (e.g. { items: [...], totalCount }), this is the wrapper key */
  listWrapperKey?: string
}

/**
 * Direct mapping: Supabase table name → backend endpoint path.
 *
 * The frontend has many additional tables that don't exist in the backend yet
 * (organizations, stakeholder_assignments, etc.). Those are NOT in this map
 * and will be returned as empty arrays by the dynamic API route.
 */
export const QA_ENTITY_MAP: Record<QaEntityKey, QaEntityConfig> = {
  stakeholders: { endpoint: '/api/dashboard/v1/Stakeholder', listWrapperKey: 'items' },
  stakeholder_codes: { endpoint: '/api/dashboard/v1/StakeholderCode' },
  contacts: { endpoint: '/api/dashboard/v1/Contact', listWrapperKey: 'items' },
  tasks: { endpoint: '/api/dashboard/v1/Task', listWrapperKey: 'items' },
  notes: { endpoint: '/api/dashboard/v1/Note' },
  campaigns: { endpoint: '/api/dashboard/v1/Campaign' },
  outreach_activities: { endpoint: '/api/dashboard/v1/Outreach' },
  cities: { endpoint: '/api/dashboard/v1/City' },
  qr_codes: { endpoint: '/api/dashboard/v1/QrCode' },
  material_templates: { endpoint: '/api/dashboard/v1/MaterialTemplate' },
  generated_materials: { endpoint: '/api/dashboard/v1/GeneratedMaterial' },
  onboarding_flows: { endpoint: '/api/dashboard/v1/Onboarding' },
  onboarding_steps: { endpoint: '/api/dashboard/v1/Onboarding' }, // accessed via flow
  offers: { endpoint: '/api/dashboard/v1/Offer' },
  audit_logs: { endpoint: '/api/dashboard/v1/AuditLog', listWrapperKey: 'items' },
  notifications: { endpoint: '/api/dashboard/v1/Notification' },
  profiles: { endpoint: '/api/dashboard/v1/User/list', listWrapperKey: 'items' },
  qr_code_collections: { endpoint: '/api/dashboard/v1/QrCodeCollection', listWrapperKey: 'items' },
  outreach_scripts: { endpoint: '/api/dashboard/v1/OutreachScript', listWrapperKey: 'items' },
  material_assignments: { endpoint: '/api/dashboard/v1/MaterialAssignment', listWrapperKey: 'items' },
  materials: { endpoint: '/api/dashboard/v1/Material', listWrapperKey: 'items' },
  // Wired to live QA backends added 2026-06 (controllers + AddDashboardCrmCompletion migration).
  organizations: { endpoint: '/api/dashboard/v1/Organization', listWrapperKey: 'items' },
  stakeholder_assignments: { endpoint: '/api/dashboard/v1/StakeholderAssignment', listWrapperKey: 'items' },
  admin_tasks: { endpoint: '/api/dashboard/v1/AdminTask', listWrapperKey: 'items' },
  business_referrals: { endpoint: '/api/dashboard/v1/BusinessReferral', listWrapperKey: 'items' },
  city_access_requests: { endpoint: '/api/dashboard/v1/CityAccessRequest', listWrapperKey: 'items' },
  template_rules: { endpoint: '/api/dashboard/v1/TemplateRule', listWrapperKey: 'items' },
}

/**
 * Tables that exist in the frontend but have no QA backend equivalent yet.
 * The dynamic API route returns [] for these to avoid breaking pages.
 */
export const EMPTY_FALLBACK_TABLES = new Set<string>([])

/** Convert camelCase → snake_case (for object keys) */
export function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`).replace(/^_/, '')
}

/** Convert snake_case → camelCase */
export function toCamelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

/**
 * Recursively convert object keys camelCase → snake_case.
 * Used when sending backend responses to the frontend.
 */
export function toSnakeCaseObject(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(toSnakeCaseObject)
  }
  if (input !== null && typeof input === 'object' && input.constructor === Object) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input)) {
      out[toSnakeCase(k)] = toSnakeCaseObject(v)
    }
    return out
  }
  return input
}

/**
 * Recursively convert object keys snake_case → camelCase.
 * Used when sending frontend payloads to the backend.
 */
export function toCamelCaseObject(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(toCamelCaseObject)
  }
  if (input !== null && typeof input === 'object' && input.constructor === Object) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input)) {
      out[toCamelCase(k)] = toCamelCaseObject(v)
    }
    return out
  }
  return input
}

/**
 * Per-entity field aliases for cases where the simple snake_case conversion
 * doesn't match the frontend type. Maps frontend field → backend field.
 */
export const FIELD_ALIASES: Partial<Record<QaEntityKey, Record<string, string>>> = {
  contacts: {
    business_id: 'businessAccountId',
    cause_id: 'causeAccountId',
    owner_id: 'ownerUserId',
  },
  stakeholders: {
    business_id: 'businessAccountId',
    cause_id: 'causeAccountId',
    owner_id: 'ownerUserId',
    profile_id: 'profileUserId',
  },
  tasks: {
    assigned_to: 'assignedToUserId',
    created_by: 'createdByUserId',
    entity_id: 'entityId',
    entity_type: 'entityType',
  },
  notes: {
    created_by: 'createdByUserId',
    entity_id: 'entityId',
    entity_type: 'entityType',
  },
  outreach_activities: {
    performed_by: 'performedByUserId',
    entity_id: 'entityId',
    entity_type: 'entityType',
    campaign_id: 'campaignId',
    // Frontend outreach dialog uses these — map to backend Outreach DTO
    channel: 'type',
    subject: 'subject',
    message: 'body',
    body: 'body',
    next_step: 'nextStep',
    next_step_date: 'nextStepDate',
  },
  campaigns: {
    owner_id: 'ownerUserId',
    city_id: 'cityId',
  },
  qr_codes: {
    created_by: 'createdByUserId',
    entity_id: 'entityId',
    entity_type: 'entityType',
    short_code: 'code',
    destination_url: 'targetUrl',
    qr_image_url: 'qrImageUrl',
  },
  offers: {
    business_id: 'businessAccountId',
    city_id: 'cityId',
    created_by: 'createdByUserId',
  },
  notifications: {
    user_id: 'userId',
    entity_id: 'entityId',
    entity_type: 'entityType',
    is_read: 'isRead',
  },
  audit_logs: {
    user_id: 'userId',
    entity_id: 'entityId',
    entity_type: 'entityType',
    ip_address: 'ipAddress',
    new_values: 'newValues',
    old_values: 'oldValues',
  },
  stakeholder_codes: {
    stakeholder_id: 'stakeholderId',
    referral_code: 'referralCode',
    connection_code: 'connectionCode',
    join_url: 'joinUrl',
  },
  onboarding_flows: {
    entity_id: 'entityId',
    entity_type: 'entityType',
    flow_type: 'flowType',
    total_steps: 'totalSteps',
    completed_steps: 'completedSteps',
    assigned_to: 'assignedToUserId',
  },
  generated_materials: {
    stakeholder_id: 'stakeholderId',
    template_id: 'templateId',
    generated_file_url: 'generatedFileUrl',
    generated_file_name: 'generatedFileName',
    library_folder: 'libraryFolder',
    generation_status: 'generationStatus',
    version_number: 'versionNumber',
    is_active: 'isActive',
  },
  material_templates: {
    template_type: 'templateType',
    output_format: 'outputFormat',
    source_path: 'sourcePath',
    audience_tags: 'audienceTags',
    stakeholder_types: 'stakeholderTypes',
    library_folder: 'libraryFolder',
    is_active: 'isActive',
    created_by: 'createdByUserId',
  },
  cities: {
    state_code: 'state',
    country_code: 'country',
    created_by: 'createdByUserId',
  },
  qr_code_collections: {
    created_by: 'createdByUserId',
  },
  outreach_scripts: {
    script_type: 'scriptType',
    audience_tags: 'audienceTags',
    is_active: 'isActive',
    created_by: 'createdByUserId',
  },
  material_assignments: {
    material_id: 'materialId',
    entity_id: 'entityId',
    entity_type: 'entityType',
    assigned_by: 'assignedByUserId',
  },
  materials: {
    created_by: 'createdByUserId',
    file_url: 'fileUrl',
    thumbnail_url: 'thumbnailUrl',
    business_id: 'businessAccountId',
    cause_id: 'causeAccountId',
  },
  stakeholder_assignments: {
    // Frontend stakeholder_id is the assigned dashboard user (QA user id).
    stakeholder_id: 'stakeholderUserId',
    assigned_by: 'assignedByUserId',
  },
  business_referrals: {
    source_business_id: 'sourceBusinessAccountId',
    created_by: 'createdByUserId',
    target_business_id: 'targetBusinessAccountId',
    converted_business_id: 'convertedBusinessAccountId',
  },
  city_access_requests: {
    requester_id: 'requesterUserId',
    reviewed_by: 'reviewedByUserId',
  },
  template_rules: {
    created_by: 'createdByUserId',
  },
  // organizations + admin_tasks: plain snake↔camel conversion is sufficient.
}

/**
 * Backend expects `long` for ID columns (e.g. ownerUserId, businessAccountId).
 * The Supabase-era frontend often passes a UUID string for these. We strip
 * fields whose value can't be parsed as a positive integer.
 */
const ID_FIELDS_REQUIRING_LONG = new Set([
  'ownerUserId',
  'profileUserId',
  'businessAccountId',
  'causeAccountId',
  'assignedToUserId',
  'createdByUserId',
  'performedByUserId',
  'campaignId',
  'cityId',
  'stakeholderId',
  'templateId',
  'flowId',
  'qrCodeId',
  'entityId',
  'userId',
  // Added with the 6 newly-wired entities
  'stakeholderUserId',
  'assignedByUserId',
  'sourceBusinessAccountId',
  'targetBusinessAccountId',
  'convertedBusinessAccountId',
  'targetCityId',
  'targetContactId',
  'requesterUserId',
  'reviewedByUserId',
  'requestedCityId',
])

function isValidLongId(v: unknown): boolean {
  if (typeof v === 'number') return Number.isInteger(v) && v > 0
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v) > 0
  return false
}

function asObjectRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return null
    }
  }
  return null
}

/**
 * Convert a frontend-shaped payload (snake_case + frontend field names)
 * to a backend-shaped payload (camelCase + backend field names).
 *
 * Drops ID fields whose value isn't a valid positive integer, so the backend
 * doesn't reject the whole payload due to a stale Supabase UUID.
 */
export function toBackendShape(
  entityKey: QaEntityKey,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const aliases = FIELD_ALIASES[entityKey] || {}
  let sourcePayload = payload

  if (entityKey === 'qr_codes') {
    const existingMetadata = asObjectRecord(payload.metadata) || {}
    const derivedEntityType =
      typeof payload.entity_type === 'string' && payload.entity_type.trim()
        ? payload.entity_type.trim()
        : payload.business_id
          ? 'business'
          : payload.cause_id
            ? 'cause'
            : payload.contact_id
              ? 'contact'
              : payload.stakeholder_id
                ? 'stakeholder'
                : null
    const derivedEntityId =
      payload.entity_id
      ?? payload.business_id
      ?? payload.cause_id
      ?? payload.contact_id
      ?? payload.stakeholder_id
      ?? null

    sourcePayload = {
      ...payload,
      ...(derivedEntityType ? { entity_type: derivedEntityType } : {}),
      ...(derivedEntityId != null ? { entity_id: derivedEntityId } : {}),
      metadata: {
        ...existingMetadata,
        name: payload.name ?? existingMetadata.name ?? null,
        brand: payload.brand ?? existingMetadata.brand ?? null,
        redirect_url: payload.redirect_url ?? existingMetadata.redirect_url ?? null,
        foreground_color: payload.foreground_color ?? existingMetadata.foreground_color ?? null,
        background_color: payload.background_color ?? existingMetadata.background_color ?? null,
        frame_text: payload.frame_text ?? existingMetadata.frame_text ?? null,
        logo_url: payload.logo_url ?? existingMetadata.logo_url ?? null,
        campaign_id: payload.campaign_id ?? existingMetadata.campaign_id ?? null,
        city_id: payload.city_id ?? existingMetadata.city_id ?? null,
        stakeholder_id: payload.stakeholder_id ?? existingMetadata.stakeholder_id ?? null,
        business_id: payload.business_id ?? existingMetadata.business_id ?? null,
        cause_id: payload.cause_id ?? existingMetadata.cause_id ?? null,
        contact_id: payload.contact_id ?? existingMetadata.contact_id ?? null,
        collection_id: payload.collection_id ?? existingMetadata.collection_id ?? null,
        destination_preset: payload.destination_preset ?? existingMetadata.destination_preset ?? null,
        version: payload.version ?? existingMetadata.version ?? 1,
      },
    }
  }

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(sourcePayload)) {
    if (entityKey === 'tasks' && k === 'completed_at') continue

    if (entityKey === 'offers') {
      if (k === 'headline') {
        out.title = v
        continue
      }
      if (k === 'value_type') continue
      if (k === 'value_label') {
        if (payload.offer_type === 'cashback' || payload.value_type === 'cashback_percent') {
          if (payload.cashback_percent == null) out.discountValue = v
        } else {
          out.discountValue = v
        }
        continue
      }
      if (k === 'cashback_percent') {
        if (payload.offer_type === 'cashback' || payload.value_type === 'cashback_percent') {
          out.discountValue = v == null ? null : String(v)
        }
        continue
      }
      if (k === 'starts_at') {
        out.startDate = v
        continue
      }
      if (k === 'ends_at') {
        out.endDate = v
        continue
      }
    }

    const backendKey = aliases[k] || toCamelCase(k)
    if (ID_FIELDS_REQUIRING_LONG.has(backendKey) && !isValidLongId(v)) {
      // skip — backend would 400 on this
      continue
    }
    if ((backendKey === 'metadata' || backendKey === 'payloadJson') && v && typeof v === 'object' && !Array.isArray(v)) {
      out[backendKey] = JSON.stringify(v)
      continue
    }
    if (entityKey === 'tasks' && backendKey === 'dueDate' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      out[backendKey] = `${v}T00:00:00.000Z`
      continue
    }
    out[backendKey] = v
  }
  return out
}

/**
 * Per-entity value normalizers run after key conversion. Use these for
 * brand/case/enum mismatches between backend and frontend.
 */
function csvToArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

const VALUE_NORMALIZERS: Partial<Record<QaEntityKey, (row: Record<string, unknown>) => void>> = {
  campaigns: (row) => {
    if (typeof row.brand === 'string') row.brand = row.brand.toLowerCase()
  },
  offers: (row) => {
    if (typeof row.brand === 'string') row.brand = row.brand.toLowerCase()
    if (typeof row.title === 'string' && !row.headline) row.headline = row.title
    if (typeof row.start_date === 'string' && !row.starts_at) row.starts_at = row.start_date
    if (typeof row.end_date === 'string' && !row.ends_at) row.ends_at = row.end_date
    if (row.discount_value != null && row.value_label == null) row.value_label = String(row.discount_value)
    if (typeof row.offer_type === 'string' && !row.value_type) {
      row.value_type = row.offer_type === 'cashback' ? 'cashback_percent' : 'label'
    }
    if (row.cashback_percent == null && row.offer_type === 'cashback' && row.discount_value != null) {
      const parsed = Number.parseFloat(String(row.discount_value).replace(/[^\d.-]/g, ''))
      row.cashback_percent = Number.isFinite(parsed) ? parsed : null
    }
    if (row.offer_type === 'cashback' && row.cashback_percent != null && !row.value_label) {
      row.value_label = `${row.cashback_percent}% cashback`
    }
  },
  stakeholders: (row) => {
    if (typeof row.brand === 'string') row.brand = row.brand.toLowerCase()
  },
  contacts: (row) => {
    if (typeof row.brand === 'string') row.brand = row.brand.toLowerCase()
  },
  material_templates: (row) => {
    row.stakeholder_types = csvToArray(row.stakeholder_types)
    row.audience_tags = csvToArray(row.audience_tags)
    row.tiers = csvToArray(row.tiers)
    if (row.qr_position_json && typeof row.qr_position_json === 'string') {
      try {
        row.qr_position = JSON.parse(row.qr_position_json as string)
      } catch {
        row.qr_position = null
      }
    }
  },
  generated_materials: (row) => {
    row.tags = csvToArray(row.tags)
    // Backend GeneratedMaterialController emits completed/error/pending; the
    // dashboard's GeneratedMaterialStatus union is generated/failed/pending.
    const status = typeof row.generation_status === 'string' ? row.generation_status.toLowerCase() : ''
    if (status === 'completed' || status === 'complete') row.generation_status = 'generated'
    else if (status === 'error' || status === 'failed') row.generation_status = 'failed'
    // The backend stores a server-relative path (/uploads/generated/...). The
    // dashboard runs on a different origin, so make it absolute against the QA
    // host or the file 404s when previewed/downloaded.
    if (typeof row.generated_file_url === 'string' && row.generated_file_url.startsWith('/')) {
      const base = (process.env.NEXT_PUBLIC_QA_AUTH_BASE_URL || 'https://qa.localvip.com').replace(/\/$/, '')
      row.generated_file_url = base + row.generated_file_url
    }
  },
  profiles: (row) => {
    // Backend returns createdDate (→ created_date). Many pages expect created_at.
    if (row.created_date && !row.created_at) row.created_at = row.created_date
    if (row.updated_date && !row.updated_at) row.updated_at = row.updated_date
    // Compose a full_name field for sort/display
    const first = row.first_name ?? ''
    const last = row.last_name ?? ''
    row.full_name = `${first} ${last}`.trim() || row.email
    // Map IsEnabled → status string used by pages
    if (typeof row.is_enabled === 'boolean') {
      row.status = row.is_enabled ? 'active' : 'inactive'
    }
    // Expose the QA account/consumer types in metadata so the Stakeholders page
    // can filter normal consumers out of the stakeholder list.
    const acct = (row.account_type ?? row.accountType) as unknown
    const ctype = (row.consumer_type ?? row.consumerType) as unknown
    row.metadata = {
      ...(row.metadata as object || {}),
      qa_account_type: acct,
      consumer_type: ctype,
    }
  },
  audit_logs: (row) => {
    if (row.created_at && typeof row.created_at === 'string') {
      // already correct
    }
  },
  onboarding_steps: (row) => {
    // Backend uses StepOrder/Status; frontend expects sort_order/is_completed.
    if (row.step_order != null && row.sort_order == null) row.sort_order = row.step_order
    const status = typeof row.status === 'string' ? row.status.toLowerCase() : ''
    row.is_completed = status === 'completed' || status === 'done'
    if (row.completed_by_user_id != null && row.completed_by == null) {
      row.completed_by = row.completed_by_user_id
    }
  },
  onboarding_flows: (row) => {
    // Frontend expects { stage, completed_at }; backend has status + completedAt.
    if (typeof row.status === 'string' && !row.stage) row.stage = row.status
  },
  qr_codes: (row) => {
    const metadata = asObjectRecord(row.metadata)
    row.metadata = metadata || null
    if (typeof row.code === 'string' && !row.short_code) row.short_code = row.code
    if (typeof row.target_url === 'string' && !row.destination_url) row.destination_url = row.target_url
    if (typeof metadata?.redirect_url === 'string' && metadata.redirect_url.trim()) {
      row.redirect_url = metadata.redirect_url
    } else if (typeof row.short_code === 'string' && row.short_code.trim() && !row.redirect_url) {
      row.redirect_url = `https://localvip.com/q/${row.short_code}`
    } else if (typeof row.target_url === 'string' && !row.redirect_url) {
      row.redirect_url = row.target_url
    }
    if (typeof metadata?.name === 'string' && metadata.name.trim() && !row.name) {
      row.name = metadata.name
    }
    if (typeof metadata?.brand === 'string' && metadata.brand.trim() && !row.brand) {
      row.brand = metadata.brand.toLowerCase()
    }
    if (typeof row.brand !== 'string' || !row.brand) {
      row.brand = 'localvip'
    } else {
      row.brand = row.brand.toLowerCase()
    }
    if (typeof metadata?.foreground_color === 'string' && metadata.foreground_color.trim()) {
      row.foreground_color = metadata.foreground_color
    } else if (row.foreground_color == null) {
      row.foreground_color = '#000000'
    }
    if (typeof metadata?.background_color === 'string' && metadata.background_color.trim()) {
      row.background_color = metadata.background_color
    } else if (row.background_color == null) {
      row.background_color = '#ffffff'
    }
    if (typeof metadata?.frame_text === 'string') {
      row.frame_text = metadata.frame_text
    } else if (row.frame_text == null) {
      row.frame_text = null
    }
    if (typeof metadata?.logo_url === 'string') {
      row.logo_url = metadata.logo_url
    } else if (row.logo_url == null) {
      row.logo_url = null
    }
    if (typeof metadata?.campaign_id === 'string') row.campaign_id = metadata.campaign_id
    else if (row.campaign_id == null) row.campaign_id = null
    if (typeof metadata?.city_id === 'string') row.city_id = metadata.city_id
    else if (row.city_id == null) row.city_id = null
    if (typeof metadata?.stakeholder_id === 'string') row.stakeholder_id = metadata.stakeholder_id
    else if (row.stakeholder_id == null) row.stakeholder_id = null
    if (typeof metadata?.business_id === 'string') row.business_id = metadata.business_id
    else if (row.business_id == null) row.business_id = null
    if (typeof metadata?.cause_id === 'string') row.cause_id = metadata.cause_id
    else if (row.cause_id == null) row.cause_id = null
    if (typeof metadata?.contact_id === 'string') {
      row.contact_id = metadata.contact_id
    }
    if (typeof metadata?.collection_id === 'string') row.collection_id = metadata.collection_id
    else if (row.collection_id == null) row.collection_id = null
    if (typeof metadata?.destination_preset === 'string') row.destination_preset = metadata.destination_preset
    else if (row.destination_preset == null) row.destination_preset = null
    if (typeof metadata?.version === 'number') row.version = metadata.version
    else if (row.version == null) row.version = 1
    if (typeof row.entity_type === 'string' && row.entity_id != null) {
      const entityId = String(row.entity_id)
      if (row.entity_type === 'business' && !row.business_id) row.business_id = entityId
      if (row.entity_type === 'cause' && !row.cause_id) row.cause_id = entityId
      if (row.entity_type === 'contact' && row.contact_id == null) row.contact_id = entityId
      if (row.entity_type === 'stakeholder' && !row.stakeholder_id) row.stakeholder_id = entityId
    }
    if (typeof row.name !== 'string' || !row.name) {
      row.name = `QR ${String(row.short_code || row.id || '').trim()}`.trim() || 'QR Code'
    }
    if (row.scan_count == null) row.scan_count = 0
  },
  materials: (row) => {
    if (typeof row.name === 'string' && !row.title) row.title = row.name
    if (typeof row.file_type === 'string' && !row.type) row.type = row.file_type
    if (row.status == null) row.status = 'active'
  },
  admin_tasks: (row) => {
    // Backend stores payload as a JSON string; frontend expects an object.
    if (typeof row.payload_json === 'string' && row.payload_json) {
      try {
        row.payload_json = JSON.parse(row.payload_json as string)
      } catch {
        row.payload_json = null
      }
    }
  },
}

/**
 * Convert a backend response (camelCase) to frontend shape (snake_case +
 * mapped field names like business_id instead of businessAccountId).
 */
export function toFrontendShape(
  entityKey: QaEntityKey,
  data: unknown,
): unknown {
  const aliases = FIELD_ALIASES[entityKey] || {}
  // reverse alias map (backend → frontend)
  const reverseAliases: Record<string, string> = {}
  for (const [frontKey, backendKey] of Object.entries(aliases)) {
    reverseAliases[backendKey] = frontKey
  }

  const normalizer = VALUE_NORMALIZERS[entityKey]

  function transform(input: unknown, depth = 0): unknown {
    if (Array.isArray(input)) {
      return input.map((item) => transform(item, depth + 1))
    }
    if (input !== null && typeof input === 'object' && (input as object).constructor === Object) {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(input)) {
        const frontKey = reverseAliases[k] || toSnakeCase(k)
        out[frontKey] = transform(v, depth + 1)
      }
      // Apply per-entity value normalizer at top level only
      if (depth <= 1 && normalizer) normalizer(out)
      return out
    }
    return input
  }

  return transform(data)
}
