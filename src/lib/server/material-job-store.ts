import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export type MaterialJob = {
  id: string; causeId: number; status: 'queued' | 'generating_flyers' | 'rendering_video' | 'completed' | 'partial' | 'failed'
  stage: string; flyerCount: number; createdAt: string; updatedAt: string; completedAt: string | null
  error: string | null; notification: 'pending' | 'sent' | 'unavailable'; notificationError: string | null
  flyerVersion: string | null
  cause: Record<string, unknown> & { id: number; name: string }; accessToken: string
}
export const materialJobActive = (job: Pick<MaterialJob, 'status'>) => ['queued', 'generating_flyers', 'rendering_video'].includes(job.status)
export function publicMaterialJob(job: MaterialJob) {
  const { cause, accessToken, ...status } = job
  return status
}

export function materialJobStore(directory: string, secret: string) {
  if (!secret) throw new Error('Configure QA_AUTH_STATE_SECRET before generating materials.')
  const key = createHash('sha256').update(secret).digest()
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const path = (causeId: number) => {
    if (!Number.isSafeInteger(causeId) || causeId <= 0) throw new Error('Invalid cause ID.')
    return resolve(directory, `cause-${causeId}.json`)
  }
  function read(causeId: number): MaterialJob | null {
    let raw: string
    try { raw = readFileSync(path(causeId), 'utf8') } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
    const envelope = JSON.parse(raw)
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'hex'))
    decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'))
    const job = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'hex')), decipher.final()]).toString('utf8')) as MaterialJob
    if (job.causeId !== causeId) throw new Error('Material job account mismatch.')
    return job
  }
  function save(job: MaterialJob, replace = false) {
    const current = read(job.causeId)
    if (!replace && current && current.id !== job.id) return
    job.updatedAt = new Date().toISOString()
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv)
    const data = Buffer.concat([cipher.update(JSON.stringify(job)), cipher.final()])
    const target = path(job.causeId)
    writeFileSync(`${target}.tmp`, JSON.stringify({ iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data: data.toString('hex') }), { mode: 0o600 })
    renameSync(`${target}.tmp`, target)
  }
  return {
    read, save,
    list: () => readdirSync(directory).filter(file => /^cause-\d+\.json$/.test(file)).map(file => read(Number(file.slice(6, -5)))!),
    enqueue(cause: MaterialJob['cause'], accessToken: string) {
      const previous = read(cause.id)
      if (previous && materialJobActive(previous)) return { job: previous, reused: true }
      const job: MaterialJob = { id: randomUUID(), causeId: cause.id, cause, accessToken, status: 'queued', stage: 'Waiting to create 12 flyers', flyerCount: 0, flyerVersion: null, createdAt: new Date().toISOString(), updatedAt: '', completedAt: null, error: null, notification: 'pending', notificationError: null }
      save(job, true)
      return { job, reused: false }
    },
  }
}
