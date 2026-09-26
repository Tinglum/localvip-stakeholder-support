import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateCauseLaunchMaterials, getCauseLaunchStatus } from '../src/lib/server/cause-launch-materials'
import { renderCauseCampaignFlyer } from '../src/lib/server/cause-campaign-flyers'
import { createCanvas } from '@napi-rs/canvas'

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

test('three audience PDFs use the cause assets and contain a PDF document', async () => {
  const originalFetch = globalThis.fetch
  const fixture = createCanvas(300, 180)
  const context = fixture.getContext('2d')
  context.fillStyle = '#163b70'
  context.fillRect(0, 0, 300, 180)
  const image = await fixture.encode('png')
  globalThis.fetch = async () => new Response(new Uint8Array(image), { status: 200 })
  try {
    for (const audience of ['business', 'families', 'schools'] as const) {
      const pdf = await renderCauseCampaignFlyer({ name: 'Test School', locality: 'Olathe, KS',
        logoUrl: 'https://qa.localvip.com/uploads/logos/logo.png',
        coverUrl: 'https://qa.localvip.com/uploads/covers/cover.png',
        joinUrl: `https://my.localvip.com/landing/test-school-42/${audience}?ref=TEST`, audience })
      assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), '%PDF-')
      assert.ok(pdf.length > 10000)
    }
  } finally { globalThis.fetch = originalFetch }
})
