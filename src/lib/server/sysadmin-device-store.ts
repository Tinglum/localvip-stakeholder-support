import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { QaSession } from '../auth/qa-auth'

export interface AdminDevice {
  sub: string; session: QaSession; salt: string; pinHash: string
  failures: number; expires: number
}

// Persistent, encrypted storage outside the release directory on the single-host
// deployment. Atomic directory locks also serialize attempts across Node workers.
export function sysadminDeviceStore(directory: string, secret: string) {
  if (!secret) throw new Error('Sysadmin device encryption is not configured.')
  const key = createHash('sha256').update(`sysadmin-devices:${secret}`).digest()
  const path = (token: string) => {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid device token.')
    return resolve(directory, `${createHash('sha256').update(token).digest('hex')}.json`)
  }
  async function read(token: string): Promise<AdminDevice | null> {
    let raw: string
    try { raw = await readFile(path(token), 'utf8') } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
    const envelope = JSON.parse(raw)
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'hex'))
    decipher.setAAD(Buffer.from(token))
    decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'))
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'hex')), decipher.final()]).toString())
  }
  async function save(token: string, record: AdminDevice) {
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv)
    cipher.setAAD(Buffer.from(token))
    const data = Buffer.concat([cipher.update(JSON.stringify(record)), cipher.final()])
    const target = path(token), temp = `${target}.${randomBytes(8).toString('hex')}.tmp`
    await writeFile(temp, JSON.stringify({ iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data: data.toString('hex') }), { mode: 0o600 })
    await rename(temp, target)
  }
  return {
    read, save,
    remove: async (token: string) => { await rm(path(token), { force: true }) },
    async locked<T>(token: string, action: () => Promise<T>): Promise<T> {
      await mkdir(directory, { recursive: true, mode: 0o700 })
      const lock = `${path(token)}.lock`
      // Fail closed if an attempt is already running; never reset a failed-attempt
      // counter from a competing request. An interrupted lock needs operator cleanup.
      try { await mkdir(lock, { mode: 0o700 }) } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('Another PIN request is in progress. Try again shortly.')
        throw error
      }
      try { return await action() } finally { await rm(lock, { recursive: true, force: true }) }
    },
  }
}

export function hashDevicePin(pin: string, salt: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error('Enter exactly four digits.')
  return scryptSync(pin, salt, 32).toString('hex')
}
export function matchesDevicePin(pin: string, record: AdminDevice) {
  return timingSafeEqual(Buffer.from(hashDevicePin(pin, record.salt), 'hex'), Buffer.from(record.pinHash, 'hex'))
}
