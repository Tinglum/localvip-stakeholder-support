import type { createServiceClient } from '@/lib/supabase/server'
import type { MaterialLibraryFolder, MaterialTemplate, StakeholderType, TemplateTier } from '@/lib/types/database'

type ServiceSupabaseClient = ReturnType<typeof createServiceClient>

interface CoreCampaignTemplateSeed {
  name: string
  audienceTags: string[]
  stakeholderTypes: StakeholderType[]
  libraryFolder: MaterialLibraryFolder
  tiers: TemplateTier[]
  metadata: Record<string, unknown>
}

export const CAMPAIGN_QR_POSITION = {
  x: 808,
  y: 1028,
  width: 184,
  height: 184,
  canvas_width: 1080,
  canvas_height: 1330,
}

export const CORE_CAMPAIGN_TEMPLATE_SEEDS: CoreCampaignTemplateSeed[] = [
  {
    name: 'Community Campaign - Business Invite Flyer',
    audienceTags: ['businesses'],
    stakeholderTypes: ['school', 'cause', 'community'],
    libraryFolder: 'share_with_businesses',
    tiers: ['auto', 'assignable'],
    metadata: {
      variant: 'campaign_sheet',
      layoutStyle: 'comparison_master',
      eyebrow: '{{stakeholder_name}}',
      headline: 'ONE GIVEBACK DAY CAN BECOME MORE THAN ONE DAY.',
      subheadline: 'Same idea you already know. More ways for everyone to benefit.',
      sectionLabel: 'THE GIVEBACK DAY YOU ALREADY KNOW',
      sectionTitle: 'HOST A {{community_short_name}} GIVEBACK DAY',
      sectionBody: 'Choose one day that could use more traffic. We rally the community and give people a reason to choose you.',
      comparisonSummary: 'The relationship continues and the impact can grow beyond the day.',
      steps: [
        {
          title: '{{community_short_name}} promotes your business',
          body: '',
        },
        {
          title: 'Our supporters shop with you',
          body: '',
        },
        {
          title: 'A successful Giveback Day. Great impact.',
          body: '',
        },
      ],
      proofLabel: 'WHAT LOCALVIP ADDS',
      proofItems: [
        {
          title: '{{community_short_name}} benefits',
          body: '',
        },
        {
          title: 'Customers can be rewarded',
          body: '',
        },
        {
          title: 'Your business can benefit',
          body: '',
        },
      ],
      cta: 'HOST YOUR FIRST GIVEBACK DAY',
      ctaSubline: 'Watch the 60-second explanation. Schedule a 15-minute setup call.',
      qrCaption: 'Scan to start',
      noteHeadline: 'NOTHING CHANGES ABOUT WHY WE DO THIS.',
      footer: 'You are still supporting {{community_short_name}} and helping your kids. LocalVIP simply makes the experience better for everyone involved and turns a single day into an ongoing connection.',
      footerBadges: ['SAME COMMUNITY.', 'SAME GENEROSITY.', 'MORE WAYS TO WIN.'],
      titlePattern: '{{stakeholder_name}} - Business Invite Flyer',
      descriptionPattern: 'Invite local businesses into a {{stakeholder_name}} giveback day.',
    },
  },
  {
    name: 'Community Campaign - Parent Support Flyer',
    audienceTags: ['parents'],
    stakeholderTypes: ['school', 'cause', 'community'],
    libraryFolder: 'share_with_parents',
    tiers: ['auto', 'assignable'],
    metadata: {
      variant: 'campaign_sheet',
      eyebrow: '{{stakeholder_name}}',
      headline: 'SUPPORT {{community_short_name}} BY SHOWING UP LOCAL.',
      subheadline: 'When families choose participating businesses, local support grows beyond one event.',
      sectionLabel: 'HOW IT WORKS',
      sectionTitle: 'ONE SIMPLE CHOICE CAN HELP',
      sectionBody: 'This is not one more fundraiser. It is a simple way to turn everyday local spending into support for {{stakeholder_name}}.',
      steps: [
        {
          title: 'Find a participating business',
          body: 'Look for Giveback Day partners connected to {{stakeholder_name}}.',
        },
        {
          title: 'Show up local',
          body: 'Grab dinner, coffee, treats, or whatever fits your day.',
        },
        {
          title: 'Help support grow',
          body: 'The more families participate, the stronger the community partnership becomes.',
        },
      ],
      proofLabel: 'WHY IT MATTERS',
      proofItems: [
        {
          title: 'Simple',
          body: 'No forms, no new fundraiser, no extra pitch.',
        },
        {
          title: 'Local',
          body: 'Your support stays connected to nearby businesses.',
        },
        {
          title: 'Repeatable',
          body: 'One good Giveback Day can lead to year-round local support.',
        },
      ],
      cta: 'SCAN TO SEE WHO IS PARTICIPATING',
      ctaSubline: 'Open the supporter page, the business list, and the next step.',
      qrCaption: 'Scan for details',
      noteHeadline: 'EVERYDAY SUPPORT IS STILL THE POINT.',
      footer: 'Support the community by choosing the businesses that choose us.',
      footerBadges: ['SHOW UP LOCAL', 'SUPPORT TOGETHER', 'KEEP IT GOING'],
      titlePattern: '{{stakeholder_name}} - Parent Support Flyer',
      descriptionPattern: 'Parent and supporter flyer for {{stakeholder_name}}.',
    },
  },
  {
    name: 'Community Campaign - School Outreach Flyer',
    audienceTags: ['schools'],
    stakeholderTypes: ['school', 'cause', 'community'],
    libraryFolder: 'share_with_schools',
    tiers: ['auto', 'assignable'],
    metadata: {
      variant: 'campaign_sheet',
      eyebrow: '{{stakeholder_name}}',
      headline: 'YOUR COMMUNITY ALREADY HAS THE TRUST.',
      subheadline: 'Use one business, one clear day, and LocalVIP to turn trust into repeatable support.',
      sectionLabel: 'THE MODEL',
      sectionTitle: 'START SMALL. BUILD SOMETHING REAL.',
      sectionBody: '{{stakeholder_name}} is the proof: one local partner and one clear offer can become a much bigger community engine over time.',
      steps: [
        {
          title: 'Start with one partner business',
          body: 'Pick one business and one day that is easy for them to say yes to.',
        },
        {
          title: 'Rally your supporters',
          body: 'Give families a reason to show up on purpose, not by accident.',
        },
        {
          title: 'Grow from one day into more',
          body: 'Use Giveback Day as the front door to longer-term local participation.',
        },
      ],
      proofLabel: 'WHY SCHOOLS AND CAUSES LIKE IT',
      proofItems: [
        {
          title: 'Easy first step',
          body: 'Businesses can say yes to one day much faster than a whole platform pitch.',
        },
        {
          title: 'Built on local trust',
          body: 'The community relationship does the heavy lifting before the tech does.',
        },
        {
          title: 'Designed to scale',
          body: 'It can expand into more businesses, more supporters, and more repeat activity.',
        },
      ],
      cta: 'BRING THIS TO {{peer_group_label}}',
      ctaSubline: 'Scan to see how the model works and book a short intro call.',
      qrCaption: 'Scan to see it',
      noteHeadline: 'THE TRUST STILL STARTS WITH THE SCHOOL.',
      footer: 'The school or cause leads the trust. LocalVIP provides the engine.',
      footerBadges: ['SCHOOL-LED TRUST', 'LOCAL BUSINESS UPSIDE', 'REPEATABLE SUPPORT'],
      titlePattern: '{{stakeholder_name}} - School Outreach Flyer',
      descriptionPattern: 'Peer outreach flyer based on the {{stakeholder_name}} campaign model.',
    },
  },
]

