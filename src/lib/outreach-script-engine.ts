import type {
  OutreachScriptChannel,
  OutreachScriptStatus,
  OutreachScriptTier,
} from '@/lib/types/database'

export type OutreachScriptCategoryKey =
  | 'coffee_shop'
  | 'restaurant'
  | 'gym_fitness'
  | 'salon_barbershop'
  | 'family_entertainment'

export interface OutreachScriptTypeOption {
  key: string
  label: string
  description: string
}

export interface OutreachScriptPersonalization {
  intern_name?: string | null
  city?: string | null
  school_name?: string | null
  business_name?: string | null
  business_type?: string | null
  owner_name?: string | null
  specific_product?: string | null
  avg_ticket?: string | null
  personal_connection?: string | null
  local_cause_name?: string | null
  local_context?: string | null
}

export interface OutreachScriptGenerationInput extends OutreachScriptPersonalization {
  categoryKey: OutreachScriptCategoryKey
  scriptType: string
  tier: OutreachScriptTier
  channel: OutreachScriptChannel
}

export interface OutreachScriptGenerationResult {
  categoryKey: OutreachScriptCategoryKey
  categoryLabel: string
  scriptType: string
  scriptTypeLabel: string
  tier: OutreachScriptTier
  channel: OutreachScriptChannel
  title: string
  subject: string | null
  body: string
  generatedContent: string
}

interface ScriptTemplateSet {
  good: string
  better: string
  best: string
}

interface CategoryConfig {
  label: string
  businessTypeLabel: string
  defaultProduct: string
  defaultAvgTicket: string
  productExamples: string[]
  messageFraming: string
  emotionalRelevance: string
  callToActionStyle: string
  scriptTypes: OutreachScriptTypeOption[]
  templates: Record<string, ScriptTemplateSet>
}

export const OUTREACH_SCRIPT_CHANNEL_OPTIONS: Array<{
  value: OutreachScriptChannel
  label: string
  hint: string
}> = [
  {
    value: 'in_person',
    label: 'In-person opener',
    hint: 'Built to sound natural out loud when you are standing in front of the business.',
  },
  {
    value: 'text_dm',
    label: 'Text / DM',
    hint: 'Short enough to send quickly while still sounding local and personal.',
  },
  {
    value: 'email',
    label: 'Email',
    hint: 'Adds a direct subject line and clean body you can send without sounding corporate.',
  },
  {
    value: 'leave_behind',
    label: 'Short leave-behind intro',
    hint: 'Trimmed into a fast written handoff for a one-pager or printed leave-behind.',
  },
]

export const OUTREACH_SCRIPT_TIER_OPTIONS: Array<{
  value: OutreachScriptTier
  label: string
  hint: string
}> = [
  {
    value: 'good',
    label: 'Good',
    hint: 'Short, usable, and fast when you just need something solid.',
  },
  {
    value: 'better',
    label: 'Better',
    hint: 'More personal and contextual with stronger local credibility.',
  },
  {
    value: 'best',
    label: 'Best',
    hint: 'The strongest relationship-based version with the clearest community logic.',
  },
]

export const OUTREACH_SCRIPT_STATUS_OPTIONS: Array<{
  value: OutreachScriptStatus
  label: string
}> = [
  { value: 'not_started', label: 'Not started' },
  { value: 'copied', label: 'Copied' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'replied', label: 'Replied' },
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'follow_up_needed', label: 'Follow-up needed' },
]

