import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateCauseLaunchMaterials, getCauseLaunchStatus } from '../src/lib/server/cause-launch-materials'
import { FLYER_DESIGNS, flyerKind, renderCauseCampaignFlyer } from '../src/lib/server/cause-campaign-flyers'
import { createCanvas } from '@napi-rs/canvas'

test('flyer identity follows schools, booster clubs and general causes', () => {
  assert.equal(flyerKind('school'), 'school')
  assert.equal(flyerKind('nonprofit', 'West Football Booster Club'), 'booster')
  assert.equal(flyerKind('community', 'Neighborhood Food Pantry'), 'cause')
})

test('new school creates a landing draft and only school/cause flyers', async () => {
  const calls: Array<{ path: string; method: string; body?: Record<string, unknown> }> = []
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const method = init?.method || 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined
    calls.push({ path, method, body })
    if (path.endsWith('/landing-page') && method === 'GET') return { status: 'not_started' } as T
    if (path.endsWith('/landing-page') && method === 'PUT') return { blockers: ['Upload a cover photo.'] } as T
    if (path.includes('/GeneratedMaterial?') && method === 'GET') return { items: [] } as T
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
    flyers: 'waiting for assets', flyerCount: 0, totalMaterialCount: 1, landingPages: 'draft', landingSlug: null,
    video: 'generated', videoUrl: 'https://example.org/video.mp4', shortVideo: 'waiting for images', shortVideoUrl: null,
    missingPhotos: ['crowd', 'team', 'people', 'community'], landingNeedsRepublish: false,
  })
})

test('missing assets show a waiting video status', async () => {
  const request = async <T>(path: string): Promise<T> => path.endsWith('/landing-page')
    ? { status: 'draft', draft: { assets: { mark: { src: 'https://example.org/logo.png' }, crowd: { src: '' } } } } as T
    : { items: [] } as T
  const status = await getCauseLaunchStatus(42, request)
  assert.equal(status.video, 'waiting for images')
  assert.equal(status.flyers, 'waiting for assets')
})

test('four audiences across three designs use the cause assets and produce print-resolution PDFs', async () => {
  const originalFetch = globalThis.fetch
  const fixture = createCanvas(300, 180)
  const context = fixture.getContext('2d')
  context.fillStyle = '#163b70'
  context.fillRect(0, 0, 300, 180)
  const image = await fixture.encode('png')
  globalThis.fetch = async () => new Response(new Uint8Array(image), { status: 200 })
  try {
    for (const audience of ['business', 'families', 'schools', 'boosters'] as const) {
      for (const design of FLYER_DESIGNS) {
      const pdf = await renderCauseCampaignFlyer({ name: 'Test School', locality: 'Olathe, KS',
        logoUrl: 'https://qa.localvip.com/uploads/logos/logo.png',
        coverUrl: 'https://qa.localvip.com/uploads/covers/cover.png',
        joinUrl: `https://my.localvip.com/landing/test-school-42/${audience}?ref=TEST`, audience, design })
      assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), '%PDF-')
      assert.ok(pdf.length > 10000)
      assert.match(Buffer.from(pdf).toString('latin1'), /\/Width 2625\b/)
      }
    }
  } finally { globalThis.fetch = originalFetch }
})

test('flyer-only regeneration leaves the landing page and videos untouched', async () => {
  const calls: string[] = []
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    calls.push(`${init?.method || 'GET'} ${path}`)
    if (path.endsWith('/landing-page')) return { draft: { slug: 'test-school' } } as T
    if (path.includes('/GeneratedMaterial?')) return { items: [] } as T
    throw new Error(`Unexpected call: ${path}`)
  }
  const result = await generateCauseLaunchMaterials({ id: 42, name: 'Test School', referralCode: 'TEST' }, request, true)
  assert.equal(result.steps.flyers.status, 'waiting')
  assert.equal(result.steps.landingPages, undefined)
  assert.equal(result.steps.video, undefined)
  assert.ok(calls.every(call => call.startsWith('GET ')))
})

