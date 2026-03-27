import type { OutreachScriptTier } from '@/lib/types/database'

export type BusinessReferralChannel = 'sms' | 'email' | 'link_share'
export type BusinessReferralScriptType =
  | 'nearby_business'
  | 'complementary_business'
  | 'places_you_already_go'
  | 'customers_also_visit'

export interface BusinessReferralGenerationInput {
  sourceBusinessName: string
  sourceBusinessCategory?: string | null
  sourceCity?: string | null
  sourceCaptureOffer?: string | null
  sourceCashbackPercent?: number | null
  sourceJoinedCount?: number | null
  targetBusinessName?: string | null
  targetBusinessCategory?: string | null
  targetOwnerName?: string | null
  targetArea?: string | null
  fitReason?: string | null
  relationshipNote?: string | null
  tier: OutreachScriptTier
  channel: BusinessReferralChannel
  scriptType: BusinessReferralScriptType
}

export interface BusinessReferralGenerationResult {
  title: string
  subject: string | null
  body: string
  generatedContent: string
  tier: OutreachScriptTier
  channel: BusinessReferralChannel
  scriptType: BusinessReferralScriptType
}

interface ScriptTemplateSet {
  good: string
  better: string
  best: string
  ultra: string
}

interface ScriptTypeConfig {
  label: string
  description: string
  fitHint: string
  templates: ScriptTemplateSet
}

export const BUSINESS_REFERRAL_CHANNEL_OPTIONS: Array<{
  value: BusinessReferralChannel
  label: string
  hint: string
}> = [
  {
    value: 'sms',
    label: 'SMS',
    hint: 'Short and direct when you already know who to text.',
  },
  {
    value: 'email',
    label: 'Email',
    hint: 'A cleaner intro when you want to send a quick overview after this note.',
  },
  {
    value: 'link_share',
    label: 'Link Share',
    hint: 'Built for copy-paste into DMs, WhatsApp, or a shared thread.',
  },
]

export const BUSINESS_REFERRAL_TIER_OPTIONS: Array<{
  value: OutreachScriptTier
  label: string
  hint: string
}> = [
  {
    value: 'good',
    label: 'Good',
    hint: 'Simple, useful, and easy to send fast.',
  },
  {
    value: 'better',
    label: 'Better',
    hint: 'Adds more local relevance and a clearer reason for the intro.',
  },
  {
    value: 'best',
    label: 'Best',
    hint: 'Stronger business-to-business context and clearer local proof.',
  },
  {
    value: 'ultra',
    label: 'Ultra',
    hint: 'Hyper-specific, relationship-based, and built to sound like a real local introduction.',
  },
]

export const BUSINESS_REFERRAL_SCRIPT_TYPE_OPTIONS: Array<{
  value: BusinessReferralScriptType
  label: string
  description: string
  fitHint: string
}> = [
  {
    value: 'nearby_business',
    label: 'Businesses Nearby',
    description: 'Use when the business is already part of the same local routine or neighborhood flow.',
    fitHint: 'Example: You are close by, already serve the same area, or feel like a natural local fit.',
  },
  {
    value: 'complementary_business',
    label: 'Complementary Business',
    description: 'Use when your customers naturally overlap even though the business category is different.',
    fitHint: 'Example: Coffee + bakery, gym + smoothie spot, salon + boutique, restaurant + dessert.',
  },
  {
    value: 'places_you_already_go',
    label: 'Places You Already Go',
    description: 'Use when you actually know the business and can make the message sound personal.',
    fitHint: 'Example: I already stop in here, I know the owner, or I have been there myself.',
  },
  {
    value: 'customers_also_visit',
    label: 'Businesses Customers Also Visit',
    description: 'Use when you want to emphasize shared customer behavior and repeat local traffic.',
    fitHint: 'Example: Our customers already visit both places during the same week or same part of town.',
  },
]

