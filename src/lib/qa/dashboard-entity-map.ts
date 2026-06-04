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
}

/**
 * Tables that exist in the frontend but have no QA backend equivalent yet.
 * The dynamic API route returns [] for these to avoid breaking pages.
 */
export const EMPTY_FALLBACK_TABLES = new Set([
  'organizations',
  'stakeholder_assignments',
  'admin_tasks',
  'business_referrals',
  'city_access_requests',
  'template_rules',
])

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
])

function isValidLongId(v: unknown): boolean {
  if (typeof v === 'number') return Number.isInteger(v) && v > 0
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v) > 0
  return false
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
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload)) {
    const backendKey = aliases[k] || toCamelCase(k)
    if (ID_FIELDS_REQUIRING_LONG.has(backendKey) && !isValidLongId(v)) {
      // skip — backend would 400 on this
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
