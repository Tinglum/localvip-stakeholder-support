import type { MaterialClassification } from './material-classification'

export type ReachState = 'eligible' | 'blocked' | 'ineligible' | 'generated'
export interface ReachEntity {
  id: string
  name: string
  type: string
  context?: string
  state: ReachState
  reasons: string[]
  blockers: string[]
  generatedVersion?: number | null
  outdated?: boolean
}
export interface ReachCounts {
  eligible: number
  blocked: number
  ineligible: number
  generated: number
  outdated: number
  wouldGenerate: number
  byType: Record<string, number>
}
export interface ReachPage { counts: ReachCounts; entities: ReachEntity[]; page: number; pageSize: number; total: number }

async function request<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`)
  return payload as T
}

function toBackendTargeting(value: MaterialClassification) {
  const ids = value.availability.entityIds.map(Number).filter(Number.isFinite)
  const requiredFields = value.delivery === 'automatic'
    ? ['logo', 'qr_code', ...(value.purpose === 'promote_offer' || value.purpose === 'promote_give_back_day' ? ['active_offer'] : [])]
    : []
  return {
    audiences: value.audiences,
    primaryPurpose: value.purpose || null,
    availabilityMode: value.availability.mode === 'everywhere' ? 'global' : value.availability.mode,
    cityIds: value.availability.mode === 'cities' ? ids : [],
    campaignIds: value.availability.mode === 'campaigns' ? ids : [],
    causeIds: value.availability.mode === 'causes' ? ids : [],
    businessIds: value.availability.mode === 'businesses' ? ids : [],
    deliveryMode: value.delivery,
    requiredFields,
  }
}

type BackendRow = { id: number; name: string; type: string; city?: string; generationState: string; eligibility: { status: string; matchedRules?: string[]; failedRules?: string[]; blockers?: string[] } }
function normalizeEntity(row: BackendRow): ReachEntity {
  return {
    id: String(row.id), name: row.name, type: row.type, context: row.city,
    state: row.eligibility.status === 'ineligible' ? 'ineligible' : row.eligibility.status === 'blocked' ? 'blocked' : row.generationState === 'generated' ? 'generated' : 'eligible',
    reasons: row.eligibility.matchedRules || [], blockers: [...(row.eligibility.failedRules || []), ...(row.eligibility.blockers || [])],
    outdated: row.generationState === 'outdated',
  }
}

function filters(value?: string) {
  if (!value || value === 'all') return undefined
  if (value === 'ready') return { statuses: ['eligible', 'blocked'] }
  if (value === 'outdated' || value === 'generated') return undefined
  return { statuses: [value] }
}

export const materialReachApi = {
  preview: async (input: { materialId?: string; targeting: MaterialClassification; page: number; pageSize: number; filter?: string; search?: string }) => {
    const raw = await request<{ counts: { eligible: number; blocked: number; ineligible: number; readyToGenerate: number; alreadyGenerated: number; outdated: number }; entities: BackendRow[]; page: number; pageSize: number; total: number }>('/api/admin/material-reach/preview', { ...input, materialId: input.materialId ? Number(input.materialId) : undefined, targeting: toBackendTargeting(input.targeting), filters: filters(input.filter) })
    const entities = raw.entities.map(normalizeEntity).filter((row) => input.filter !== 'outdated' || row.outdated).filter((row) => input.filter !== 'generated' || row.state === 'generated')
    return { ...raw, entities, counts: { eligible: raw.counts.eligible, blocked: raw.counts.blocked, ineligible: raw.counts.ineligible, generated: raw.counts.alreadyGenerated, outdated: raw.counts.outdated, wouldGenerate: raw.counts.readyToGenerate, byType: {} } }
  },
  check: async (input: { materialId?: string; targeting: MaterialClassification; query: string }) => {
    const raw = await request<{ items: BackendRow[] }>('/api/admin/material-reach/check', { ...input, materialId: input.materialId ? Number(input.materialId) : undefined, targeting: toBackendTargeting(input.targeting) })
    return { entity: raw.items[0] ? normalizeEntity(raw.items[0]) : null }
  },
  previewEntity: async (input: { materialId?: string; targeting: MaterialClassification; entityId: string }) => {
    const raw = await request<BackendRow>('/api/admin/material-reach/entity-preview', { materialId: input.materialId ? Number(input.materialId) : undefined, targeting: toBackendTargeting(input.targeting), entityId: Number(input.entityId) })
    return { entity: normalizeEntity(raw) }
  },
  activate: (input: { materialId: string; targeting: MaterialClassification; mode: 'all' | 'missing' | 'outdated' | 'selected'; selectedEntityIds?: string[]; confirmationCount?: number }) =>
    request<{ message: string; entityIds: number[] }>('/api/admin/material-reach/activate', { ...input, materialId: Number(input.materialId), targeting: toBackendTargeting(input.targeting), selectedEntityIds: input.selectedEntityIds?.map(Number) }).then((result) => ({ message: result.message, ready: result.entityIds.length, entityIds: result.entityIds.map(String) })),
}
