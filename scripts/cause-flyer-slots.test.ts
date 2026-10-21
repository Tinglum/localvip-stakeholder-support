import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { test } from 'node:test'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { buildCauseCampaignFlyerSvg, FLYER_DESIGNS, getFlyerSlots, renderCauseCampaignFlyer, validateFlyerOverrides } from '../src/lib/server/cause-campaign-flyers'
import { FLYER_ORG_WORD_SLOT, flyerEditsFor, storeFlyerEdits } from '../src/lib/flyer-slots'
import { flyerPhotoFor } from '../src/lib/flyer-designs'

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
    // The space between a footer's runs survives tagging.
    assert.match(svg, /<\/tspan> <tspan data-slot="footer.2" fill="#efb719">GO TEAM\.<\/tspan>/)
    assert.match(svg, /<g data-slot-header="">[^]*>RENAMED CAUSE</)
    const step = /<text[^>]*font-size="([\d.]+)"[^>]*data-size="(\d+)"[^>]*><tspan data-slot="step2-title.1">A MUCH LONGER STEP TITLE/.exec(svg)
    assert.ok(step && Number(step[1]) < Number(step[2]), 'a long line shrinks below its design size')
    // Every slot line and both images are tagged for the live preview.
    const slots = await getFlyerSlots(input)
    // The organization word rewrites lines rather than being a line of its own.
    for (const slot of slots.text.filter(item => !item.id.startsWith('header.') && item.id !== FLYER_ORG_WORD_SLOT)) assert.ok(svg.includes(`data-slot="${slot.id}"`), `${slot.id} is not tagged`)
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

/** The printed words of a flyer: text content only, with embedded images removed. */
const printedText = (svg: string) => [...svg.replace(/href="data:[^"]*"/g, '').matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)]
  .map(match => match[1].replace(/<[^>]+>/g, ' ')).join(' | ')

test('no flyer prints the source library school name or the LocalVIP mark (bug reports 278, 279)', async () => {
  await withImages(async () => {
    for (const name of ['Olathe School District Activity Fund', 'Northwest Booster Club', 'Hope Food Pantry']) {
      for (const audience of ['business', 'families', 'schools', 'boosters'] as const) {
        for (const design of FLYER_DESIGNS) {
          const svg = await buildCauseCampaignFlyerSvg({ ...input, name, audience, design })
          const words = printedText(svg).replace(/OLATHE SCHOOL|Olathe School/g, '') // the cause's own name may say Olathe
          assert.doesNotMatch(words, /\bWEST\b|\bWest\b|OLATHE|Olathe/, `${name} ${audience}/${design}: ${words.match(/.{0,40}(WEST|West|OLATHE|Olathe).{0,40}/)?.[0]}`)
          assert.doesNotMatch(svg, /POWERED BY|Powered by Local VIP/, `${audience}/${design} still has the LocalVIP mark`)
        }
      }
    }
    // The title from the report now names the organization.
    const families = printedText(await buildCauseCampaignFlyerSvg({ ...input, name: 'Olathe School District Activity Fund', audience: 'families', design: 'comparison' }))
    assert.match(families, /SUPPORT THIS[^|]*\|[^|]*SCHOOL’S PROGRAMS/)
  })
})

test('the organization word changes every generated line, is kept cause-wide, and is sanitized (bug report 277)', async () => {
  await withImages(async () => {
    const slots = await getFlyerSlots({ ...input, audience: 'boosters' })
    const word = slots.text.find(slot => slot.id === FLYER_ORG_WORD_SLOT)!
    assert.equal(word.default, 'club')
    assert.ok(word.suggestions?.includes('school') && word.suggestions.includes('team'))

    const club = printedText(await buildCauseCampaignFlyerSvg({ ...input, audience: 'boosters' }))
    const team = printedText(await buildCauseCampaignFlyerSvg({ ...input, audience: 'boosters', overrides: { text: { [FLYER_ORG_WORD_SLOT]: 'team' } } }))
    assert.match(club, /\bclub\b|\bCLUB\b/)
    assert.doesNotMatch(team.replace(/BOOSTER CLUB/g, ''), /\bclub\b|\bCLUB\b/)
    assert.match(team, /\bteam\b|\bTEAM\b/)
    // Line defaults follow the word, so the editor shows what prints.
    const teamSlots = await getFlyerSlots({ ...input, audience: 'boosters', orgWord: 'team' })
    assert.ok(teamSlots.text.some(slot => /\bTEAM\b|\bteam\b/.test(slot.default) && slot.id !== FLYER_ORG_WORD_SLOT))

    const hostile = await buildCauseCampaignFlyerSvg({ ...input, overrides: { text: { [FLYER_ORG_WORD_SLOT]: '<b>$& co' } } })
    assert.doesNotMatch(hostile, /<b>|\$&/)
    assert.match(printedText(hostile), /b co/)

    // Stored once for the cause; every design reads it back.
    const stored = storeFlyerEdits(undefined, 'community', 'business', { text: { [FLYER_ORG_WORD_SLOT]: 'team', 'headline.1': 'HI' } })
    assert.deepEqual(flyerEditsFor(stored, 'growth', 'families'), { text: { [FLYER_ORG_WORD_SLOT]: 'team' } })
    assert.deepEqual(flyerEditsFor(stored, 'community', 'business'), { text: { [FLYER_ORG_WORD_SLOT]: 'team', 'headline.1': 'HI' } })
    // Resetting the word on any design clears it everywhere; other edits stay.
    const reset = storeFlyerEdits(stored, 'growth', 'families', {})
    assert.deepEqual(flyerEditsFor(reset, 'comparison', 'schools'), {})
    assert.deepEqual(flyerEditsFor(reset, 'community', 'business'), { text: { 'headline.1': 'HI' } })
  })
})

test('each flyer design uses a different setup photo, falling back to the supporters photo (bug report 276)', () => {
  const all = { crowd: 'c', team: 't', people: 'p', community: 'm' }
  const used = new Set((['families', 'business'] as const).flatMap(audience => FLYER_DESIGNS.map(design => flyerPhotoFor(audience, design, all))))
  assert.deepEqual([...used].sort(), ['c', 'm', 'p', 't'])
  assert.notEqual(flyerPhotoFor('families', 'community', all), flyerPhotoFor('families', 'growth', all))
  for (const design of FLYER_DESIGNS) assert.equal(flyerPhotoFor('schools', design, { crowd: 'c', team: '' }), 'c')
})
