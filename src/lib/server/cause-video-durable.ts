import { createHash } from 'node:crypto'
import { CAUSE_VIDEO_CUTS, type CauseVideoCut, type CauseVideoProps } from './cause-video-render'

type Json = <T>(path: string, init?: RequestInit, message?: string) => Promise<T | null>
type JobRef = { id: string; version: string }
export type RenderJob = {
  id: string; accountId: number; composition: string
  status: 'queued' | 'rendering_video' | 'completed' | 'partial' | 'failed'
  stage: string; progress: number; startedAt: string | null; createdAt: string; completedAt: string | null
  elapsedSeconds: number; estimateSeconds: [number, number]
  error?: string | null; result?: { src: string; poster: string | null } | null
}
type Draft = Record<string, unknown> & { slug: string; videoJobs?: Partial<Record<CauseVideoCut, JobRef>> }
type RecordWithDraft = { draft?: unknown; status?: string; published?: unknown }

export const durableVideoJobsEnabled = () => process.env.CAUSE_VIDEO_DURABLE_JOBS === '1'

async function worker<T>(path: string, init?: RequestInit): Promise<T> {
  const base = process.env.CAUSE_VIDEO_RENDER_URL
  const token = process.env.CAUSE_VIDEO_RENDER_TOKEN
  if (!base || !token) throw new Error('The video renderer is not configured.')
  const response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    ...init, headers: { ...init?.headers, authorization: `Bearer ${token}` },
    cache: 'no-store', signal: AbortSignal.timeout(15_000),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Could not load video render status.')
  return body as T
}

function verifyJob(job: RenderJob, causeId: number, cut: CauseVideoCut) {
  if (job.accountId !== causeId || job.composition !== (CAUSE_VIDEO_CUTS[cut].composition || 'CauseLaunchVideo'))
    throw new Error('The renderer returned a job for a different cause or cut.')
}

export async function queueDurableVideo(causeId: number, cut: CauseVideoCut, want: {
  version: string; props: CauseVideoProps; request: Json; landingPath: string
}) {
  const record = await want.request<RecordWithDraft>(want.landingPath)
  const draft = record?.draft as Draft | undefined
  if (!draft?.slug) throw new Error('Save the landing draft before generating video.')
  const previous = draft.videoJobs?.[cut]
  let retry = ''
  if (previous?.version === want.version) {
    const existing = await worker<RenderJob>(`/jobs/${encodeURIComponent(previous.id)}`)
    verifyJob(existing, causeId, cut)
    if (!['failed', 'partial'].includes(existing.status)) return existing
    retry = previous.id
  }
  const payload = { ...want.props, ...(CAUSE_VIDEO_CUTS[cut].composition ? { composition: CAUSE_VIDEO_CUTS[cut].composition } : {}) }
  const key = createHash('sha256').update(JSON.stringify([causeId, cut, want.version, payload, retry])).digest('hex')
  const job = await worker<RenderJob>('/jobs', {
    method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(payload),
  })
  verifyJob(job, causeId, cut)
  // The worker owns the job before we return. Store its reference in durable
  // backend storage so a fresh dashboard process can collect the result.
  const latest = await want.request<RecordWithDraft>(want.landingPath)
  const current = latest?.draft as Draft | undefined
  if (!current?.slug) throw new Error('Landing draft is missing; the render reference could not be saved.')
  await want.request(want.landingPath, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slug: current.slug, config: { ...current, videoJobs: { ...current.videoJobs, [cut]: { id: job.id, version: want.version } } } }),
  })
  return job
}

export async function reconcileDurableVideos(causeId: number, record: RecordWithDraft | null, request: Json) {
  const jobs: Partial<Record<CauseVideoCut, RenderJob>> = {}
  let current = record
  for (const cut of ['short', 'feature'] as const) {
    const ref = (current?.draft as Draft | undefined)?.videoJobs?.[cut]
    if (!ref) continue
    const job = await worker<RenderJob>(`/jobs/${encodeURIComponent(ref.id)}`)
    verifyJob(job, causeId, cut)
    jobs[cut] = job
    if (job.status !== 'completed' || !job.result?.src || !job.result.poster) continue
    const spec = CAUSE_VIDEO_CUTS[cut]
    const landingPath = `/api/dashboard/v1/Nonprofit/${causeId}/landing-page`
    const latest = await request<RecordWithDraft>(landingPath)
    const draft = latest?.draft as Draft | undefined
    // Never attach a superseded render or overwrite edits made while rendering.
    if (!draft?.slug || draft.videoJobs?.[cut]?.id !== ref.id || draft.videoJobs[cut]?.version !== ref.version) continue
    const asset = draft[spec.field] as { src?: string } | undefined
    if (asset?.src === job.result.src && draft[spec.sourceField] === ref.version) continue
    const config = { ...draft, [spec.field]: job.result, [spec.sourceField]: ref.version }
    await request(landingPath, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: draft.slug, config }),
    })
    current = { ...latest, draft: config, status: latest?.status === 'published' ? 'published_with_changes' : latest?.status }
  }
  return { record: current, jobs }
}