test('automatic launch saves all twelve audience and design combinations', async () => {
  const originalFetch = globalThis.fetch
  const canvas = createCanvas(300, 180)
  canvas.getContext('2d').fillRect(0, 0, 300, 180)
  const image = await canvas.encode('png')
  globalThis.fetch = async () => new Response(new Uint8Array(image), { status: 200 })
  const logoUrl = 'https://qa.localvip.com/uploads/logos/logo.png'
  const coverUrl = 'https://qa.localvip.com/uploads/covers/cover.png'
  const saved: Array<{ audience: string; design: string }> = []
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    if (path.endsWith('/landing-page')) return { status: 'draft', draft: {
      slug: 'test-school-42', scheduleCallUrl: 'https://example.org/setup',
      assets: { mark: { src: logoUrl }, crowd: { src: coverUrl } },
      video: { src: 'https://example.org/feature.mp4' }, shortVideo: { src: 'https://example.org/short.mp4' },
    } } as T
    if (path.includes('/GeneratedMaterial?')) return { items: [] } as T
    if (path.includes('/MaterialTemplate?')) return [] as T
    if (path.includes('/MaterialAsset/upload')) return { fileUrl: 'https://example.org/flyer.pdf' } as T
    if (path.endsWith('/GeneratedMaterial') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { metadata: { audience: string; design: string } }
      saved.push(body.metadata)
      return { id: saved.length } as T
    }
    throw new Error(`Unexpected request: ${init?.method || 'GET'} ${path}`)
  }
  try {
    const result = await generateCauseLaunchMaterials({ id: 42, name: 'Test School', category: 'school',
      referralCode: 'TEST', imageUrl: logoUrl, coverPhotoUrl: coverUrl }, request)
    assert.equal(result.steps.flyers.status, 'generated')
    assert.equal(saved.length, 12)
    assert.equal(new Set(saved.map(item => `${item.audience}:${item.design}`)).size, 12)
  } finally { globalThis.fetch = originalFetch }
})

test('repeat launch keeps the saved audience flyers and template', async () => {
  const logoUrl = 'https://qa.localvip.com/uploads/logos/logo.png'
  const coverUrl = 'https://qa.localvip.com/uploads/covers/cover.png'
  const version = `campaign-template-v7|Test School|||test-school-42|${logoUrl}|${coverUrl}|TEST|||||`
  const calls: string[] = []
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    calls.push(`${init?.method || 'GET'} ${path}`)
    if (path.endsWith('/landing-page')) return { status: 'draft', draft: { slug: 'test-school-42',
      scheduleCallUrl: 'https://calendly.com/ktinglum/localvip-internship',
      assets: { mark: { src: logoUrl }, crowd: { src: coverUrl } }, video: { src: 'https://example.org/video.mp4' } } } as T
    if (path.includes('/GeneratedMaterial?')) return { items: [
      ...(['business', 'families', 'schools', 'boosters'] as const).flatMap(audience => FLYER_DESIGNS.map(design => ({
        generatedFileUrl: `${audience}-${design}.pdf`, metadata: { generator: 'cause-campaign-v1', audience, design, version },
      }))),
      { generatedFileUrl: 'template.pdf', metadata: { generator: 'cause-template-v1', version: '1|TEST' } },
    ] } as T
    if (path.includes('/MaterialTemplate?')) return [{ id: 1, name: 'School flyer', stakeholderTypes: 'school' }] as T
    throw new Error(`Unexpected request: ${path}`)
  }
  const result = await generateCauseLaunchMaterials({ id: 42, name: 'Test School', referralCode: 'TEST',
    imageUrl: logoUrl, coverPhotoUrl: coverUrl }, request)
  assert.equal(result.steps.flyers.status, 'generated')
  assert.equal(result.steps.video.status, 'waiting')
  assert.ok(calls.every(call => !call.includes('POST /api/dashboard/v1/GeneratedMaterial')
    && !call.includes('POST /api/dashboard/v1/MaterialAsset/upload')))
})
