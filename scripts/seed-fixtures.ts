import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_PASSWORD = 'demo1234'
const PDF_URL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
const sid = (group: number, index: number) =>
  `00000000-0000-0000-0000-${String(group).padStart(2, '0')}${String(index).padStart(10, '0')}`

const extraUsers = [
  ['maya@localvip.com', 'Maya Patel', 'intern', 'localvip', 'maya-clt', 'Charlotte'],
  ['ethan@localvip.com', 'Ethan Brooks', 'intern', 'localvip', 'ethan-nsh', 'Nashville'],
  ['naomi@localvip.com', 'Naomi Carter', 'volunteer', 'hato', 'naomi-bhm', 'Birmingham'],
] as const

const makeIdMap = <T extends readonly string[]>(group: number, keys: T) =>
  Object.fromEntries(keys.map((key, index) => [key, sid(group, index + 1)])) as Record<T[number], string>

const contactIds = {
  lisa: sid(60, 1),
  elena: sid(60, 11),
  amy: sid(60, 12),
  ty: sid(60, 13),
} as const
const referralIds = makeIdMap(97, ['alexBakery', 'jordanCoffee', 'mayaSchool', 'caseyPlayTown'] as const)
const tagIds = makeIdMap(98, ['priority', 'coffee', 'restaurant', 'fitness', 'salon', 'family', 'school', 'launch'] as const)

async function upsert(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

async function listAllAuthUsers() {
  const users: Array<{ id: string; email?: string | null }> = []
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 200) break
    page += 1
  }
  return users
}

