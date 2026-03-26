/**
 * Seed script for LocalVIP Stakeholder Support System.
 *
 * Creates demo data in Supabase for testing and development.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Prerequisites:
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local
 *   - Database migrations must be applied first (supabase db push)
 *
 * Demo accounts (all passwords: "demo1234"):
 *   - kenneth@localvip.com (Super Admin)
 *   - rick@localvip.com (Internal Admin)
 *   - principal@mlkschool.edu (School Leader)
 *   - director@communitystrong.org (Cause Leader)
 *   - alex@partner.com (Business Onboarding Partner)
 *   - owner@mainstreetbakery.com (Business Owner — Lisa Chen)
 *   - jordan@influencer.com (Influencer)
 *   - volunteer@example.com (Volunteer)
 */

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
  auth: { autoRefreshToken: false, persistSession: false }
})

const DEMO_PASSWORD = 'demo1234'

async function seed() {
  console.log('Seeding LocalVIP Stakeholder Support System...\n')

  // 1. Create cities
  console.log('Creating cities...')
  const { data: cities } = await supabase.from('cities').upsert([
    { id: '00000000-0000-0000-0000-200000000001', name: 'Atlanta', state: 'GA', country: 'US', status: 'active' },
    { id: '00000000-0000-0000-0000-200000000002', name: 'Charlotte', state: 'NC', country: 'US', status: 'active' },
    { id: '00000000-0000-0000-0000-200000000003', name: 'Nashville', state: 'TN', country: 'US', status: 'active' },
    { id: '00000000-0000-0000-0000-200000000004', name: 'Birmingham', state: 'AL', country: 'US', status: 'active' },
  ], { onConflict: 'id' }).select()
  console.log(`  Created ${cities?.length || 0} cities`)

  // 2. Create organizations
  console.log('Creating organizations...')
  const { data: orgs } = await supabase.from('organizations').upsert([
    { id: '00000000-0000-0000-0000-100000000001', name: 'MLK Elementary School', type: 'school', brand: 'hato', city_id: '00000000-0000-0000-0000-200000000001', status: 'active' },
    { id: '00000000-0000-0000-0000-100000000002', name: 'Community Strong Foundation', type: 'nonprofit', brand: 'localvip', city_id: '00000000-0000-0000-0000-200000000001', status: 'active' },
    { id: '00000000-0000-0000-0000-100000000003', name: 'Grace Community Church', type: 'church', brand: 'localvip', city_id: '00000000-0000-0000-0000-200000000001', status: 'active' },
  ], { onConflict: 'id' }).select()
  console.log(`  Created ${orgs?.length || 0} organizations`)

  // 3. Create demo auth users and profiles
  console.log('Creating demo users...')
  const demoUsers = [
    { email: 'kenneth@localvip.com', name: 'Kenneth', role: 'super_admin', brand: 'localvip', referral_code: 'kenneth-admin' },
    { email: 'rick@localvip.com', name: 'Rick', role: 'internal_admin', brand: 'localvip', referral_code: 'rick-admin' },
    { email: 'principal@mlkschool.edu', name: 'Dr. Sarah Johnson', role: 'school_leader', brand: 'hato', referral_code: 'sarah-mlk', org_id: '00000000-0000-0000-0000-100000000001' },
    { email: 'director@communitystrong.org', name: 'Marcus Williams', role: 'cause_leader', brand: 'localvip', referral_code: 'marcus-cs', org_id: '00000000-0000-0000-0000-100000000002' },
    { email: 'alex@partner.com', name: 'Alex Rivera', role: 'business_onboarding', brand: 'localvip', referral_code: 'alex-biz' },
    { email: 'owner@mainstreetbakery.com', name: 'Lisa Chen', role: 'business_onboarding', brand: 'localvip', referral_code: 'lisa-biz' },
    { email: 'jordan@influencer.com', name: 'Jordan Taylor', role: 'influencer', brand: 'localvip', referral_code: 'jordan-inf' },
    { email: 'volunteer@example.com', name: 'Casey Adams', role: 'volunteer', brand: 'localvip', referral_code: 'casey-vol' },
  ]

  for (const user of demoUsers) {
    // Create auth user (idempotent via email)
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: user.name, role: user.role },
    })

    if (authError && !authError.message.includes('already been registered')) {
      console.error(`  Error creating ${user.email}:`, authError.message)
      continue
    }

    const userId = authUser?.user?.id
    if (userId) {
      await supabase.from('profiles').upsert({
        id: userId,
        email: user.email,
        full_name: user.name,
        role: user.role,
        brand_context: user.brand,
        organization_id: (user as any).org_id || null,
        city_id: '00000000-0000-0000-0000-200000000001',
        referral_code: user.referral_code,
        status: 'active',
      }, { onConflict: 'id' })
      console.log(`  Created user: ${user.email} (${user.role})`)
    }
  }

  // 4. Create campaigns
  console.log('Creating campaigns...')
  await supabase.from('campaigns').upsert([
    { id: '00000000-0000-0000-0000-300000000001', name: 'Atlanta Spring 2026 Launch', brand: 'localvip', city_id: '00000000-0000-0000-0000-200000000001', start_date: '2026-02-01', end_date: '2026-05-31', status: 'active', description: 'Major push to onboard businesses in Midtown, Buckhead, and Decatur.' },
    { id: '00000000-0000-0000-0000-300000000002', name: 'HATO Back to School', brand: 'hato', city_id: '00000000-0000-0000-0000-200000000001', start_date: '2026-03-01', end_date: '2026-08-15', status: 'active', description: 'Partner with schools for the fall semester HATO program.' },
    { id: '00000000-0000-0000-0000-300000000003', name: 'Charlotte Pilot', brand: 'localvip', city_id: '00000000-0000-0000-0000-200000000002', start_date: '2026-03-15', end_date: '2026-06-30', status: 'active', description: 'Test market expansion in Charlotte.' },
  ], { onConflict: 'id' })
  console.log('  Created 3 campaigns')

  // 5. Look up owner IDs from profiles for business assignment
  console.log('Looking up business owner IDs...')
  const { data: lisaProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', 'owner@mainstreetbakery.com')
    .single()
  const { data: alexProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', 'alex@partner.com')
    .single()

  const lisaOwnerId = lisaProfile?.id || null
  const alexOwnerId = alexProfile?.id || null
  console.log(`  Lisa Chen owner ID: ${lisaOwnerId || 'not found'}`)
  console.log(`  Alex Rivera owner ID: ${alexOwnerId || 'not found'}`)

  // 6. Create sample businesses with rich metadata (BusinessPortalData)
  console.log('Creating businesses...')
  await supabase.from('businesses').upsert([
    {
      name: 'Main Street Bakery',
      email: 'hello@mainstreetbakery.com',
      phone: '(404) 555-0101',
      website: 'mainstreetbakery.com',
      city_id: '00000000-0000-0000-0000-200000000001',
      category: 'Restaurant / Bakery',
      brand: 'localvip',
      stage: 'interested',
      source: 'Walk-in',
      status: 'active',
      address: '142 Main St, Atlanta, GA 30301',
      owner_id: lisaOwnerId,
      metadata: {
        logo_url: null,
        offer_title: 'Free Cookie with Any Coffee',
        offer_description: 'Enjoy a freshly baked cookie of your choice when you purchase any coffee drink. Choose from chocolate chip, oatmeal raisin, or snickerdoodle.',
        offer_category: 'food_drink',
        offer_value: 'Free cookie (up to $4 value)',
        offer_terms: 'One per customer per visit. Must show LocalVIP pass. Cannot be combined with other offers.',
        offer_start_date: '2026-03-01',
        offer_end_date: '2026-08-31',
        offer_recurring: true,
        selected_days: ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        hours_open: '06:30',
        hours_close: '18:00',
        special_hours_notes: 'Saturday hours 7:00 AM - 3:00 PM. Closed Sundays and Mondays.',
        tagline: 'Baked fresh daily, served with love.',
        description: 'Main Street Bakery has been an Atlanta staple since 2018, offering artisan breads, pastries, and specialty coffee sourced from local roasters. We bake everything from scratch every morning.',
        social_facebook: 'https://facebook.com/mainstreetbakeryatl',
        social_instagram: 'https://instagram.com/mainstreetbakery_atl',
        social_tiktok: null,
        social_x: null,
      },
    },
    {
      name: 'River Cafe',
      email: 'info@rivercafe.co',
      phone: '(404) 555-0303',
      website: 'rivercafe.co',
      city_id: '00000000-0000-0000-0000-200000000001',
      category: 'Restaurant / Cafe',
      brand: 'localvip',
      stage: 'onboarded',
      source: 'Campaign',
      status: 'active',
      address: '55 River Walk Dr, Atlanta, GA 30339',
      owner_id: lisaOwnerId,
      metadata: {
        logo_url: null,
        offer_title: '15% Off Brunch for Two',
        offer_description: 'Get 15% off your total bill when dining with a friend during brunch hours. Includes our famous mimosa flight and seasonal dishes.',
        offer_category: 'food_drink',
        offer_value: '15% off (max $25 discount)',
        offer_terms: 'Valid during brunch hours only (9 AM - 2 PM). Minimum two guests. Excludes alcohol beyond mimosa flight. Show LocalVIP pass to server.',
        offer_start_date: '2026-04-01',
        offer_end_date: '2026-09-30',
        offer_recurring: true,
        selected_days: ['saturday', 'sunday'],
        hours_open: '09:00',
        hours_close: '22:00',
        special_hours_notes: 'Brunch served Saturday & Sunday 9 AM - 2 PM. Dinner service starts at 5 PM.',
        tagline: 'Where the river meets your table.',
        description: 'River Cafe offers a farm-to-table dining experience along the Chattahoochee River. Our seasonal menu highlights Georgia-grown produce, sustainable seafood, and craft cocktails.',
        social_facebook: 'https://facebook.com/rivercafeatl',
        social_instagram: 'https://instagram.com/rivercafe.atl',
        social_tiktok: 'https://tiktok.com/@rivercafeatl',
        social_x: 'https://x.com/rivercafeatl',
      },
    },
    {
      name: 'Sunrise Yoga Studio',
      email: 'namaste@sunriseyoga.com',
      phone: '(678) 555-0404',
      website: 'sunriseyoga.com',
      city_id: '00000000-0000-0000-0000-200000000001',
      category: 'Health & Wellness',
      brand: 'localvip',
      stage: 'live',
      source: 'Cold Outreach',
      status: 'active',
      address: '210 Church St, Marietta, GA 30060',
      owner_id: alexOwnerId,
      metadata: {
        logo_url: null,
        offer_title: 'Free First Class + Mat Rental',
        offer_description: 'New to yoga? Try your first class on us with a complimentary mat rental. Choose from Vinyasa, Hatha, or Restorative sessions.',
        offer_category: 'health_wellness',
        offer_value: 'Free class ($22 value) + free mat rental ($5 value)',
        offer_terms: 'First-time visitors only. Must register online 24 hours in advance. Show LocalVIP pass at front desk. Subject to class availability.',
        offer_start_date: '2026-03-15',
        offer_end_date: '2026-12-31',
        offer_recurring: true,
        selected_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        hours_open: '05:30',
        hours_close: '21:00',
        special_hours_notes: 'Early bird classes at 5:30 AM Mon-Fri. Weekend classes start at 8:00 AM. Reduced hours on holidays.',
        tagline: 'Start your day with intention.',
        description: 'Sunrise Yoga Studio offers over 40 weekly classes for all levels in a warm, welcoming space. Our certified instructors guide you through mindful movement, breathwork, and meditation.',
        social_facebook: null,
        social_instagram: 'https://instagram.com/sunriseyogamarietta',
        social_tiktok: 'https://tiktok.com/@sunriseyogastudio',
        social_x: null,
      },
    },
    {
      name: 'Peachtree Auto Repair',
      email: 'service@peachtreeauto.com',
      phone: '(404) 555-0202',
      website: 'peachtreeauto.com',
      city_id: '00000000-0000-0000-0000-200000000001',
      category: 'Automotive',
      brand: 'localvip',
      stage: 'in_progress',
      source: 'Referral',
      status: 'active',
      address: '890 Peachtree Rd, Atlanta, GA 30308',
      owner_id: alexOwnerId,
      metadata: {
        logo_url: null,
        offer_title: 'Free Multi-Point Inspection',
        offer_description: 'Get a comprehensive 27-point vehicle inspection at no charge. Includes brake check, fluid levels, tire condition, battery test, and a written report.',
        offer_category: 'automotive',
        offer_value: 'Free inspection ($49.95 value)',
        offer_terms: 'By appointment only. One per vehicle per year. Does not include repairs — estimates provided separately. Show LocalVIP pass when dropping off vehicle.',
        offer_start_date: '2026-04-01',
        offer_end_date: '2026-10-31',
        offer_recurring: false,
        selected_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        hours_open: '07:30',
        hours_close: '17:30',
        special_hours_notes: 'Saturday drop-off available by appointment (8 AM - 12 PM). Closed Sundays.',
        tagline: 'Honest service. Fair prices. Every time.',
        description: 'Family-owned since 2005, Peachtree Auto Repair provides full-service automotive care including oil changes, brake repair, engine diagnostics, and state inspections. ASE-certified technicians you can trust.',
        social_facebook: 'https://facebook.com/peachtreeautorepair',
        social_instagram: null,
        social_tiktok: null,
        social_x: null,
      },
    },
    {
      name: 'Buckhead Dental Arts',
      email: 'front@buckheaddental.com',
      phone: '(404) 555-0606',
      website: 'buckheaddental.com',
      city_id: '00000000-0000-0000-0000-200000000001',
      category: 'Healthcare / Dental',
      brand: 'localvip',
      stage: 'contacted',
      source: 'Referral',
      status: 'active',
      address: '3200 Lenox Rd, Atlanta, GA 30326',
      owner_id: alexOwnerId,
      metadata: {
        logo_url: null,
        offer_title: 'Free Teeth Whitening with New Patient Exam',
        offer_description: 'New patients receive a complimentary take-home whitening kit after completing their first exam and cleaning. Professional-grade results in the comfort of your home.',
        offer_category: 'healthcare',
        offer_value: 'Free whitening kit ($199 value)',
        offer_terms: 'New patients only. Must complete exam and cleaning ($149 without insurance). Whitening kit dispensed at follow-up visit. Show LocalVIP pass at check-in.',
        offer_start_date: '2026-05-01',
        offer_end_date: '2026-11-30',
        offer_recurring: false,
        selected_days: ['monday', 'tuesday', 'wednesday', 'thursday'],
        hours_open: '08:00',
        hours_close: '17:00',
        special_hours_notes: 'Early morning appointments available Tuesdays at 7:00 AM. Friday hours 8:00 AM - 1:00 PM.',
        tagline: 'Your smile, our passion.',
        description: 'Buckhead Dental Arts combines modern technology with personalized care. We offer general dentistry, cosmetic procedures, Invisalign, and same-day crowns in a spa-like environment.',
        social_facebook: 'https://facebook.com/buckheaddentalarts',
        social_instagram: 'https://instagram.com/buckheaddentalarts',
        social_tiktok: null,
        social_x: 'https://x.com/buckheaddental',
      },
    },
  ], { onConflict: 'id' })
  console.log('  Created 5 businesses with metadata')

  // 7. Create sample causes
  console.log('Creating causes...')
  await supabase.from('causes').upsert([
    { name: 'MLK Elementary School', type: 'school', organization_id: '00000000-0000-0000-0000-100000000001', city_id: '00000000-0000-0000-0000-200000000001', brand: 'hato', stage: 'in_progress', source: 'Direct', status: 'active' },
    { name: 'Community Strong Foundation', type: 'nonprofit', organization_id: '00000000-0000-0000-0000-100000000002', city_id: '00000000-0000-0000-0000-200000000001', brand: 'localvip', stage: 'onboarded', source: 'Direct', status: 'active' },
    { name: 'Grace Community Church', type: 'church', organization_id: '00000000-0000-0000-0000-100000000003', city_id: '00000000-0000-0000-0000-200000000001', brand: 'localvip', stage: 'interested', source: 'Referral', status: 'active' },
  ], { onConflict: 'id' })
  console.log('  Created 3 causes')

  // 8. Create tags
  console.log('Creating tags...')
  await supabase.from('tags').upsert([
    { name: 'priority', category: 'internal' },
    { name: 'featured', category: 'internal' },
    { name: 'restaurant', category: 'business' },
    { name: 'retail', category: 'business' },
    { name: 'service', category: 'business' },
    { name: 'k12', category: 'cause' },
    { name: 'nonprofit', category: 'cause' },
    { name: 'church', category: 'cause' },
  ], { onConflict: 'id' })
  console.log('  Created 8 tags')

  console.log('\nSeed complete!')
  console.log('\nDemo accounts (password: demo1234):')
  demoUsers.forEach(u => console.log(`  ${u.email} — ${u.role}`))
}

seed().catch(console.error)
