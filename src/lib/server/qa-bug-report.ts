import { fetchQaApi, parseQaJsonResponse, parseQaResponse } from '@/lib/auth/qa-api'
import type {
  BugReport,
  BugReportCreateInput,
  BugReportListQuery,
  BugReportListResponse,
  BugReportSettings,
  BugReportStats,
  BugReportUpdateInput,
} from '@/lib/bug-center/types'

const BASE = '/api/dashboard/v1/BugReport'

// The backend stores/returns `tags` as a CSV string and `notes` as a JSON string.
// The UI types them as arrays (tags: string[], notes: BugReportNote[]) and call
// .map/.join on them — so normalize every report on the way in.
function normalizeReport(raw: unknown): BugReport {
  const r = (raw ?? {}) as Record<string, unknown>
  let tags: string[] = []
  if (Array.isArray(r.tags)) tags = (r.tags as unknown[]).map(String)
  else if (typeof r.tags === 'string') tags = r.tags.split(',').map((t) => t.trim()).filter(Boolean)
  let notes: BugReport['notes'] = []
  if (Array.isArray(r.notes)) notes = r.notes as BugReport['notes']
  else if (typeof r.notes === 'string' && r.notes.trim()) {
    try { const p = JSON.parse(r.notes); if (Array.isArray(p)) notes = p } catch { notes = [] }
  }
  return { ...(r as unknown as BugReport), tags, notes }
}

export async function fetchBugSettings(): Promise<BugReportSettings> {
  const res = await fetchQaApi(`${BASE}/settings`)
  return parseQaJsonResponse<BugReportSettings>(res, 'Bug Center settings could not be loaded.')
}

export async function updateBugSettings(payload: BugReportSettings): Promise<BugReportSettings> {
  const res = await fetchQaApi(`${BASE}/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseQaJsonResponse<BugReportSettings>(res, 'Bug Center settings could not be saved.')
}

export async function createBugReport(payload: BugReportCreateInput): Promise<BugReport> {
  const res = await fetchQaApi(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return normalizeReport(await parseQaJsonResponse<BugReport>(res, 'The bug report could not be submitted.'))
}

export async function listBugReports(query: BugReportListQuery): Promise<BugReportListResponse> {
  const params = new URLSearchParams()
  if (query.priority) params.set('priority', query.priority)
  if (query.category) params.set('category', query.category)
  if (query.status) params.set('status', query.status)
  if (query.app) params.set('app', query.app)
  if (query.search) params.set('search', query.search)
  params.set('page', String(query.page ?? 1))
  params.set('pageSize', String(query.pageSize ?? 25))

  const res = await fetchQaApi(`${BASE}?${params.toString()}`)
  const data = await parseQaJsonResponse<BugReportListResponse | BugReport[]>(res, 'Bug reports could not be loaded.')
  const items = Array.isArray(data) ? data : (data.items || [])
  const totalCount = Array.isArray(data) ? items.length : (data.totalCount ?? items.length)
  return { items: items.map(normalizeReport), totalCount, page: query.page ?? 1, pageSize: query.pageSize ?? 25 }
}

export async function fetchBugReport(id: string): Promise<BugReport> {
  const res = await fetchQaApi(`${BASE}/${encodeURIComponent(id)}`)
  return normalizeReport(await parseQaJsonResponse<BugReport>(res, 'The bug report could not be loaded.'))
}

export async function updateBugReport(id: string, payload: BugReportUpdateInput): Promise<BugReport> {
  // The backend stores Tags as a CSV string and rejects a JSON array (400). The
  // UI works with arrays (the read shape is string[]), so coerce on the way out.
  const body: Record<string, unknown> = { ...payload }
  if (Array.isArray(body.tags)) body.tags = (body.tags as string[]).map((t) => String(t).trim()).filter(Boolean).join(', ')
  const res = await fetchQaApi(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return normalizeReport(await parseQaJsonResponse<BugReport>(res, 'The bug report could not be updated.'))
}

export async function deleteBugReport(id: string): Promise<void> {
  const res = await fetchQaApi(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  await parseQaResponse(res, 'The bug report could not be deleted.')
}

export async function fetchBugStats(): Promise<BugReportStats> {
  const res = await fetchQaApi(`${BASE}/stats`)
  return parseQaJsonResponse<BugReportStats>(res, 'Bug Center stats could not be loaded.')
}