export const CORE_CAMPAIGN_TEMPLATE_NAMES = CORE_CAMPAIGN_TEMPLATE_SEEDS.map((template) => template.name)

export async function ensureCoreCampaignStructuredTemplates(
  supabase: ServiceSupabaseClient,
) {
  const { data, error } = await supabase
    .from('material_templates')
    .select('*')
    .in('name', CORE_CAMPAIGN_TEMPLATE_NAMES)

  if (error) throw error

  const existing = ((data || []) as MaterialTemplate[])
  const existingNames = new Set(existing.map((template) => template.name))
  const missing = CORE_CAMPAIGN_TEMPLATE_SEEDS.filter((template) => !existingNames.has(template.name))

  if (missing.length === 0) return existing

  const rows = missing.map((template) => ({
    name: template.name,
    source_path: null,
    template_type: 'structured',
    output_format: 'png' as const,
    audience_tags: template.audienceTags,
    stakeholder_types: template.stakeholderTypes,
    library_folder: template.libraryFolder,
    qr_position_json: CAMPAIGN_QR_POSITION,
    is_active: true,
    tiers: template.tiers,
    version: 1,
    scope_global: true,
    scope_cities: [],
    scope_campaigns: [],
    scope_categories: [],
    created_by: null,
    metadata: template.metadata,
  }))

  const { data: inserted, error: insertError } = await (supabase.from('material_templates') as any)
    .insert(rows)
    .select()

  if (insertError) throw insertError

  return [...existing, ...((inserted || []) as MaterialTemplate[])]
}
