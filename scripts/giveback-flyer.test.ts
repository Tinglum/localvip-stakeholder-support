import assert from 'node:assert/strict'
import test from 'node:test'
import { createCanvas } from '@napi-rs/canvas'
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib'
import { buildCauseCampaignFlyerSvg, getGivebackFlyerSlots, renderCauseCampaignFlyer, validateFlyerOverrides } from '../src/lib/server/cause-campaign-flyers'
import { designAudiences, isGeneratorDesign } from '../src/lib/flyer-designs'

// Run with LOCALVIP_FLYER_WORKER=1 so renders stay in this process and use the fetch stub.
const base = {
  logoUrl: 'https://qa.localvip.com/uploads/logos/logo.png', coverUrl: 'https://qa.localvip.com/uploads/covers/cover.png',
  joinUrl: 'https://my.localvip.com/x', audience: 'business' as const, design: 'giveback' as const,
}
const fathersClub = { ...base, name: "The Father's Club", locality: 'Olathe, KS', parentOrganization: 'Olathe Public Schools',
  owner: { name: 'Mike Davisson', email: 'mdavisson@fathersclub.org', phone: '(913) 414-2600' } }
const library = { ...base, name: 'Friends of the Lenexa Library', locality: 'Lenexa, KS', category: 'Library' }

test.before(async () => {
  const canvas = createCanvas(320, 240)
  const context = canvas.getContext('2d')
  context.fillStyle = '#7a4a2a'
  context.fillRect(40, 30, 240, 180)
  const image = await canvas.encode('png')
  globalThis.fetch = async () => new Response(new Uint8Array(image), { status: 200 })
})

test('GiveBack Days is a business-only generator design', () => {
  assert.ok(isGeneratorDesign('giveback'))
  assert.deepEqual(designAudiences('giveback'), ['business'])
  assert.deepEqual(designAudiences('community'), ['business', 'families', 'schools', 'boosters'])
})

test('every line is a slot worded from the cause, and every slot prints once', async () => {
  const slots = getGivebackFlyerSlots(fathersClub)
  const ids = slots.text.map(slot => slot.id)
  assert.equal(new Set(ids).size, ids.length)
  const value = (id: string) => slots.text.find(slot => slot.id === id)?.default
  assert.equal(value('org.1'), "THE FATHER'S CLUB")
  assert.equal(value('host-name.1'), 'Mike Davisson')
  assert.equal(value('host-contact.1'), 'mdavisson@fathersclub.org · (913) 414-2600')
  assert.equal(value('highlight.2'), 'Stronger Olathe schools.')
  assert.equal(value('district.2'), 'SUPPORTING OLATHE PUBLIC SCHOOLS')
  assert.deepEqual(slots.images.map(image => image.id), ['logo', 'photo'])
  const svg = await buildCauseCampaignFlyerSvg(fathersClub)
  for (const id of ids) assert.equal(svg.split(`data-slot="${id}"`).length - 1, 1, id)
  assert.equal(svg.split('data-slot="logo"').length - 1, 2)
  assert.match(svg, /viewBox="0 0 612 792"/)
})

test('a general cause gets community wording and no district mark', async () => {
  const slots = getGivebackFlyerSlots(library)
  const value = (id: string) => slots.text.find(slot => slot.id === id)?.default
  assert.equal(value('highlight.2'), 'A stronger Lenexa community.')
  assert.equal(value('third-title.1'), 'Our cause')
  assert.equal(value('host-name.1'), 'Friends of the Lenexa Library')
  const withDistrict = await buildCauseCampaignFlyerSvg(fathersClub)
  const without = await buildCauseCampaignFlyerSvg(library)
  assert.ok(withDistrict.split('<image').length > without.split('<image').length)
})

test('edits are escaped, long lines are fitted, and unknown slots are ignored', async () => {
  const slots = getGivebackFlyerSlots(fathersClub)
  const checked = validateFlyerOverrides({ text: { 'headline.1': 'Busy days & <nights> too', 'not-a-slot': 'x' } }, slots)
  assert.ok('overrides' in checked)
  const svg = await buildCauseCampaignFlyerSvg({ ...fathersClub, overrides: checked.overrides })
  assert.match(svg, /&amp; &lt;nights&gt;/)
  const size = Number(/font-size="([\d.]+)"[^>]*><tspan data-slot="headline\.1"/.exec(svg)?.[1])
  assert.ok(size < 32, `headline.1 fitted to ${size}`)
  assert.doesNotMatch(svg, /not-a-slot/)
})

test('the QR panel is blank unless the booking QR is asked for', async () => {
  assert.doesNotMatch(await buildCauseCampaignFlyerSvg(fathersClub), /x="478" y="594"/)
  assert.match(await buildCauseCampaignFlyerSvg({ ...fathersClub, qr: true }), /<image href="data:image\/png[^"]*" x="478" y="594"/)
})

test('the print PDF is one Letter page with embedded, vector type', async () => {
  const result = JSON.parse(Buffer.from(await renderCauseCampaignFlyer(fathersClub, true)).toString('utf8'))
  const bytes = Buffer.from(result.pdf, 'base64')
  const document = await PDFDocument.load(bytes)
  assert.equal(document.getPageCount(), 1)
  assert.deepEqual([document.getPage(0).getWidth(), document.getPage(0).getHeight()], [612, 792])
  const fonts = [...document.context.enumerateIndirectObjects()].filter(([, object]) => object instanceof PDFDict && object.get(PDFName.of('Type')) === PDFName.of('Font'))
  assert.ok(fonts.length >= 4, `embedded fonts: ${fonts.length}`)
  assert.ok(result.preview.length > 1000)
})
