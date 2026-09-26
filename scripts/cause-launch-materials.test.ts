import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateCauseLaunchMaterials, getCauseLaunchStatus } from '../src/lib/server/cause-launch-materials'

test('new school creates a landing draft and only school/cause flyers', async () => {
  const calls: Array<{ path: string; method: string; body?: Record<string, unknown> }> = []
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const method = init?.method || 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined
    calls.push({ path, method, body })
    if (path.endsWith('/landing-page') && method === 'GET') return { status: 'not_started' } as T
    if (path.endsWith('/landing-page') && method === 'PUT') return { blockers: ['Upload a cover photo.'] } as T
    if (path.includes('/MaterialTemplate')) return [
      { id: 1, name: 'School flyer', stakeholderTypes: '["school"]' },
      { id: 2, name: 'Cause flyer', stakeholderTypes: 'cause,community' },
      { id: 3, name: 'Business flyer', stakeholderTypes: 'business' },
    ] as T
    if (path.endsWith('/GeneratedMaterial') && method === 'POST') return { id: 4 } as T
    throw new Error(`Unexpected call: ${method} ${path}`)
  }
  const result = await generateCauseLaunchMaterials({
    id: 42, name: 'Test School', city: 'Olathe', state: 'KS',
    category: 'school', referralCode: 'TEST', imageUrl: 'logo.png',
  }, request)
  assert.equal(result.steps.landingPages.status, 'draft')
  assert.equal(result.steps.flyers.status, 'generated')
  assert.equal(result.steps.video.status, 'waiting')
  const flyerCalls = calls.filter(call => call.path.endsWith('/GeneratedMaterial'))
  assert.deepEqual(flyerCalls.map(call => call.body?.templateId), [1, 2])
  const draft = calls.find(call => call.path.endsWith('/landing-page') && call.method === 'PUT')?.body?.config as { assets: { mark: { src: string } } }
  assert.match(draft.assets.mark.src, /\/uploads\/logos\/logo\.png$/)
})

test('status is based on saved files and the campaign draft', async () => {
  const request = async <T>(path: string): Promise<T> => path.endsWith('/landing-page')
    ? { status: 'draft', draft: { video: { src: 'https://example.org/video.mp4' } } } as T
    : { items: [{ generatedFileUrl: 'https://example.org/flyer.pdf', generationStatus: 'generated' }] } as T
  assert.deepEqual(await getCauseLaunchStatus(42, request), {
    flyers: 'generated', flyerCount: 1, landingPages: 'draft', landingSlug: null,
    video: 'generated', videoUrl: 'https://example.org/video.mp4',
  })
})

test('missing assets show a waiting video status', async () => {
  const request = async <T>(path: string): Promise<T> => path.endsWith('/landing-page')
    ? { status: 'draft', draft: { assets: { mark: { src: 'https://example.org/logo.png' }, crowd: { src: '' } } } } as T
    : { items: [] } as T
  const status = await getCauseLaunchStatus(42, request)
  assert.equal(status.video, 'waiting for images')
  assert.equal(status.flyers, 'missing')
})
