// Content for styles D, E and F. Split from the layout code so a copy edit
// never risks the geometry.
//
// The voice rule from the design handover applies throughout: the READER is the
// one doing the thing and LocalVIP helps, and nothing claims anything about
// prices, margins or cost.
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
  { icon: 'play', label: 'WATCH HOW IT WORKS' },
  { icon: 'calendar', label: 'JOIN THE OLATHE WEST CAMPAIGN' },
]
const rowsSch = [
  { icon: 'play', label: 'WATCH THE 60-SECOND OVERVIEW' },
  { icon: 'calendar', label: 'BOOK YOUR 15-MINUTE LAUNCH CALL' },
]

const D = {
  business: styleD({
    ...OW, hero: TEAM,
    kicker: 'HOST AN OLATHE WEST GIVEBACK DAY',
    title: [{ t: 'YOUR BUSINESS.' }, { t: 'OUR COMMUNITY.' }, { t: "LET'S WIN TOGETHER.", gold: true }],
    blurb: ['Pick the day you want busier. We rally Olathe West families,', 'fans and supporters behind it.'],
    cols: [
      { icon: 'calendar', title: 'YOU PICK|THE DAY', lines: ['Choose a day that', 'makes sense for', 'your business.'] },
      { icon: 'megaphone', title: 'WE PROMOTE|YOU', lines: ['We rally Olathe West', 'families, fans and', 'supporters.'] },
      { icon: 'customers', title: 'THEY SHOP.|EVERYONE GAINS.', lines: ['You get customers.', 'Shoppers earn back.', 'Olathe West benefits.'] },
      { icon: 'infinity', title: 'THE IMPACT|CONTINUES.', lines: ['That first day turns', 'into an ongoing', 'connection.'] },
    ],
    ctaTitle: ["LET'S PLAN YOUR FIRST", 'OLATHE WEST GIVEBACK DAY'],
    ctaRows: rowsBiz,
    script: "We'll handle the promotion.",
    foot: ['LOCAL BUSINESS.', 'LOCAL FAMILIES.', 'LOCAL IMPACT.'],
  }),
  parent: styleD({
    ...OW, hero: CROWD,
    kicker: 'OLATHE WEST GIVEBACK DAYS',
    title: [{ t: 'SHOP WHERE YOU' }, { t: 'ALREADY SHOP.' }, { t: 'HELP WHERE IT COUNTS.', gold: true }],
    blurb: ['Your everyday choices already support local business.', 'LocalVIP helps them do more for Olathe West.'],
    cols: [
      { icon: 'badge', title: 'JOIN YOUR|SCHOOL', lines: ['Connect through the', 'official campaign', 'code.'] },
      { icon: 'bag', title: 'SHOP AS|USUAL', lines: ['Choose participating', 'businesses you', 'already use.'] },
      { icon: 'customers', title: 'EVERYONE|BENEFITS', lines: ['Your family earns.', 'Olathe West gains.', 'Local shops grow.'] },
      { icon: 'infinity', title: 'ALL YEAR|LONG', lines: ['Not one day. Every', 'ordinary week after', 'it.'] },
    ],
    ctaTitle: ['JOIN THE OLATHE WEST', 'GIVEBACK CAMPAIGN'],
    ctaRows: rowsFam,
    script: 'Same shopping. More impact.',
    foot: ['SAME COMMUNITY.', 'SAME GENEROSITY.', 'MORE WAYS TO WIN.'],
  }),
  school: styleD({
    ...OPS, hero: COMMUNITY,
    kicker: 'A DISTRICT-READY COMMUNITY MODEL',
    title: [{ t: 'ONE GIVEBACK DAY.' }, { t: 'ONE FRAMEWORK.' }, { t: 'EVERY CAMPUS.', gold: true }],
    blurb: ['Start with one school and one day. Repeat it without', 'building new collateral each time.'],
    cols: [
      { icon: 'calendar', title: 'START WITH|ONE CAMPUS', lines: ['One school, one day,', 'one QR code.'] },
      { icon: 'megaphone', title: 'WE RALLY|THE COMMUNITY', lines: ['We promote taking', 'part to families and', 'supporters.'] },
      { icon: 'customers', title: 'EVERYONE|BENEFITS', lines: ['Businesses gain.', 'Families earn.', 'Schools benefit.'] },
      { icon: 'network', title: 'THEN|IT SCALES', lines: ['Extend the same', 'framework across the', 'district.'] },
    ],
    ctaTitle: ['BRING IT TO', 'YOUR CAMPUS'],
    ctaRows: rowsSch,
    script: "We'll make it easy to run.",
    foot: ['YOUR SCHOOL.', 'OUR COMMUNITY.', 'MORE WAYS TO GROW.'],
  }),
}