const CATEGORY_CONFIG: Record<OutreachScriptCategoryKey, CategoryConfig> = {
  coffee_shop: {
    label: 'Coffee Shop',
    businessTypeLabel: 'Coffee Shop',
    defaultProduct: 'coffee',
    defaultAvgTicket: '$12',
    productExamples: ['coffee', 'breakfast sandwiches', 'lattes', 'cold brew'],
    messageFraming: 'daily routine, repeat visits, neighborhood habit',
    emotionalRelevance: 'part of the local morning rhythm',
    callToActionStyle: 'quick look, one-pager, easy yes',
    scriptTypes: [
      {
        key: 'relationship_opener',
        label: 'Relationship Opener',
        description: 'The primary LocalVIP opener for coffee shops, anchored in trust, routine, and school support.',
      },
      {
        key: 'daily_routine_angle',
        label: 'Daily Routine Angle',
        description: 'A more neighborhood-specific coffee script built around repeat traffic and everyday habit.',
      },
    ],
    templates: {
      relationship_opener: {
        good: `Hi, I'm from here, I went to {school_reference}, and I've been by {business_name} quite a few times.

I'm working on something local that helps places like yours while also supporting {support_phrase_schools}. Can I show you a quick one-pager?`,
        better: `Hi, I grew up here and went to {school_reference}, and I've stopped by {business_name} a bunch over the years.

I'm working on something that helps local spots like yours get more consistent customer flow, while also helping {support_phrase_schools}.

Since most people are already coming in for things like {specific_product} around {avg_ticket}, it connects that everyday activity to something bigger locally.

Would you be open to a quick look?`,
        best: `Hi, I'm from {city_phrase}, I went to {school_reference}, and I've actually been coming into {business_name} for {specific_product} for a while.

I'm working as a college intern on something local that helps coffee shops like yours bring in more consistent local traffic, while also helping {support_phrase_broad}.

Since people are already spending around {avg_ticket} here, this just connects that everyday flow to something that supports the community without changing how you run things.

I thought of you specifically because you're already part of the local routine here.

Would you be open to seeing a really quick overview?`,
      },
      daily_routine_angle: {
        good: `Hi, I'm from here, went to {school_reference}, and I thought of {business_name} because it already feels like part of the routine around {local_area_phrase}.

I'm working on something local that helps coffee spots like this stay part of that daily flow while also supporting {support_phrase_broad}. Could I show you something quick?`,
        better: `Hi, I'm from {city_phrase}, went to {school_reference}, and I thought of {business_name} because people around {local_area_phrase} already stop in here as part of their normal day.

I'm working on something that helps coffee shops turn everyday visits around {specific_product} and {avg_ticket} into something that also supports {support_phrase_broad}.

It feels natural because you're already part of what people do here every week.

Would you be open to a quick look?`,
        best: `Hi, I'm from {city_phrase}, went to {school_reference}, and I thought of {business_name} because you're already part of the local rhythm around {local_area_phrase}.

When people are already coming in for {specific_product} around {avg_ticket}, I'm working on a local model that helps coffee shops like yours turn that steady traffic into something that also supports {support_phrase_broad}.

It keeps the business simple, makes the community connection obvious, and feels real because people already know you.

Would you be open to seeing a really quick overview?`,
      },
    },
  },
  restaurant: {
    label: 'Restaurant',
    businessTypeLabel: 'Restaurant',
    defaultProduct: 'lunch or dinner',
    defaultAvgTicket: '$25',
    productExamples: ['pizza', 'lunch', 'family meals', 'dinner'],
    messageFraming: 'repeat meals, local families, neighborhood traffic',
    emotionalRelevance: 'part of how local families spend time together',
    callToActionStyle: 'quick look, one-page overview',
    scriptTypes: [
      {
        key: 'relationship_opener',
        label: 'Relationship Opener',
        description: 'The core restaurant opener tied to repeat visits and local school or cause support.',
      },
      {
        key: 'family_meals_angle',
        label: 'Family Meals Angle',
        description: 'A restaurant script focused on family visits, school households, and repeat meal occasions.',
      },
    ],
    templates: {
      relationship_opener: {
        good: `Hi, I'm from here and grew up going to {school_reference}. I've been to {business_name} a few times.

I'm working on something local that supports restaurants and {support_phrase_broad} at the same time. Can I show you something quick?`,
        better: `Hi, I'm from {city_phrase}, went to {school_reference}, and I've been to {business_name} before.

I'm working on something that helps restaurants get more local repeat customers while also supporting {support_phrase_broad}.

Since most customers are already spending around {avg_ticket} on meals, this connects that to something meaningful locally.

Would you be open to taking a quick look?`,
        best: `Hi, I grew up here, went to {school_reference}, and I've actually been to {business_name} a few times for {specific_product}.

I'm working on a local project that helps restaurants like yours turn everyday customer visits, usually around {avg_ticket}, into something that also supports {support_phrase_broad}.

So it's not about changing what you do, it's about strengthening what's already happening here.

I thought of you because you're already part of the local community.

Would you be open to seeing a quick one-page overview?`,
      },
      family_meals_angle: {
        good: `Hi, I'm from here, went to {school_reference}, and I thought of {business_name} because local families already spend time here.

I'm working on something local that helps restaurants keep building that family traffic while also supporting {support_phrase_broad}. Could I show you something quick?`,
        better: `Hi, I'm from {city_phrase}, went to {school_reference}, and I thought of {business_name} because this feels like the kind of place families around {local_area_phrase} already trust.

I'm working on something that helps restaurants bring people back for more lunch, dinner, and family meal occasions while also supporting {support_phrase_broad}.

With average checks around {avg_ticket}, it turns everyday meals into something that still feels easy and local.

Would you be open to a quick look?`,
        best: `Hi, I'm from {city_phrase}, went to {school_reference}, and I thought of {business_name} because you're already part of how local families around {local_area_phrase} spend time together.

When people are already coming in for {specific_product} and spending around {avg_ticket}, I'm working on a local model that helps restaurants like yours turn those repeat visits into something that also supports {support_phrase_broad}.

It keeps the experience simple for the restaurant and makes the impact feel close to home for the same families already coming through.

Would you be open to seeing a really quick overview?`,
      },
    },
  },
  gym_fitness: {
    label: 'Gym / Fitness Studio',
    businessTypeLabel: 'Gym / Fitness Studio',
    defaultProduct: 'memberships',
    defaultAvgTicket: '$60',
    productExamples: ['memberships', 'class packs', 'personal training', 'monthly plans'],
    messageFraming: 'consistency, recurring membership value, local wellness habit',
    emotionalRelevance: 'part of the routine people commit to every week',
    callToActionStyle: 'quick look, simple walkthrough',
    scriptTypes: [
      {
        key: 'relationship_opener',
        label: 'Relationship Opener',
        description: 'The main fitness-studio script centered on recurring memberships and school support.',
      },
      {
        key: 'membership_consistency_angle',
        label: 'Membership Consistency Angle',
        description: 'A stronger recurring-value script for gyms, studios, and long-term member businesses.',
      },
    ],
    templates: {
      relationship_opener: {
        good: `Hi, I'm from here and went to {school_reference}. I've seen {business_name} around.

I'm working on something local that helps gyms grow while also supporting {support_phrase_schools}. Can I show you something quick?`,
        better: `Hi, I'm from {city_phrase}, went to {school_reference}, and I've seen {business_name} in the community.

I'm working on something that helps gyms like yours get more consistent memberships while also supporting {support_phrase_broad}.

Since memberships are usually around {avg_ticket}, it connects that ongoing activity to something local.

Would you be open to a quick look?`,
        best: `Hi, I'm from {city_phrase}, went to {school_reference}, and I've seen {business_name} as part of the local fitness scene here.

I'm working on something that helps gyms bring in more consistent local members while also supporting {support_phrase_broad}.

Since memberships are typically around {avg_ticket}, this connects that recurring activity to something that benefits the community without adding complexity for you.

Would you be open to seeing how it works?`,
      },
      membership_consistency_angle: {
        good: `Hi, I'm from here, went to {school_reference}, and I thought of {business_name} because consistency is already such a big part of what you do.

I'm working on something local that helps fitness businesses grow while also supporting {support_phrase_broad}. Could I show you something quick?`,
        better: `Hi, I'm from {city_phrase}, went to {school_reference}, and I thought of {business_name} because places like this already depend on local members showing up week after week.

I'm working on something that helps gyms and studios turn recurring spend around {avg_ticket} into something that also supports {support_phrase_broad}.

It fits naturally because it is built around habits people already have.

Would you be open to a quick look?`,
        best: `Hi, I'm from {city_phrase}, went to {school_reference}, and I thought of {business_name} because the people joining here are already making an ongoing commitment to their routine.

I'm working on a local model that helps gyms and studios turn that recurring membership activity around {avg_ticket} into something that also supports {support_phrase_broad}.

That makes the value more visible for members, strengthens the local story, and does not force the business to operate differently.

Would you be open to a really quick overview?`,
      },
    },
  },
  salon_barbershop: {
    label: 'Salon / Barbershop',
    businessTypeLabel: 'Salon / Barbershop',
    defaultProduct: 'haircuts',
    defaultAvgTicket: '$45',
    productExamples: ['haircuts', 'color appointments', 'fades', 'styling services'],
    messageFraming: 'repeat appointments, personal care routine, trusted local relationships',
    emotionalRelevance: 'people come back because they know and trust the business',
    callToActionStyle: 'quick look, short overview',
    scriptTypes: [
      {
        key: 'relationship_opener',
        label: 'Relationship Opener',
        description: 'The primary salon and barbershop script focused on repeat clients and local support.',
      },
      {
        key: 'repeat_client_angle',
        label: 'Repeat Client Angle',
        description: 'A stronger routine-client script for salons and barbershops built around loyalty.',
      },
    ],
    templates: {
      relationship_opener: {
        good: `Hi, I'm from here and went to {school_reference}. I've seen {business_name} around.

I'm working on something local that supports businesses like yours and {support_phrase_schools}. Can I show you something quick?`,
        better: `Hi, I'm from {city_phrase}, went to {school_reference}, and I've seen {business_name} in the area.

I'm working on something that helps salons and barbershops bring in more repeat clients while also supporting {support_phrase_broad}.

Since services are usually around {avg_ticket}, it connects that to something local.

Would you be open to a quick look?`,
        best: `Hi, I'm from {city_phrase}, went to {school_reference}, and I've seen {business_name} as part of the local community.

I'm working on something that helps places like yours bring in more consistent repeat clients, while also supporting {support_phrase_broad}.

Since people are already spending around {avg_ticket} on services, this just connects that existing activity to something bigger for the community.

Would you be open to seeing a quick overview?`,
      },
      repeat_client_angle: {
        good: `Hi, I'm from here, went to {school_reference}, and I thought of {business_name} because people already come back here on a regular basis.

I'm working on something local that helps businesses with loyal clients keep growing while also supporting {support_phrase_broad}. Could I show you something quick?`,
        better: `Hi, I'm from {city_phrase}, went to {school_reference}, and I thought of {business_name} because salons and barbershops are built on trust and repeat visits.

I'm working on something that helps places like yours turn that routine client activity around {avg_ticket} into something that also supports {support_phrase_broad}.

It feels natural because the relationship is already there.

Would you be open to a quick look?`,
        best: `Hi, I'm from {city_phrase}, went to {school_reference}, and I thought of {business_name} because you already have the kind of repeat local trust most businesses want.

I'm working on a local model that helps salons and barbershops turn those ongoing appointments around {avg_ticket} into something that also supports {support_phrase_broad}.

That makes the business feel even more rooted in the community without changing the way you serve clients day to day.

Would you be open to seeing a really quick overview?`,
      },
    },
  },
  family_entertainment: {
    label: 'Family Entertainment / Kids Venue',
    businessTypeLabel: 'Family Entertainment / Kids Venue',
    defaultProduct: 'family visits',
    defaultAvgTicket: '$32',
    productExamples: ['birthday packages', 'arcade cards', 'jump sessions', 'family passes'],
    messageFraming: 'family visits, local outings, school-age kids, birthdays and weekends',
    emotionalRelevance: 'already connected to parents, kids, and school households',
    callToActionStyle: 'quick overview, easy handoff',
    scriptTypes: [
      {
        key: 'relationship_opener',
        label: 'Relationship Opener',
        description: 'The main kids-venue opener focused on family visits and school connection.',
      },
      {
        key: 'family_outing_angle',
        label: 'Family Outing Angle',
        description: 'A stronger family-traffic script for arcades, indoor play, and entertainment venues.',
      },
    ],
    templates: {
      relationship_opener: {
        good: `Hi, I'm from here and grew up going to {school_reference}. I've been to {business_name}.

I'm working on something that supports places like this and {support_phrase_schools}. Can I show you something quick?`,
        better: `Hi, I'm from {city_phrase}, went to {school_reference}, and I've been to {business_name} before.

I'm working on something that helps places like this get more family visits while also supporting {support_phrase_broad}.

Since families already spend around {avg_ticket}, it connects that to something meaningful locally.

Would you be open to a quick look?`,
        best: `Hi, I'm from {city_phrase}, went to {school_reference}, and I've actually been to {business_name} growing up.

I'm working on something that helps family-focused places like this bring in more local families, while also supporting {support_phrase_broad}.

Since families are already spending around {avg_ticket} here, this connects that experience to something that helps {kids_school_phrase}.

Would you be open to seeing a quick overview?`,
      },
      family_outing_angle: {
        good: `Hi, I'm from here, went to {school_reference}, and I thought of {business_name} because this already feels like the kind of place local parents and kids know.

I'm working on something local that helps venues like this drive more family visits while also supporting {support_phrase_broad}. Could I show you something quick?`,
        better: `Hi, I'm from {city_phrase}, went to {school_reference}, and I thought of {business_name} because families around {local_area_phrase} are already looking for places like this for birthdays, weekends, and school breaks.

I'm working on something that helps family-focused venues bring in more repeat outings while also supporting {support_phrase_broad}.

With average spend around {avg_ticket}, it turns a normal family outing into something that still feels fun but also meaningful locally.

Would you be open to a quick look?`,
        best: `Hi, I'm from {city_phrase}, went to {school_reference}, and I thought of {business_name} because you're already part of how local families around {local_area_phrase} spend time together.

I'm working on a local model that helps family entertainment businesses bring in more repeat visits while also supporting {support_phrase_broad}.

Since parents are already spending around {avg_ticket} here for things like {specific_product}, it ties that experience back to the same schools and causes those families already care about.

Would you be open to a really quick overview?`,
      },
    },
  },
}