const SCRIPT_TYPE_CONFIG: Record<BusinessReferralScriptType, ScriptTypeConfig> = {
  nearby_business: {
    label: 'Businesses Nearby',
    description: 'Lead with the local fit and shared neighborhood presence.',
    fitHint: 'You are already part of the same local routine.',
    templates: {
      good: `Hey {greeting_name},

I'm with {source_business_name} here in {city_phrase}, and I thought of {target_business_name} because you're already part of the local mix around here.

We're part of something local that's helping businesses grow while giving customers a reason to support nearby spots too.

Want me to send you a quick overview?`,
      better: `Hey {greeting_name},

I'm with {source_business_name} here in {city_phrase}, and I thought of {target_business_name} because {fit_reason_sentence}

We've been setting this up on our side and it's been straightforward. The whole idea is to help local businesses grow in a way that feels simple for the business and easy to talk about with customers.

Since you're already part of the local flow around {target_area_phrase}, it felt like a natural business to reach out to.

Want me to send you a quick overview?`,
      best: `Hey {greeting_name},

I'm with {source_business_name} here in {city_phrase}, and I thought of {target_business_name} specifically because {fit_reason_sentence}

We've already been using this to build more local momentum on our side{proof_phrase}, and it has felt simple to set up without making the business do anything awkward.

It stood out to me because businesses like yours already matter to the same people moving around this area every week.

Would you be open to a quick look?`,
      ultra: `Hey {greeting_name},

I'm with {source_business_name} in {city_phrase}, and I wanted to reach out directly because {fit_reason_sentence}

{relationship_note_sentence}

We've already been getting traction on our side{proof_phrase}, and what I like about it is that it feels local, practical, and easy to explain without sounding salesy.

I thought of {target_business_name} because you're already part of what people around {target_area_phrase} are doing anyway.

Would you be open to a really quick overview?`,
    },
  },
  complementary_business: {
    label: 'Complementary Business',
    description: 'Lead with the fact that your customers already make sense together.',
    fitHint: 'Your customers already overlap in natural ways.',
    templates: {
      good: `Hey {greeting_name},

I'm with {source_business_name} in {city_phrase}, and I thought of {target_business_name} because businesses like ours already make sense together locally.

We're part of something that's helping bring in more repeat local customers while giving people another reason to choose businesses here.

Want me to send you a quick overview?`,
      better: `Hey {greeting_name},

I'm with {source_business_name} in {city_phrase}, and I thought of {target_business_name} because {fit_reason_sentence}

It felt worth reaching out because customers already move naturally between places like ours, and this gives us a cleaner way to turn that into repeat local business.

We've been setting it up on our side and it has been simple so far.

Would you be open to a quick look?`,
      best: `Hey {greeting_name},

I'm with {source_business_name} in {city_phrase}, and I thought of {target_business_name} because {fit_reason_sentence}

The reason I think it could work is that people are already choosing both kinds of businesses during the same normal week. This just gives that local behavior a clearer path to repeat visits.

We've already been using it on our side{proof_phrase}, and I think it could fit really naturally for a {target_business_category_phrase} too.

Want me to send over a quick overview?`,
      ultra: `Hey {greeting_name},

I'm with {source_business_name} in {city_phrase}, and I thought of {target_business_name} because {fit_reason_sentence}

{relationship_note_sentence}

What stood out to me is that our customers already think locally in a way that makes this feel obvious instead of forced. You're the kind of business they already talk about, visit, and recommend.

We've already been getting momentum on our side{proof_phrase}, and I think this could work really well for a {target_business_category_phrase}.

Would you be open to a really quick look?`,
    },
  },
  places_you_already_go: {
    label: 'Places You Already Go',
    description: 'Sound personal and believable when the business is genuinely familiar to you.',
    fitHint: 'You actually know the business, visit it, or have a real relationship there.',
    templates: {
      good: `Hey {greeting_name},

I'm with {source_business_name} here in {city_phrase}, and I thought of {target_business_name} because it's already a place I know.

We're part of something local that's helping businesses grow while giving customers a simple reason to support local spots more often.

Want me to send you a quick overview?`,
      better: `Hey {greeting_name},

I'm with {source_business_name} here in {city_phrase}, and I thought of {target_business_name} because {relationship_note_sentence}

We've been setting this up on our side and it's been easy to understand. The reason I reached out is that it feels like the kind of thing that could fit a business people already know and trust.

Would you be open to a quick look?`,
      best: `Hey {greeting_name},

I'm with {source_business_name} here in {city_phrase}, and I thought of {target_business_name} because {relationship_note_sentence}

It felt worth reaching out directly because the best intros are the ones that already feel real. This has been simple on our side{proof_phrase}, and I think it could work well for a business that's already part of the local routine.

Would you be open to me sending a quick overview?`,
      ultra: `Hey {greeting_name},

I'm with {source_business_name} here in {city_phrase}, and I thought of {target_business_name} because {relationship_note_sentence}

I wanted to reach out directly instead of sending something generic, because businesses that already have real local trust are exactly the ones this feels best for.

We've already been building momentum on our side{proof_phrase}, and I think this could fit naturally for you without adding anything complicated.

Would you be open to a really quick overview?`,
    },
  },
  customers_also_visit: {
    label: 'Businesses Customers Also Visit',
    description: 'Lead with shared customer behavior and repeat local traffic.',
    fitHint: 'The same people already move between your business and theirs.',
    templates: {
      good: `Hey {greeting_name},

I'm with {source_business_name} in {city_phrase}, and I thought of {target_business_name} because our customers already tend to visit businesses like yours too.

We're part of something local that helps businesses stay top of mind and keep more local traffic moving back around town.

Want me to send you a quick overview?`,
      better: `Hey {greeting_name},

I'm with {source_business_name} in {city_phrase}, and I thought of {target_business_name} because {fit_reason_sentence}

What I like about this model is that it works with customer behavior that's already happening. It is not about forcing something new. It's about giving shared local traffic a better reason to keep circulating.

Would you be open to a quick look?`,
      best: `Hey {greeting_name},

I'm with {source_business_name} in {city_phrase}, and I thought of {target_business_name} because {fit_reason_sentence}

People already choose both of our types of businesses as part of normal local life. This just gives that pattern a cleaner way to turn into repeat visits and more local visibility.

We've already been using it on our side{proof_phrase}, and I think it could be a strong fit for you too.

Want me to send over a quick overview?`,
      ultra: `Hey {greeting_name},

I'm with {source_business_name} in {city_phrase}, and I thought of {target_business_name} because {fit_reason_sentence}

{relationship_note_sentence}

The reason I'm reaching out is simple: the same people already move through both kinds of businesses, and this gives them a better reason to keep choosing local more often.

We've already been seeing momentum on our side{proof_phrase}, and I think it could fit really naturally for you too.

Would you be open to a really quick look?`,
    },
  },
}