const E = {
  business: styleE({
    ...OW, band: TEAM,
    kicker: 'FOR LOCAL BUSINESS OWNERS',
    title: ['YOU KNOW GIVEBACK DAYS.', 'THIS ONE WORKS HARDER.'],
    script: 'Same generosity. Better economics.',
    blurb: ["You've supported Olathe West before. LocalVIP takes what already", 'works and adds a reason for those customers to come back.'],
    steps: [
      { title: 'PICK YOUR GIVEBACK DAY', line: 'Choose a day that could use more business.' },
      { title: 'WE RALLY OLATHE WEST', line: 'We promote you to families, fans and supporters.' },
      { title: 'GENEROSITY KEEPS PAYING', line: 'Customers come back long after the day is over.' },
    ],
    ctaTitle: ['CLAIM YOUR NEXT', 'GIVEBACK DAY'],
    ctaRows: rowsBiz,
    foot: ['YOUR BUSINESS.', 'OUR COMMUNITY.', 'MORE WAYS TO WIN.'],
  }),
  parent: styleE({
    ...OW, band: CROWD,
    kicker: 'FOR PARENTS, FAMILIES AND SUPPORTERS',
    title: ['THE SHOPPING YOU', 'ALREADY DO. DOING MORE.'],
    script: 'Same routine. More impact.',
    blurb: ['Nothing extra to buy and nothing extra to remember. LocalVIP helps', 'the choices you already make go further for Olathe West.'],
    steps: [
      { title: 'JOIN YOUR SCHOOL', line: 'Connect through the official Olathe West campaign code.' },
      { title: 'SHOP AS USUAL', line: 'Choose participating businesses you already use.' },
      { title: 'IT KEEPS GIVING', line: 'Everyday choices keep supporting the school.' },
    ],
    ctaTitle: ['JOIN THE OLATHE', 'WEST CAMPAIGN'],
    ctaRows: rowsFam,
    foot: ['YOUR FAMILY.', 'YOUR SCHOOL.', 'MORE WAYS TO GIVE.'],
  }),
  school: styleE({
    ...OPS, band: COMMUNITY,
    kicker: 'FOR PRINCIPALS, ADS AND DISTRICT LEADERS',
    title: ['ONE GIVEBACK DAY CAN', 'BECOME MORE THAN ONE DAY.'],
    script: 'Same idea. Built to repeat.',
    blurb: ['The message stays consistent across Olathe Public Schools. Each admin', 'adds the QR code for the right campus or campaign.'],
    steps: [
      { title: 'START WITH ONE CAMPUS', line: 'One school, one Giveback Day, one QR code.' },
      { title: 'KEEP IT CONSISTENT', line: 'The same framework for every school.' },
      { title: 'THEN EXTEND IT', line: 'Roll it out district-wide without new collateral.' },
    ],
    ctaTitle: ['BRING IT TO', 'YOUR CAMPUS'],
    ctaRows: rowsSch,
    foot: ['YOUR SCHOOL.', 'OUR COMMUNITY.', 'MORE WAYS TO GROW.'],
  }),
}

const F = {
  business: styleF({
    ...OW,
    big: [{ t: 'GENEROSITY' }, { t: "SHOULDN'T BE" }, { t: 'ONE-WAY.', gold: true }],
    sub2: "You've given to Olathe West for years. This gives something back.",
    blocks: [
      { icon: 'repeat', title: 'CUSTOMERS COME BACK', line: 'A reason to return, not just to visit once.' },
      { icon: 'customers', title: 'REWARD THE ONES YOU HAVE', line: 'Your regulars earn something for the loyalty they already show.' },
      { icon: 'chart', title: 'REACH THE WIDER NETWORK', line: "Local families who haven't found you yet." },
    ],
    script: 'You pick the day. We do the rest.',
    ctaTitle: ['ONGOING CONNECTION.', 'MORE WAYS TO WIN.'],
    ctaRows: rowsBiz,
    foot: ['YOUR BUSINESS.', 'OUR COMMUNITY.', 'MORE WAYS TO WIN.'],
  }),
  parent: styleF({
    ...OW,
    big: [{ t: 'YOUR NEXT' }, { t: 'LOCAL PURCHASE' }, { t: 'CAN DO MORE.', gold: true }],
    sub2: 'No extra spending. No extra steps. Just the shops you already choose.',
    blocks: [
      { icon: 'bag', title: 'SHOP WHERE YOU ALREADY SHOP', line: 'Participating businesses you know and trust.' },
      { icon: 'heart', title: 'OLATHE WEST BENEFITS', line: 'Support reaches the school from ordinary purchases.' },
      { icon: 'customers', title: 'YOUR FAMILY EARNS TOO', line: 'Rewards come back to the people doing the shopping.' },
    ],
    script: 'Same routine. More impact.',
    ctaTitle: ['YOUR FAMILY.', 'MORE WAYS TO MAKE AN IMPACT.'],
    ctaRows: rowsFam,
    foot: ['SAME COMMUNITY.', 'SAME GENEROSITY.', 'MORE WAYS TO WIN.'],
  }),
  school: styleF({
    ...OPS,
    big: [{ t: 'ONE FRAMEWORK.' }, { t: 'EVERY CAMPUS.' }, { t: 'BUILT TO REPEAT.', gold: true }],
    sub2: 'Less collateral to maintain, and a programme families recognise.',
    blocks: [
      { icon: 'badge', title: 'EASY ACTIVATION', line: 'Add the right school QR without redesigning anything.' },
      { icon: 'storefront', title: 'LOCAL ALIGNMENT', line: 'Connect each campus with nearby business partners.' },
      { icon: 'network', title: 'ROOM TO GROW', line: 'Start with one school and extend across the district.' },
    ],
    script: "We'll make it easy to run.",
    ctaTitle: ['YOUR SCHOOL.', 'MORE WAYS TO GROW.'],
    ctaRows: rowsSch,
    foot: ['YOUR SCHOOL.', 'OUR COMMUNITY.', 'MORE WAYS TO GROW.'],
  }),
}

for (const [style, set] of Object.entries({ d: D, e: E, f: F })) {
  for (const [aud, svg] of Object.entries(set)) {
    const name = `${aud}-option-${style}.svg`
    fs.writeFileSync(path.join(root, name), svg)
    console.log('Wrote', name)
  }
}
