// Content for styles D, E and F. Split from the layout code so a copy edit
// never risks the geometry.
//
// The voice rule from the design handover applies throughout: the READER is the
// one doing the thing and LocalVIP helps, and nothing claims anything about
// prices, margins or cost.
//
// Copy pass 2 - five changes per sheet. The pattern across all nine: cut the
// abstract nouns, name the thing that actually happens, and make the CTA an
// instruction rather than a description.
import fs from 'node:fs'
import path from 'node:path'
import { styleD, styleE, styleF, owl, district, CROWD, TEAM, COMMUNITY } from './build-olathe-flyers-styles.mjs'

const root = path.resolve('public/templates/olathe')

const OW = { m: owl, org: ['OLATHE WEST', '12TH MAN'], sub: 'FOOTBALL BOOSTER CLUB' }
const OPS = { m: district, org: ['OLATHE PUBLIC', 'SCHOOLS'], sub: 'COMMUNITY GIVEBACK' }

const rowsBiz = [
  { icon: 'play', label: 'WATCH THE 60-SECOND PLAN' },
  { icon: 'calendar', label: 'BOOK YOUR 15-MINUTE SETUP CALL' },
]
const rowsFam = [
  { icon: 'play', label: 'SEE HOW IT WORKS IN 60 SECONDS' },
  { icon: 'calendar', label: 'SCAN TO JOIN IN 30 SECONDS' },
]
const rowsSch = [
  { icon: 'play', label: 'WATCH THE 60-SECOND OVERVIEW' },
  { icon: 'calendar', label: 'BOOK YOUR 15-MINUTE LAUNCH CALL' },
]

const ctaBiz = ['ONGOING CONNECTION.', 'MORE WAYS TO WIN.']
const ctaFam = ['YOUR FAMILY. OUR COMMUNITY.', 'MORE WAYS TO MAKE AN IMPACT.']
const ctaSch = ['YOUR SCHOOL. OUR COMMUNITY.', 'MORE WAYS TO GROW.']

const footBiz = [
  { icon: 'storefront', label: 'YOUR BUSINESS.' },
  { icon: 'customers', label: 'OUR COMMUNITY.' },
  { icon: 'chart', label: 'MORE WAYS TO WIN.' },
]
const footFam = [
  { icon: 'bag', label: 'SAME SHOPPING.' },
  { icon: 'heart', label: 'MORE FOR OUR KIDS.' },
  { icon: 'customers', label: 'REWARDS FOR YOU.' },
]
const footSch = [
  { icon: 'badge', label: 'YOUR SCHOOL.' },
  { icon: 'storefront', label: 'LOCAL PARTNERS.' },
  { icon: 'network', label: 'BUILT TO REPEAT.' },
]