const CATEGORY_MATCHERS: Array<{ key: OutreachScriptCategoryKey; patterns: RegExp[] }> = [
  { key: 'coffee_shop', patterns: [/coffee/i, /\bcafe\b/i, /\bbakery\b/i, /espresso/i] },
  { key: 'restaurant', patterns: [/restaurant/i, /pizza/i, /grill/i, /diner/i, /bbq/i, /eatery/i, /bistro/i] },
  { key: 'gym_fitness', patterns: [/gym/i, /fitness/i, /pilates/i, /yoga/i, /crossfit/i, /spin/i, /training/i, /workout/i] },
  { key: 'salon_barbershop', patterns: [/salon/i, /barber/i, /barbershop/i, /\bspa\b/i, /nails?/i, /beauty/i] },
  { key: 'family_entertainment', patterns: [/family/i, /kids?/i, /arcade/i, /play/i, /indoor/i, /venue/i, /trampoline/i, /bowling/i, /entertainment/i] },
]

function clean(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function ensureSentence(value: string) {
  const trimmed = clean(value)
  if (!trimmed) return ''
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function compactWhitespace(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function firstName(value: string | null | undefined) {
  return clean(value).split(' ')[0] || ''
}

function cityPhrase(value: string | null | undefined) {
  return clean(value) || 'here'
}

function schoolReference(schoolName: string | null | undefined, city: string | null | undefined) {
  const school = clean(schoolName)
  if (school) return school
  const normalizedCity = clean(city)
  return normalizedCity ? `school in ${normalizedCity}` : 'school here'
}

function localAreaPhrase(localContext: string | null | undefined, city: string | null | undefined) {
  return clean(localContext) || clean(city) || 'the area'
}

function supportPhraseSchools(localCauseName: string | null | undefined, city: string | null | undefined) {
  return clean(localCauseName) || (clean(city) ? `schools in ${clean(city)}` : 'local schools')
}

function supportPhraseBroad(
  localCauseName: string | null | undefined,
  city: string | null | undefined,
  localContext: string | null | undefined,
) {
  return clean(localCauseName)
    || (clean(localContext) ? `schools and causes around ${clean(localContext)}` : '')
    || (clean(city) ? `schools and causes in ${clean(city)}` : 'local schools and causes')
}

function kidsSchoolPhrase(localCauseName: string | null | undefined, city: string | null | undefined) {
  return clean(localCauseName)
    || (clean(city) ? `the schools kids in ${clean(city)} already go to` : 'the schools those kids go to')
}

function ownerGreeting(
  ownerName: string | null | undefined,
  businessName: string | null | undefined,
  channel: OutreachScriptChannel,
) {
  const ownerFirstName = firstName(ownerName)
  if (ownerFirstName) return `Hi ${ownerFirstName},`
  if (channel === 'email' && clean(businessName)) return `Hi ${clean(businessName)} team,`
  return 'Hi,'
}

function stripLeadingGreeting(value: string) {
  return compactWhitespace(value).replace(/^Hi(?: [^,\n]+)?,\s*/i, '')
}

function channelBodyForText(
  value: string,
  ownerName: string | null | undefined,
  businessName: string | null | undefined,
) {
  const stripped = stripLeadingGreeting(value)
  return compactWhitespace(`${ownerGreeting(ownerName, businessName, 'text_dm')}\n\n${stripped}`)
}

function channelBodyForLeaveBehind(value: string) {
  const stripped = stripLeadingGreeting(value)
  const paragraphs = stripped
    .split(/\n\s*\n/)
    .map(paragraph => compactWhitespace(paragraph))
    .filter(Boolean)
  const lastParagraph = paragraphs.length ? paragraphs[paragraphs.length - 1] : ''
  return compactWhitespace([paragraphs[0], paragraphs[1], lastParagraph].filter(Boolean).join('\n\n'))
}

function emailSubject(businessName: string, localCauseName: string, categoryLabel: string) {
  if (businessName && localCauseName) return `Quick local idea for ${businessName} + ${localCauseName}`
  if (businessName) return `Quick local idea for ${businessName}`
  return `Quick local idea for ${categoryLabel}`
}

function tokenMap(input: OutreachScriptGenerationInput, config: CategoryConfig) {
  const city = clean(input.city)
  const localCause = clean(input.local_cause_name)
  const localContext = clean(input.local_context)
  const businessName = clean(input.business_name) || 'your business'
  const specificProduct = clean(input.specific_product) || config.defaultProduct
  const avgTicket = clean(input.avg_ticket) || config.defaultAvgTicket

  return {
    avg_ticket: avgTicket,
    business_name: businessName,
    business_type: clean(input.business_type) || config.businessTypeLabel,
    city_phrase: cityPhrase(city),
    intern_name: clean(input.intern_name),
    kids_school_phrase: kidsSchoolPhrase(localCause, city),
    local_area_phrase: localAreaPhrase(localContext, city),
    owner_name: clean(input.owner_name),
    school_reference: schoolReference(input.school_name, city),
    specific_product: specificProduct,
    support_phrase_broad: supportPhraseBroad(localCause, city, localContext),
    support_phrase_schools: supportPhraseSchools(localCause, city),
  }
}

function fillTemplate(template: string, tokens: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => tokens[key] || '')
}

function addConnectionSentence(value: string, personalConnection: string | null | undefined) {
  const sentence = ensureSentence(personalConnection || '')
  if (!sentence) return compactWhitespace(value)

  const paragraphs = compactWhitespace(value)
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) return sentence
  if (paragraphs.some(paragraph => paragraph.includes(sentence))) return compactWhitespace(value)

  const withConnection = [paragraphs[0], sentence, ...paragraphs.slice(1)]
  return compactWhitespace(withConnection.join('\n\n'))
}

function transformForChannel(
  body: string,
  input: OutreachScriptGenerationInput,
  config: CategoryConfig,
) {
  if (input.channel === 'text_dm') {
    return {
      subject: null,
      body: channelBodyForText(body, input.owner_name, input.business_name),
    }
  }

  if (input.channel === 'email') {
    const stripped = stripLeadingGreeting(body)
    const greeting = ownerGreeting(input.owner_name, input.business_name, input.channel)
    const signature = clean(input.intern_name) ? `\n\nThanks,\n${clean(input.intern_name)}` : ''
    return {
      subject: emailSubject(clean(input.business_name), clean(input.local_cause_name), config.label),
      body: compactWhitespace(`${greeting}\n\n${stripped}${signature}`),
    }
  }

  if (input.channel === 'leave_behind') {
    return {
      subject: null,
      body: channelBodyForLeaveBehind(body),
    }
  }

  return { subject: null, body: compactWhitespace(body) }
}

export function normalizeBusinessCategory(category: string | null | undefined): OutreachScriptCategoryKey {
  const normalized = clean(category)
  for (const matcher of CATEGORY_MATCHERS) {
    if (matcher.patterns.some(pattern => pattern.test(normalized))) return matcher.key
  }
  return 'restaurant'
}

export function getCategoryConfig(categoryKey: OutreachScriptCategoryKey) {
  return CATEGORY_CONFIG[categoryKey]
}

export function getScriptTypeOptions(categoryKey: OutreachScriptCategoryKey) {
  return CATEGORY_CONFIG[categoryKey].scriptTypes
}

export function generateOutreachScript(input: OutreachScriptGenerationInput): OutreachScriptGenerationResult {
  const config = getCategoryConfig(input.categoryKey)
  const scriptOption = config.scriptTypes.find(option => option.key === input.scriptType) || config.scriptTypes[0]
  const templates = config.templates[scriptOption.key] || config.templates[config.scriptTypes[0].key]
  const template = templates[input.tier]
  const tokens = tokenMap(input, config)
  const baseBody = addConnectionSentence(fillTemplate(template, tokens), input.personal_connection)
  const transformed = transformForChannel(baseBody, input, config)

  return {
    categoryKey: input.categoryKey,
    categoryLabel: config.label,
    scriptType: scriptOption.key,
    scriptTypeLabel: scriptOption.label,
    tier: input.tier,
    channel: input.channel,
    title: `${config.label} ${scriptOption.label}`,
    subject: transformed.subject,
    body: transformed.body,
    generatedContent: transformed.body,
  }
}
