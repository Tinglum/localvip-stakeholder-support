import type { OutreachScriptTier } from '@/lib/types/database'
import type { BusinessReferralChannel } from '@/lib/business-referral-script-engine'

/**
 * Any node can refer any other node type. This module covers the two invitee
 * types the business-to-business script engine was never written for — a
 * customer joining as a member, and a cause joining as an organisation.
 *
 * Business invites keep using `generateBusinessReferralScript`, which carries the
 * CRM-flavoured local-fit angles that only make sense between two businesses.
 */

export type NetworkInviteeType = 'consumer' | 'business' | 'cause'

export interface NetworkInviteeTypeOption {
  value: NetworkInviteeType
  /** Noun used in the UI. Never "downline". */
  label: string
  description: string
  /** What the composer collects for this type. */
  identityLabel: string
  identityPlaceholder: string
  /** Word used inside generated copy. */
  nounSingular: string
}

export const NETWORK_INVITEE_TYPE_OPTIONS: NetworkInviteeTypeOption[] = [
  {
    value: 'consumer',
    label: 'Customer',
    description: 'A person who joins as a member under your business.',
    identityLabel: 'Their name',
    identityPlaceholder: 'A regular, a friend, a past customer...',
    nounSingular: 'customer',
  },
  {
    value: 'business',
    label: 'Business',
    description: 'Another local business, opened as a lead in your CRM.',
    identityLabel: 'Business to invite',
    identityPlaceholder: 'Neighborhood coffee shop, gym, salon...',
    nounSingular: 'business',
  },
  {
    value: 'cause',
    label: 'Cause',
    description: 'A nonprofit, school, team, or community group you support.',
    identityLabel: 'Cause to invite',
    identityPlaceholder: 'School PTA, youth league, food pantry...',
    nounSingular: 'cause',
  },
]

export function getNetworkInviteeTypeOption(value: NetworkInviteeType): NetworkInviteeTypeOption {
  return NETWORK_INVITEE_TYPE_OPTIONS.find((option) => option.value === value) || NETWORK_INVITEE_TYPE_OPTIONS[0]
}

export interface NetworkInviteScriptInput {
  inviteeType: Exclude<NetworkInviteeType, 'business'>
  sourceBusinessName: string
  sourceCity?: string | null
  sourceCaptureOffer?: string | null
  sourceCashbackPercent?: number | null
  /** Person being written to. For a cause this is the contact, not the org. */
  contactFirstName?: string | null
  /** Cause only. */
  organizationName?: string | null
  personalNote?: string | null
  tier: OutreachScriptTier
  channel: BusinessReferralChannel
}

export interface NetworkInviteScriptResult {
  title: string
  subject: string | null
  body: string
}

