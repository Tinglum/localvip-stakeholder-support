import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { test } from 'node:test'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { buildCauseCampaignFlyerSvg, FLYER_DESIGNS, getFlyerSlots, renderCauseCampaignFlyer, validateFlyerOverrides } from '../src/lib/server/cause-campaign-flyers'

process.env.LOCALVIP_FLYER_WORKER = '1' // render in-process so the fetch fixture applies
const base = 'https://qa.localvip.com/uploads'
const input = {
  name: 'Test School', locality: 'Olathe, KS', logoUrl: `${base}/logos/logo.png`, coverUrl: `${base}/covers/cover.png`,
  joinUrl: 'https://my.localvip.com/go/campaign/test/business?ref=TEST', audience: 'business' as const, design: 'community' as const,
}

async function solid(color: string) {
  const canvas = createCanvas(400, 400)
  const context = canvas.getContext('2d')
  context.fillStyle = color
  context.fillRect(0, 0, 400, 400)
  return canvas.encode('png')
}

async function withImages<T>(run: () => Promise<T>) {
  const images: Record<string, Buffer> = {
    [input.logoUrl]: await solid('#1040c0'), [input.coverUrl]: await solid('#808080'),
    [`${base}/flyer-edits/logo.png`]: await solid('#e01010'), [`${base}/flyer-edits/photo.png`]: await solid('#10c040'),
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url: string | URL | Request) => images[String(url)]
    ? new Response(new Uint8Array(images[String(url)]), { status: 200 }) : new Response('missing', { status: 404 })
  try { return await run() } finally { globalThis.fetch = originalFetch }
}

test('every approved layout exposes named, ordered slots with no unclassified lines', async () => {
  for (const audience of ['business', 'families', 'schools', 'boosters'] as const) {
    for (const design of FLYER_DESIGNS) {
      const slots = await getFlyerSlots({ ...input, audience, design })
      assert.ok(slots.text.length > 30, `${audience}/${design} has too few slots`)
      assert.ok(!slots.text.some(slot => slot.group === 'Other text'), `${audience}/${design} has an unclassified line`)
      assert.equal(new Set(slots.text.map(slot => slot.id)).size, slots.text.length)
      for (const group of ['Headline', 'Step 4 description', 'Call to action', 'Footer']) assert.ok(slots.text.some(slot => slot.group === group))
      assert.deepEqual(slots.images.map(image => image.id), ['logo', 'photo'])
    }
  }
})

test('overrides are validated against the slot list and our asset host', async () => {
  const slots = await getFlyerSlots(input)
  assert.deepEqual(validateFlyerOverrides({ text: { 'headline.1': '  NEW LINE ', 'nope.1': 'x' } }, slots), { overrides: { text: { 'headline.1': 'NEW LINE' } } })
  assert.deepEqual(validateFlyerOverrides({ text: { 'headline.1': slots.text.find(slot => slot.id === 'headline.1')!.default } }, slots), { overrides: {} })
  assert.ok('error' in validateFlyerOverrides({ text: { 'headline.1': 'X'.repeat(500) } }, slots))
  assert.ok('error' in validateFlyerOverrides({ images: { logo: 'https://evil.example.com/uploads/a.png' } }, slots))
  assert.ok('error' in validateFlyerOverrides({ images: { photo: 'http://qa.localvip.com/uploads/a.png' } }, slots))
  assert.deepEqual(validateFlyerOverrides({ images: { photo: `${base}/flyer-edits/photo.png` } }, slots), { overrides: { images: { photo: `${base}/flyer-edits/photo.png` } } })
})

test('text and image overrides reach the rendered flyer, escaped and fitted', async () => {
  await withImages(async () => {
    const overrides = {
      text: { 'headline.1': 'BAKE SALE & <MORE>', 'step2-title.1': 'A MUCH LONGER STEP TITLE THAN THE DESIGN EXPECTED', 'footer.2': 'GO TEAM.', 'header.name': 'Renamed Cause' },
      images: { logo: `${base}/flyer-edits/logo.png`, photo: `${base}/flyer-edits/photo.png` },
    }
    const svg = await buildCauseCampaignFlyerSvg({ ...input, overrides })
    assert.match(svg, /<tspan data-slot="headline.1">BAKE SALE &amp; &lt;MORE&gt;<\/tspan>/)
    assert.match(svg, /<tspan data-slot="footer.2" fill="#efb719">GO TEAM\.<\/tspan>/)
    assert.match(svg, /<g data-slot-header="">[^]*>RENAMED CAUSE</)
    const step = /<text[^>]*font-size="([\d.]+)"[^>]*data-size="(\d+)"[^>]*><tspan data-slot="step2-title.1">A MUCH LONGER STEP TITLE/.exec(svg)
    assert.ok(step && Number(step[1]) < Number(step[2]), 'a long line shrinks below its design size')
    // Every slot line and both images are tagged for the live preview.
    const slots = await getFlyerSlots(input)
    for (const slot of slots.text.filter(item => !item.id.startsWith('header.'))) assert.ok(svg.includes(`data-slot="${slot.id}"`), `${slot.id} is not tagged`)
    assert.equal(svg.match(/data-slot="logo"/g)?.length, 2)
    assert.equal(svg.match(/data-slot="photo"/g)?.length, 1)

    const { pdf, preview } = JSON.parse(Buffer.from(await renderCauseCampaignFlyer({ ...input, overrides }, true)).toString('utf8'))
    assert.equal(Buffer.from(pdf, 'base64').subarray(0, 5).toString(), '%PDF-')
    const png = Buffer.from(preview, 'base64')
    if (process.env.FLYER_PREVIEW_OUT) writeFileSync(process.env.FLYER_PREVIEW_OUT, png)
    const image = await loadImage(png)
    const canvas = createCanvas(image.width, image.height)
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const scale = image.width / 1050
    const pixel = (x: number, y: number) => [...context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data.slice(0, 3)]
    const [r, g, b] = pixel(116, 94) // header logo
    assert.ok(r > 180 && g < 80 && b < 80, `logo override should be red, got ${[r, g, b]}`)
    const [pr, pg, pb] = pixel(1000, 300) // photo side of the hero
    assert.ok(pg > pr + 40 && pg > pb + 40, `photo override should be green, got ${[pr, pg, pb]}`)
  })
})
