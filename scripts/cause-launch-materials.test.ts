import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateCauseLaunchMaterials, getCauseLaunchStatus } from '../src/lib/server/cause-launch-materials'
import { getConsumerWebappBaseUrl as campaignAppOrigin } from '../src/lib/material-engine'
import { FLYER_DESIGNS, approvedFlyerTemplateId, buildCauseCampaignFlyerSvg, flyerKind, renderCauseCampaignFlyer } from '../src/lib/server/cause-campaign-flyers'
import { createCanvas } from '@napi-rs/canvas'

// These unit tests provide an in-process fetch stub. The isolated process is
// checked separately with real uploads on the production host.
process.env.LOCALVIP_FLYER_WORKER = '1'

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

test('automatic launch saves all twelve audience and design combinations', async () => {
  const originalFetch = globalThis.fetch
  const canvas = createCanvas(300, 180)
  canvas.getContext('2d').fillRect(0, 0, 300, 180)
  const image = await canvas.encode('png')
  globalThis.fetch = async () => new Response(new Uint8Array(image), { status: 200 })
  const logoUrl = 'https://qa.localvip.com/uploads/logos/logo.png'
  const coverUrl = 'https://qa.localvip.com/uploads/covers/cover.png'
  const saved: Array<{ audience: string; design: string }> = []
  const progressCounts: number[] = []
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
      referralCode: 'TEST', imageUrl: logoUrl, coverPhotoUrl: coverUrl }, request, count => {
        assert.equal(saved.length, count, 'Progress must advance only after saving the PDF')
        progressCounts.push(count)
      })
    assert.equal(result.steps.flyers.status, 'generated')
    assert.equal(saved.length, 12)
    assert.deepEqual(progressCounts, Array.from({length:13},(_,index)=>index))
    assert.equal(new Set(saved.map(item => `${item.audience}:${item.design}`)).size, 12)
  } finally { globalThis.fetch = originalFetch }
})

test('repeat launch keeps the saved audience flyers and template', async () => {
  const logoUrl = 'https://qa.localvip.com/uploads/logos/logo.png'
  const coverUrl = 'https://qa.localvip.com/uploads/covers/cover.png'
  const version = `approved-library-v8|Test School|||test-school-42|${logoUrl}|${coverUrl}|TEST||||||${campaignAppOrigin()}`
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

test('approved Community Win artwork is preserved and personalized', async () => {
  assert.equal(approvedFlyerTemplateId('business', 'community'), 77)
  assert.equal(approvedFlyerTemplateId('families', 'growth'), 71)
  assert.equal(approvedFlyerTemplateId('boosters', 'comparison'), 75)
  const originalFetch = globalThis.fetch
  const canvas = createCanvas(30, 20)
  const bytes = await canvas.encode('png')
  let imageRequests = 0
  globalThis.fetch = async () => { imageRequests++; return new Response(new Uint8Array(bytes)) }
  try {
    const svg = await buildCauseCampaignFlyerSvg({ name: 'Food & Friends', category: 'charity', locality: 'Kansas',
      logoUrl: 'https://qa.localvip.com/uploads/logos/logo.png', coverUrl: 'https://qa.localvip.com/uploads/covers/photo.png',
      joinUrl: 'https://my.localvip.com/go/campaign/food-friends/business?ref=TEST', audience: 'business', colors: { navy: '#228844', gold: '#EEDDCC' } })
    assert.match(svg, /LET'S WIN/)
    assert.match(svg, /RELATIONSHIP LOOP/)
    assert.match(svg, /FOOD &amp; FRIENDS/)
    assert.doesNotMatch(svg, /#228844/)
    assert.match(svg, /#EEDDCC/)
    assert.match(svg, /stop-color="#041735"/)
    assert.match(svg, /\.white\{fill:#fff\}/)
    assert.match(svg, /\.gold\{fill:#efb719\}/)
    assert.match(svg, /r="18" fill="#EEDDCC"/)
    assert.match(svg, /\.step-number\{fill:#000000\}/)
    for (const audience of ['business', 'families', 'schools', 'boosters'] as const) {
      for (const design of FLYER_DESIGNS) {
        const variant = await buildCauseCampaignFlyerSvg({ name: 'Food & Friends', locality: 'Kansas', audience, design,
          logoUrl: 'https://qa.localvip.com/uploads/logos/logo.png', coverUrl: 'https://qa.localvip.com/uploads/covers/photo.png',
          joinUrl: 'https://my.localvip.com/go/campaign/test/business?ref=TEST', colors: { navy: '#228844', gold: '#EEDDCC' } })
        assert.match(variant, /r="(?:18|22)" fill="#EEDDCC"/, `${audience}/${design} has a small cause accent`)
        assert.match(variant, /\.white\{fill:#fff\}/)
        assert.match(variant, /\.gold\{fill:#efb719\}/)
        assert.doesNotMatch(variant, /#228844/)
      }
    }
    assert.doesNotMatch(svg, /Olathe|OLATHE|12TH MAN|{{[A-Z_]+}}/)
    assert.match(svg, /x="40" y="1299" width="133" height="133"/)
    const booster = await buildCauseCampaignFlyerSvg({ name: 'Test School', category: 'school', locality: 'Kansas',
      logoUrl: 'https://qa.localvip.com/uploads/logos/logo.png', coverUrl: 'https://qa.localvip.com/uploads/covers/photo.png',
      joinUrl: 'https://my.localvip.com/go/campaign/test-school/boosters?ref=TEST', audience: 'boosters' })
    assert.match(booster, /YOUR CLUB\./)
    assert.doesNotMatch(booster, /YOUR SCHOOL\./)
    assert.equal(imageRequests, 2, 'audience variants reuse the prepared logo and photo')
    const manual = await buildCauseCampaignFlyerSvg({ name: 'Manual Palette', locality: 'Kansas', audience: 'business',
      logoUrl: 'https://qa.localvip.com/uploads/logos/logo.png', coverUrl: 'https://qa.localvip.com/uploads/covers/photo.png',
      joinUrl: 'https://my.localvip.com/go/campaign/test/business?ref=TEST',
      palette: { background: '#193629', highlight: '#D9B75B', accent: '#EEAA99' } })
    assert.match(manual, /stop-color="#193629"/)
    assert.match(manual, /\.gold\{fill:#D9B75B\}/)
    assert.match(manual, /r="18" fill="#EEAA99"/)
    assert.doesNotMatch(manual, /#041735/)
    const webp = await canvas.encode('webp')
    globalThis.fetch = async () => new Response(new Uint8Array(webp))
    const webpSvg = await buildCauseCampaignFlyerSvg({ name: 'WebP Cause', locality: 'Kansas',
      logoUrl: 'https://qa.localvip.com/uploads/logos/logo.webp', coverUrl: 'https://qa.localvip.com/uploads/covers/photo.webp',
      joinUrl: 'https://my.localvip.com/go/campaign/webp/business?ref=TEST', audience: 'business' })
    assert.match(webpSvg, /data:image\/png;base64,/)
    assert.doesNotMatch(webpSvg, /data:image\/webp/)
  } finally { globalThis.fetch = originalFetch }
})