function clean(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function compact(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function ensureSentence(value: string | null | undefined) {
  const trimmed = clean(value)
  if (!trimmed) return ''
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/** What the invited node actually gets, phrased for the reader. */
function rewardPhrase(captureOffer: string | null | undefined, cashbackPercent: number | null | undefined) {
  const offer = clean(captureOffer)
  if (offer) return `you get ${offer.toLowerCase().startsWith('a ') ? offer : offer} when you join`
  if (typeof cashbackPercent === 'number' && Number.isFinite(cashbackPercent) && cashbackPercent > 0) {
    return `you get ${cashbackPercent}% back every time you spend with us`
  }
  return 'you get money back on what you already spend locally'
}

const CONSUMER_TEMPLATES: Record<OutreachScriptTier, string> = {
  good: `Hey {first_name},

We just set up our LocalVIP list at {business_name}, and {reward_phrase}.

Takes about a minute to join. Want me to send you the link?`,
  better: `Hey {first_name},

Quick one — we just opened up our LocalVIP list at {business_name}. It is how we say thank you to the people who actually show up: {reward_phrase}.

{personal_note}

You are one of the first people I thought of. Want the link?`,
  best: `Hey {first_name},

We started building our LocalVIP list at {business_name}, and I would rather it be made of real regulars than strangers.

Here is the short version: you join with your name and number, {reward_phrase}, and you hear about anything good before it goes out to everyone else in {city_phrase}.

{personal_note}

Takes a minute. Want me to send it over?`,
  ultra: `Hey {first_name},

I am putting together the LocalVIP list for {business_name}, and I am starting with the people who were here before it was busy.

{personal_note}

It is simple: join once, {reward_phrase}, and you get first look at anything we run around {city_phrase}. No spam, no card, nothing you have to keep up with.

I would genuinely like you on it. Want me to send the link?`,
}

const CAUSE_TEMPLATES: Record<OutreachScriptTier, string> = {
  good: `Hi {first_name},

I am with {business_name} here in {city_phrase}. We are part of LocalVIP, where local spending sends money back to causes people pick.

I would like {organization_name} to be one of those causes. Can I send you the details?`,
  better: `Hi {first_name},

I am with {business_name} in {city_phrase}. We are part of LocalVIP — when people shop at businesses like ours, a share goes to a cause they choose.

I wanted {organization_name} on that list, because the support should stay with groups doing the work right here.

{personal_note}

There is nothing to sell and nothing to pay. Can I send you the details?`,
  best: `Hi {first_name},

I am with {business_name} here in {city_phrase}, and I want to put {organization_name} in front of our customers.

We are part of LocalVIP, where everyday local spending routes a share back to a cause the customer picks. Once {organization_name} is on there, supporters can choose it and it keeps earning from things they were already buying.

{personal_note}

No fundraiser to run, no cost to you. Would you be open to a quick look?`,
  ultra: `Hi {first_name},

I am with {business_name} here in {city_phrase}, and I have wanted to do something for {organization_name} that is not another one-off donation.

{personal_note}

We are part of LocalVIP: people shop where they already shop, and a share of it goes to the cause they chose. If {organization_name} is on the list, every supporter who picks it turns their normal spending into steady support — no event, no ask, no cost on your side.

I would rather it go to a group I can actually point to. Would you be open to a quick look?`,
}

function personalNoteLine(inviteeType: NetworkInviteScriptInput['inviteeType'], note: string | null | undefined) {
  const explicit = ensureSentence(note)
  if (explicit) return explicit
  return inviteeType === 'cause'
    ? 'Our customers already care about what happens around here, so this felt like the right place to point them.'
    : 'You have been good to us and this is one of the few ways I can actually give something back.'
}

function replaceTokens(template: string, tokens: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => tokens[key] || '')
}

function buildSubject(input: NetworkInviteScriptInput) {
  const city = clean(input.sourceCity)
  if (input.inviteeType === 'cause') {
    const org = clean(input.organizationName) || 'your cause'
    return `Local support for ${org}`
  }
  return city ? `A thank-you from ${clean(input.sourceBusinessName)} in ${city}` : `A thank-you from ${clean(input.sourceBusinessName)}`
}

function stripGreeting(body: string) {
  return compact(body).replace(/^(Hey|Hi) [^,\n]+,\s*/i, '')
}

export function generateNetworkInviteScript(input: NetworkInviteScriptInput): NetworkInviteScriptResult {
  const templates = input.inviteeType === 'cause' ? CAUSE_TEMPLATES : CONSUMER_TEMPLATES
  const firstName = clean(input.contactFirstName).split(' ')[0] || 'there'

  const raw = replaceTokens(templates[input.tier], {
    first_name: firstName,
    business_name: clean(input.sourceBusinessName) || 'our business',
    city_phrase: clean(input.sourceCity) || 'our area',
    organization_name: clean(input.organizationName) || 'your cause',
    reward_phrase: rewardPhrase(input.sourceCaptureOffer, input.sourceCashbackPercent),
    personal_note: personalNoteLine(input.inviteeType, input.personalNote),
  })

  const title = input.inviteeType === 'cause' ? 'Cause invite' : 'Customer invite'

  if (input.channel === 'email') {
    return {
      title,
      subject: buildSubject(input),
      body: compact(`Hi ${firstName},\n\n${stripGreeting(raw)}\n\nThanks,\n${clean(input.sourceBusinessName)}`),
    }
  }

  return { title, subject: null, body: compact(raw) }
}