const D = {
  // Copy: (1) kicker states the offer instead of naming it, (2) blurb names who
  // sees it, (3) col 3 leads with the owner's outcome, (4) CTA is an
  // instruction, (5) footer says what each party gets.
  business: styleD({
    ...OW, hero: TEAM,
    kicker: 'PICK A DAY. WE BRING THE CROWD.',
    title: [{ t: 'YOUR BUSINESS.' }, { t: 'OUR COMMUNITY.' }, { t: "LET'S WIN TOGETHER.", gold: true }],
    blurb: ['Choose the day you want busier. Put it in front of Olathe West', 'families, fans and local supporters.'],
    cols: [
      { icon: 'calendar', title: 'YOU PICK|THE DAY', lines: ['A Tuesday, a slow', 'afternoon, whatever', 'needs the traffic.'] },
      { icon: 'megaphone', title: 'WE HELP|RALLY SUPPORT', lines: ['Email, socials and', 'game-night reach to', 'Olathe West families.'] },
      { icon: 'customers', title: 'THEY WALK|THROUGH THE DOOR', lines: ['You get customers.', 'They earn back.', 'Olathe West gains.'] },
      { icon: 'infinity', title: 'THEY KEEP|COMING BACK', lines: ['One day becomes a', 'reason to return all', 'season.'] },
    ],
    ctaTitle: ctaBiz,
    ctaRows: rowsBiz,
    script: "We'll handle the promotion.",
    foot: footBiz,
  }),
  parent: styleD({
    ...OW, hero: CROWD,
    kicker: 'SHOP LOCAL. LIFT OLATHE WEST.',
    title: [{ t: 'THE SHOPPING' }, { t: 'YOU ALREADY DO.' }, { t: 'WORKING HARDER.', gold: true }],
    blurb: ['Nothing extra to buy and nothing extra to remember.', 'The same coffee, haircut and dinner out.'],
    cols: [
      { icon: 'badge', title: 'JOIN ONCE|TAKES A MINUTE', lines: ['Scan the Olathe West', 'code. That is the', 'whole setup.'] },
      { icon: 'bag', title: 'SHOP WHERE|YOU ALWAYS DO', lines: ['Local places you', 'already know and', 'already trust.'] },
      { icon: 'customers', title: 'YOUR FAMILY|EARNS BACK', lines: ['Rewards land with', 'the people doing', 'the shopping.'] },
      { icon: 'infinity', title: 'AND IT|KEEPS GOING', lines: ['Not one night. Every', 'ordinary week after', 'it.'] },
    ],
    ctaTitle: ctaFam,
    ctaRows: rowsFam,
    script: 'Same routine. More impact.',
    foot: footFam,
  }),
  school: styleD({
    ...OPS, hero: COMMUNITY,
    kicker: 'START WITH ONE CAMPUS. THEN SCALE.',
    title: [{ t: 'ONE GIVEBACK DAY.' }, { t: 'ONE FRAMEWORK.' }, { t: 'EVERY CAMPUS.', gold: true }],
    blurb: ['Run it once at one school. Repeat it without designing', 'anything new for the next.'],
    cols: [
      { icon: 'calendar', title: 'ONE SCHOOL|ONE DAY', lines: ['A single campus and', 'a single QR code to', 'start.'] },
      { icon: 'megaphone', title: 'WE REACH|YOUR FAMILIES', lines: ['We promote taking', 'part to families and', 'local supporters.'] },
      { icon: 'customers', title: 'EVERY SIDE|COMES OUT AHEAD', lines: ['Businesses get trade.', 'Families earn back.', 'The school benefits.'] },
      { icon: 'network', title: 'THEN ROLL|IT OUT', lines: ['Same framework, new', 'campus, no new', 'collateral.'] },
    ],
    ctaTitle: ctaSch,
    ctaRows: rowsSch,
    script: "We'll make it easy to run.",
    foot: footSch,
  }),
}

const E = {
  business: styleE({
    ...OW, band: TEAM, band2: CROWD, band3: COMMUNITY,
    kicker: 'FOR LOCAL BUSINESS OWNERS',
    title: ['YOU KNOW GIVEBACK DAYS.', 'THIS ONE WORKS HARDER.'],
    script: 'Same generosity. More ways to win.',
    blurb: ["You've backed Olathe West before. This keeps what already works", 'and adds a reason for those customers to come back next week.'],
    steps: [
      { title: 'PICK YOUR GIVEBACK DAY', line: 'The slow Tuesday, not the busy Saturday.' },
      { title: 'WE RALLY OLATHE WEST', line: 'Families, fans and supporters hear about it.' },
      { title: 'THE CONNECTION CAN CONTINUE', line: 'Give those customers another reason to come back.' },
    ],
    quote: 'One Giveback Day. More reasons to come back.',
    ctaTitle: ctaBiz,
    ctaRows: rowsBiz,
    ctaAside: 'Pick a slow day.',
    foot: footBiz,
  }),
  parent: styleE({
    ...OW, band: COMMUNITY, band2: CROWD, band3: TEAM,
    kicker: 'FOR PARENTS, FAMILIES AND SUPPORTERS',
    title: ['THE SHOPPING YOU', 'ALREADY DO. WORKING HARDER.'],
    script: 'Same routine. More impact.',
    blurb: ['No extra spending and nothing new to remember. Just the coffee,', 'the haircut and the dinner out you were having anyway.'],
    steps: [
      { title: 'JOIN ONCE', line: 'Scan the Olathe West code. That is the setup.' },
      { title: 'SHOP WHERE YOU ALWAYS DO', line: 'Local places you already know and trust.' },
      { title: 'IT KEEPS GIVING', line: 'Every ordinary week, not just one night.' },
    ],
    quote: 'The same money, doing two jobs instead of one.',
    ctaTitle: ctaFam,
    ctaRows: rowsFam,
    ctaAside: 'Takes one minute.',
    foot: footFam,
  }),
  school: styleE({
    ...OPS, band: COMMUNITY, band2: TEAM, band3: CROWD,
    kicker: 'FOR PRINCIPALS, ATHLETIC DIRECTORS AND DISTRICT LEADERS',
    title: ['ONE GIVEBACK DAY CAN', 'BECOME MORE THAN ONE DAY.'],
    script: 'Same idea. Built to repeat.',
    blurb: ['The message stays the same across Olathe Public Schools. Each admin', 'adds the QR code for their own campus or campaign.'],
    steps: [
      { title: 'START WITH ONE CAMPUS', line: 'One school, one day, one QR code.' },
      { title: 'KEEP IT CONSISTENT', line: 'The same sheet works for every school.' },
      { title: 'THEN EXTEND IT', line: 'District-wide without new collateral.' },
    ],
    quote: 'One flyer for the district, not one per campus.',
    ctaTitle: ctaSch,
    ctaRows: rowsSch,
    ctaAside: 'Start with one school.',
    foot: footSch,
  }),
}