function clean(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function ensureSentence(value: string | null | undefined) {
  const trimmed = clean(value)
  if (!trimmed) return ''
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function compact(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function greetingName(ownerName: string | null | undefined, businessName: string | null | undefined) {
  const owner = clean(ownerName)
  if (owner) return owner.split(' ')[0]
  return clean(businessName) || 'there'
}

function cityPhrase(value: string | null | undefined) {
  return clean(value) || 'our city'
}

function targetAreaPhrase(value: string | null | undefined, city: string | null | undefined) {
  return clean(value) || clean(city) || 'the area'
}

function fitReasonSentence(
  scriptType: BusinessReferralScriptType,
  fitReason: string | null | undefined,
  targetBusinessName: string | null | undefined,
  targetCategory: string | null | undefined,
  city: string | null | undefined,
) {
  const explicit = ensureSentence(fitReason)
  if (explicit) return explicit

  const name = clean(targetBusinessName) || 'your business'
  const category = clean(targetCategory) || 'business like yours'
  const cityName = clean(city) || 'here'

  switch (scriptType) {
    case 'complementary_business':
      return `our customers already make room for businesses like ${name} in the same normal week.`
    case 'places_you_already_go':
      return `${name} already feels like one of the places people around ${cityName} know and trust.`
    case 'customers_also_visit':
      return `people who know us already tend to visit ${category} spots like ${name} too.`
    default:
      return `${name} already feels like a natural fit for the local mix in ${cityName}.`
  }
}

function relationshipSentence(relationshipNote: string | null | undefined, targetBusinessName: string | null | undefined) {
  const explicit = ensureSentence(relationshipNote)
  if (explicit) return explicit
  const name = clean(targetBusinessName) || 'your business'
  return `I wanted to keep the note personal because ${name} already feels connected to the same local community we do.`
}

function proofPhrase(joinedCount: number | null | undefined, captureOffer: string | null | undefined, cashbackPercent: number | null | undefined) {
  const count = typeof joinedCount === 'number' && joinedCount > 0 ? joinedCount : 0
  if (count >= 1) {
    return `, including using it to start building our first ${count} customers`
  }

  const offer = clean(captureOffer)
  if (offer) {
    return `, and the customer capture side has been easy to explain with our ${offer}`
  }

  if (typeof cashbackPercent === 'number' && !Number.isNaN(cashbackPercent)) {
    return `, and we already have our ${cashbackPercent}% cashback set up on the live side`
  }

  return ''
}

function replaceTokens(template: string, tokens: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => tokens[key] || '')
}

function stripGreeting(body: string) {
  return compact(body).replace(/^Hey [^,\n]+,\s*/i, '')
}

function buildEmailBody(body: string, input: BusinessReferralGenerationInput) {
  const greeting = `Hi ${greetingName(input.targetOwnerName, input.targetBusinessName)},`
  const signature = `\n\nThanks,\n${clean(input.sourceBusinessName)}`
  return compact(`${greeting}\n\n${stripGreeting(body)}${signature}`)
}

function buildEmailSubject(input: BusinessReferralGenerationInput) {
  const target = clean(input.targetBusinessName) || 'your business'
  const city = clean(input.sourceCity)
  if (city) return `Quick local idea for ${target} in ${city}`
  return `Quick local idea for ${target}`
}

function transformForChannel(body: string, input: BusinessReferralGenerationInput) {
  if (input.channel === 'email') {
    return {
      subject: buildEmailSubject(input),
      body: buildEmailBody(body, input),
    }
  }

  return {
    subject: null,
    body: compact(body),
  }
}

export function generateBusinessReferralScript(input: BusinessReferralGenerationInput): BusinessReferralGenerationResult {
  const config = SCRIPT_TYPE_CONFIG[input.scriptType]
  const template = config.templates[input.tier]
  const tokens = {
    greeting_name: greetingName(input.targetOwnerName, input.targetBusinessName),
    source_business_name: clean(input.sourceBusinessName) || 'our business',
    city_phrase: cityPhrase(input.sourceCity),
    target_business_name: clean(input.targetBusinessName) || 'your business',
    target_business_category_phrase: clean(input.targetBusinessCategory) || 'local business like yours',
    target_area_phrase: targetAreaPhrase(input.targetArea, input.sourceCity),
    fit_reason_sentence: fitReasonSentence(
      input.scriptType,
      input.fitReason,
      input.targetBusinessName,
      input.targetBusinessCategory,
      input.sourceCity,
    ),
    relationship_note_sentence: relationshipSentence(input.relationshipNote, input.targetBusinessName),
    proof_phrase: proofPhrase(input.sourceJoinedCount, input.sourceCaptureOffer, input.sourceCashbackPercent),
  }

  const transformed = transformForChannel(replaceTokens(template, tokens), input)

  return {
    title: config.label,
    subject: transformed.subject,
    body: transformed.body,
    generatedContent: transformed.body,
    tier: input.tier,
    channel: input.channel,
    scriptType: input.scriptType,
  }
}