async function seedFixtures() {
  const { data: cities } = await supabase.from('cities').select('id,name,state')
  const { data: profilesBefore } = await supabase.from('profiles').select('id,email,full_name,city_id')
  if (!cities || !profilesBefore) throw new Error('Base seed data is missing. Run scripts/seed.ts first.')

  const cityByName = new Map(cities.map(city => [city.name, city]))
  const authMap = new Map((await listAllAuthUsers()).map(user => [user.email?.toLowerCase() || '', user.id]))

  for (const [email, name, role, brand, referralCode, cityName] of extraUsers) {
    let userId = authMap.get(email.toLowerCase()) || null
    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: name, role },
      })
      if (error) throw error
      userId = data.user.id
      authMap.set(email.toLowerCase(), userId)
    }
    await supabase.from('profiles').upsert({
      id: userId,
      email,
      full_name: name,
      role,
      brand_context: brand,
      city_id: cityByName.get(cityName)?.id || null,
      referral_code: referralCode,
      status: 'active',
    }, { onConflict: 'id' })
  }

  const { data: profiles } = await supabase.from('profiles').select('id,email,full_name,city_id')
  const { data: baseCampaigns } = await supabase.from('campaigns').select('id,name,city_id')
  const { data: baseBusinesses } = await supabase.from('businesses').select('id,name,city_id')
  const { data: baseCauses } = await supabase.from('causes').select('id,name,city_id')
  if (!profiles || !baseCampaigns || !baseBusinesses || !baseCauses) throw new Error('Failed to load base rows.')

  const profileId = (email: string) => profiles.find(profile => profile.email.toLowerCase() === email.toLowerCase())?.id || ''
  const businessByName = new Map(baseBusinesses.map(item => [item.name, item]))
  const causeByName = new Map(baseCauses.map(item => [item.name, item]))
  const campaignByName = new Map(baseCampaigns.map(item => [item.name, item]))

  const nashvilleCampaignId = sid(31, 1)
  const queenCityId = sid(41, 1)
  const playTownId = sid(41, 2)
  const magicLanternId = sid(41, 3)
  const charlotteCauseId = sid(51, 1)
  const nashvilleCauseId = sid(51, 2)
  const birminghamCauseId = sid(51, 3)

  await upsert('campaigns', [
    {
      id: nashvilleCampaignId,
      name: 'Nashville Local Reads Push',
      description: 'Literacy-linked restaurant and venue outreach.',
      brand: 'localvip',
      city_id: cityByName.get('Nashville')?.id || null,
      start_date: '2026-04-01',
      end_date: '2026-07-31',
      status: 'active',
      owner_id: profileId('ethan@localvip.com'),
    },
  ])

  await upsert('causes', [
    {
      id: charlotteCauseId,
      name: 'Charlotte Teachers Fund',
      type: 'school',
      city_id: cityByName.get('Charlotte')?.id || null,
      brand: 'hato',
      stage: 'interested',
      owner_id: profileId('maya@localvip.com'),
      source: 'Parent referral',
      campaign_id: campaignByName.get('Charlotte Pilot')?.id || null,
      status: 'active',
      metadata: { local_context: 'Plaza Midwood parents', fundraising_goal: '$12500' },
    },
    {
      id: nashvilleCauseId,
      name: 'Nashville Reads Coalition',
      type: 'nonprofit',
      city_id: cityByName.get('Nashville')?.id || null,
      brand: 'localvip',
      stage: 'in_progress',
      owner_id: profileId('ethan@localvip.com'),
      source: 'Community intro',
      campaign_id: nashvilleCampaignId,
      status: 'active',
      metadata: { local_context: 'Music Row literacy push', fundraising_goal: '$14000' },
    },
    {
      id: birminghamCauseId,
      name: 'Birmingham Northside PTA',
      type: 'school',
      city_id: cityByName.get('Birmingham')?.id || null,
      brand: 'hato',
      stage: 'contacted',
      owner_id: profileId('naomi@localvip.com'),
      source: 'Community event',
      status: 'active',
      metadata: { local_context: 'Northside family partnership', fundraising_goal: '$8000' },
    },
  ])

  await upsert('businesses', [
    {
      id: queenCityId,
      name: 'Queen City Coffee',
      city_id: cityByName.get('Charlotte')?.id || null,
      category: 'Coffee Shop',
      brand: 'localvip',
      stage: 'interested',
      owner_id: profileId('maya@localvip.com'),
      source: 'Neighborhood referral',
      campaign_id: campaignByName.get('Charlotte Pilot')?.id || null,
      linked_cause_id: charlotteCauseId,
      status: 'active',
      email: 'hello@queencitycoffee.com',
      phone: '(704) 555-0707',
      website: 'queencitycoffee.com',
      address: '715 Central Ave, Charlotte, NC 28204',
      metadata: { owner_name: 'Elena Diaz', specific_product: 'coffee and breakfast sandwiches', avg_ticket: '$12', local_context: 'Plaza Midwood regulars' },
    },
    {
      id: playTownId,
      name: 'PlayTown Kids Atlanta',
      city_id: cityByName.get('Atlanta')?.id || null,
      category: 'Family Entertainment / Kids Venue',
      brand: 'localvip',
      stage: 'lead',
      owner_id: profileId('volunteer@example.com'),
      source: 'Influencer referral',
      campaign_id: campaignByName.get('Atlanta Spring 2026 Launch')?.id || null,
      linked_cause_id: causeByName.get('MLK Elementary School')?.id || null,
      status: 'active',
      email: 'events@playtownkids.com',
      phone: '(404) 555-0606',
      website: 'playtownkids.com',
      address: '1200 Memorial Dr SE, Atlanta, GA 30316',
      metadata: { owner_name: 'Amy Lopez', specific_product: 'birthday packages', avg_ticket: '$32', local_context: 'East Atlanta family outings' },
    },
    {
      id: magicLanternId,
      name: 'Magic Lantern Arcade',
      city_id: cityByName.get('Birmingham')?.id || null,
      category: 'Family Entertainment / Kids Venue',
      brand: 'localvip',
      stage: 'contacted',
      owner_id: profileId('naomi@localvip.com'),
      source: 'Event intro',
      linked_cause_id: birminghamCauseId,
      status: 'active',
      email: 'hello@magiclanternarcade.com',
      phone: '(205) 555-0909',
      website: 'magiclanternarcade.com',
      address: '300 20th St N, Birmingham, AL 35203',
      metadata: { owner_name: 'Ty Marshall', specific_product: 'game cards and birthday rooms', avg_ticket: '$30', local_context: 'Downtown family weekends' },
    },
  ])

  const { data: businesses } = await supabase.from('businesses').select('id,name,city_id,stage,campaign_id,linked_cause_id,owner_id')
  const { data: causes } = await supabase.from('causes').select('id,name,city_id,stage,owner_id,campaign_id')
  if (!businesses || !causes) throw new Error('Failed to reload businesses or causes.')

  const businessId = (name: string) => businesses.find(item => item.name === name)?.id || ''
  const causeId = (name: string) => causes.find(item => item.name === name)?.id || ''

  await upsert('contacts', [
    { id: contactIds.lisa, first_name: 'Lisa', last_name: 'Chen', email: 'owner@mainstreetbakery.com', phone: '(404) 555-0101', title: 'Owner', business_id: businessId('Main Street Bakery'), owner_id: profileId('owner@mainstreetbakery.com'), source: 'Owner record', status: 'active' },
    { id: sid(60, 11), first_name: 'Elena', last_name: 'Diaz', email: 'hello@queencitycoffee.com', phone: '(704) 555-0707', title: 'Owner', business_id: queenCityId, owner_id: profileId('maya@localvip.com'), source: 'Referral', status: 'active' },
    { id: sid(60, 12), first_name: 'Amy', last_name: 'Lopez', email: 'events@playtownkids.com', phone: '(404) 555-0606', title: 'Manager', business_id: playTownId, owner_id: profileId('volunteer@example.com'), source: 'Referral', status: 'active' },
    { id: sid(60, 13), first_name: 'Ty', last_name: 'Marshall', email: 'hello@magiclanternarcade.com', phone: '(205) 555-0909', title: 'Owner', business_id: magicLanternId, owner_id: profileId('naomi@localvip.com'), source: 'Event', status: 'active' },
  ])

  const flowRows = businesses.map((business, index) => ({
    id: sid(95, index + 1),
    name: `${business.name} onboarding`,
    entity_type: 'business',
    entity_id: business.id,
    brand: 'localvip',
    stage: business.stage,
    owner_id: business.owner_id,
    campaign_id: business.campaign_id,
    started_at: '2026-03-01T09:00:00Z',
    completed_at: ['live', 'onboarded'].includes(business.stage) ? '2026-03-20T16:00:00Z' : null,
    metadata: { source: 'seed-fixtures' },
  }))
  const stageCount: Record<string, number> = { lead: 0, contacted: 1, interested: 2, in_progress: 3, onboarded: 4, live: 4 }

  await upsert('onboarding_flows', flowRows)
  await upsert('onboarding_steps', flowRows.flatMap((flow, flowIndex) => ['Initial connection', 'Owner conversation', 'Materials + QR', 'Launch decision'].map((title, stepIndex) => ({
    id: sid(96, flowIndex * 4 + stepIndex + 1),
    flow_id: flow.id,
    title,
    description: title,
    sort_order: stepIndex + 1,
    is_required: true,
    is_completed: stepIndex < (stageCount[flow.stage] || 0),
    completed_by: stepIndex < (stageCount[flow.stage] || 0) ? flow.owner_id : null,
    completed_at: stepIndex < (stageCount[flow.stage] || 0) ? `2026-03-${String(11 + stepIndex).padStart(2, '0')}T14:00:00Z` : null,
    metadata: { source: 'seed-fixtures' },
  }))))

  await upsert('materials', [
    { id: sid(70, 11), title: 'Atlanta Business One-Pager', description: 'Core LocalVIP business overview.', type: 'pdf', brand: 'localvip', file_url: PDF_URL, file_name: 'atlanta-one-pager.pdf', file_size: 28000, mime_type: 'application/pdf', thumbnail_url: PDF_URL, category: 'Onboarding', use_case: 'business_onboarding', target_roles: ['business_onboarding', 'intern', 'volunteer'], campaign_id: campaignByName.get('Atlanta Spring 2026 Launch')?.id || null, city_id: cityByName.get('Atlanta')?.id || null, is_template: true, version: 1, status: 'active', created_by: profileId('alex@partner.com') },
    { id: sid(70, 12), title: 'Charlotte Pilot Flyer', description: 'Coffee-shop pilot PDF.', type: 'pdf', brand: 'localvip', file_url: PDF_URL, file_name: 'charlotte-pilot.pdf', file_size: 27720, mime_type: 'application/pdf', thumbnail_url: PDF_URL, category: 'Pilot', use_case: 'influencer_outreach', target_roles: ['influencer', 'intern'], campaign_id: campaignByName.get('Charlotte Pilot')?.id || null, city_id: cityByName.get('Charlotte')?.id || null, is_template: false, version: 1, status: 'active', created_by: profileId('maya@localvip.com') },
    { id: sid(70, 13), title: 'HATO School One-Pager', description: 'School support overview.', type: 'pdf', brand: 'hato', file_url: PDF_URL, file_name: 'hato-school.pdf', file_size: 30000, mime_type: 'application/pdf', thumbnail_url: PDF_URL, category: 'School support', use_case: 'cause_onboarding', target_roles: ['school_leader', 'volunteer', 'intern'], campaign_id: campaignByName.get('HATO Back to School')?.id || null, city_id: cityByName.get('Atlanta')?.id || null, is_template: true, version: 1, status: 'active', created_by: profileId('principal@mlkschool.edu') },
    { id: sid(70, 14), title: 'How to Invite Your Customers', description: 'Simple business-owner script for inviting regulars into LocalVIP.', type: 'pdf', brand: 'localvip', file_url: PDF_URL, file_name: 'invite-your-customers.pdf', file_size: 28120, mime_type: 'application/pdf', thumbnail_url: PDF_URL, category: 'business_to_consumer', use_case: 'general', target_roles: ['business'], campaign_id: null, city_id: cityByName.get('Atlanta')?.id || null, is_template: true, version: 1, status: 'active', created_by: profileId('alex@partner.com') },
    { id: sid(70, 15), title: 'What to Say to Your Regulars', description: 'Short talking points for in-store customer conversations.', type: 'pdf', brand: 'localvip', file_url: PDF_URL, file_name: 'what-to-say.pdf', file_size: 28180, mime_type: 'application/pdf', thumbnail_url: PDF_URL, category: 'business_to_consumer', use_case: 'general', target_roles: ['business'], campaign_id: null, city_id: cityByName.get('Atlanta')?.id || null, is_template: true, version: 1, status: 'active', created_by: profileId('alex@partner.com') },
    { id: sid(70, 16), title: 'Simple Script to Explain LocalVIP', description: 'Quick leave-behind explanation for customers who want the short version.', type: 'pdf', brand: 'localvip', file_url: PDF_URL, file_name: 'simple-script-localvip.pdf', file_size: 28210, mime_type: 'application/pdf', thumbnail_url: PDF_URL, category: 'business_to_consumer', use_case: 'general', target_roles: ['business'], campaign_id: null, city_id: cityByName.get('Atlanta')?.id || null, is_template: true, version: 1, status: 'active', created_by: profileId('alex@partner.com') },
  ])
  await upsert('material_assignments', [
    { id: sid(87, 11), material_id: sid(70, 11), stakeholder_id: profileId('alex@partner.com'), assigned_by: profileId('kenneth@localvip.com') },
    { id: sid(87, 12), material_id: sid(70, 12), stakeholder_id: profileId('maya@localvip.com'), assigned_by: profileId('kenneth@localvip.com') },
    { id: sid(87, 13), material_id: sid(70, 13), stakeholder_id: profileId('principal@mlkschool.edu'), assigned_by: profileId('rick@localvip.com') },
  ])

  await upsert('qr_code_collections', [
    { id: sid(80, 11), name: 'Atlanta Launch Materials', description: 'Atlanta QR set.', brand: 'localvip', created_by: profileId('alex@partner.com'), status: 'active' },
    { id: sid(80, 12), name: 'Charlotte Pilot Set', description: 'Charlotte QR set.', brand: 'localvip', created_by: profileId('maya@localvip.com'), status: 'active' },
  ])
  await upsert('qr_codes', [
    { id: sid(81, 11), name: 'Bakery Launch QR', short_code: 'atl-bakery-26', destination_url: 'https://localvip.com/atlanta/main-street-bakery', redirect_url: 'https://localvip.com/r/atl-bakery-26', brand: 'localvip', foreground_color: '#b45309', background_color: '#ffffff', frame_text: 'Support MLK Elementary', campaign_id: campaignByName.get('Atlanta Spring 2026 Launch')?.id || null, city_id: cityByName.get('Atlanta')?.id || null, stakeholder_id: profileId('alex@partner.com'), business_id: businessId('Main Street Bakery'), cause_id: causeId('MLK Elementary School'), collection_id: sid(80, 11), destination_preset: 'localvip_business', scan_count: 38, version: 1, status: 'active', created_by: profileId('alex@partner.com'), metadata: { source: 'seed-fixtures' } },
    { id: sid(81, 12), name: 'Queen City QR', short_code: 'clt-coffee-26', destination_url: 'https://localvip.com/charlotte/queen-city-coffee', redirect_url: 'https://localvip.com/r/clt-coffee-26', brand: 'localvip', foreground_color: '#b45309', background_color: '#ffffff', frame_text: 'Back Charlotte Teachers Fund', campaign_id: campaignByName.get('Charlotte Pilot')?.id || null, city_id: cityByName.get('Charlotte')?.id || null, stakeholder_id: profileId('maya@localvip.com'), business_id: queenCityId, cause_id: charlotteCauseId, collection_id: sid(80, 12), destination_preset: 'localvip_business', scan_count: 19, version: 1, status: 'active', created_by: profileId('maya@localvip.com'), metadata: { source: 'seed-fixtures' } },
  ])
  await upsert('redirects', [
    { id: sid(82, 11), short_code: 'atl-bakery-26', destination_url: 'https://localvip.com/atlanta/main-street-bakery', qr_code_id: sid(81, 11), click_count: 38, status: 'active', created_by: profileId('alex@partner.com') },
    { id: sid(82, 12), short_code: 'clt-coffee-26', destination_url: 'https://localvip.com/charlotte/queen-city-coffee', qr_code_id: sid(81, 12), click_count: 19, status: 'active', created_by: profileId('maya@localvip.com') },
  ])
  await upsert('qr_code_events', [
    { id: sid(88, 11), qr_code_id: sid(81, 11), event_type: 'scan', city: 'Atlanta', country: 'US', metadata: { source: 'counter' } },
    { id: sid(88, 12), qr_code_id: sid(81, 12), event_type: 'scan', city: 'Charlotte', country: 'US', metadata: { source: 'register' } },
  ])

  await upsert('outreach_scripts', [
    { id: sid(84, 11), business_id: businessId('Main Street Bakery'), cause_id: causeId('MLK Elementary School'), campaign_id: campaignByName.get('Atlanta Spring 2026 Launch')?.id || null, city_id: cityByName.get('Atlanta')?.id || null, contact_id: contactIds.lisa, created_by: profileId('alex@partner.com'), script_category: 'coffee_shop', script_type: 'relationship_opener', script_tier: 'best', channel: 'in_person', status: 'sent', business_category: 'Coffee Shop', generated_content: 'Hi, I am from Atlanta, I went to MLK Elementary, and I have been by Main Street Bakery quite a few times. I am working on something local that helps places like yours while also supporting MLK Elementary School.', final_content: 'Hi, I am from Atlanta and I went to MLK Elementary. I have been coming into Main Street Bakery for coffee for a long time, and this could support MLK families in a very local way. Would you be open to a quick look?', was_edited: true, notes: 'Adjusted for Alex voice.', copy_count: 2, copied_at: '2026-03-18T10:15:00Z', sent_at: '2026-03-18T10:17:00Z', linked_material_id: sid(70, 11), linked_qr_code_id: sid(81, 11), linked_qr_collection_id: sid(80, 11), personalization: { city: 'Atlanta', school_name: 'MLK Elementary', specific_product: 'coffee', avg_ticket: '$14' }, metadata: { source: 'seed-fixtures' } },
    { id: sid(84, 12), business_id: queenCityId, cause_id: charlotteCauseId, campaign_id: campaignByName.get('Charlotte Pilot')?.id || null, city_id: cityByName.get('Charlotte')?.id || null, contact_id: sid(60, 11), created_by: profileId('maya@localvip.com'), script_category: 'coffee_shop', script_type: 'daily_routine_angle', script_tier: 'better', channel: 'text_dm', status: 'copied', business_category: 'Coffee Shop', generated_content: 'Hi Elena, I am from Charlotte, went to Charlotte Teachers Fund, and I thought of Queen City Coffee because people already stop in there as part of their normal day.', final_content: 'Hi Elena, I grew up here and have stopped by Queen City Coffee a lot over the years. Since people are already coming in around $12, this could support Charlotte classrooms in a very local way. Would you be open to a quick look?', was_edited: true, notes: 'Saved as text version.', copy_count: 3, copied_at: '2026-03-19T09:40:00Z', linked_material_id: sid(70, 12), linked_qr_code_id: sid(81, 12), linked_qr_collection_id: sid(80, 12), personalization: { city: 'Charlotte', school_name: 'Charlotte Teachers Fund', specific_product: 'coffee and breakfast sandwiches', avg_ticket: '$12' }, metadata: { source: 'seed-fixtures' } },
  ])

  await upsert('outreach_activities', [
    { id: sid(89, 11), type: 'in_person', subject: 'First bakery conversation', body: 'Met Lisa at the counter and left a one-pager.', entity_type: 'business', entity_id: businessId('Main Street Bakery'), business_id: businessId('Main Street Bakery'), cause_id: causeId('MLK Elementary School'), city_id: cityByName.get('Atlanta')?.id || null, contact_id: contactIds.lisa, performed_by: profileId('alex@partner.com'), campaign_id: campaignByName.get('Atlanta Spring 2026 Launch')?.id || null, outreach_script_id: sid(84, 11), script_category: 'coffee_shop', script_type: 'relationship_opener', script_tier: 'best', script_channel: 'in_person', outreach_status: 'interested', business_category: 'Coffee Shop', generated_script_content: 'Hi, I am from Atlanta, I went to MLK Elementary, and I have been by Main Street Bakery quite a few times. I am working on something local that helps places like yours while also supporting MLK Elementary School.', edited_script_content: 'Hi, I am from Atlanta and I went to MLK Elementary. I have been coming into Main Street Bakery for coffee for a long time, and this could support MLK families in a very local way. Would you be open to a quick look?', log_notes: 'Lisa wanted a pricing sheet before deciding.', linked_material_id: sid(70, 11), linked_qr_code_id: sid(81, 11), linked_qr_collection_id: sid(80, 11), outcome: 'Interested', next_step: 'Follow up Thursday morning.', next_step_date: '2026-03-21T14:00:00Z', metadata: { channel: 'in_person' } },
    { id: sid(89, 12), type: 'text', subject: 'Queen City follow-up', body: 'Sent neighborhood-specific version.', entity_type: 'business', entity_id: queenCityId, business_id: queenCityId, cause_id: charlotteCauseId, city_id: cityByName.get('Charlotte')?.id || null, contact_id: sid(60, 11), performed_by: profileId('maya@localvip.com'), campaign_id: campaignByName.get('Charlotte Pilot')?.id || null, outreach_script_id: sid(84, 12), script_category: 'coffee_shop', script_type: 'daily_routine_angle', script_tier: 'better', script_channel: 'text_dm', outreach_status: 'follow_up_needed', business_category: 'Coffee Shop', generated_script_content: 'Hi Elena, I am from Charlotte, went to Charlotte Teachers Fund, and I thought of Queen City Coffee because people already stop in there as part of their normal day.', edited_script_content: 'Hi Elena, I grew up here and have stopped by Queen City Coffee a lot over the years. Since people are already coming in around $12, this could support Charlotte classrooms in a very local way. Would you be open to a quick look?', log_notes: 'Plan in-person weekend stop-in.', linked_material_id: sid(70, 12), linked_qr_code_id: sid(81, 12), linked_qr_collection_id: sid(80, 12), outcome: 'Copied', next_step: 'Visit Saturday morning.', next_step_date: '2026-03-23T15:00:00Z', metadata: { channel: 'text' } },
    { id: sid(89, 13), type: 'in_person', subject: 'MLK principal approval', body: 'Sarah confirmed MLK wants two launch partners.', entity_type: 'cause', entity_id: causeId('MLK Elementary School'), cause_id: causeId('MLK Elementary School'), city_id: cityByName.get('Atlanta')?.id || null, performed_by: profileId('principal@mlkschool.edu'), campaign_id: campaignByName.get('HATO Back to School')?.id || null, log_notes: 'Need shortlist that feels hyper-local to parents.', outcome: 'Approved', next_step: 'Share business shortlist.', next_step_date: '2026-03-22T13:30:00Z', metadata: { channel: 'meeting' } },
  ])

  await upsert('tasks', [
    { id: sid(90, 11), title: 'Bring pricing sheet to Main Street Bakery', priority: 'high', status: 'pending', assigned_to: profileId('alex@partner.com'), created_by: profileId('alex@partner.com'), entity_type: 'business', entity_id: businessId('Main Street Bakery'), due_date: '2026-03-21T14:00:00Z' },
    { id: sid(90, 12), title: 'Saturday in-person follow-up at Queen City Coffee', priority: 'high', status: 'pending', assigned_to: profileId('maya@localvip.com'), created_by: profileId('maya@localvip.com'), entity_type: 'business', entity_id: queenCityId, due_date: '2026-03-23T15:00:00Z' },
    { id: sid(90, 13), title: 'Set Birmingham intro meeting', priority: 'high', status: 'pending', assigned_to: profileId('naomi@localvip.com'), created_by: profileId('rick@localvip.com'), entity_type: 'business', entity_id: magicLanternId, due_date: '2026-03-29T17:00:00Z' },
    { id: sid(90, 14), title: 'Send business shortlist to MLK family liaison', priority: 'medium', status: 'pending', assigned_to: profileId('principal@mlkschool.edu'), created_by: profileId('principal@mlkschool.edu'), entity_type: 'cause', entity_id: causeId('MLK Elementary School'), due_date: '2026-03-22T13:30:00Z' },
  ])

  await upsert('notes', [
    { id: sid(91, 11), content: 'Lisa responds best to simple math and neighborhood language.', entity_type: 'business', entity_id: businessId('Main Street Bakery'), created_by: profileId('alex@partner.com'), is_internal: false },
    { id: sid(91, 12), content: 'Queen City Coffee is the strongest Charlotte proof point.', entity_type: 'business', entity_id: queenCityId, created_by: profileId('maya@localvip.com'), is_internal: false },
    { id: sid(91, 13), content: 'MLK wants businesses families already know.', entity_type: 'cause', entity_id: causeId('MLK Elementary School'), created_by: profileId('principal@mlkschool.edu'), is_internal: false },
    { id: sid(91, 14), content: 'Charlotte pilot should stay coffee and lunch focused.', entity_type: 'campaign', entity_id: campaignByName.get('Charlotte Pilot')?.id || null, created_by: profileId('maya@localvip.com'), is_internal: true },
  ])

  await upsert('referrals', [
    { id: referralIds.alexBakery, referrer_id: profileId('alex@partner.com'), referral_code: 'alex-mainstreet', entity_type: 'business', entity_id: businessId('Main Street Bakery'), campaign_id: campaignByName.get('Atlanta Spring 2026 Launch')?.id || null, status: 'converted', converted_at: '2026-03-18T10:17:00Z', metadata: { source: 'walk_in' } },
    { id: referralIds.jordanCoffee, referrer_id: profileId('jordan@influencer.com'), referral_code: 'jordan-queen-city', entity_type: 'business', entity_id: queenCityId, campaign_id: campaignByName.get('Charlotte Pilot')?.id || null, status: 'pending', metadata: { source: 'influencer_intro' } },
    { id: referralIds.mayaSchool, referrer_id: profileId('maya@localvip.com'), referral_code: 'maya-charlotte-school', entity_type: 'cause', entity_id: charlotteCauseId, campaign_id: campaignByName.get('Charlotte Pilot')?.id || null, status: 'pending', metadata: { source: 'parent_network' } },
    { id: referralIds.caseyPlayTown, referrer_id: profileId('volunteer@example.com'), referral_code: 'casey-playtown', entity_type: 'business', entity_id: playTownId, campaign_id: campaignByName.get('Atlanta Spring 2026 Launch')?.id || null, status: 'pending', metadata: { source: 'dm_intro' } },
  ])

  await upsert('analytics_rollups', [
    { id: sid(92, 11), period: 'weekly', period_start: '2026-03-16', dimension_type: 'city', dimension_id: cityByName.get('Atlanta')?.id || null, metric: 'outreach_volume', value: 18, metadata: { brand: 'localvip' } },
    { id: sid(92, 12), period: 'weekly', period_start: '2026-03-16', dimension_type: 'city', dimension_id: cityByName.get('Charlotte')?.id || null, metric: 'outreach_volume', value: 7, metadata: { brand: 'localvip' } },
    { id: sid(92, 13), period: 'weekly', period_start: '2026-03-16', dimension_type: 'campaign', dimension_id: campaignByName.get('Charlotte Pilot')?.id || null, metric: 'businesses_contacted', value: 3, metadata: {} },
    { id: sid(92, 14), period: 'weekly', period_start: '2026-03-16', dimension_type: 'stakeholder', dimension_id: profileId('alex@partner.com'), metric: 'outreach_volume', value: 9, metadata: { role: 'business_onboarding' } },
  ])

  await upsert('tags', [
    { id: tagIds.priority, name: 'priority', category: 'internal' },
    { id: tagIds.coffee, name: 'coffee-shop', category: 'business' },
    { id: tagIds.restaurant, name: 'restaurant', category: 'business' },
    { id: tagIds.fitness, name: 'fitness', category: 'business' },
    { id: tagIds.salon, name: 'salon', category: 'business' },
    { id: tagIds.family, name: 'family-venue', category: 'business' },
    { id: tagIds.school, name: 'school-partner', category: 'cause' },
    { id: tagIds.launch, name: 'launch-ready', category: 'internal' },
  ])
  await upsert('entity_tags', [
    { id: sid(93, 11), tag_id: tagIds.coffee, entity_type: 'business', entity_id: businessId('Main Street Bakery') },
    { id: sid(93, 12), tag_id: tagIds.coffee, entity_type: 'business', entity_id: queenCityId },
    { id: sid(93, 13), tag_id: tagIds.family, entity_type: 'business', entity_id: playTownId },
    { id: sid(93, 14), tag_id: tagIds.family, entity_type: 'business', entity_id: magicLanternId },
    { id: sid(93, 15), tag_id: tagIds.school, entity_type: 'cause', entity_id: causeId('MLK Elementary School') },
  ])
  await upsert('audit_logs', [
    { id: sid(94, 11), user_id: profileId('kenneth@localvip.com'), action: 'seeded_city_fixtures', entity_type: 'city', entity_id: cityByName.get('Charlotte')?.id || null, metadata: { source: 'seed-fixtures' } },
    { id: sid(94, 12), user_id: profileId('alex@partner.com'), action: 'created_outreach_script', entity_type: 'outreach_script', entity_id: sid(84, 11), metadata: { source: 'seed-fixtures' } },
    { id: sid(94, 13), user_id: profileId('maya@localvip.com'), action: 'assigned_material', entity_type: 'material', entity_id: sid(70, 12), metadata: { source: 'seed-fixtures' } },
  ])

  console.log('Fixture seed complete.')
}

seedFixtures().catch(error => {
  console.error(error)
  process.exit(1)
})