const F = {
  business: styleF({
    ...OW,
    big: [{ t: 'GENEROSITY' }, { t: "SHOULDN'T BE" }, { t: 'ONE-WAY.', gold: true }],
    sub2: "You've given to Olathe West for years. This gives something back.",
    chip: 'YOU PICK THE DAY',
    blocks: [
      { icon: 'repeat', title: 'THEY COME BACK', line: 'A reason to return, not just to visit once.' },
      { icon: 'customers', title: 'YOUR REGULARS EARN', line: 'The people already loyal to you get something for it.' },
      { icon: 'chart', title: 'NEW FACES FIND YOU', line: 'Olathe West families who have not walked in yet.' },
    ],
    script: 'You pick the day. We do the rest.',
    signoff: 'See you on game night.',
    ctaTitle: ctaBiz,
    ctaRows: rowsBiz,
    foot: footBiz,
  }),
  parent: styleF({
    ...OW,
    big: [{ t: 'YOUR NEXT' }, { t: 'LOCAL PURCHASE' }, { t: 'CAN DO MORE.', gold: true }],
    sub2: 'No extra spending. No extra steps. The shops you already choose.',
    chip: 'TAKES ONE MINUTE TO JOIN',
    blocks: [
      { icon: 'bag', title: 'SHOP AS USUAL', line: 'Local places you already know and trust.' },
      { icon: 'heart', title: 'OLATHE WEST GAINS', line: 'Support reaches the school from ordinary purchases.' },
      { icon: 'customers', title: 'YOUR FAMILY EARNS', line: 'Rewards land with the people doing the shopping.' },
    ],
    script: 'Same routine. More impact.',
    signoff: 'Go Owls.',
    ctaTitle: ctaFam,
    ctaRows: rowsFam,
    foot: footFam,
  }),
  school: styleF({
    ...OPS,
    big: [{ t: 'ONE FRAMEWORK.' }, { t: 'EVERY CAMPUS.' }, { t: 'BUILT TO REPEAT.', gold: true }],
    sub2: 'Less collateral to maintain, and a programme families recognise.',
    chip: 'ONE SHEET FOR THE DISTRICT',
    blocks: [
      { icon: 'badge', title: 'EASY TO ACTIVATE', line: 'Add your school QR. Nothing else changes.' },
      { icon: 'storefront', title: 'LOCAL PARTNERS', line: 'Connect each campus with businesses nearby.' },
      { icon: 'network', title: 'ROOM TO GROW', line: 'Start with one school and extend across the district.' },
    ],
    script: 'Same idea. Built to repeat.',
    signoff: "We'll help you launch.",
    ctaTitle: ctaSch,
    ctaRows: rowsSch,
    foot: footSch,
  }),
}

const productionNames = {
  d: 'photo-led',
  e: 'editorial',
  f: 'bold-modular',
}

for (const [style, set] of Object.entries({ d: D, e: E, f: F })) {
  for (const [aud, svg] of Object.entries(set)) {
    const optionName = `${aud}-option-${style}.svg`
    const productionName = `${aud}-${productionNames[style]}.svg`
    const cleanSvg = svg.replace(/[ \t]+$/gm, '')
    fs.writeFileSync(path.join(root, optionName), cleanSvg)
    fs.writeFileSync(path.join(root, productionName), cleanSvg)
    console.log('Wrote', productionName)
  }
}

const audienceDetails = {
  business: {
    label: 'Business',
    description: 'Business-facing Olathe West flyer focused on repeat visits, existing customers, slower-day traffic, and LocalVIP network reach.',
    stakeholderTypes: ['business'],
    audienceTags: ['olathe', 'olathe-west', 'business', 'giveback-day'],
  },
  parent: {
    label: 'Parent & Supporter',
    description: 'Parent and supporter flyer connecting everyday local shopping, family rewards, and ongoing support for Olathe West.',
    stakeholderTypes: ['community', 'cause'],
    audienceTags: ['olathe', 'olathe-west', 'parents', 'supporters'],
  },
  school: {
    label: 'School & District',
    description: 'School and district flyer for launching a repeatable community-giveback programme with campus-specific QR codes.',
    stakeholderTypes: ['school', 'cause', 'community'],
    audienceTags: ['olathe', 'olathe-public-schools', 'school', 'district'],
  },
}

