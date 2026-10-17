import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { QA_AUTH_CONFIG } from '@/lib/auth/qa-auth'
import { parseQaResponse } from '@/lib/auth/qa-api'
import { generateCauseLaunchMaterials, getCauseLaunchStatus, type LaunchCause } from './cause-launch-materials'
import { materialJobActive, materialJobStore, type MaterialJob } from './material-job-store'

export function getMaterialJobStore() {
  const secret = process.env.QA_AUTH_STATE_SECRET || (process.env.NODE_ENV !== 'production' ? 'local-development-only' : '')
  return materialJobStore(resolve(process.env.CAUSE_MATERIAL_JOB_DIR || '.localvip-material-jobs'), secret)
}

type Dependencies = {
  save: (job: MaterialJob) => void
  generate: (progress: (count: number, stage: string, version: string) => void) => Promise<{ steps: Record<string, { status: string; detail?: string }> }>
  status: () => Promise<{video: string; shortVideo: string; videoJobError?: string | null; videoJobs?: Record<string, { stage: string; error?: string | null }> }>
  notify: () => Promise<{ available: boolean }>
}

/** Each tick is recoverable from disk. Completed PDFs are skipped on a resumed batch. */
export async function advanceMaterialJob(job: MaterialJob, deps: Dependencies) {
  const finish = (status: MaterialJob['status'], stage: string, error: string | null = null) => {
    job.status = status; job.stage = stage; job.error = error; job.completedAt = new Date().toISOString()
    if (status !== 'completed') { job.notification = 'unavailable'; job.accessToken = '' }
    deps.save(job)
  }
  try {
    if (materialJobActive(job) && Date.now() - Date.parse(job.createdAt) > 30 * 60_000)
      return finish(job.flyerCount ? 'partial' : 'failed', 'Generation timed out', 'Your saved flyers are still available. Retry to resume the remaining materials.')
    if (job.status === 'queued' || job.status === 'generating_flyers') {
      job.status = 'generating_flyers'; job.stage = `Creating flyers: ${job.flyerCount}/12 ready`; deps.save(job)
      const result = await deps.generate((count, stage, version) => {
        job.flyerCount = count; job.stage = stage; job.flyerVersion = version; deps.save(job)
      })
      if (result.steps.landingPages?.status === 'failed') return finish('failed', 'Landing draft could not be prepared', result.steps.landingPages.detail || 'Retry generation.')
      if (result.steps.flyers?.status !== 'generated' || job.flyerCount !== 12)
        return finish(job.flyerCount ? 'partial' : 'failed', `${job.flyerCount}/12 flyers ready`, result.steps.flyers?.detail || 'Finish your logo, photos and referral setup, then retry.')
      if (result.steps.video?.status === 'waiting' || result.steps.video?.status === 'failed')
        return finish('partial', '12/12 flyers ready; video needs attention', result.steps.video.detail || 'Complete the photo set and retry video generation.')
      job.status = 'rendering_video'; job.stage = '12/12 flyers ready · Rendering videos'; deps.save(job)
    }
    if (job.status === 'rendering_video') {
      const status = await deps.status()
      if (status.videoJobError) { job.error = status.videoJobError; deps.save(job); return }
      if (['failed', 'partial'].includes(status.video) || ['failed', 'partial'].includes(status.shortVideo)) {
        const detail = Object.values(status.videoJobs || {}).find(value => value.error)?.error
        return finish('partial', '12/12 flyers ready; video needs attention', detail || 'Video generation failed. Retry to collect both video cuts.')
      }
      if (status.video !== 'generated' || status.shortVideo !== 'generated') return
      finish('completed', '12/12 flyers and both videos are ready')
    }
    if (job.status === 'completed' && job.notification === 'pending') {
      try {
        const result = await deps.notify()
        job.notification = result.available ? 'sent' : 'unavailable'; job.notificationError = null; job.accessToken = ''; deps.save(job)
      } catch {
        // Files stay completed. The idempotent backend endpoint makes retrying safe.
        job.notificationError = 'Materials are ready. The completion notification will be retried.'; deps.save(job)
      }
    }
  } catch (error) {
    finish(job.flyerCount ? 'partial' : 'failed', 'Generation needs attention', error instanceof Error ? error.message : 'Generation failed. Retry to resume the saved flyers.')
  }
}

let timer: ReturnType<typeof setInterval> | undefined
export function startMaterialWorker() {
  if (timer) return
  const store = getMaterialJobStore()
  const lock = resolve(process.env.CAUSE_MATERIAL_JOB_DIR || '.localvip-material-jobs', 'worker.lock')
  try {
    const fd = openSync(lock, 'wx', 0o600); writeFileSync(fd, String(process.pid)); closeSync(fd)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    const pid = Number(readFileSync(lock, 'utf8'))
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid materials worker lock. Check the job directory.')
    try { process.kill(pid, 0); return } catch (probe) { if ((probe as NodeJS.ErrnoException).code !== 'ESRCH') throw probe }
    unlinkSync(lock); startMaterialWorker(); return
  }
  process.once('exit', () => { try { unlinkSync(lock) } catch {} })
  let busy = false
  const tick = async () => {
    if (busy) return
    busy = true
    try {
      for (const job of store.list()) {
        if (!materialJobActive(job) && !(job.status === 'completed' && job.notification === 'pending')) continue
        const request = async <T>(path: string, init?: RequestInit): Promise<T | null> => {
          if (!path.startsWith('/api/dashboard/v1/')) throw new Error('Invalid materials backend path.')
          const headers = new Headers(init?.headers); headers.set('authorization', `Bearer ${job.accessToken}`)
          return parseQaResponse<T>(await fetch(`${QA_AUTH_CONFIG.baseUrl}${path}`, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(60_000) }), 'Materials request failed. Sign in again and retry if your session expired.')
        }
        await advanceMaterialJob(job, {
          save: store.save,
          generate: progress => generateCauseLaunchMaterials(job.cause as LaunchCause, request, progress),
          status: () => getCauseLaunchStatus(job.causeId, request),
          notify: async () => (await request<{available: boolean}>('/api/dashboard/v1/Notification/materials-ready', {
            method: 'POST', headers: {'content-type': 'application/json'},
            body: JSON.stringify({causeId: job.causeId, jobId: job.id, flyerVersion: job.flyerVersion}),
          })) || {available: false},
        })
      }
    } catch (error) { console.error('[material-jobs]', error instanceof Error ? error.message : 'Worker failed') }
    finally { busy = false }
  }
  timer = setInterval(() => void tick(), 3000)
  timer.unref()
  void tick()
}