const designDetails = {
  approved: { label: 'Approved 12th Man Layout', slug: 'approved-layout', qr: { x: 8.5714, y: 78.4, size: 19.4286 } },
  d: { label: 'Photo-Led Campaign', slug: 'photo-led', qr: { x: 4.9524, y: 77.0667, size: 15.8095 } },
  e: { label: 'Editorial Explainer', slug: 'editorial', qr: { x: 4.9524, y: 79.8667, size: 15.8095 } },
}

const manifest = []
for (const [style, design] of Object.entries(designDetails)) {
  for (const [audience, details] of Object.entries(audienceDetails)) {
    const fileName = `${audience}-${design.slug}.svg`
    manifest.push({
      key: `olathe-${audience}-${design.slug}`,
      title: `Olathe ${details.label} — ${design.label}`,
      description: details.description,
      audience,
      design: design.slug,
      fileName,
      publicPath: `/templates/olathe/${fileName}`,
      mimeType: 'image/svg+xml',
      type: 'flyer',
      brand: 'localvip',
      category: 'olathe-community-giveback',
      useCase: audience === 'business' ? 'business_outreach' : audience === 'parent' ? 'parent_supporter_outreach' : 'school_outreach',
      targetRoles: audience === 'business' ? ['business'] : ['community'],
      targetSubtypes: audience === 'school' ? ['school'] : audience === 'parent' ? ['cause'] : [],
      causeAccountIds: audience === 'school' ? [190045, 190046] : [190046],
      metadata: {
        collection: 'olathe-community-giveback',
        template_key: `olathe-${audience}-${design.slug}`,
        audience,
        design_system: design.slug,
        allowed_cause_account_ids: audience === 'school' ? [190045, 190046] : [190046],
        qr_placement: { id: `olathe_${audience}_${style}_qr`, page: 1, ...design.qr },
        qr_placements: [{ id: `olathe_${audience}_${style}_qr`, page: 1, ...design.qr }],
        automation_template: {
          enabled: true,
          is_active: true,
          stakeholder_types: details.stakeholderTypes,
          audience_tags: details.audienceTags,
          library_folder: 'share_with_customers',
          qr_zone_count: 1,
        },
      },
    })
  }
}

// School-dashboard template for business outreach. The source deliberately
// leaves the QR zone blank; the material engine inserts the selected school's
// campaign QR when a school user generates a copy.
manifest.push({
  key: 'olathe-business-community-win',
  title: 'Olathe West — Business Giveback Day Flyer',
  description: 'Business-facing Olathe West Giveback Day flyer for schools to share with prospective local business partners.',
  audience: 'business',
  design: 'community-win',
  fileName: 'business-community-win.svg',
  publicPath: '/templates/olathe/business-community-win.svg',
  mimeType: 'image/svg+xml',
  type: 'flyer',
  brand: 'localvip',
  category: 'olathe-community-giveback',
  useCase: 'business_outreach',
  targetRoles: ['community'],
  targetSubtypes: ['school'],
  causeAccountIds: [190045, 190046],
  metadata: {
    collection: 'olathe-community-giveback',
    template_key: 'olathe-business-community-win',
    audience: 'business',
    flyer_type: 'business',
    material_tags: ['business-flyer', 'business-outreach'],
    design_system: 'community-win',
    allowed_cause_account_ids: [190045, 190046],
    qr_placement: { id: 'olathe_business_community_win_qr', page: 1, x: 4.0952, y: 86.8, size: 12.0952 },
    qr_placements: [{ id: 'olathe_business_community_win_qr', page: 1, x: 4.0952, y: 86.8, size: 12.0952 }],
    automation_template: {
      enabled: true,
      is_active: true,
      stakeholder_types: ['school', 'cause', 'community'],
      audience_tags: ['olathe', 'olathe-west', 'businesses', 'giveback-day'],
      library_folder: 'share_with_businesses',
      qr_zone_count: 1,
    },
  },
})

fs.writeFileSync(path.join(root, 'olathe-template-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log('Wrote olathe-template-manifest.json')
